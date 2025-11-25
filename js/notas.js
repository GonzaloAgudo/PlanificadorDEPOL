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

let currentNoteId = null; // ID del documento actual en Firebase
let typingTimer; // Para autoguardado

// --- 1. Cargar Pestañas (Categorías) ---
function loadCategories() {
    if (!auth.currentUser) return;

    const q = query(
        collection(db, "bloc_notas"),
        where("user_id", "==", auth.currentUser.uid),
        orderBy("titulo", "asc") // Orden alfabético
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
                // Si se pulsó el botón de borrar, no abrimos
                if (e.target.classList.contains('delete-cat-btn')) return;
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
            contenido: "", // Empieza vacío
            updatedAt: new Date()
        });
        // Abrir la nueva nota inmediatamente
        currentNoteId = docRef.id;
        noteTitleInput.value = titulo;
        quill.setText('');
        quill.enable(true);
        statusMsg.textContent = "Cuaderno creado.";
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
    // Buscar el elemento li correspondiente y activarlo (un poco hacky pero funcional con onSnapshot)
    // Al recargar snapshot se pondrá bien solo, esto es para feedback instantáneo si no hay red
    
    noteTitleInput.value = data.titulo;
    noteTitleInput.readOnly = false; // Permitir editar título
    
    // Cargar contenido en Quill
    if (data.contenido) {
        quill.root.innerHTML = data.contenido;
    } else {
        quill.setText('');
    }
    
    quill.enable(true);
    statusMsg.textContent = "Nota cargada.";
}

// --- 4. Guardar Nota ---
async function saveCurrentNote() {
    if (!currentNoteId || !auth.currentUser) return;

    const content = quill.root.innerHTML;
    const title = noteTitleInput.value;

    statusMsg.textContent = "Guardando...";
    
    try {
        await updateDoc(doc(db, "bloc_notas", currentNoteId), {
            titulo: title,
            contenido: content,
            updatedAt: new Date()
        });
        statusMsg.textContent = "Guardado exitoso ✓";
        setTimeout(() => statusMsg.textContent = "", 2000);
    } catch (error) {
        console.error(error);
        statusMsg.textContent = "Error al guardar ❌";
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
    quill.enable(false); // Desactivar editor
    statusMsg.textContent = "";
}

// --- Event Listeners ---

// Crear
addCategoryBtn.addEventListener('click', createNewCategory);

// Guardado Manual
saveNoteBtn.addEventListener('click', saveCurrentNote);

// Borrar Nota Actual (Botón superior)
deleteNoteBtn.addEventListener('click', () => {
    if(currentNoteId) deleteNote(currentNoteId, noteTitleInput.value);
});

// Auto-guardado al escribir (con delay de 2 segundos)
quill.on('text-change', () => {
    if (!currentNoteId) return;
    statusMsg.textContent = "Escribiendo...";
    clearTimeout(typingTimer);
    typingTimer = setTimeout(saveCurrentNote, 2000);
});

// Guardar al cambiar el título
noteTitleInput.addEventListener('input', () => {
    if (!currentNoteId) return;
    clearTimeout(typingTimer);
    typingTimer = setTimeout(saveCurrentNote, 1000);
});

// Inicialización
quill.enable(false); // Desactivado al inicio hasta que selecciones algo
auth.onAuthStateChanged(user => {
    if (user) {
        loadCategories();
    } else {
        categoriesList.innerHTML = "";
        resetEditor();
    }
});