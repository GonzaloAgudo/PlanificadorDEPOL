import { db, auth } from './firebase-config.js';
import { 
    collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, limit, startAfter, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { deleteUser } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Paleta de colores
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

document.addEventListener('DOMContentLoaded', () => {

    // --- REFERENCIAS DOM ---
    const settingsMenu = document.getElementById('settings-menu');
    const sections = document.querySelectorAll('.settings-section');
    
    // CORRECCIÓN AQUÍ: Seleccionamos la nueva clase y solo los que tengan data-target
    const optionBtns = document.querySelectorAll('.settings-nav-btn[data-target]');
    
    const backBtns = document.querySelectorAll('.back-btn');
    const deleteAccountBtn = document.getElementById('btn-delete-account');

    // Referencias Reglas
    const paletteContainer = document.getElementById('color-palette');
    const rulesList = document.getElementById('rules-list');
    const ruleForm = document.getElementById('rule-form');
    const ruleFormTitle = document.getElementById('form-title');
    const keywordInput = document.getElementById('keyword-input');
    const bgColorInput = document.getElementById('bg-color-input');
    const borderColorInput = document.getElementById('border-color-input');
    const ruleIdInput = document.getElementById('rule-id-input');
    const saveRuleBtn = document.getElementById('save-rule-btn');
    const cancelRuleEditBtn = document.getElementById('cancel-edit-btn');
    const ruleErrorMsg = document.getElementById('rule-error-message');
    
    // Referencias Historial
    const sessionsList = document.getElementById('sessions-list');
    const loadMoreBtn = document.getElementById('load-more-sessions');
    const sessionForm = document.getElementById('session-form');
    const sessionIdInput = document.getElementById('session-id-input');
    const sessionDateInput = document.getElementById('session-date-input');
    const sessionDurationInput = document.getElementById('session-duration-input');
    const sessionTypeInput = document.getElementById('session-type-input');
    const sessionTopicInput = document.getElementById('session-topic-input');
    const cancelSessionBtn = document.getElementById('cancel-session-btn');

    let selectedColorElement = null;
    let lastVisibleSession = null;
    const SESSIONS_PER_PAGE = 15;

    // ==========================================
    // 1. NAVEGACIÓN DEL MENÚ
    // ==========================================
    
    // Abrir sección
    optionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target; // Esto lee el data-target="section-rules" del HTML
            if (targetId) {
                settingsMenu.style.display = 'none';
                
                const targetSection = document.getElementById(targetId);
                if(targetSection) {
                    targetSection.style.display = 'block';

                    // Cargar datos si es la primera vez
                    if (targetId === 'section-history' && sessionsList.children.length === 0) {
                        loadHistory();
                    } else if (targetId === 'section-rules' && rulesList.children.length === 0) {
                        loadRules();
                    }
                }
            }
        });
    });

    // Volver al menú
    backBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sections.forEach(s => s.style.display = 'none');
            settingsMenu.style.display = 'block'; // Volvemos a mostrar el menú principal (si usas block o flex depende de tu CSS general, block suele ir bien aquí)
        });
    });

    // ==========================================
    // 2. ELIMINAR CUENTA
    // ==========================================
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async () => {
            const confirm1 = confirm("⚠️ ¿ESTÁS SEGURO?\n\nEsta acción eliminará tu cuenta permanentemente. No se puede deshacer.");
            if (!confirm1) return;

            const confirm2 = confirm("⚠️ Último aviso.\n\nTodos tus datos (tareas, tiempos, estadísticas) se perderán.\n\n¿Confirmar eliminación?");
            if (!confirm2) return;

            const user = auth.currentUser;
            if (user) {
                try {
                    await deleteUser(user);
                    alert("Tu cuenta ha sido eliminada.");
                    window.location.href = "login.html";
                } catch (error) {
                    console.error("Error borrando usuario:", error);
                    if (error.code === 'auth/requires-recent-login') {
                        alert("Por seguridad, necesitas iniciar sesión de nuevo antes de eliminar tu cuenta. Por favor, sal y vuelve a entrar.");
                        // Opcional: forzar logout aquí
                    } else {
                        alert("Error al eliminar cuenta: " + error.message);
                    }
                }
            }
        });
    }

    // ==========================================
    // 3. LÓGICA DE REGLAS DE COLOR (Igual que antes)
    // ==========================================
    function renderPalette() {
        if(!paletteContainer) return; // Seguridad por si cambia el HTML
        paletteContainer.innerHTML = '';
        Object.entries(PALETTE).forEach(([name, [bg, border]]) => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = bg;
            swatch.style.borderColor = border;
            swatch.addEventListener('click', () => {
                if (selectedColorElement) selectedColorElement.classList.remove('selected');
                swatch.classList.add('selected');
                selectedColorElement = swatch;
                bgColorInput.value = bg;
                borderColorInput.value = border;
            });
            paletteContainer.appendChild(swatch);
        });
    }

    function renderRule(ruleDoc) {
        const rule = ruleDoc.data();
        const li = document.createElement('li');
        li.className = 'rule-item';
        li.innerHTML = `
            <span class="rule-swatch" style="background-color: ${rule.bg_color}; border-color: ${rule.border_color};"></span>
            <span class="rule-keyword">${rule.keyword}</span>
            <div class="rule-actions">
                <button class="edit-btn">✏️</button>
                <button class="delete-btn">🗑️</button>
            </div>
        `;
        li.querySelector('.edit-btn').addEventListener('click', () => populateRuleForm(ruleDoc));
        li.querySelector('.delete-btn').addEventListener('click', () => deleteRule(ruleDoc.id));
        rulesList.appendChild(li);
    }

    async function loadRules() {
        if (!auth.currentUser) return;
        rulesList.innerHTML = 'Cargando...'; 
        const q = query(collection(db, "color_rules"), where("user_id", "==", auth.currentUser.uid), orderBy("keyword"));
        const querySnapshot = await getDocs(q);
        rulesList.innerHTML = ''; 
        querySnapshot.forEach(doc => renderRule(doc));
    }

    if(ruleForm) {
        ruleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            ruleErrorMsg.textContent = '';
            if (!auth.currentUser) return;

            const ruleData = {
                keyword: keywordInput.value.trim(),
                bg_color: bgColorInput.value,
                border_color: borderColorInput.value,
                user_id: auth.currentUser.uid
            };
            
            if (!ruleData.keyword || !ruleData.bg_color) {
                ruleErrorMsg.textContent = 'Faltan datos.';
                return;
            }

            try {
                if (ruleIdInput.value) {
                    await updateDoc(doc(db, "color_rules", ruleIdInput.value), ruleData);
                } else {
                    await addDoc(collection(db, "color_rules"), ruleData);
                }
                // Recargar reglas manualmente en lugar de recargar página
                loadRules();
                resetForm();
            } catch (error) {
                console.error(error);
                ruleErrorMsg.textContent = 'Error al guardar.';
            }
        });
    }

    async function deleteRule(id) {
        if (!confirm('¿Borrar regla?')) return;
        try {
            await deleteDoc(doc(db, "color_rules", id));
            loadRules();
        } catch (e) { alert('Error al borrar.'); }
    }

    function populateRuleForm(ruleDoc) {
        const rule = ruleDoc.data();
        ruleFormTitle.textContent = 'Editar Regla';
        ruleIdInput.value = ruleDoc.id;
        keywordInput.value = rule.keyword;
        bgColorInput.value = rule.bg_color;
        borderColorInput.value = rule.border_color;
        
        if (selectedColorElement) selectedColorElement.classList.remove('selected');
        Array.from(paletteContainer.children).forEach(swatch => {
            if(swatch.style.backgroundColor === rule.bg_color) {
                swatch.classList.add('selected');
                selectedColorElement = swatch;
            }
        });
        
        saveRuleBtn.textContent = 'Actualizar';
        cancelRuleEditBtn.style.display = 'inline-block';
        ruleForm.scrollIntoView({ behavior: 'smooth' });
    }

    function resetForm() {
        ruleFormTitle.textContent = 'Añadir Nueva Regla';
        ruleIdInput.value = '';
        keywordInput.value = '';
        bgColorInput.value = '';
        borderColorInput.value = '';
        if (selectedColorElement) {
            selectedColorElement.classList.remove('selected');
            selectedColorElement = null;
        }
        saveRuleBtn.textContent = 'Guardar';
        cancelRuleEditBtn.style.display = 'none';
        ruleErrorMsg.textContent = '';
    }

    if(cancelRuleEditBtn) cancelRuleEditBtn.addEventListener('click', resetForm);


    // ==========================================
    // 4. LÓGICA DE HISTORIAL DE SESIONES
    // ==========================================
    async function loadHistory(isNextPage = false) {
        if (!auth.currentUser) return;
        
        if (!isNextPage) {
            sessionsList.innerHTML = '';
            lastVisibleSession = null;
        }

        let q = query(
            collection(db, "sesiones_estudio"),
            where("user_id", "==", auth.currentUser.uid),
            orderBy("fecha_sesion", "desc"),
            limit(SESSIONS_PER_PAGE)
        );

        if (isNextPage && lastVisibleSession) {
            q = query(q, startAfter(lastVisibleSession));
        }

        try {
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                if(!isNextPage) sessionsList.innerHTML = '<p style="padding:1rem; text-align:center; color:#888;">No hay sesiones.</p>';
                loadMoreBtn.style.display = 'none';
                return;
            }

            lastVisibleSession = snapshot.docs[snapshot.docs.length - 1];
            loadMoreBtn.style.display = snapshot.size < SESSIONS_PER_PAGE ? 'none' : 'block';

            snapshot.forEach(doc => {
                const s = doc.data();
                const date = s.fecha_sesion.toDate();
                
                // --- NUEVA LÓGICA VISUAL PARA EL HISTORIAL ---
                let tipoVisual = s.tipo; // Por defecto el que viene de la BD
                const temaTexto = (s.tema || '').toLowerCase().trim();
                
                // Si el tema empieza por test/examen, forzamos visualmente 'test'
                if (temaTexto.startsWith('test') || temaTexto.startsWith('examen')) {
                    tipoVisual = 'test';
                }
                // ---------------------------------------------

                const li = document.createElement('li');
                li.className = 'history-item';
                
                // Nota: Asegúrate de tener CSS para .history-badge.test (te lo pongo abajo)
                li.innerHTML = `
                    <div class="history-info">
                        <span class="history-date">${date.toLocaleString()}</span>
                        <div class="history-title">
                            <span class="history-badge ${tipoVisual}">${tipoVisual.toUpperCase()}</span>
                            ${s.tema || 'Sin tema'}
                        </div>
                    </div>
                    <div class="history-duration">${s.duracion_minutos} min</div>
                    <div class="rule-actions">
                        <button class="edit-btn">✏️</button>
                        <button class="delete-btn">🗑️</button>
                    </div>
                `;
                li.querySelector('.edit-btn').addEventListener('click', () => editSession(doc));
                li.querySelector('.delete-btn').addEventListener('click', () => deleteSession(doc.id));
                sessionsList.appendChild(li);
            });
        } catch (error) {
            console.error("Error historial:", error);
            if(error.message.includes("index")) alert("Falta el índice para historial. Mira la consola.");
        }
    }

    if(loadMoreBtn) loadMoreBtn.addEventListener('click', () => loadHistory(true));

    function editSession(docSnap) {
        const s = docSnap.data();
        const date = s.fecha_sesion.toDate();
        const tzOffset = date.getTimezoneOffset() * 60000; 
        const localISOTime = (new Date(date - tzOffset)).toISOString().slice(0, 16);

        sessionIdInput.value = docSnap.id;
        sessionDateInput.value = localISOTime;
        sessionDurationInput.value = s.duracion_minutos;
        sessionTypeInput.value = s.tipo;
        sessionTopicInput.value = s.tema || '';

        sessionForm.style.display = 'block';
        sessionForm.scrollIntoView({ behavior: 'smooth' });
    }

    if(sessionForm) {
        sessionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = sessionIdInput.value;
            if(!id) return;

            try {
                await updateDoc(doc(db, "sesiones_estudio", id), {
                    fecha_sesion: Timestamp.fromDate(new Date(sessionDateInput.value)),
                    duracion_minutos: parseInt(sessionDurationInput.value),
                    tipo: sessionTypeInput.value,
                    tema: sessionTopicInput.value.trim()
                });
                alert('Sesión actualizada');
                sessionForm.style.display = 'none';
                loadHistory(false); 
            } catch(e) {
                console.error(e);
                alert('Error al actualizar');
            }
        });
    }

    async function deleteSession(id) {
        if(!confirm("¿Borrar esta sesión para siempre?")) return;
        try {
            await deleteDoc(doc(db, "sesiones_estudio", id));
            loadHistory(false);
        } catch(e) { alert('Error al borrar'); }
    }

    if(cancelSessionBtn) {
        cancelSessionBtn.addEventListener('click', () => {
            sessionForm.style.display = 'none';
        });
    }

    // Inicializar
    renderPalette();
    auth.onAuthStateChanged(user => {
        // Ya no cargamos nada automáticamente, esperamos al click del menú
    });
});