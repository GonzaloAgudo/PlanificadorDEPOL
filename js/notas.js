import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, query, where, getDocs, 
    doc, updateDoc, deleteDoc, onSnapshot, orderBy, limit, writeBatch 
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
const backToListBtn = document.getElementById('back-to-list-btn');
const notesAppContainer = document.querySelector('.notes-app');

let currentNoteId = null; 
let sortableInstance = null; // Para controlar la librería de arrastrar

// --- 1. Cargar Pestañas (Ordenadas por 'orden') ---
function loadCategories() {
    if (!auth.currentUser) return;

    // IMPORTANTE: Si la consola te pide crear un índice, haz clic en el enlace que te da.
    const q = query(
        collection(db, "bloc_notas"),
        where("user_id", "==", auth.currentUser.uid),
        orderBy("orden", "asc") 
    );

    onSnapshot(q, (snapshot) => {
        categoriesList.innerHTML = "";
        
        if(snapshot.empty) {
            statusMsg.textContent = "Crea tu primer cuaderno (+)";
        }

        snapshot.forEach((docSnap) => {
            const note = docSnap.data();
            const li = document.createElement('li');
            li.className = `category-item ${docSnap.id === currentNoteId ? 'active' : ''}`;
            li.setAttribute('data-id', docSnap.id); // Guardamos ID para el reordenamiento
            li.innerHTML = `
                <span class="drag-handle">⋮⋮</span> 
                <span class="cat-title">${note.titulo}</span>
                <button class="delete-cat-btn" title="Borrar cuaderno">×</button>
            `;
            
            // Click para abrir nota
            li.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-cat-btn')) return;
                // Evitar abrir si estamos arrastrando (Sortable lo maneja, pero por seguridad)
                openNote(docSnap.id, note);
            });

            // Click para borrar
            li.querySelector('.delete-cat-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteNote(docSnap.id, note.titulo);
            });

            categoriesList.appendChild(li);
        });

        // Inicializar o refrescar la capacidad de arrastrar
        initSortable();
    });
}

// --- Función para activar el arrastre ---
function initSortable() {
    // Si ya existe, no lo recreamos
    if (sortableInstance) return; 

    if (typeof Sortable !== 'undefined') {
        sortableInstance = new Sortable(categoriesList, {
            animation: 150,
            
            // --- CONFIGURACIÓN PARA MÓVIL ---
            delay: 200,             // Mantener pulsado 200ms para activar el arrastre
            delayOnTouchOnly: true, // En el PC sigue siendo instantáneo
            touchStartThreshold: 3, // Pequeña tolerancia al movimiento del dedo
            // -------------------------------

            onEnd: function (evt) {
                const itemIds = Array.from(categoriesList.querySelectorAll('.category-item')).map(el => el.dataset.id);
                saveCategoryOrder(itemIds);
            }
        });
    }
}
// --- Guardar el nuevo orden en Firebase (Batch) ---
async function saveCategoryOrder(ids) {
    if (!auth.currentUser) return;
    try {
        const batch = writeBatch(db);
        ids.forEach((id, index) => {
            const docRef = doc(db, "bloc_notas", id);
            batch.update(docRef, { orden: index + 1 });
        });
        await batch.commit();
        // No mostramos mensaje para no molestar, es un guardado silencioso
    } catch (error) {
        console.error("Error reordenando:", error);
    }
}

// --- 2. Crear Nueva Pestaña (Calculando orden) ---
async function createNewCategory() {
    const titulo = prompt("Nombre de la nueva asignatura/cuaderno:");
    if (!titulo || titulo.trim() === "") return;

    try {
        // 1. Buscar cuál es el orden más alto actual para poner la nueva al final
        const qOrder = query(
            collection(db, "bloc_notas"),
            where("user_id", "==", auth.currentUser.uid),
            orderBy("orden", "desc"),
            limit(1)
        );
        const snapOrder = await getDocs(qOrder);
        const newOrder = snapOrder.empty ? 1 : snapOrder.docs[0].data().orden + 1;

        // 2. Crear el documento
        const docRef = await addDoc(collection(db, "bloc_notas"), {
            user_id: auth.currentUser.uid,
            titulo: titulo.trim(),
            contenido: "", 
            updatedAt: new Date(),
            orden: newOrder // Guardamos el orden
        });

        // 3. Abrir inmediatamente
        currentNoteId = docRef.id;
        noteTitleInput.value = titulo;
        quill.setText('');
        quill.enable(true);
        
        statusMsg.textContent = "Cuaderno creado.";
        saveNoteBtn.style.backgroundColor = ""; 
    } catch (error) {
        console.error("Error creando nota:", error);
        alert("Error al crear. Revisa la consola (posible falta de índice).");
    }
}

// --- 3. Abrir una Nota ---
function openNote(id, data) {
    currentNoteId = id;
    
    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
    // Marcar visualmente la seleccionada buscando por ID
    const activeItem = document.querySelector(`.category-item[data-id="${id}"]`);
    if(activeItem) activeItem.classList.add('active');
    
    noteTitleInput.value = data.titulo;
    noteTitleInput.readOnly = false; 
    
    if (data.contenido) {
        quill.root.innerHTML = data.contenido;
    } else {
        quill.setText('');
    }
    
    quill.enable(true);
    statusMsg.textContent = "Nota cargada.";
    saveNoteBtn.style.backgroundColor = "";
    
    if (window.innerWidth <= 768) {
        notesAppContainer.classList.add('mobile-view-editor');
    }
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
        saveNoteBtn.style.backgroundColor = ""; 
        
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
if(backToListBtn) {
    backToListBtn.addEventListener('click', () => {
        // Quitar la clase para volver a ver la lista
        notesAppContainer.classList.remove('mobile-view-editor');
        
        // Opcional: Guardar al salir si quieres
        // if (saveNoteBtn.style.backgroundColor) saveCurrentNote();
    });
}

// Visual: Cambios sin guardar
quill.on('text-change', (delta, oldDelta, source) => {
    if (!currentNoteId) return;
    if (source === 'user') { 
        statusMsg.textContent = "Cambios sin guardar ⚠️";
        saveNoteBtn.style.backgroundColor = "#fd7e14"; 
    }
});

noteTitleInput.addEventListener('input', () => {
    if (!currentNoteId) return;
    statusMsg.textContent = "Cambios sin guardar ⚠️";
    saveNoteBtn.style.backgroundColor = "#fd7e14"; 
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