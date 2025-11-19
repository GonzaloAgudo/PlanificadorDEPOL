// Importa las funciones de DB y Auth
import { db, auth } from './firebase-config.js';
// Importa todas las funciones de Firestore que necesitamos
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Paleta de 10 colores pastel [bg_color, border_color]
const PALETTE = {
    verde: ['#e6f7e9', '#6fbf7b'],
    azul: ['#e0f1fb', '#5d9cec'],
    naranja: ['#fef3e5', '#f6a623'],
    violeta: ['#f0e6fa', '#a787d9'],
    rojo: ['#fde8e8', '#e57373'],
    cyan: ['#e0f7fa', '#4dd0e1'],
    lima: ['#f9fbe7', '#d4e157'],
    rosa: ['#fce4ec', '#ec407a'],
    indigo: ['#e8eaf6', '#7986cb'],
    gris: ['#f5f5f5', '#bdbdbd']
};

// Referencias al DOM
const paletteContainer = document.getElementById('color-palette');
const rulesList = document.getElementById('rules-list');
const form = document.getElementById('rule-form');
const formTitle = document.getElementById('form-title');
const keywordInput = document.getElementById('keyword-input');
const bgColorInput = document.getElementById('bg-color-input');
const borderColorInput = document.getElementById('border-color-input');
const ruleIdInput = document.getElementById('rule-id-input');
const saveRuleBtn = document.getElementById('save-rule-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const errorMessage = document.getElementById('rule-error-message');

let selectedColorElement = null;

// 1. Dibujar la paleta de colores (sin cambios)
function renderPalette() {
    paletteContainer.innerHTML = '';
    Object.entries(PALETTE).forEach(([name, [bg, border]]) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = bg;
        swatch.style.borderColor = border;
        swatch.dataset.bg = bg;
        swatch.dataset.border = border;
        
        swatch.addEventListener('click', () => {
            if (selectedColorElement) {
                selectedColorElement.classList.remove('selected');
            }
            swatch.classList.add('selected');
            selectedColorElement = swatch;
            bgColorInput.value = bg;
            borderColorInput.value = border;
        });
        paletteContainer.appendChild(swatch);
    });
}

// 2. Dibujar una regla en la lista (Ahora recibe un 'doc' de Firebase)
function renderRule(ruleDoc) {
    const rule = ruleDoc.data(); // Obtiene los datos
    const li = document.createElement('li');
    li.className = 'rule-item';
    li.setAttribute('data-id', ruleDoc.id); // Usa el ID del documento
    
    li.innerHTML = `
        <span class="rule-swatch" style="background-color: ${rule.bg_color}; border-color: ${rule.border_color};"></span>
        <span class="rule-keyword">${rule.keyword}</span>
        <div class="rule-actions">
            <button class="edit-btn">✏️</button>
            <button class="delete-btn">🗑️</button>
        </div>
    `;

    // Pasa el 'doc' completo a las funciones de edición/borrado
    li.querySelector('.edit-btn').addEventListener('click', () => populateFormForEdit(ruleDoc));
    li.querySelector('.delete-btn').addEventListener('click', () => deleteRule(ruleDoc.id));
    
    rulesList.appendChild(li);
}

// 3. Cargar todas las reglas de Firestore
async function loadRules() {
    if (!auth.currentUser) return; // Asegurarse de que el usuario está logueado
    
    rulesList.innerHTML = 'Cargando reglas...'; 
    
    const q = query(
        collection(db, "color_rules"), 
        where("user_id", "==", auth.currentUser.uid),
        orderBy("keyword") // Ordena alfabéticamente
    );
    
    const querySnapshot = await getDocs(q);
    rulesList.innerHTML = ''; // Limpiar
    querySnapshot.forEach(doc => renderRule(doc));
}

// 4. Lógica del Formulario (Añadir o Editar)
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.textContent = '';
    if (!auth.currentUser) return;

    const ruleData = {
        keyword: keywordInput.value.trim(),
        bg_color: bgColorInput.value,
        border_color: borderColorInput.value,
        user_id: auth.currentUser.uid // ¡Importante!
    };
    
    const ruleId = ruleIdInput.value;

    if (!ruleData.keyword || !ruleData.bg_color) {
        errorMessage.textContent = 'Por favor, escribe una palabra clave y elige un color.';
        return;
    }

    try {
        if (ruleId) {
            // --- MODO EDICIÓN ---
            const docRef = doc(db, "color_rules", ruleId);
            await updateDoc(docRef, {
                keyword: ruleData.keyword,
                bg_color: ruleData.bg_color,
                border_color: ruleData.border_color
            });
        } else {
            // --- MODO AÑADIR ---
            await addDoc(collection(db, "color_rules"), ruleData);
        }
        
        location.reload(); // Recarga la página como pediste
    } catch (error) {
        console.error("Error al guardar regla: ", error);
        errorMessage.textContent = 'Error de red. Inténtalo de nuevo.';
    }
});

// 5. Borrar una regla
async function deleteRule(id) {
    if (!confirm('¿Seguro que quieres eliminar esta regla?')) return;

    try {
        const docRef = doc(db, "color_rules", id);
        await deleteDoc(docRef);
        location.reload(); // Recarga la página como pediste
    } catch (error) {
        console.error("Error al borrar regla: ", error);
        alert('Error de red al borrar.');
    }
}

// 6. Funciones de ayuda del formulario
function populateFormForEdit(ruleDoc) {
    const rule = ruleDoc.data();
    formTitle.textContent = 'Editar Regla';
    ruleIdInput.value = ruleDoc.id; // <-- ID del documento
    keywordInput.value = rule.keyword;
    bgColorInput.value = rule.bg_color;
    borderColorInput.value = rule.border_color;
    
    if (selectedColorElement) selectedColorElement.classList.remove('selected');
    const swatch = paletteContainer.querySelector(`[data-bg="${rule.bg_color}"]`);
    if (swatch) {
        swatch.classList.add('selected');
        selectedColorElement = swatch;
    }
    
    saveRuleBtn.textContent = 'Actualizar Regla';
    cancelEditBtn.style.display = 'inline-block';
    window.scrollTo(0, 0); 
}

function resetForm() {
    formTitle.textContent = 'Añadir Nueva Regla';
    ruleIdInput.value = '';
    keywordInput.value = '';
    bgColorInput.value = '';
    borderColorInput.value = '';
    if (selectedColorElement) {
        selectedColorElement.classList.remove('selected');
        selectedColorElement = null;
    }
    saveRuleBtn.textContent = 'Guardar Regla';
    cancelEditBtn.style.display = 'none';
    errorMessage.textContent = '';
}

cancelEditBtn.addEventListener('click', resetForm);

// --- Carga Inicial ---
// Espera a que el "guardia" de autenticación confirme el login
auth.onAuthStateChanged(user => {
    if (user) {
        // Usuario logueado, ahora sí carga todo
        renderPalette();
        loadRules();
    }
});