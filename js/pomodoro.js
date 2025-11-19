// Importamos Firebase y las configuraciones
import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, query, where, getDocs, 
    orderBy, limit, doc, updateDoc, deleteDoc, 
    writeBatch, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// Importamos las reglas de color
import { fetchColorRules, applyColorRule } from './colorRules.js';

// --- Referencias al DOM ---
const timerDisplay = document.getElementById('timer-display');
const inputEstudio = document.getElementById('input-estudio');
const inputDescanso = document.getElementById('input-descanso');
const btnIniciar = document.getElementById('btn-iniciar');
const btnPausa = document.getElementById('btn-pausa');
const btnReset = document.getElementById('btn-reset');
const tabBotones = document.querySelectorAll('.tab-btn');
const inputDescansoLargo = document.getElementById('input-descanso-largo');
const inputCicloPomodoro = document.getElementById('input-ciclo-pomodoro');
const pomodoroCountDisplay = document.getElementById('pomodoro-count-display');
const newTaskInput = document.getElementById('new-task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');
const activitySwitcher = document.querySelector('.activity-switcher');
const activityBotones = document.querySelectorAll('.activity-btn');
const pomodoroUI = document.getElementById('pomodoro-ui');
const stopwatchUI = document.getElementById('stopwatch-ui');
const stopwatchDisplay = document.getElementById('stopwatch-display');
const btnStopwatchStart = document.getElementById('btn-stopwatch-start');
const btnStopwatchPause = document.getElementById('btn-stopwatch-pause');
const btnStopwatchSave = document.getElementById('btn-stopwatch-save');
const btnStopwatchManual = document.getElementById('btn-stopwatch-manual');
// --- ¡NUEVA REFERENCIA AÑADIDA! ---
const btnPomodoroManual = document.getElementById('btn-pomodoro-manual'); 

const topicInputContainer = document.querySelector('.topic-input-container');
const topicInput = document.getElementById('topic-input');

// --- Estado ---
let tiempoTotalSegundos = 30 * 60;
let tiempoRestante = tiempoTotalSegundos;
let esEstudio = true;
let enPausa = true;
let intervaloTimer = null;
let duracionEstudioActual = 30;
let pomodoroCount = 0; 
let pomodorosHoy = 0; 
let pomodoroEndTime = 0;

let stopwatchInterval = null;
let stopwatchStartTime = 0;
let stopwatchElapsedTime = 0; 
let stopwatchPaused = true;
let currentActivity = 'estudio'; 

const audioAlarma = new Audio('assets/alarma.mp3'); 

// --- Helper para obtener fecha local YYYY-MM-DD ---
function getLocalTodayDate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60000));
    return localToday.toISOString().split('T')[0];
}

// --- Lógica de Interfaz ---
function switchActivity(newActivity) {
    currentActivity = newActivity;
    pausarTimer();
    pauseStopwatch();
    resetStopwatch(false); 
    activityBotones.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.activity === newActivity);
    });
    if (newActivity === 'estudio') {
        pomodoroUI.style.display = 'block';
        stopwatchUI.style.display = 'none';
        topicInputContainer.style.display = 'block'; 
        resetTimer(); 
    } else if (newActivity === 'clase') {
        pomodoroUI.style.display = 'none';
        stopwatchUI.style.display = 'block';
        topicInputContainer.style.display = 'block'; 
    } else { 
        pomodoroUI.style.display = 'none';
        stopwatchUI.style.display = 'block';
        topicInputContainer.style.display = 'none'; 
    }
}

function getValidatedTopic() {
    const tema = topicInput.value.trim();
    if (currentActivity === 'psicotecnicos') return { valid: true, topic: null };
    if (tema === '') {
        const userConfirmed = confirm("No has especificado un tema.\n¿Quieres continuar y guardarlo sin tema?");
        return userConfirmed ? { valid: true, topic: null } : { valid: false, topic: null };
    }
    return { valid: true, topic: tema };
}

// --- Lógica del Pomodoro ---
function actualizarDisplay() {
    const displayTime = Math.max(0, tiempoRestante);
    const minutos = Math.floor(displayTime / 60);
    const segundos = displayTime % 60;
    timerDisplay.textContent = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
    document.title = `${timerDisplay.textContent} - ${esEstudio ? 'Estudio' : 'Descanso'}`;
}

function cambiarModo(modo) {
    pausarTimer();
    esEstudio = (modo === 'estudio');
    tabBotones.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === modo));
    if (esEstudio) {
        tiempoTotalSegundos = parseInt(inputEstudio.value) * 60;
    } else {
        const cicloTarget = parseInt(inputCicloPomodoro.value);
        if (cicloTarget > 0 && pomodoroCount > 0 && pomodoroCount % cicloTarget === 0) {
            tiempoTotalSegundos = parseInt(inputDescansoLargo.value) * 60;
        } else {
            tiempoTotalSegundos = parseInt(inputDescanso.value) * 60;
        }
    }
    tiempoRestante = tiempoTotalSegundos;
    actualizarDisplay();
    btnIniciar.textContent = "Iniciar";
}

function iniciarTimer() {
    if (enPausa) {
        if (esEstudio && tiempoRestante === tiempoTotalSegundos) {
            const validation = getValidatedTopic();
            if (!validation.valid) return;
        }
        audioAlarma.load(); 
        enPausa = false;
        btnIniciar.textContent = "Iniciar";
        
        if (tiempoRestante === tiempoTotalSegundos) {
             if(esEstudio) {
                duracionEstudioActual = parseInt(inputEstudio.value);
                tiempoTotalSegundos = duracionEstudioActual * 60;
            } else {
                const cicloTarget = parseInt(inputCicloPomodoro.value);
                if (cicloTarget > 0 && pomodoroCount > 0 && pomodoroCount % cicloTarget === 0) {
                     tiempoTotalSegundos = parseInt(inputDescansoLargo.value) * 60;
                } else {
                     tiempoTotalSegundos = parseInt(inputDescanso.value) * 60;
                }
            }
            tiempoRestante = tiempoTotalSegundos;
        }
        pomodoroEndTime = Date.now() + (tiempoRestante * 1000);
        intervaloTimer = setInterval(() => {
            const msRestantes = pomodoroEndTime - Date.now();
            tiempoRestante = Math.round(msRestantes / 1000);
            actualizarDisplay();
            if (tiempoRestante < 0) terminarSesion();
        }, 1000); 
    }
}

function pausarTimer() {
    if (!enPausa) { 
        enPausa = true;
        clearInterval(intervaloTimer);
        const msRestantes = pomodoroEndTime - Date.now();
        tiempoRestante = Math.round(msRestantes / 1000);
        if (tiempoRestante < 0) tiempoRestante = 0;
        actualizarDisplay(); 
        btnIniciar.textContent = "Continuar";
    }
}

function resetTimer() {
    pausarTimer();
    // pomodoroCount = 0; 
    cambiarModo('estudio');
}

function guardarYResetear() { 
    pausarTimer();
    if (esEstudio) {
        const tiempoTotalConfigurado = parseInt(inputEstudio.value) * 60;
        const tiempoEstudiadoSegundos = tiempoTotalConfigurado - tiempoRestante;
        const minutosEstudiados = Math.round(tiempoEstudiadoSegundos / 60);
        if (minutosEstudiados > 0) {
            const validation = getValidatedTopic();
            if (!validation.valid) { pausarTimer(); return; }
            
            guardarSesionEnBD(minutosEstudiados, 'estudio', validation.topic); 
            pomodorosHoy++;
            pomodoroCount++; 
            pomodoroCountDisplay.textContent = pomodorosHoy;
        }
    }
    resetTimer();
}

function terminarSesion() {
    pausarTimer();
    audioAlarma.play().catch(e => console.warn("Audio error:", e));
    if (esEstudio) {
        pomodoroCount++; 
        pomodorosHoy++; 
        pomodoroCountDisplay.textContent = pomodorosHoy; 
        const validation = getValidatedTopic(); 
        const tema = validation.valid ? validation.topic : null; 
        guardarSesionEnBD(duracionEstudioActual, 'estudio', tema); 
        const cicloTarget = parseInt(inputCicloPomodoro.value);
        if (cicloTarget > 0 && pomodoroCount > 0 && pomodoroCount % cicloTarget === 0) {
            tiempoTotalSegundos = parseInt(inputDescansoLargo.value) * 60;
        } else {
            tiempoTotalSegundos = parseInt(inputDescanso.value) * 60;
        }
        cambiarModo('descanso'); 
        tiempoRestante = tiempoTotalSegundos; 
        pomodoroEndTime = Date.now() + (tiempoRestante * 1000); 
        actualizarDisplay();
    } else {
        cambiarModo('estudio');
    }
}

// --- Lógica del Cronómetro ---
function formatStopwatchTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
function updateStopwatchDisplay() {
    const now = Date.now();
    const elapsedTime = now - stopwatchStartTime + stopwatchElapsedTime;
    const timeString = formatStopwatchTime(elapsedTime);
    stopwatchDisplay.textContent = timeString;
    document.title = `${timeString} - ${currentActivity.charAt(0).toUpperCase() + currentActivity.slice(1)}`;
}
function startStopwatch() {
    if (stopwatchPaused) {
        if (stopwatchElapsedTime === 0) {
            const validation = getValidatedTopic();
            if (!validation.valid) { return; }
        }
        audioAlarma.load(); 
        stopwatchPaused = false;
        stopwatchStartTime = Date.now();
        stopwatchInterval = setInterval(updateStopwatchDisplay, 1000);
        btnStopwatchStart.textContent = "Iniciar"; 
    }
}
function pauseStopwatch() {
    if (!stopwatchPaused) {
        stopwatchPaused = true;
        clearInterval(stopwatchInterval);
        stopwatchElapsedTime += Date.now() - stopwatchStartTime;
        btnStopwatchStart.textContent = "Continuar";
    }
}
function resetStopwatch(save = false) {
    pauseStopwatch();
    let totalMinutes = 0;
    if (stopwatchElapsedTime > 0) {
        totalMinutes = Math.round((stopwatchElapsedTime / 1000) / 60);
    }
    if (save && totalMinutes > 0) {
        const validation = getValidatedTopic();
        if (!validation.valid) { pauseStopwatch(); return; }
        guardarSesionEnBD(totalMinutes, currentActivity, validation.topic);
    }
    stopwatchElapsedTime = 0;
    stopwatchStartTime = 0;
    stopwatchDisplay.textContent = "00:00:00";
    btnStopwatchStart.textContent = "Iniciar";
    document.title = "Pomodoro Timer"; 
}
function addManualTime() {
    // Si el temporizador está corriendo, pausarlo
    pausarTimer();
    pauseStopwatch();

    const validation = getValidatedTopic();
    if (!validation.valid) return;
    const input = prompt("Introduce el tiempo total en MINUTOS:");
    if (input === null || input.trim() === '') return;
    const duration = parseInt(input, 10);
    if (isNaN(duration) || duration <= 0) {
        alert('Por favor, introduce un número válido de minutos.');
        return;
    }
    guardarSesionEnBD(duration, currentActivity, validation.topic);
    alert(`${duration} minutos de '${currentActivity}' guardados con éxito.`);
    
    // Actualizar contador si es estudio
    if (currentActivity === 'estudio') {
        pomodorosHoy++;
        pomodoroCountDisplay.textContent = pomodorosHoy;
        pomodoroCount = pomodorosHoy % (parseInt(inputCicloPomodoro.value) || 4);
    }
    
    // Resetear la interfaz
    resetStopwatch(false); 
    resetTimer(); 
}

// --- FIREBASE: FUNCIONES DE BASE DE DATOS ---

async function guardarSesionEnBD(duracion, tipo, tema = null) { 
    if (!auth.currentUser) return alert('Error: No autenticado');
    try {
        await addDoc(collection(db, "sesiones_estudio"), {
            user_id: auth.currentUser.uid,
            fecha_sesion: Timestamp.now(), 
            duracion_minutos: duracion,
            tipo: tipo,
            tema: tema
        });
        console.log("Sesión guardada OK");
    } catch (error) {
        console.error("Error al guardar sesión: ", error);
        alert('Error de red al guardar la sesión.');
    }
}

function renderTask(taskDoc) { 
    const task = taskDoc.data();
    const listItem = document.createElement('li');
    listItem.className = 'task-item';
    listItem.setAttribute('data-id', taskDoc.id); 
    applyColorRule(listItem, task.texto);
    if (task.completada) {
        listItem.classList.add('completed');
    }
    listItem.innerHTML = `
        <input type="checkbox" ${task.completada ? 'checked' : ''} class="task-checkbox">
        <span class="task-text">${task.texto}</span>
        <button class="edit-task-btn">✏️</button>
        <button class="delete-task-btn">🗑️</button>
    `;
    taskList.appendChild(listItem);
}

async function loadAndRenderTasks() {
    taskList.innerHTML = 'Cargando tareas...'; 
    if (!auth.currentUser) return;

    try {
        await fetchColorRules();
        const todayStr = getLocalTodayDate();

        // 1. Tareas de Hoy
        const tasksQ = query(
            collection(db, "tareas_semanales"),
            where("user_id", "==", auth.currentUser.uid),
            where("fecha_tarea", "==", todayStr),
            orderBy("orden", "asc")
        );
        const tasksSnap = await getDocs(tasksQ);
        taskList.innerHTML = ''; 
        tasksSnap.forEach(doc => renderTask(doc));

        // 2. Contador de Pomodoros
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date();
        endOfDay.setHours(23,59,59,999);

        const sessionsQ = query(
            collection(db, "sesiones_estudio"),
            where("user_id", "==", auth.currentUser.uid),
            where("tipo", "==", "estudio"),
            where("fecha_sesion", ">=", Timestamp.fromDate(startOfDay)),
            where("fecha_sesion", "<=", Timestamp.fromDate(endOfDay))
        );
        const sessionsSnap = await getDocs(sessionsQ);
        
        pomodorosHoy = sessionsSnap.size;
        pomodoroCountDisplay.textContent = pomodorosHoy;
        
        const cicloTarget = parseInt(inputCicloPomodoro.value) || 4;
        pomodoroCount = pomodorosHoy % cicloTarget;

    } catch (error) {
        console.error("Error cargando datos:", error);
        taskList.innerHTML = 'Error cargando tareas.';
    }
}

async function addTask() {
    const taskText = newTaskInput.value.trim();
    if (taskText === '' || !auth.currentUser) return;
    
    try {
        const todayStr = getLocalTodayDate();
        const qOrder = query(
            collection(db, "tareas_semanales"),
            where("user_id", "==", auth.currentUser.uid),
            where("fecha_tarea", "==", todayStr),
            orderBy("orden", "desc"),
            limit(1)
        );
        const snapOrder = await getDocs(qOrder);
        const newOrder = snapOrder.empty ? 1 : snapOrder.docs[0].data().orden + 1;

        const newTask = {
            user_id: auth.currentUser.uid,
            texto: taskText,
            fecha_tarea: todayStr,
            completada: false,
            orden: newOrder
        };
        
        const docRef = await addDoc(collection(db, "tareas_semanales"), newTask);
        renderTask({ id: docRef.id, data: () => newTask }); 
        newTaskInput.value = '';
        
    } catch (error) {
        console.error("Error añadiendo tarea:", error);
        alert('Error al añadir tarea.');
    }
}

async function editTask(id, currentText, taskElement) {
    const newText = prompt('Editar tarea:', currentText);
    if (newText && newText !== currentText) {
        try {
            await updateDoc(doc(db, "tareas_semanales", id), { texto: newText });
            taskElement.querySelector('.task-text').textContent = newText;
            applyColorRule(taskElement, newText);
        } catch(e) { console.error(e); }
    }
}
async function toggleTaskCompleted(id, isCompleted) {
    try { await updateDoc(doc(db, "tareas_semanales", id), { completada: isCompleted }); } catch(e) { console.error(e); }
}
async function deleteTask(id) {
    try { await deleteDoc(doc(db, "tareas_semanales", id)); } catch(e) { console.error(e); }
}
async function saveTaskOrder(taskIds) {
    if (!auth.currentUser) return;
    try {
        const batch = writeBatch(db);
        taskIds.forEach((id, index) => {
            batch.update(doc(db, "tareas_semanales", id), { orden: index + 1 });
        });
        await batch.commit();
    } catch(e) { console.error(e); }
}

// --- Event Listeners ---
btnIniciar.addEventListener('click', iniciarTimer);
btnPausa.addEventListener('click', pausarTimer);
btnReset.addEventListener('click', guardarYResetear); 
tabBotones.forEach(btn => { btn.addEventListener('click', () => cambiarModo(btn.dataset.mode)); });
addTaskBtn.addEventListener('click', addTask);
newTaskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

btnStopwatchStart.addEventListener('click', startStopwatch);
btnStopwatchPause.addEventListener('click', pauseStopwatch);
btnStopwatchSave.addEventListener('click', () => resetStopwatch(true));
btnStopwatchManual.addEventListener('click', addManualTime); 

// --- ¡LISTENER AÑADIDO! ---
if(btnPomodoroManual) {
    btnPomodoroManual.addEventListener('click', addManualTime);
}

activityBotones.forEach(btn => {
    btn.addEventListener('click', () => switchActivity(btn.dataset.activity));
});

taskList.addEventListener('click', (e) => {
    const listItem = e.target.closest('li.task-item');
    if (!listItem) return; 
    const taskId = listItem.dataset.id; 
    if (e.target.classList.contains('task-checkbox')) { const isCompleted = e.target.checked; listItem.classList.toggle('completed', isCompleted); toggleTaskCompleted(taskId, isCompleted); } 
    else if (e.target.classList.contains('edit-task-btn')) { const currentText = listItem.querySelector('.task-text').textContent; editTask(taskId, currentText, listItem); } 
    else if (e.target.classList.contains('delete-task-btn')) { listItem.remove(); deleteTask(taskId); }
});

auth.onAuthStateChanged(user => {
    if (user) {
        actualizarDisplay();
        loadAndRenderTasks(); 
    }
});

new Sortable(taskList, {
    animation: 150, handle: '.task-item', filter: '.task-checkbox, .edit-task-btn, .delete-task-btn', 
    onEnd: function (evt) {
        const taskItems = taskList.querySelectorAll('li.task-item');
        const taskIds = Array.from(taskItems).map(item => item.dataset.id);
        saveTaskOrder(taskIds);
    }
});