// --- Referencias al DOM del Temporizador ---
const timerDisplay = document.getElementById('timer-display');
const inputEstudio = document.getElementById('input-estudio');
const inputDescanso = document.getElementById('input-descanso');
const btnIniciar = document.getElementById('btn-iniciar');
const btnPausa = document.getElementById('btn-pausa');
const btnReset = document.getElementById('btn-reset'); // Botón rojo
const tabBotones = document.querySelectorAll('.tab-btn');
const inputDescansoLargo = document.getElementById('input-descanso-largo');
const inputCicloPomodoro = document.getElementById('input-ciclo-pomodoro');
const pomodoroCountDisplay = document.getElementById('pomodoro-count-display');
// --- ¡NUEVA REFERENCIA! ---
const btnPomodoroManual = document.getElementById('btn-pomodoro-manual');

// --- Referencias al DOM de Tareas ---
const newTaskInput = document.getElementById('new-task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');

// --- Referencias al DOM de Actividad y Cronómetro ---
const activitySwitcher = document.querySelector('.activity-switcher');
const activityBotones = document.querySelectorAll('.activity-btn');
const pomodoroUI = document.getElementById('pomodoro-ui');
const stopwatchUI = document.getElementById('stopwatch-ui');
const stopwatchDisplay = document.getElementById('stopwatch-display');
const btnStopwatchStart = document.getElementById('btn-stopwatch-start');
const btnStopwatchPause = document.getElementById('btn-stopwatch-pause');
const btnStopwatchSave = document.getElementById('btn-stopwatch-save');
const btnStopwatchManual = document.getElementById('btn-stopwatch-manual');
const topicInputContainer = document.querySelector('.topic-input-container');
const topicInput = document.getElementById('topic-input');

// --- Estado del Temporizador ---
let tiempoTotalSegundos = 30 * 60;
let tiempoRestante = tiempoTotalSegundos;
let esEstudio = true;
let enPausa = true;
let intervaloTimer = null;
let duracionEstudioActual = 30;
let pomodoroCount = 0; 
let pomodorosHoy = 0; 
let pomodoroEndTime = 0;

// --- Estado del Cronómetro ---
let stopwatchInterval = null;
let stopwatchStartTime = 0;
let stopwatchElapsedTime = 0; 
let stopwatchPaused = true;
let currentActivity = 'estudio'; 

const audioAlarma = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_2c0a0a38f3.mp3'); 

// --- Lógica del Selector de Actividad ---
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
    } else { // Psicotécnicos
        pomodoroUI.style.display = 'none';
        stopwatchUI.style.display = 'block';
        topicInputContainer.style.display = 'none'; 
    }
}

// --- Validación de Tema ---
function getValidatedTopic() {
    const tema = topicInput.value.trim();
    if (currentActivity === 'psicotecnicos') {
        return { valid: true, topic: null };
    }
    if (tema === '') {
        const userConfirmed = confirm("No has especificado un tema.\n¿Quieres continuar y guardarlo sin tema?");
        if (userConfirmed) {
            return { valid: true, topic: null }; 
        } else {
            return { valid: false, topic: null }; 
        }
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
    tabBotones.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === modo);
    });

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
            if (!validation.valid) {
                return; 
            }
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
    pomodoroCount = 0; 
    cambiarModo('estudio');
}

function guardarYResetear() { 
    pausarTimer();
    if (esEstudio) {
        const tiempoEstudiadoSegundos = (duracionEstudioActual * 60) - tiempoRestante;
        const minutosEstudiados = Math.round(tiempoEstudiadoSegundos / 60);

        if (minutosEstudiados > 0) {
            const validation = getValidatedTopic(); 
            if (!validation.valid) {
                pausarTimer(); 
                return;
            }
            
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
    audioAlarma.play().catch(error => console.warn("No se pudo reproducir el sonido:", error));
    
    if (esEstudio) {
        pomodoroCount++; 
        pomodorosHoy++; 
        pomodoroCountDisplay.textContent = pomodorosHoy; 
        
        const validation = getValidatedTopic(); 
        if (validation.valid) { 
            guardarSesionEnBD(duracionEstudioActual, 'estudio', validation.topic); 
        }
        
        const cicloTarget = parseInt(inputCicloPomodoro.value);
        
        // Determinar tiempo de descanso
        if (cicloTarget > 0 && pomodoroCount > 0 && pomodoroCount % cicloTarget === 0) {
            tiempoTotalSegundos = parseInt(inputDescansoLargo.value) * 60;
        } else {
            tiempoTotalSegundos = parseInt(inputDescanso.value) * 60;
        }
        
        cambiarModo('descanso'); // Cambia a modo descanso
        
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
            if (!validation.valid) {
                return; 
            }
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
        if (!validation.valid) {
            pauseStopwatch(); 
            return;
        }
        guardarSesionEnBD(totalMinutes, currentActivity, validation.topic);
    }
    stopwatchElapsedTime = 0;
    stopwatchStartTime = 0;
    stopwatchDisplay.textContent = "00:00:00";
    btnStopwatchStart.textContent = "Iniciar";
    document.title = "Pomodoro Timer"; 
}

function addManualTime() {
    pauseStopwatch();
    
    // 1. Validar el tema
    const validation = getValidatedTopic();
    if (!validation.valid) {
        return;
    }
    
    // 2. Pedir minutos
    const input = prompt("Introduce el tiempo total en MINUTOS:");
    if (input === null || input.trim() === '') { return; }
    const duration = parseInt(input, 10);
    if (isNaN(duration) || duration <= 0) {
        alert('Por favor, introduce un número válido de minutos.');
        return;
    }
    
    // 3. Guardar (¡CON EL TEMA!)
    guardarSesionEnBD(duration, currentActivity, validation.topic);
    alert(`${duration} minutos de '${currentActivity}' guardados con éxito.`);
    
    // Si era un pomodoro, actualiza el contador de hoy
    if (currentActivity === 'estudio') {
        pomodorosHoy++;
        pomodoroCountDisplay.textContent = pomodorosHoy;
        pomodoroCount = pomodorosHoy % (parseInt(inputCicloPomodoro.value) || 4);
    }
    
    resetStopwatch(false); // Resetea el crono
    resetTimer(); // Resetea el pomodoro
}

// --- Función de BD (Modificada para aceptar TEMA) ---
async function guardarSesionEnBD(duracion, tipo, tema = null) { 
    try {
        await fetch('api/guardar_sesion.php', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duracion: duracion, tipo: tipo, tema: tema }) 
        });
    } catch (error) {
        console.error('Error de red al guardar:', error);
    }
}

// --- LÓGICA DE LAS TAREAS (CONECTADA A LA BD) ---
// (Esta sección no necesita más cambios)

function renderTask(task) {
    const listItem = document.createElement('li');
    listItem.className = 'task-item';
    listItem.setAttribute('data-id', task.id); 
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
    try {
        await fetchColorRules();
        const response = await fetch('api/get_tasks.php'); 
        const data = await response.json();
        taskList.innerHTML = ''; 
        if (data.success) {
            data.tasks.forEach(task => renderTask(task));
            pomodorosHoy = data.pomodoro_count;
            pomodoroCountDisplay.textContent = pomodorosHoy;
            const cicloTarget = parseInt(inputCicloPomodoro.value);
            if (cicloTarget > 0) {
                pomodoroCount = pomodorosHoy % cicloTarget;
            } else {
                pomodoroCount = 0;
            }
        } else {
            taskList.innerHTML = 'Error al cargar tareas.';
        }
    } catch (error) {
        taskList.innerHTML = 'Error de red al cargar tareas.';
    }
}

async function addTask() {
    const taskText = newTaskInput.value.trim();
    if (taskText !== '') {
        try {
            const response = await fetch('api/add_task.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: taskText }) }); 
            const data = await response.json();
            if (data.success) { renderTask(data.task); newTaskInput.value = ''; } else { alert(data.message); }
        } catch (error) { alert('Error de red al añadir tarea.'); }
    }
}

async function editTask(id, currentText, taskElement) {
    const newText = prompt('Editar tarea:', currentText);
    if (newText !== null && newText.trim() !== '' && newText !== currentText) {
        try {
            const response = await fetch('api/update_task_text.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, text: newText }) }); 
            const data = await response.json();
            if (data.success) {
                taskElement.querySelector('.task-text').textContent = newText;
                applyColorRule(taskElement, newText);
            } else { alert(data.message); }
        } catch (error) { alert('Error de red al editar tarea.'); }
    }
}

async function toggleTaskCompleted(id, isCompleted) {
    try { await fetch('api/update_task.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, completed: isCompleted }) }); } catch (error) { alert('Error de red al actualizar tarea.'); } 
}

async function deleteTask(id) {
    try { await fetch('api/delete_task.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }) }); } catch (error) { alert('Error de red al eliminar tarea.'); } 
}

async function saveTaskOrder(taskIds) {
    try { await fetch('api/update_task_order.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_ids: taskIds }) }); } catch (error) { console.error('Error al guardar el orden:', error); alert('Error al guardar el nuevo orden.'); } 
}

// --- Event Listeners ---
btnIniciar.addEventListener('click', iniciarTimer);
btnPausa.addEventListener('click', pausarTimer);
btnReset.addEventListener('click', guardarYResetear); 
tabBotones.forEach(btn => { btn.addEventListener('click', () => cambiarModo(btn.dataset.mode)); });
addTaskBtn.addEventListener('click', addTask);
newTaskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

// Listeners del Cronómetro
btnStopwatchStart.addEventListener('click', startStopwatch);
btnStopwatchPause.addEventListener('click', pauseStopwatch);
btnStopwatchSave.addEventListener('click', () => resetStopwatch(true));
btnStopwatchManual.addEventListener('click', addManualTime); 

// --- ¡LISTENER AÑADIDO! ---
btnPomodoroManual.addEventListener('click', addManualTime);

// Listener del Selector de Actividad
activityBotones.forEach(btn => {
    btn.addEventListener('click', () => switchActivity(btn.dataset.activity));
});

taskList.addEventListener('click', (e) => {
    const listItem = e.target.closest('li.task-item');
    if (!listItem) return; 
    const taskId = parseInt(listItem.dataset.id);
    if (e.target.classList.contains('task-checkbox')) { const isCompleted = e.target.checked; listItem.classList.toggle('completed', isCompleted); toggleTaskCompleted(taskId, isCompleted); } 
    else if (e.target.classList.contains('edit-task-btn')) { const currentText = listItem.querySelector('.task-text').textContent; editTask(taskId, currentText, listItem); } 
    else if (e.target.classList.contains('delete-task-btn')) { listItem.remove(); deleteTask(taskId); }
});

// --- Inicializar al cargar la página ---
actualizarDisplay();
loadAndRenderTasks(); 

new Sortable(taskList, {
    animation: 150, handle: '.task-item', filter: '.task-checkbox, .edit-task-btn, .delete-task-btn', 
    onEnd: function (evt) {
        const taskItems = taskList.querySelectorAll('li.task-item');
        const taskIdsInOrder = Array.from(taskItems).map(item => item.dataset.id);
        saveTaskOrder(taskIdsInOrder);
    }
});