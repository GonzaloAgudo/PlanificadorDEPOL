import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, query, where, getDocs, 
    doc, updateDoc, deleteDoc, onSnapshot, orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Inicializar Quill (Editor de texto)
const quill = new Quill('#editor', {
    theme: 'snow',
    placeholder: 'Escribe tus apuntes aquí...',
    modules: {
        toolbar: [
            [{ 'header': [1, 2, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'color': [] }, { 'background': [] }],
            ['clean']
        ]
    }
});

// Referencias DOM
const categoriesList = document.getElementById('categories-list');
const addCategoryBtn = document.getElementById('add-category-btn');
const noteTitleInput = document.getElementById('note-title');
const saveNoteBtn = document.getElementById('save-note-btn');
const deleteNoteBtn = document.getElementById('delete-note-btn');
const statusMsg = document.getElementById('status-msg');

let currentNoteId = null; 

// --- 1. Cargar Pestañas (Categorías) ---
function loadCategories() {
    if (!auth.currentUser) return;

    const q = query(
        collection(db, "bloc_notas"),
        where("user_id", "==", auth.currentUser.uid)
        // orderBy("titulo", "asc") // Descomenta esto si ya creaste el índice
    );

    // Escucha en tiempo real
    onSnapshot(q, (snapshot) => {
        categoriesList.innerHTML = "";
        
        if(snapshot.empty) {
            statusMsg.textContent = "Crea tu primer cuaderno (+)";
        }

        snapshot.forEach((docSnap) => {
            const note = docSnap.data();
            const li = document.createElement('li');
            li.className = `category-item ${docSnap.id === currentNoteId ? 'active' : ''}`;
            li.innerHTML = `
                <span>${note.titulo}</span>
                <button class="delete-cat-btn" title="Borrar cuaderno">×</button>
            `;
            
            // Click para abrir nota
            li.addEventListener('click', (e) => {
                // Si pulsas borrar, no abrimos la nota
                if (e.target.classList.contains('delete-cat-btn')) return;
                
                // PEQUEÑA PROTECCIÓN: Si hay cambios sin guardar, podrías añadir un confirm aquí
                // if (saveNoteBtn.style.backgroundColor === "rgb(253, 126, 20)") ...
                
                openNote(docSnap.id, note);
            });

            // Click para borrar
            li.querySelector('.delete-cat-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteNote(docSnap.id, note.titulo);
            });

            categoriesList.appendChild(li);
        });
    });
}

// --- 2. Crear Nueva Pestaña ---
async function createNewCategory() {
    const titulo = prompt("Nombre de la nueva asignatura/cuaderno:");
    if (!titulo || titulo.trim() === "") return;

    try {
        const docRef = await addDoc(collection(db, "bloc_notas"), {
            user_id: auth.currentUser.uid,
            titulo: titulo.trim(),
            contenido: "", 
            updatedAt: new Date()
        });
        // Al crear, abrimos inmediatamente
        currentNoteId = docRef.id;
        noteTitleInput.value = titulo;
        quill.setText('');
        quill.enable(true);
        
        // Resetear estado visual
        statusMsg.textContent = "Cuaderno creado.";
        saveNoteBtn.style.backgroundColor = ""; 
    } catch (error) {
        console.error("Error creando nota:", error);
        alert("Error al crear.");
    }
}

// --- 3. Abrir una Nota ---
function openNote(id, data) {
    currentNoteId = id;
    
    // Actualizar UI visual de selección
    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
    
    noteTitleInput.value = data.titulo;
    noteTitleInput.readOnly = false; 
    
    // Cargar contenido en Quill sin disparar evento de cambio de usuario
    if (data.contenido) {
        quill.root.innerHTML = data.contenido;
    } else {
        quill.setText('');
    }
    
    quill.enable(true);
    
    // Resetear avisos de "sin guardar"
    statusMsg.textContent = "Nota cargada.";
    saveNoteBtn.style.backgroundColor = ""; // Volver a color original (verde/azul)
}

// --- 4. Guardar Nota (MANUAL) ---
async function saveCurrentNote() {
    if (!currentNoteId || !auth.currentUser) return;

    const content = quill.root.innerHTML;
    const title = noteTitleInput.value;

    statusMsg.textContent = "Guardando...";
    saveNoteBtn.textContent = "Guardando...";
    
    try {
        await updateDoc(doc(db, "bloc_notas", currentNoteId), {
            titulo: title,
            contenido: content,
            updatedAt: new Date()
        });
        
        statusMsg.textContent = "Guardado exitoso ✓";
        saveNoteBtn.textContent = "Guardar";
        saveNoteBtn.style.backgroundColor = ""; // Quitar color de alerta (Naranja)
        
        setTimeout(() => statusMsg.textContent = "", 2000);
    } catch (error) {
        console.error(error);
        statusMsg.textContent = "Error al guardar ❌";
        saveNoteBtn.textContent = "Reintentar";
    }
}

// --- 5. Borrar Nota ---
async function deleteNote(id, title) {
    if (!confirm(`¿Borrar el cuaderno "${title}" y todo su contenido?`)) return;

    try {
        await deleteDoc(doc(db, "bloc_notas", id));
        if (currentNoteId === id) {
            resetEditor();
        }
        alert("Borrado.");
    } catch (error) {
        console.error(error);
        alert("Error al borrar.");
    }
}

function resetEditor() {
    currentNoteId = null;
    noteTitleInput.value = "";
    noteTitleInput.placeholder = "Selecciona o crea un cuaderno...";
    noteTitleInput.readOnly = true;
    quill.setText('');
    quill.enable(false); 
    statusMsg.textContent = "";
    saveNoteBtn.style.backgroundColor = "";
}

// --- Event Listeners ---

addCategoryBtn.addEventListener('click', createNewCategory);
saveNoteBtn.addEventListener('click', saveCurrentNote);
deleteNoteBtn.addEventListener('click', () => {
    if(currentNoteId) deleteNote(currentNoteId, noteTitleInput.value);
});

// --- MODIFICADO: DETECTAR CAMBIOS PERO NO GUARDAR ---
// Si escribes, te avisa visualmente
quill.on('text-change', (delta, oldDelta, source) => {
    if (!currentNoteId) return;
    if (source === 'user') { 
        statusMsg.textContent = "Cambios sin guardar ⚠️";
        saveNoteBtn.style.backgroundColor = "#fd7e14"; // Naranja para avisar
    }
});

// Si cambias el título, te avisa visualmente
noteTitleInput.addEventListener('input', () => {
    if (!currentNoteId) return;
    statusMsg.textContent = "Cambios sin guardar ⚠️";
    saveNoteBtn.style.backgroundColor = "#fd7e14"; // Naranja para avisar
});

// Inicialización
quill.enable(false); 
auth.onAuthStateChanged(user => {
    if (user) {
        loadCategories();
    } else {
        categoriesList.innerHTML = "";
        resetEditor();
    }
});