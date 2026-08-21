import { db, auth } from './firebase-config.js';
import {
    collection, query, where, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc,
    orderBy, limit, startAfter, Timestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    deleteUser, reauthenticateWithCredential, reauthenticateWithPopup,
    EmailAuthProvider, GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { icon } from './icons.js';
import { toast, confirmDialog, formDialog } from './ui.js';
import { borrarDatosDeUsuario } from './borrar-datos.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- REFERENCIAS DOM ---
    const settingsMenu = document.getElementById('settings-menu');
    const sections = document.querySelectorAll('.settings-section');
    const optionBtns = document.querySelectorAll('.settings-nav-btn[data-target]');
    const backBtns = document.querySelectorAll('.back-btn');
    const deleteAccountBtn = document.getElementById('btn-delete-account');

    // Referencias Reglas
    const quickPaletteContainer = document.getElementById('quick-palette'); 
    const customColorPicker = document.getElementById('custom-color-picker'); 
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

    // Referencias Historial
    const sessionsList = document.getElementById('sessions-list');
    const loadMoreBtn = document.getElementById('load-more-sessions');
    const sessionForm = document.getElementById('session-form');
    const sessionIdInput = document.getElementById('session-id-input');
    const sessionDateInput = document.getElementById('session-date-input');
    const sessionDurationInput = document.getElementById('session-duration-input');
    const sessionTypeInput = document.getElementById('session-type-input');
    const sessionTopicInput = document.getElementById('session-topic-input');
    const sessionDescriptionInput = document.getElementById('session-description-input'); // NUEVO CAMPO
    const cancelSessionBtn = document.getElementById('cancel-session-btn');

    let lastVisibleSession = null;
    const SESSIONS_PER_PAGE = 15;
    let loadedRules = []; 

    // Colores para las etiquetas del historial (Sincronizado con stats)
    const badgeColors = {
        'estudio': '#1c4e80',
        'clase': '#58487f',
        'seminario': '#58487f',
        'psicotecnicos': '#9a6a2f',
        'test': '#9b2c2c',
        'examen': '#1f6f4a',
        'opowar': '#2b6b73',
        'voltea': '#6b5a2b'
    };

    // ==========================================
    // CARGAR TIPOS PERSONALIZADOS EN EL SELECT
    // ==========================================
    async function loadCustomSessionTypes() {
        if (!auth.currentUser) return;
        try {
            const userPrefsRef = doc(db, "preferencias_usuario", auth.currentUser.uid);
            const docSnap = await getDoc(userPrefsRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.tipos_custom) {
                    data.tipos_custom.forEach(tipo => {
                        if (!Array.from(sessionTypeInput.options).some(opt => opt.value === tipo)) {
                            const opt = new Option(tipo, tipo);
                            sessionTypeInput.add(opt);
                        }
                    });
                }
            }
        } catch (error) {
            console.error("Error cargando tipos personalizados:", error);
        }
    }


    // ==========================================
    // 1. UTILIDADES DE COLOR
    // ==========================================
    function adjustColor(color, amount) {
        return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
    }

    if (customColorPicker) {
        customColorPicker.addEventListener('input', (e) => {
            selectColor(e.target.value);
        });
    }

    function selectColor(hexBg, hexBorder = null) {
        customColorPicker.value = hexBg;
        colorHexDisplay.textContent = hexBg;
        const calculatedBorder = hexBorder ? hexBorder : adjustColor(hexBg, -40);
        bgColorInput.value = hexBg;
        borderColorInput.value = calculatedBorder;
        
        document.querySelectorAll('.color-swatch').forEach(sw => {
            if (sw.dataset.bg === hexBg) sw.classList.add('selected');
            else sw.classList.remove('selected');
        });
    }
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

    /**
     * Eliminar la cuenta. Para que no pueda ocurrir por accidente exige
     * teclear la dirección de correo completa y volver a autenticarse, y
     * antes de borrar el usuario elimina sus datos de Firestore (si no,
     * quedarían huérfanos para siempre).
     */
    async function eliminarCuenta() {
        const user = auth.currentUser;
        if (!user) return;

        const email = user.email || '';
        const usaContrasena = user.providerData.some(p => p.providerId === 'password');
        const usaGoogle = user.providerData.some(p => p.providerId === 'google.com');

        const campos = [{
            name: 'confirmacion',
            label: 'Escribe tu correo para confirmar',
            type: 'text',
            placeholder: email,
            autocomplete: 'off'
        }];
        if (usaContrasena) {
            campos.push({
                name: 'password',
                label: 'Tu contraseña actual',
                type: 'password',
                autocomplete: 'current-password'
            });
        }

        const datos = await formDialog({
            title: 'Eliminar cuenta',
            message: 'Esta acción es <strong>permanente y no se puede deshacer</strong>. ' +
                     'Se borrarán tus sesiones de estudio, tareas, eventos, apuntes, ' +
                     'notas y el seguimiento del temario.' +
                     (usaGoogle && !usaContrasena ? '<br><br>Al continuar se abrirá una ventana de Google para confirmar tu identidad.' : ''),
            fields: campos,
            confirmText: 'Eliminar cuenta',
            danger: true,
            validate: (v) =>
                v.confirmacion.trim().toLowerCase() === email.toLowerCase() &&
                (!usaContrasena || v.password.length > 0)
        });
        if (!datos) return;

        // 1. Volver a autenticar: Firebase lo exige si la sesión no es reciente
        try {
            if (usaContrasena) {
                const cred = EmailAuthProvider.credential(email, datos.password);
                await reauthenticateWithCredential(user, cred);
            } else if (usaGoogle) {
                await reauthenticateWithPopup(user, new GoogleAuthProvider());
            }
        } catch (error) {
            console.error('Error al reautenticar:', error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                toast('La contraseña no es correcta.', { type: 'error' });
            } else if (error.code === 'auth/popup-closed-by-user') {
                toast('Se canceló la confirmación con Google.', { type: 'warning' });
            } else {
                toast('No se pudo verificar tu identidad. Inténtalo de nuevo.', { type: 'error' });
            }
            return;
        }

        // 2. Borrar los datos y, por último, el usuario
        const aviso = toast('Eliminando tus datos…', { type: 'info', duration: 0 });
        try {
            await borrarDatosDeUsuario(user.uid);
            await deleteUser(user);
            aviso();
            window.location.href = 'login.html';
        } catch (error) {
            aviso();
            console.error('Error al eliminar la cuenta:', error);
            toast('No se pudo completar el borrado. Inténtalo de nuevo.', { type: 'error' });
        }
    }

    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', eliminarCuenta);
    }

    // ==========================================
    // 3. LÓGICA DE REGLAS
    // ==========================================
    function renderQuickPalette() {
        if(!quickPaletteContainer) return;
        quickPaletteContainer.innerHTML = '';
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
            swatch.dataset.bg = color.bg; 
            
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
                <button class="edit-btn" title="Editar" aria-label="Editar regla">${icon('edit', 'icon--sm')}</button>
                <button class="delete-btn" title="Borrar" aria-label="Borrar regla">${icon('trash', 'icon--sm')}</button>
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
        loadedRules = []; 

        querySnapshot.forEach(doc => {
            loadedRules.push(doc.data());
            renderRule(doc);
        });
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
                loadRules(); 
                resetForm();
            } catch (error) {
                if(errorDiv) errorDiv.textContent = 'Error al guardar.';
            }
        });
    }

    async function deleteRule(id) {
        const ok = await confirmDialog({
            title: 'Borrar regla',
            message: 'Las tareas y eventos dejarán de colorearse con esta regla.',
            confirmText: 'Borrar',
            danger: true
        });
        if (!ok) return;
        try {
            await deleteDoc(doc(db, "color_rules", id));
            loadRules();
            toast('Regla borrada.', { type: 'success' });
        } catch (e) { toast('No se pudo borrar la regla.', { type: 'error' }); }
    }

    function populateRuleForm(ruleDoc) {
        const rule = ruleDoc.data();
        ruleFormTitle.textContent = 'Editar Regla';
        ruleIdInput.value = ruleDoc.id;
        keywordInput.value = rule.keyword;
        selectColor(rule.bg_color, rule.border_color);
        
        saveRuleBtn.textContent = 'Actualizar';
        cancelRuleEditBtn.style.display = 'inline-block';
        ruleForm.scrollIntoView({ behavior: 'smooth' });
    }

    function resetForm() {
        ruleFormTitle.textContent = 'Añadir Nueva Regla';
        ruleIdInput.value = '';
        keywordInput.value = '';
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
                if(!isNextPage) sessionsList.innerHTML = '<p class="empty-msg">Todavía no hay sesiones registradas.</p>';
                loadMoreBtn.classList.add('hidden');
                return;
            }

            lastVisibleSession = snapshot.docs[snapshot.docs.length - 1];
            loadMoreBtn.classList.toggle('hidden', snapshot.size < SESSIONS_PER_PAGE);

            snapshot.forEach(doc => {
                const s = doc.data();
                const date = s.fecha_sesion.toDate();

                const tipoVisual = s.tipo || 'estudio';
                const bgBadge = badgeColors[tipoVisual] || '#5b6673';

                // Si hay descripción, la mostramos debajo del tema
                const descHtml = s.descripcion
                    ? `<div class="history-desc">${s.descripcion}</div>`
                    : '';

                const li = document.createElement('li');
                li.className = 'history-item';
                li.innerHTML = `
                    <div class="history-info">
                        <span class="history-date">${date.toLocaleString()}</span>
                        <div class="history-title">
                            <span class="history-badge" style="background-color: ${bgBadge};">${tipoVisual}</span>
                            <span>${s.tema || 'Sin tema'}</span>
                        </div>
                        ${descHtml}
                    </div>
                    <div class="history-duration">${s.duracion_minutos} min</div>
                    <div class="rule-actions">
                        <button class="edit-btn" title="Editar" aria-label="Editar sesión">${icon('edit', 'icon--sm')}</button>
                        <button class="delete-btn" title="Borrar" aria-label="Borrar sesión">${icon('trash', 'icon--sm')}</button>
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
        
        const options = Array.from(sessionTypeInput.options).map(opt => opt.value);
        if (options.includes(s.tipo)) {
            sessionTypeInput.value = s.tipo;
        } else {
            sessionTypeInput.value = 'estudio'; 
        }
        
        sessionTopicInput.value = s.tema || '';
        sessionDescriptionInput.value = s.descripcion || ''; // Cargamos la descripción al editar

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
                    tema: sessionTopicInput.value.trim(),
                    descripcion: sessionDescriptionInput.value.trim() // Actualizamos la descripción
                });
                toast('Sesión actualizada.', { type: 'success' });
                sessionForm.style.display = 'none';
                loadHistory(false); 
            } catch(e) {
                console.error(e);
                toast('No se pudo actualizar la sesión.', { type: 'error' });
            }
        });
    }

    async function deleteSession(id) {
        const ok = await confirmDialog({
            title: 'Borrar sesión',
            message: 'Se eliminará esta sesión del historial y dejará de contar en tus estadísticas.',
            confirmText: 'Borrar',
            danger: true
        });
        if (!ok) return;
        try {
            await deleteDoc(doc(db, "sesiones_estudio", id));
            loadHistory(false);
            toast('Sesión borrada.', { type: 'success' });
        } catch(e) { toast('No se pudo borrar la sesión.', { type: 'error' }); }
    }

    if(cancelSessionBtn) {
        cancelSessionBtn.addEventListener('click', () => {
            sessionForm.style.display = 'none';
        });
    }

    // Inicializar
    auth.onAuthStateChanged(user => {
        if (user) {
            loadCustomSessionTypes();
        }
    });
});