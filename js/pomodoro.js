// ==============================================================
//  IMPORTACIONES Y CONFIGURACIÓN
// ==============================================================
import { db, auth } from './firebase-config.js';
import {
    collection, addDoc, query, where, getDocs,
    orderBy, doc, updateDoc, deleteDoc,
    writeBatch, Timestamp, setDoc, onSnapshot, getDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { fetchColorRules, applyColorRule } from './colorRules.js';
import { icon } from './icons.js';

// ==============================================================
//  REFERENCIAS AL DOM
// ==============================================================
const timerDisplay = document.getElementById('timer-display');
const inputEstudio = document.getElementById('input-estudio');
const inputDescanso = document.getElementById('input-descanso');
const btnIniciar = document.getElementById('btn-iniciar');
const btnReset = document.getElementById('btn-reset');
const tabBotones = document.querySelectorAll('.tab-btn'); 
const inputDescansoLargo = document.getElementById('input-descanso-largo');
const inputCicloPomodoro = document.getElementById('input-ciclo-pomodoro');
const pomodoroCountDisplay = document.getElementById('pomodoro-count-display');
const newTaskInput = document.getElementById('new-task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');

const selectTema = document.getElementById('select-tema');
const selectTipo = document.getElementById('select-tipo');
const inputDescripcion = document.getElementById('input-descripcion'); 
const btnDelTema = document.getElementById('btn-del-tema'); // NUEVO: Borrar Tema
const btnDelTipo = document.getElementById('btn-del-tipo'); // NUEVO: Borrar Tipo
const mainTabBtns = document.querySelectorAll('.main-tab-btn');
const mainTabContents = document.querySelectorAll('.main-tab-content');
const btnSaveManual = document.getElementById('btn-save-manual');

// ==============================================================
//  VARIABLES GLOBALES Y ESTADO
// ==============================================================
let esEstudio = true; 
let pomodoroCount = 0; 
let pomodorosHoy = 0; 
let visualInterval = null;   
let wakeLock = null;         
let unsubscribeTimer = null; 

let remoteState = {
    status: 'stopped', 
    endTime: 0,        
    timeLeft: 0,       
    totalDuration: 0,  
    mode: 'estudio',   
    activity: 'estudio',
    topic: ''
};

const audioAlarma = new Audio('assets/alarma.mp3'); 

// Arrays para controlar qué opciones NO se pueden borrar
const defaultTemas = ['TODOS', 'ADD_NEW', ''];
const defaultTipos = ['estudio', 'clase', 'seminario', 'test', 'psicotecnicos', 'opowar', 'voltea', 'examen', 'ADD_NEW', ''];

// ==============================================================
//  INICIALIZACIÓN DE TEMAS 1-45 Y PESTAÑAS
// ==============================================================

// Generar Temas del 1 al 45 automáticamente y añadirlos a la lista de bloqueados para borrar
for (let i = 1; i <= 45; i++) {
    const nombreTema = `Tema ${i}`;
    const opt = new Option(nombreTema, nombreTema);
    selectTema.add(opt, selectTema.options[selectTema.options.length - 1]);
    defaultTemas.push(nombreTema);
}

// Lógica de Pestañas (Temporizador / Registro manual)
mainTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        mainTabBtns.forEach(b => b.classList.remove('active'));
        mainTabContents.forEach(c => c.classList.add('hidden'));

        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.target);
        if (target) target.classList.remove('hidden');
    });
});

// ==============================================================
//  GESTIÓN DE OPCIONES (AÑADIR Y BORRAR)
// ==============================================================
async function loadUserPreferences() {
    if (!auth.currentUser) return;
    const userPrefsRef = doc(db, "preferencias_usuario", auth.currentUser.uid);
    const docSnap = await getDoc(userPrefsRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Cargamos temas personalizados SOLO si no existen ya en los por defecto
        if (data.temas_custom) {
            data.temas_custom.forEach(t => {
                if (!defaultTemas.includes(t)) addOptionToSelect(selectTema, t, t);
            });
        }
        
        // Cargamos tipos personalizados SOLO si no existen ya en los por defecto
        if (data.tipos_custom) {
            data.tipos_custom.forEach(t => {
                if (!defaultTipos.includes(t)) addOptionToSelect(selectTipo, t, t);
            });
        }
    }
}

function addOptionToSelect(selectElement, value, text) {
    const newOption = new Option(text, value);
    const length = selectElement.options.length;
    selectElement.add(newOption, selectElement.options[length - 1]);
}

async function handleAddNew(event, fieldToUpdate) {
    const selectElement = event.target;
    
    if (selectElement.value === 'ADD_NEW') {
        const newValue = prompt("Introduce el nuevo nombre:");
        
        if (newValue && newValue.trim() !== "") {
            const cleanValue = newValue.trim();
            
            // 1. Evitar que se creen duplicados de los que ya vienen por defecto
            const defaultsArray = (fieldToUpdate === 'temas_custom') ? defaultTemas : defaultTipos;
            if (defaultsArray.includes(cleanValue)) {
                alert(`"${cleanValue}" ya existe en la lista por defecto.`);
                selectElement.value = cleanValue; // Lo seleccionamos directamente
                return;
            }

            // 2. Si es válido y nuevo, lo añadimos
            addOptionToSelect(selectElement, cleanValue, cleanValue);
            selectElement.value = cleanValue;

            try {
                const userPrefsRef = doc(db, "preferencias_usuario", auth.currentUser.uid);
                await setDoc(userPrefsRef, {
                    [fieldToUpdate]: arrayUnion(cleanValue)
                }, { merge: true });
            } catch (error) { console.error("Error guardando:", error); }
            
        } else {
            selectElement.selectedIndex = 0; // Si cancela, vuelve a la opción por defecto
        }
    }
}

// Nueva función para borrar opciones
async function handleDeleteCustom(selectElement, fieldToUpdate, defaultsArray) {
    const selectedValue = selectElement.value;
    
    if (!selectedValue || defaultsArray.includes(selectedValue)) {
        return alert("Esta opción viene por defecto y no se puede borrar.\n\nSolo puedes borrar las opciones que hayas añadido tú.");
    }

    if (confirm(`¿Estás seguro de que quieres borrar '${selectedValue}' de tu lista personalizada?`)) {
        try {
            const userPrefsRef = doc(db, "preferencias_usuario", auth.currentUser.uid);
            await setDoc(userPrefsRef, {
                [fieldToUpdate]: arrayRemove(selectedValue)
            }, { merge: true }); // Merge asegura que no rompemos el documento si está vacío
            
            // Quitar del DOM
            selectElement.remove(selectElement.selectedIndex);
            selectElement.selectedIndex = 0; // Volver al primer elemento
            alert("Opción borrada correctamente.");
        } catch (error) {
            console.error("Error al borrar:", error);
            alert("Error al intentar borrar la opción.");
        }
    }
}

// Listeners de los selectores y botones de borrar
selectTema.addEventListener('change', (e) => handleAddNew(e, 'temas_custom'));
selectTipo.addEventListener('change', (e) => handleAddNew(e, 'tipos_custom'));

btnDelTema.addEventListener('click', () => handleDeleteCustom(selectTema, 'temas_custom', defaultTemas));
btnDelTipo.addEventListener('click', () => handleDeleteCustom(selectTipo, 'tipos_custom', defaultTipos));


// ==============================================================
//  UTILIDADES
// ==============================================================
if ("Notification" in window) Notification.requestPermission();

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try { wakeLock = await navigator.wakeLock.request('screen'); } catch (err) { console.error(err); }
    }
}
function releaseWakeLock() {
    if (wakeLock !== null) { wakeLock.release(); wakeLock = null; }
}

function getValidatedTopic() {
    if (remoteState.status === 'running') return { valid: true, topic: remoteState.topic };

    const act = selectTipo.value;
    const tema = selectTema.value;

    if (!act || act === 'ADD_NEW') {
        alert("Selecciona un Tipo de Actividad válido.");
        return { valid: false, topic: null };
    }

    if (act === 'psicotecnicos') return { valid: true, topic: null };
    
    if (!tema || tema === 'ADD_NEW') {
        const userConfirmed = confirm("No has especificado un tema.\n¿Quieres continuar y guardarlo sin tema?");
        return userConfirmed ? { valid: true, topic: null } : { valid: false, topic: null };
    }
    return { valid: true, topic: tema };
}

function updateDisplay(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    timerDisplay.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    document.title = `${timerDisplay.textContent} - ${esEstudio ? 'Estudio' : 'Descanso'}`;
}

// ==============================================================
//  CORE: SINCRONIZACIÓN CON FIRESTORE (Pomodoro)
// ==============================================================

function iniciarEscuchaFirebase() {
    if (!auth.currentUser) return;
    const docRef = doc(db, "timers_activos", auth.currentUser.uid);
    
    unsubscribeTimer = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            actualizarEstadoDesdeRemoto(docSnap.data());
        } else {
            actualizarEstadoDesdeRemoto({ status: 'stopped', mode: 'estudio', activity: 'estudio' });
        }
    });
}

function actualizarEstadoDesdeRemoto(data) {
    remoteState = { ...remoteState, ...data };
    
    if (data.activity && selectTipo.querySelector(`option[value="${data.activity}"]`)) {
        selectTipo.value = data.activity;
    }
    if (data.topic && selectTema.querySelector(`option[value="${data.topic}"]`)) {
        selectTema.value = data.topic;
    }

    if (data.mode) {
        esEstudio = (data.mode === 'estudio');
        tabBotones.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === data.mode));
    }

    clearInterval(visualInterval);
    
    if (data.status === 'running') {
        requestWakeLock();
        btnIniciar.textContent = "Pausar";
        btnIniciar.dataset.state = "running";
        btnIniciar.onclick = pausarTimerRemoto;

        const checkTime = () => {
            const currentNow = Date.now();
            const currentSecondsLeft = Math.ceil((data.endTime - currentNow) / 1000);

            if (currentSecondsLeft <= 0) {
                clearInterval(visualInterval);
                timerDisplay.textContent = "00:00";
                terminarSesionRemota();
            } else {
                updateDisplay(currentSecondsLeft);
            }
        };
        checkTime();
        visualInterval = setInterval(checkTime, 1000);

    } else if (data.status === 'paused') {
        releaseWakeLock();
        btnIniciar.textContent = "Continuar";
        btnIniciar.dataset.state = "paused";
        btnIniciar.onclick = iniciarTimerLocal;
        updateDisplay(data.timeLeft);

    } else { 
        releaseWakeLock();
        btnIniciar.textContent = "Iniciar";
        btnIniciar.dataset.state = "idle";
        btnIniciar.onclick = iniciarTimerLocal;

        let defaultTime = esEstudio ? parseInt(inputEstudio.value) * 60 : parseInt(inputDescanso.value) * 60;
        if (isNaN(defaultTime) || defaultTime <= 0) defaultTime = 25 * 60;
        updateDisplay(defaultTime);
    }
}

// ==============================================================
//  ACCIONES DEL USUARIO (Logica del Timer)
// ==============================================================

async function iniciarTimerLocal() {
    if (!auth.currentUser) return alert("Debes iniciar sesión");
    
    let durationSec = 0;
    if (remoteState.status === 'paused') {
        durationSec = remoteState.timeLeft;
    } else {
        if (esEstudio) {
            const validation = getValidatedTopic();
            if (!validation.valid) return;
            remoteState.topic = validation.topic; 
            durationSec = parseInt(inputEstudio.value) * 60;
        } else {
            const cicloTarget = parseInt(inputCicloPomodoro.value) || 4;
            if (cicloTarget > 0 && pomodoroCount > 0 && pomodoroCount % cicloTarget === 0) {
                durationSec = parseInt(inputDescansoLargo.value) * 60;
            } else {
                durationSec = parseInt(inputDescanso.value) * 60;
            }
        }
    }

    const endTime = Date.now() + (durationSec * 1000);
    const currentAct = selectTipo.value || 'estudio';

    try {
        await setDoc(doc(db, "timers_activos", auth.currentUser.uid), {
            status: 'running',
            endTime: endTime,
            totalDuration: durationSec, 
            mode: esEstudio ? 'estudio' : 'descanso',
            activity: currentAct,
            topic: remoteState.topic || '',
            lastUpdated: Date.now()
        });
        audioAlarma.load();
    } catch (e) { console.error("Error al iniciar:", e); }
}

async function pausarTimerRemoto() {
    if (!auth.currentUser || remoteState.status !== 'running') return;
    const now = Date.now();
    const timeLeft = Math.ceil((remoteState.endTime - now) / 1000);
    await updateDoc(doc(db, "timers_activos", auth.currentUser.uid), {
        status: 'paused',
        timeLeft: Math.max(0, timeLeft)
    });
}

async function guardarYResetearRemoto() {
    if (!auth.currentUser) return;
    
    if (remoteState.status === 'running' || remoteState.status === 'paused') {
        let secondsLeft = remoteState.status === 'running' ? Math.ceil((remoteState.endTime - Date.now()) / 1000) : remoteState.timeLeft;
        const secondsElapsed = Math.max(0, remoteState.totalDuration - secondsLeft);
        const minutosEstudiados = Math.round(secondsElapsed / 60);

        if (remoteState.mode === 'estudio' && minutosEstudiados > 0) {
            if (confirm(`Has parado a la mitad. ¿Guardar los ${minutosEstudiados} minutos que llevabas?`)) {
                const desc = inputDescripcion.value.trim();
                await guardarSesionEnBD(minutosEstudiados, remoteState.activity, remoteState.topic, desc);
            }
        }
    }

    try {
        await setDoc(doc(db, "timers_activos", auth.currentUser.uid), {
            status: 'stopped', mode: 'estudio', activity: selectTipo.value || 'estudio', timeLeft: 0, lastUpdated: Date.now()
        });
        inputDescripcion.value = ''; 
    } catch (e) { console.error("Error al resetear timer:", e); }
}

async function terminarSesionRemota() {
    if (!auth.currentUser || remoteState.status !== 'running') return;

    audioAlarma.play().catch(e => console.log(e));
    if (Notification.permission === "granted") new Notification("Tiempo Terminado", { body: esEstudio ? "¡Descanso!" : "A estudiar" });

    if (remoteState.mode === 'estudio') {
        const minutos = Math.round(remoteState.totalDuration / 60);
        const desc = inputDescripcion.value.trim();
        if (minutos > 0) await guardarSesionEnBD(minutos, remoteState.activity, remoteState.topic, desc);
    }
    
    let nextMode = remoteState.mode === 'estudio' ? 'descanso' : 'estudio';
    if (remoteState.mode === 'estudio') pomodoroCount++;

    try {
        await setDoc(doc(db, "timers_activos", auth.currentUser.uid), {
            status: 'stopped', mode: nextMode, activity: remoteState.activity, timeLeft: 0, lastUpdated: Date.now()
        });
        inputDescripcion.value = ''; 
    } catch (e) { console.error("Error al terminar sesión:", e); }
}

// ==============================================================
//  GUARDADO DE DATOS (BD) - POMODORO Y MANUAL
// ==============================================================

async function guardarSesionEnBD(duracion, tipo, tema = null, descripcion = "") { 
    if (!auth.currentUser || !duracion || duracion <= 0) return;

    try {
        await addDoc(collection(db, "sesiones_estudio"), {
            user_id: auth.currentUser.uid,
            fecha_sesion: Timestamp.now(), 
            duracion_minutos: Number(duracion),
            tipo: tipo,
            tema: tema || "Sin tema",
            descripcion: descripcion 
        });
        
        if (tipo === 'estudio') {
            pomodorosHoy++;
            if(pomodoroCountDisplay) pomodoroCountDisplay.textContent = pomodorosHoy;
        }
    } catch (error) { console.error("Error guardando sesión:", error); }
}

// Lógica de Guardado Manual (H:M:S)
btnSaveManual.addEventListener('click', async () => {
    const act = selectTipo.value;
    const tema = selectTema.value;
    const desc = inputDescripcion.value.trim();

    if (!act || act === 'ADD_NEW') return alert("Selecciona un Tipo de Actividad arriba.");
    if (act !== 'psicotecnicos' && (!tema || tema === 'ADD_NEW')) {
        if (!confirm("No has puesto tema. ¿Guardar sin tema?")) return;
    }

    const h = parseInt(document.getElementById('input-horas').value) || 0;
    const m = parseInt(document.getElementById('input-minutos').value) || 0;
    const s = parseInt(document.getElementById('input-segundos').value) || 0;

    const totalMinutos = (h * 60) + m + (s / 60);

    if (totalMinutos <= 0) return alert('Introduce un tiempo mayor a 0');

    await guardarSesionEnBD(totalMinutos, act, tema === 'ADD_NEW' ? null : tema, desc);
    alert(`Guardados ${h} h ${m} min ${s} s correctamente.`);
    
    // Limpiar inputs
    document.getElementById('input-horas').value = '';
    document.getElementById('input-minutos').value = '';
    document.getElementById('input-segundos').value = '';
    inputDescripcion.value = ''; 
});

// ==============================================================
//  LISTA DE TAREAS (CRUD)
// ==============================================================
function renderTask(taskDoc) { 
    const task = taskDoc.data();
    const listItem = document.createElement('li');
    listItem.className = 'task-item';
    listItem.setAttribute('data-id', taskDoc.id); 
    applyColorRule(listItem, task.texto);
    if (task.completada) listItem.classList.add('completed');
    
    listItem.innerHTML = `
        <span class="drag-handle" aria-hidden="true">${icon('grip', 'icon--sm')}</span>
        <input type="checkbox" ${task.completada ? 'checked' : ''} class="task-checkbox">
        <span class="task-text">${task.texto}</span>
        <button class="edit-task-btn" title="Editar" aria-label="Editar tarea">${icon('edit', 'icon--sm')}</button>
        <button class="delete-task-btn" title="Borrar" aria-label="Borrar tarea">${icon('trash', 'icon--sm')}</button>
    `;
    taskList.appendChild(listItem);
}

async function loadAndRenderTasks() {
    taskList.innerHTML = 'Cargando...'; 
    if (!auth.currentUser) return;
    try {
        await fetchColorRules();
        const todayStr = new Date().toISOString().split('T')[0];
        const tasksQ = query(collection(db, "tareas_semanales"), where("user_id", "==", auth.currentUser.uid), where("fecha_tarea", "==", todayStr), orderBy("orden", "asc"));
        const tasksSnap = await getDocs(tasksQ);
        taskList.innerHTML = ''; 
        tasksSnap.forEach(doc => renderTask(doc));

        const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date(); endOfDay.setHours(23,59,59,999);
        const sessionsQ = query(collection(db, "sesiones_estudio"), where("user_id", "==", auth.currentUser.uid), where("tipo", "==", "estudio"), where("fecha_sesion", ">=", Timestamp.fromDate(startOfDay)), where("fecha_sesion", "<=", Timestamp.fromDate(endOfDay)));
        const sessionsSnap = await getDocs(sessionsQ);
        
        pomodorosHoy = sessionsSnap.size;
        if(pomodoroCountDisplay) pomodoroCountDisplay.textContent = pomodorosHoy;
        pomodoroCount = pomodorosHoy % (parseInt(inputCicloPomodoro.value) || 4);
    } catch (e) { console.error("Error cargando datos:", e); }
}

async function addTask() {
    const txt = newTaskInput.value.trim();
    if(!txt || !auth.currentUser) return;
    const todayStr = new Date().toISOString().split('T')[0];
    await addDoc(collection(db, "tareas_semanales"), { user_id: auth.currentUser.uid, texto: txt, fecha_tarea: todayStr, completada: false, orden: 999 });
    newTaskInput.value = '';
    loadAndRenderTasks();
}

async function saveTaskOrder(taskIds) {
    if (!auth.currentUser) return;
    const batch = writeBatch(db);
    taskIds.forEach((id, index) => { batch.update(doc(db, "tareas_semanales", id), { orden: index + 1 }); });
    await batch.commit();
}

// ==============================================================
//  LISTENERS DE EVENTOS Y TAREAS
// ==============================================================

btnReset.addEventListener('click', guardarYResetearRemoto); 

tabBotones.forEach(btn => { 
    btn.addEventListener('click', () => {
        if(remoteState.status === 'stopped') actualizarEstadoDesdeRemoto({ status: 'stopped', mode: btn.dataset.mode });
    }); 
});

addTaskBtn.addEventListener('click', addTask);
newTaskInput.addEventListener('keypress', (e) => { if(e.key==='Enter') addTask(); });

taskList.addEventListener('click', (e) => {
    const item = e.target.closest('li.task-item');
    if (!item) return; 
    const id = item.dataset.id;
    
    if (e.target.classList.contains('task-checkbox')) { 
        updateDoc(doc(db, "tareas_semanales", id), { completada: e.target.checked }); 
        item.classList.toggle('completed'); 
    } else if (e.target.classList.contains('delete-task-btn')) { 
        deleteDoc(doc(db, "tareas_semanales", id)); 
        item.remove(); 
    } else if (e.target.classList.contains('edit-task-btn')) {
        const currentText = item.querySelector('.task-text').textContent;
        const newText = prompt('Editar:', currentText);
        if (newText && newText !== currentText) {
            updateDoc(doc(db, "tareas_semanales", id), { texto: newText });
            item.querySelector('.task-text').textContent = newText;
        }
    }
});

if (typeof Sortable !== 'undefined') {
    new Sortable(taskList, {
        animation: 150, handle: '.drag-handle', filter: 'button, input',
        onEnd: function (evt) {
            const taskIds = Array.from(taskList.querySelectorAll('li.task-item')).map(i => i.dataset.id);
            saveTaskOrder(taskIds);
        }
    });
}

// ==============================================================
//  INICIALIZACIÓN
// ==============================================================
auth.onAuthStateChanged(user => {
    if (user) {
        loadUserPreferences();
        loadAndRenderTasks();
        iniciarEscuchaFirebase();
    } else {
        if (unsubscribeTimer) unsubscribeTimer();
    }
});