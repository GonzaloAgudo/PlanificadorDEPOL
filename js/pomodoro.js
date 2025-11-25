// ==============================================================
//  IMPORTACIONES Y CONFIGURACIÓN
// ==============================================================
import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, query, where, getDocs, 
    orderBy, limit, doc, updateDoc, deleteDoc, 
    writeBatch, Timestamp, setDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { fetchColorRules, applyColorRule } from './colorRules.js';

// ==============================================================
//  REFERENCIAS AL DOM
// ==============================================================
const timerDisplay = document.getElementById('timer-display');
const inputEstudio = document.getElementById('input-estudio');
const inputDescanso = document.getElementById('input-descanso');
const btnIniciar = document.getElementById('btn-iniciar');
// const btnPausa eliminada (ya no existe en HTML)
const btnReset = document.getElementById('btn-reset');
const tabBotones = document.querySelectorAll('.tab-btn');
const inputDescansoLargo = document.getElementById('input-descanso-largo');
const inputCicloPomodoro = document.getElementById('input-ciclo-pomodoro');
const pomodoroCountDisplay = document.getElementById('pomodoro-count-display');
const newTaskInput = document.getElementById('new-task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');
const activityBotones = document.querySelectorAll('.activity-btn');
const pomodoroUI = document.getElementById('pomodoro-ui');
const stopwatchUI = document.getElementById('stopwatch-ui');
const stopwatchDisplay = document.getElementById('stopwatch-display');
const btnStopwatchStart = document.getElementById('btn-stopwatch-start'); 
// const btnStopwatchPause eliminada (ya no existe en HTML)
const btnStopwatchSave = document.getElementById('btn-stopwatch-save');
const btnStopwatchManual = document.getElementById('btn-stopwatch-manual');
const btnPomodoroManual = document.getElementById('btn-pomodoro-manual'); 
const topicInputContainer = document.querySelector('.topic-input-container');
const topicInput = document.getElementById('topic-input');

// ==============================================================
//  VARIABLES GLOBALES Y ESTADO
// ==============================================================
let esEstudio = true; 
let pomodoroCount = 0; 
let pomodorosHoy = 0; 
let visualInterval = null;   // Intervalo para el "tick" visual del reloj
let wakeLock = null;         // Para mantener pantalla encendida
let unsubscribeTimer = null; // Para detener la escucha de DB al salir

// ESTADO REMOTO (Sincronizado con Firestore)
let remoteState = {
    status: 'stopped', // 'running', 'paused', 'stopped'
    endTime: 0,        // Timestamp de fin
    timeLeft: 0,       // Tiempo restante al pausar
    totalDuration: 0,  // Duración total original
    mode: 'estudio',   // 'estudio' o 'descanso'
    activity: 'estudio',
    topic: ''
};

const audioAlarma = new Audio('assets/alarma.mp3'); 

// ==============================================================
//  UTILIDADES (WAKELOCK, NOTIFICACIONES, UI)
// ==============================================================

// Solicitar permiso de notificaciones al cargar
if ("Notification" in window) Notification.requestPermission();

// Wake Lock API (Pantalla Encendida)
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try { wakeLock = await navigator.wakeLock.request('screen'); } catch (err) { console.error(err); }
    }
}
function releaseWakeLock() {
    if (wakeLock !== null) { wakeLock.release(); wakeLock = null; }
}

// Helpers de UI
function switchActivity(newActivity) {
    activityBotones.forEach(btn => btn.classList.toggle('active', btn.dataset.activity === newActivity));
    if (newActivity === 'estudio') {
        pomodoroUI.style.display = 'block';
        stopwatchUI.style.display = 'none';
        topicInputContainer.style.display = 'block'; 
    } else { 
        pomodoroUI.style.display = 'none';
        stopwatchUI.style.display = 'block';
        topicInputContainer.style.display = (newActivity === 'psicotecnicos') ? 'none' : 'block'; 
    }
}

function getValidatedTopic() {
    // Si ya está corriendo remotamente, confiamos en el tema remoto
    if (remoteState.status === 'running') return { valid: true, topic: remoteState.topic };

    const tema = topicInput.value.trim();
    const act = document.querySelector('.activity-btn.active').dataset.activity;
    
    if (act === 'psicotecnicos') return { valid: true, topic: null };
    if (tema === '') {
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
//  CORE: SINCRONIZACIÓN CON FIRESTORE
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
    
    // 1. Sincronizar UI (Actividad, Modo, Tema)
    if (data.activity) switchActivity(data.activity);
    if (data.mode) {
        esEstudio = (data.mode === 'estudio');
        tabBotones.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === data.mode));
    }
    if (data.topic && topicInput.value === '') topicInput.value = data.topic;

    // 2. Gestión del Timer
    clearInterval(visualInterval);
    
    if (data.status === 'running') {
        requestWakeLock();
        
        // Actualizar estado del botón
        btnIniciar.textContent = "Pausar"; 
        btnIniciar.classList.add('btn-yellow-state'); 
        btnIniciar.onclick = pausarTimerRemoto; 

        // --- LÓGICA CRÍTICA CORREGIDA PARA MÓVIL ---
        const checkTime = () => {
            const currentNow = Date.now();
            // Calculamos diferencia real contra el servidor
            const currentSecondsLeft = Math.ceil((data.endTime - currentNow) / 1000);

            if (currentSecondsLeft <= 0) {
                // ¡EL TIEMPO YA ACABÓ!
                clearInterval(visualInterval);
                timerDisplay.textContent = "00:00";
                
                // IMPORTANTE: Solo el dispositivo "dueño" o activo debería llamar a terminar
                // Para evitar condiciones de carrera, lo llamamos directamente.
                // La función terminarSesionRemota tiene un guardafrenos (if status !== running)
                // así que es seguro llamarla varias veces.
                terminarSesionRemota(); 
            } else {
                updateDisplay(currentSecondsLeft);
            }
        };

        // 1. Ejecutar comprobación INMEDIATAMENTE (al recibir datos de Firebase)
        // Esto arregla el caso de "abro el móvil y ya pasaron 5 minutos del cero"
        checkTime();

        // 2. Iniciar bucle visual para la cuenta atrás
        visualInterval = setInterval(checkTime, 1000);

    } else if (data.status === 'paused') {
        releaseWakeLock();
        btnIniciar.textContent = "Continuar";
        btnIniciar.classList.remove('btn-yellow-state');
        btnIniciar.onclick = iniciarTimerLocal; 
        updateDisplay(data.timeLeft);

    } else { // stopped
        releaseWakeLock();
        btnIniciar.textContent = "Iniciar";
        btnIniciar.classList.remove('btn-yellow-state');
        btnIniciar.onclick = iniciarTimerLocal;
        
        let defaultTime = 0;
        if (esEstudio) defaultTime = parseInt(inputEstudio.value) * 60;
        else defaultTime = parseInt(inputDescanso.value) * 60;
        
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
    const currentAct = document.querySelector('.activity-btn.active').dataset.activity;
    const currentTopic = topicInput.value;

    try {
        await setDoc(doc(db, "timers_activos", auth.currentUser.uid), {
            status: 'running',
            endTime: endTime,
            totalDuration: durationSec, 
            mode: esEstudio ? 'estudio' : 'descanso',
            activity: currentAct,
            topic: currentTopic,
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
        
        let secondsLeft = 0;
        if (remoteState.status === 'running') {
            const now = Date.now();
            secondsLeft = Math.ceil((remoteState.endTime - now) / 1000);
        } else {
            secondsLeft = remoteState.timeLeft;
        }

        const secondsElapsed = Math.max(0, remoteState.totalDuration - secondsLeft);
        const minutosEstudiados = Math.round(secondsElapsed / 60);

        if (remoteState.mode === 'estudio' && minutosEstudiados > 0) {
            const confirmSave = confirm(`Has parado a la mitad. ¿Guardar los ${minutosEstudiados} minutos que llevabas?`);
            if (confirmSave) {
                await guardarSesionEnBD(minutosEstudiados, remoteState.activity, remoteState.topic);
            }
        }
    }

    try {
        await setDoc(doc(db, "timers_activos", auth.currentUser.uid), {
            status: 'stopped',
            mode: 'estudio', 
            activity: 'estudio',
            timeLeft: 0,
            lastUpdated: Date.now()
        });
        
        // Reset Visual Inmediato
        esEstudio = true;
        // Aseguramos que se quita el amarillo
        btnIniciar.classList.remove('btn-yellow-state');
        btnIniciar.textContent = "Iniciar";

        const defaultMinutes = parseInt(inputEstudio.value) || 25;
        updateDisplay(defaultMinutes * 60);
        document.title = "Pomodoro Listo";
        tabBotones.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === 'estudio'));

    } catch (e) {
        console.error("Error al resetear timer:", e);
    }
}

async function terminarSesionRemota() {
    if (!auth.currentUser) return;
    if (remoteState.status !== 'running') return;

    audioAlarma.play().catch(e => console.log(e));
    if (Notification.permission === "granted") {
        new Notification("Tiempo Terminado", { body: esEstudio ? "¡Descanso!" : "A estudiar" });
    }

    if (remoteState.mode === 'estudio') {
        const minutos = Math.round(remoteState.totalDuration / 60);
        if (minutos > 0) {
            await guardarSesionEnBD(minutos, remoteState.activity, remoteState.topic);
        }
    }
    
    let nextMode = 'estudio';
    if (remoteState.mode === 'estudio') {
        nextMode = 'descanso';
        pomodoroCount++;
    }

    try {
        await setDoc(doc(db, "timers_activos", auth.currentUser.uid), {
            status: 'stopped',
            mode: nextMode,
            activity: remoteState.activity,
            timeLeft: 0,
            lastUpdated: Date.now()
        });
        // Quitar amarillo al terminar
        btnIniciar.classList.remove('btn-yellow-state');
        btnIniciar.textContent = "Iniciar";
    } catch (e) { console.error("Error al terminar sesión:", e); }
}

// ==============================================================
//  GUARDADO DE DATOS (BD)
// ==============================================================

async function guardarSesionEnBD(duracion, tipo, tema = null) { 
    if (!auth.currentUser) {
        console.error("No hay usuario logueado.");
        return;
    }
    if (!duracion || duracion <= 0) return;

    try {
        console.log(`Guardando: ${duracion}m ${tipo} - ${tema}`);
        await addDoc(collection(db, "sesiones_estudio"), {
            user_id: auth.currentUser.uid,
            fecha_sesion: Timestamp.now(), 
            duracion_minutos: Number(duracion),
            tipo: tipo,
            tema: tema || "Sin tema"
        });
        
        if (tipo === 'estudio') {
            pomodorosHoy++;
            if(pomodoroCountDisplay) pomodoroCountDisplay.textContent = pomodorosHoy;
        }
    } catch (error) {
        console.error("Error guardando sesión:", error);
        alert('Error al guardar la sesión. Revisa tu conexión.');
    }
}

function addManualTime() {
    if (remoteState.status === 'running') pausarTimerRemoto();
    if (typeof pauseStopwatch === 'function') pauseStopwatch();

    const activeBtn = document.querySelector('.activity-btn.active');
    const currentActivity = activeBtn ? activeBtn.dataset.activity : 'estudio';
    
    const tema = topicInput.value.trim();
    if (currentActivity !== 'psicotecnicos' && tema === '') {
        if (!confirm("No has puesto tema. ¿Guardar sin tema?")) return;
    }

    const input = prompt(`Añadir tiempo manual a '${currentActivity.toUpperCase()}'.\nIntroduce minutos:`);
    if (!input) return;
    const duration = parseInt(input, 10);
    if (isNaN(duration) || duration <= 0) return alert('Número inválido');

    guardarSesionEnBD(duration, currentActivity, tema || null);
    alert(`Guardados ${duration} min.`);
}

// ==============================================================
//  CRONÓMETRO (LOCAL - CLASE/PSICOTECNICOS)
// ==============================================================
let stopwatchInterval = null;
let stopwatchStartTime = 0;
let stopwatchElapsedTime = 0; 
let stopwatchPaused = true;

function formatStopwatchTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateStopwatchDisplay() {
    const now = Date.now();
    const elapsedTime = now - stopwatchStartTime + stopwatchElapsedTime;
    stopwatchDisplay.textContent = formatStopwatchTime(elapsedTime);
    document.title = `${stopwatchDisplay.textContent} - Cronómetro`;
}

// Función principal que alterna entre Start y Pause
function toggleStopwatch() {
    if (stopwatchPaused) {
        startStopwatch();
    } else {
        pauseStopwatch();
    }
}

function startStopwatch() {
    if (stopwatchPaused) {
        const validation = getValidatedTopic();
        if (!validation.valid) return;
        
        requestWakeLock();
        audioAlarma.load(); 
        stopwatchPaused = false;
        stopwatchStartTime = Date.now();
        stopwatchInterval = setInterval(updateStopwatchDisplay, 1000);
        
        // Actualizar botón a PAUSAR (AMARILLO)
        btnStopwatchStart.textContent = "Pausar"; 
        btnStopwatchStart.classList.add('btn-yellow-state');
    }
}

function pauseStopwatch() {
    if (!stopwatchPaused) {
        releaseWakeLock();
        stopwatchPaused = true;
        clearInterval(stopwatchInterval);
        stopwatchElapsedTime += Date.now() - stopwatchStartTime;
        
        // Actualizar botón a CONTINUAR (NORMAL)
        btnStopwatchStart.textContent = "Continuar"; 
        btnStopwatchStart.classList.remove('btn-yellow-state');
    }
}

function resetStopwatch(save = false) {
    pauseStopwatch(); // Aseguramos pausa
    
    let totalMinutes = 0;
    if (stopwatchElapsedTime > 0) totalMinutes = Math.round((stopwatchElapsedTime / 1000) / 60);
    
    if (save && totalMinutes > 0) {
        const act = document.querySelector('.activity-btn.active').dataset.activity;
        const tema = topicInput.value.trim(); 
        guardarSesionEnBD(totalMinutes, act, tema || "Sin tema");
    }
    
    stopwatchElapsedTime = 0;
    stopwatchStartTime = 0;
    stopwatchDisplay.textContent = "00:00:00";
    // Resetear botón a INICIAR (NORMAL)
    btnStopwatchStart.textContent = "Iniciar";
    btnStopwatchStart.classList.remove('btn-yellow-state');
}

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
        <input type="checkbox" ${task.completada ? 'checked' : ''} class="task-checkbox">
        <span class="task-text">${task.texto}</span>
        <button class="edit-task-btn">✏️</button>
        <button class="delete-task-btn">🗑️</button>
    `;
    taskList.appendChild(listItem);
}

async function loadAndRenderTasks() {
    taskList.innerHTML = 'Cargando...'; 
    if (!auth.currentUser) return;
    try {
        await fetchColorRules();
        const todayStr = new Date().toISOString().split('T')[0];
        
        // 1. Cargar Tareas
        const tasksQ = query(collection(db, "tareas_semanales"), where("user_id", "==", auth.currentUser.uid), where("fecha_tarea", "==", todayStr), orderBy("orden", "asc"));
        const tasksSnap = await getDocs(tasksQ);
        taskList.innerHTML = ''; 
        tasksSnap.forEach(doc => renderTask(doc));

        // 2. Cargar Estadísticas Rápidas
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
    loadAndRenderTasks(); // Recargar para ordenar
}

async function saveTaskOrder(taskIds) {
    if (!auth.currentUser) return;
    const batch = writeBatch(db);
    taskIds.forEach((id, index) => {
        batch.update(doc(db, "tareas_semanales", id), { orden: index + 1 });
    });
    await batch.commit();
}

// ==============================================================
//  LISTENERS DE EVENTOS
// ==============================================================

btnReset.addEventListener('click', guardarYResetearRemoto); 
if(btnPomodoroManual) btnPomodoroManual.addEventListener('click', addManualTime);

tabBotones.forEach(btn => { 
    btn.addEventListener('click', () => {
        if(remoteState.status === 'stopped') {
            actualizarEstadoDesdeRemoto({ status: 'stopped', mode: btn.dataset.mode });
        }
    }); 
});

activityBotones.forEach(btn => btn.addEventListener('click', () => {
    // Permitir cambio de actividad visual aunque esté corriendo el cronómetro
    // Pero si el pomodoro está corriendo, eso lo gestiona la BD
    if(remoteState.status === 'stopped') switchActivity(btn.dataset.activity);
}));

// CRONÓMETRO: Listener único para toggle
btnStopwatchStart.addEventListener('click', toggleStopwatch);
btnStopwatchSave.addEventListener('click', () => resetStopwatch(true));
if(btnStopwatchManual) btnStopwatchManual.addEventListener('click', addManualTime);

addTaskBtn.addEventListener('click', addTask);
newTaskInput.addEventListener('keypress', (e) => { if(e.key==='Enter') addTask(); });

taskList.addEventListener('click', (e) => {
    const item = e.target.closest('li.task-item');
    if (!item) return; 
    const id = item.dataset.id;
    
    if (e.target.classList.contains('task-checkbox')) { 
        updateDoc(doc(db, "tareas_semanales", id), { completada: e.target.checked }); 
        item.classList.toggle('completed'); 
    } 
    else if (e.target.classList.contains('delete-task-btn')) { 
        deleteDoc(doc(db, "tareas_semanales", id)); 
        item.remove(); 
    }
    else if (e.target.classList.contains('edit-task-btn')) {
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
        animation: 150,
        delay: 200, // <--- Retraso de 200ms antes de activar el arrastre
        delayOnTouchOnly: true, // <--- Solo aplica el retraso en pantallas táctiles (en PC será instantáneo)
        filter: 'button, input',
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
        loadAndRenderTasks();
        iniciarEscuchaFirebase();
    } else {
        if (unsubscribeTimer) unsubscribeTimer();
    }
});