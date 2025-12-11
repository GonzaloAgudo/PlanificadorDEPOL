import { db, auth } from './firebase-config.js';
import { 
    collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, limit, startAfter, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { deleteUser } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- REFERENCIAS DOM ---
    const settingsMenu = document.getElementById('settings-menu');
    const sections = document.querySelectorAll('.settings-section');
    const optionBtns = document.querySelectorAll('.settings-nav-btn[data-target]');
    const backBtns = document.querySelectorAll('.back-btn');
    const deleteAccountBtn = document.getElementById('btn-delete-account');

    // Referencias Reglas
    const quickPaletteContainer = document.getElementById('quick-palette'); // Nuevo contenedor
    const customColorPicker = document.getElementById('custom-color-picker'); // Nuevo picker
    const colorHexDisplay = document.getElementById('color-hex-display');
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

    let lastVisibleSession = null;
    const SESSIONS_PER_PAGE = 15;
    
    // Almacén local de reglas para generar la paleta rápida
    let loadedRules = []; 

    // ==========================================
    // 1. UTILIDADES DE COLOR (NUEVO)
    // ==========================================
    
    // Función para oscurecer un color HEX (para generar el borde)
    function adjustColor(color, amount) {
        return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
    }

    // Al cambiar el picker, actualizamos inputs y borde
    if (customColorPicker) {
        customColorPicker.addEventListener('input', (e) => {
            const hex = e.target.value;
            selectColor(hex);
        });
    }

    function selectColor(hexBg, hexBorder = null) {
        // 1. Actualizar visualmente el picker y texto
        customColorPicker.value = hexBg;
        colorHexDisplay.textContent = hexBg;

        // 2. Calcular borde si no viene dado (oscurecer 20%)
        // Si hexBorder es null, lo generamos restando 40 al valor RGB
        const calculatedBorder = hexBorder ? hexBorder : adjustColor(hexBg, -40);

        // 3. Rellenar inputs ocultos
        bgColorInput.value = hexBg;
        borderColorInput.value = calculatedBorder;
        
        // 4. Feedback visual en paleta rápida (si coincide)
        document.querySelectorAll('.color-swatch').forEach(sw => {
            if (sw.dataset.bg === hexBg) sw.classList.add('selected');
            else sw.classList.remove('selected');
        });
    }

    // Inicializar con un color por defecto
    selectColor('#e6f7e9');


    // ==========================================
    // 2. NAVEGACIÓN
    // ==========================================
    optionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            if (targetId) {
                settingsMenu.style.display = 'none';
                const targetSection = document.getElementById(targetId);
                if(targetSection) {
                    targetSection.style.display = 'block';
                    if (targetId === 'section-history' && sessionsList.children.length === 0) loadHistory();
                    else if (targetId === 'section-rules') loadRules();
                }
            }
        });
    });

    backBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sections.forEach(s => s.style.display = 'none');
            settingsMenu.style.display = 'block';
        });
    });

    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async () => {
            if (!confirm("⚠️ ¿Eliminar cuenta y perder todos los datos?")) return;
            const user = auth.currentUser;
            if (user) {
                try {
                    await deleteUser(user);
                    alert("Cuenta eliminada.");
                    window.location.href = "login.html";
                } catch (error) {
                    alert("Error. Inicia sesión de nuevo e inténtalo.");
                }
            }
        });
    }

    // ==========================================
    // 3. LÓGICA DE REGLAS
    // ==========================================

    function renderQuickPalette() {
        if(!quickPaletteContainer) return;
        quickPaletteContainer.innerHTML = '';
        
        // Extraer colores únicos de las reglas cargadas
        const uniqueColors = new Set();
        const colorsArray = [];

        loadedRules.forEach(rule => {
            const key = rule.bg_color + '|' + rule.border_color;
            if (!uniqueColors.has(key)) {
                uniqueColors.add(key);
                colorsArray.push({ bg: rule.bg_color, border: rule.border_color });
            }
        });

        if (colorsArray.length === 0) {
            quickPaletteContainer.innerHTML = '<p style="font-size:0.8rem; color:#888;">No hay colores guardados aún.</p>';
            return;
        }

        colorsArray.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color.bg;
            swatch.style.borderColor = color.border;
            swatch.dataset.bg = color.bg; // Para identificarlo
            
            swatch.addEventListener('click', () => {
                selectColor(color.bg, color.border);
            });
            quickPaletteContainer.appendChild(swatch);
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
        loadedRules = []; // Resetear cache local

        querySnapshot.forEach(doc => {
            loadedRules.push(doc.data()); // Guardar datos para la paleta
            renderRule(doc);
        });

        // Generar la paleta de acceso rápido con lo que acabamos de cargar
        renderQuickPalette();
    }

    if(ruleForm) {
        ruleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorDiv = document.getElementById('rule-error-message');
            if(errorDiv) errorDiv.textContent = '';
            
            if (!auth.currentUser) return;

            const ruleData = {
                keyword: keywordInput.value.trim(),
                bg_color: bgColorInput.value,
                border_color: borderColorInput.value,
                user_id: auth.currentUser.uid
            };
            
            if (!ruleData.keyword || !ruleData.bg_color) {
                if(errorDiv) errorDiv.textContent = 'Faltan datos.';
                return;
            }

            try {
                if (ruleIdInput.value) {
                    await updateDoc(doc(db, "color_rules", ruleIdInput.value), ruleData);
                } else {
                    await addDoc(collection(db, "color_rules"), ruleData);
                }
                loadRules(); // Recargar lista y paleta
                resetForm();
            } catch (error) {
                console.error(error);
                if(errorDiv) errorDiv.textContent = 'Error al guardar.';
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
        
        // Usar nuestra nueva función para setear el color en los inputs y el picker
        selectColor(rule.bg_color, rule.border_color);
        
        saveRuleBtn.textContent = 'Actualizar';
        cancelRuleEditBtn.style.display = 'inline-block';
        ruleForm.scrollIntoView({ behavior: 'smooth' });
    }

    function resetForm() {
        ruleFormTitle.textContent = 'Añadir Nueva Regla';
        ruleIdInput.value = '';
        keywordInput.value = '';
        // Reset color al default
        selectColor('#e6f7e9');
        
        saveRuleBtn.textContent = 'Guardar';
        cancelRuleEditBtn.style.display = 'none';
        const errorDiv = document.getElementById('rule-error-message');
        if(errorDiv) errorDiv.textContent = '';
    }

    if(cancelRuleEditBtn) cancelRuleEditBtn.addEventListener('click', resetForm);


    // ==========================================
    // 4. HISTORIAL DE SESIONES
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
                
                let tipoVisual = s.tipo;
                const temaTexto = (s.tema || '').toLowerCase().trim();
                if (temaTexto.startsWith('test') || temaTexto.startsWith('examen')) {
                    tipoVisual = 'test';
                }

                const li = document.createElement('li');
                li.className = 'history-item';
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
    auth.onAuthStateChanged(user => {
        // Esperamos interacción del usuario
    });
});