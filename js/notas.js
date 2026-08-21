import { db, auth } from './firebase-config.js';
import {
    collection, addDoc, query, where, getDocs,
    doc, updateDoc, deleteDoc, onSnapshot, orderBy, limit, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { icon } from './icons.js';

// Inicializar Quill
const quill = new Quill('#editor', {
    theme: 'snow',
    placeholder: 'Escribe tus apuntes aquí...',
    modules: {
        toolbar: [
            [{ 'header': [1, 2, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'color': [] }, { 'background': [] }],
            ['image'], 
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

// Botón flotante de guardado, solo visible en móvil
const FAB_ICON_IDLE = icon('save', 'icon--lg');
const fabSaveBtn = document.createElement('button');
fabSaveBtn.className = 'fab-save-mobile';
fabSaveBtn.title = 'Guardar nota';
fabSaveBtn.setAttribute('aria-label', 'Guardar nota');
fabSaveBtn.innerHTML = FAB_ICON_IDLE;
document.body.appendChild(fabSaveBtn);

let currentNoteId = null; 
let sortableInstance = null; 
let unsavedChanges = false; // Control de cambios sin guardar

// --- 1. PREVENIR RECARGA ACCIDENTAL ---
window.addEventListener('beforeunload', (e) => {
    if (unsavedChanges) {
        // El mensaje estándar lo pone el navegador, pero esto activa el aviso
        e.preventDefault();
        e.returnValue = '';
    }
});

// --- 2. Cargar Pestañas ---
function loadCategories() {
    if (!auth.currentUser) return;

    const q = query(
        collection(db, "bloc_notas"),
        where("user_id", "==", auth.currentUser.uid),
        orderBy("orden", "asc") 
    );

    onSnapshot(q, (snapshot) => {
        categoriesList.innerHTML = "";
        if(snapshot.empty) statusMsg.textContent = "Crea tu primer cuaderno (+)";

        snapshot.forEach((docSnap) => {
            const note = docSnap.data();
            const li = document.createElement('li');
            li.className = `category-item ${docSnap.id === currentNoteId ? 'active' : ''}`;
            li.setAttribute('data-id', docSnap.id); 
            li.innerHTML = `
                <span class="drag-handle" aria-hidden="true">${icon('grip', 'icon--sm')}</span>
                <span class="cat-title">${note.titulo}</span>
                <button class="delete-cat-btn" title="Borrar cuaderno" aria-label="Borrar cuaderno">${icon('trash', 'icon--sm')}</button>
            `;
            
            li.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-cat-btn')) return;
                // Si hay cambios sin guardar, preguntar antes de cambiar de nota
                if(unsavedChanges && !confirm("Tienes cambios sin guardar. ¿Cambiar de nota igualmente?")) return;
                
                openNote(docSnap.id, note);
            });

            li.querySelector('.delete-cat-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteNote(docSnap.id, note.titulo);
            });

            categoriesList.appendChild(li);
        });

        initSortable();
    });
}

function initSortable() {
    if (sortableInstance) return; 
    if (typeof Sortable !== 'undefined') {
        sortableInstance = new Sortable(categoriesList, {
            animation: 150, delay: 200, delayOnTouchOnly: true, touchStartThreshold: 3, 
            onEnd: function (evt) {
                const itemIds = Array.from(categoriesList.querySelectorAll('.category-item')).map(el => el.dataset.id);
                saveCategoryOrder(itemIds);
            }
        });
    }
}

async function saveCategoryOrder(ids) {
    if (!auth.currentUser) return;
    try {
        const batch = writeBatch(db);
        ids.forEach((id, index) => {
            const docRef = doc(db, "bloc_notas", id);
            batch.update(docRef, { orden: index + 1 });
        });
        await batch.commit();
    } catch (error) { console.error("Error reordenando:", error); }
}

async function createNewCategory() {
    const titulo = prompt("Nombre de la nueva asignatura/cuaderno:");
    if (!titulo || titulo.trim() === "") return;

    try {
        const qOrder = query(collection(db, "bloc_notas"), where("user_id", "==", auth.currentUser.uid), orderBy("orden", "desc"), limit(1));
        const snapOrder = await getDocs(qOrder);
        const newOrder = snapOrder.empty ? 1 : snapOrder.docs[0].data().orden + 1;

        const docRef = await addDoc(collection(db, "bloc_notas"), {
            user_id: auth.currentUser.uid, titulo: titulo.trim(), contenido: "", 
            updatedAt: new Date(), orden: newOrder 
        });

        unsavedChanges = false; // Nueva nota empieza limpia
        openNote(docRef.id, { titulo: titulo.trim(), contenido: "" });
        statusMsg.textContent = "Cuaderno creado.";
    } catch (error) { console.error(error); alert("Error al crear."); }
}

// --- 3. ABRIR NOTA (Y GESTIONAR BOTÓN MÓVIL) ---
function openNote(id, data) {
    currentNoteId = id;
    unsavedChanges = false; // Resetear estado al abrir

    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.querySelector(`.category-item[data-id="${id}"]`);
    if(activeItem) activeItem.classList.add('active');
    
    noteTitleInput.value = data.titulo;
    noteTitleInput.readOnly = false; 
    
    if (data.contenido) quill.root.innerHTML = data.contenido;
    else quill.setText('');
    
    quill.enable(true);
    statusMsg.textContent = "Nota cargada.";
    saveNoteBtn.classList.remove('is-dirty');
    
    // MODO MÓVIL
    if (window.innerWidth <= 768) {
        notesAppContainer.classList.add('mobile-view-editor');
        fabSaveBtn.classList.add('visible'); // MOSTRAR BOTÓN FLOTANTE
    }
}

// --- 4. GUARDAR NOTA ---
async function saveCurrentNote() {
    if (!currentNoteId || !auth.currentUser) return;

    const content = quill.root.innerHTML;
    const title = noteTitleInput.value;

    statusMsg.textContent = "Guardando…";
    saveNoteBtn.innerHTML = `${icon('save', 'icon--sm')}Guardando…`;
    saveNoteBtn.disabled = true;

    try {
        await updateDoc(doc(db, "bloc_notas", currentNoteId), {
            titulo: title, contenido: content, updatedAt: new Date()
        });

        statusMsg.textContent = "Guardado";
        saveNoteBtn.innerHTML = `${icon('check', 'icon--sm')}Guardado`;
        saveNoteBtn.classList.remove('is-dirty');
        unsavedChanges = false; // Ya no hay cambios pendientes

        fabSaveBtn.innerHTML = icon('check', 'icon--lg');
        setTimeout(() => {
            statusMsg.textContent = "";
            saveNoteBtn.innerHTML = `${icon('save', 'icon--sm')}Guardar`;
            fabSaveBtn.innerHTML = FAB_ICON_IDLE;
        }, 1500);

    } catch (error) {
        console.error(error);
        if (error.code === 'invalid-argument') alert("La nota es demasiado grande (imágenes).");
        statusMsg.textContent = "No se pudo guardar";
        saveNoteBtn.innerHTML = `${icon('warning', 'icon--sm')}Reintentar`;
        fabSaveBtn.innerHTML = icon('warning', 'icon--lg');
        setTimeout(() => { fabSaveBtn.innerHTML = FAB_ICON_IDLE; }, 2000);
    } finally {
        saveNoteBtn.disabled = false;
    }
}

async function deleteNote(id, title) {
    if (!confirm(`¿Borrar el cuaderno "${title}"?`)) return;
    try {
        await deleteDoc(doc(db, "bloc_notas", id));
        if (currentNoteId === id) resetEditor();
        alert("Borrado.");
    } catch (error) { console.error(error); alert("Error al borrar."); }
}

function resetEditor() {
    currentNoteId = null;
    unsavedChanges = false;
    noteTitleInput.value = "";
    noteTitleInput.placeholder = "Selecciona o crea un cuaderno...";
    noteTitleInput.readOnly = true;
    quill.setText('');
    quill.enable(false); 
    statusMsg.textContent = "";
    saveNoteBtn.classList.remove('is-dirty');
    
    // Salir del modo móvil
    notesAppContainer.classList.remove('mobile-view-editor');
    fabSaveBtn.classList.remove('visible'); // OCULTAR BOTÓN FLOTANTE
}

// --- EVENT LISTENERS ---

addCategoryBtn.addEventListener('click', createNewCategory);
saveNoteBtn.addEventListener('click', saveCurrentNote);
fabSaveBtn.addEventListener('click', saveCurrentNote); // Conectar FAB

deleteNoteBtn.addEventListener('click', () => {
    if(currentNoteId) deleteNote(currentNoteId, noteTitleInput.value);
});

// Botón Atrás (Móvil)
if(backToListBtn) {
    backToListBtn.addEventListener('click', () => {
        // Si hay cambios sin guardar al volver atrás en móvil
        if(unsavedChanges) {
            if(confirm("Tienes cambios sin guardar. ¿Deseas guardar antes de salir?")) {
                saveCurrentNote().then(() => {
                    notesAppContainer.classList.remove('mobile-view-editor');
                    fabSaveBtn.classList.remove('visible');
                });
                return;
            } else {
                // Si dice que no quiere guardar, ¿confirmamos que quiere perderlos?
                if(!confirm("¿Seguro que quieres salir y PERDER los cambios?")) return;
            }
        }
        
        notesAppContainer.classList.remove('mobile-view-editor');
        fabSaveBtn.classList.remove('visible');
    });
}

// DETECCIÓN DE CAMBIOS
function markUnsaved() {
    if (!currentNoteId) return;
    unsavedChanges = true;
    statusMsg.textContent = "Cambios sin guardar";
    saveNoteBtn.classList.add('is-dirty'); 
}

quill.on('text-change', (delta, oldDelta, source) => {
    if (source === 'user') markUnsaved();
});

noteTitleInput.addEventListener('input', markUnsaved);

// Inicialización
quill.enable(false); 
auth.onAuthStateChanged(user => {
    if (user) loadCategories();
    else { categoriesList.innerHTML = ""; resetEditor(); }
});