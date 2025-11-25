// Importamos Firebase y las configuraciones
import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, query, where, getDocs, 
    orderBy, limit, doc, updateDoc, deleteDoc, 
    writeBatch 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// Importamos las reglas de color
import { fetchColorRules, applyColorRule } from './colorRules.js';

document.addEventListener('DOMContentLoaded', () => {

    const weekGrid = document.querySelector('.week-grid');
    const weekTitle = document.getElementById('week-title');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    // --- Estado de la Semana ---
    let currentWeekStart = getMonday(new Date());

    // --- Función para obtener el Lunes de una fecha ---
    function getMonday(date) {
        const d = new Date(date);
        const day = d.getDay(); // Domingo = 0, Lunes = 1, ... Sábado = 6
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar a Lunes
        return new Date(d.setDate(diff));
    }
    
    // --- Función para formatear fechas ---
    // Formato YYYY-MM-DD
    function formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    
    // --- Función Principal de Carga ---
    async function loadWeek(startDate) {
        if (!auth.currentUser) return; // Esperar a que el usuario esté listo
        
        document.querySelectorAll('.task-list').forEach(list => list.innerHTML = 'Cargando...');
        
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            dates.push(date);
        }
        
        const monday = dates[0];
        const sunday = dates[6];

        weekTitle.textContent = `Semana del ${monday.getDate()} ${monthNames[monday.getMonth()]} al ${sunday.getDate()} ${monthNames[sunday.getMonth()]} ${sunday.getFullYear()}`;
        
        document.querySelectorAll('.day-column').forEach((col, index) => {
            const date = dates[index];
            col.setAttribute('data-date', formatDate(date));
            col.querySelector('.day-date').textContent = `(${date.getDate()}/${date.getMonth() + 1})`;
            col.querySelector('.task-list').innerHTML = ''; // Limpiar
        });

        // Cargar las reglas de color
        await fetchColorRules();
        
        // Pedir a la API las tareas para este rango de fechas
        try {
            const q = query(
                collection(db, "tareas_semanales"),
                where("user_id", "==", auth.currentUser.uid),
                where("fecha_tarea", ">=", formatDate(monday)),
                where("fecha_tarea", "<=", formatDate(sunday)),
                orderBy("fecha_tarea", "asc"),
                orderBy("orden", "asc")
            );
            
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => renderTask(doc));
            
            initSortable(); 
        } catch (error) {
            console.error('Error al cargar tareas:', error);
        }
    }

    // --- Lógica de Tareas ---

    async function saveTaskOrder(taskIds) {
        if (!auth.currentUser) return;
        try {
            const batch = writeBatch(db);
            taskIds.forEach((id, index) => {
                const docRef = doc(db, "tareas_semanales", id);
                batch.update(docRef, { orden: index + 1 });
            });
            await batch.commit();
        } catch (error) { console.error('Error al guardar el orden:', error); }
    }
    
    async function moveTask(taskId, newDate, sourceListIds, destListIds) {
        if (!auth.currentUser) return;
        try {
            const batch = writeBatch(db);
            
            // 1. Mover y actualizar la fecha de la tarea
            const taskRef = doc(db, "tareas_semanales", taskId);
            batch.update(taskRef, { fecha_tarea: newDate });
            
            // 2. Reordenar lista de origen
            sourceListIds.forEach((id, index) => {
                const docRef = doc(db, "tareas_semanales", id);
                batch.update(docRef, { orden: index + 1 });
            });
            
            // 3. Reordenar lista de destino
            destListIds.forEach((id, index) => {
                const docRef = doc(db, "tareas_semanales", id);
                batch.update(docRef, { orden: index + 1 });
            });
            
            await batch.commit();
        } catch (error) { 
            console.error('Error al mover la tarea:', error); 
            location.reload(); // Recarga si la BD falla
        }
    }
    
    function renderTask(taskDoc) {
        const task = taskDoc.data();
        const cell = document.querySelector(`.day-column[data-date="${task.fecha_tarea}"]`);
        if (!cell) return;

        const taskList = cell.querySelector('.task-list'); 
        const listItem = document.createElement('li');
        listItem.className = 'task-item'; 
        listItem.setAttribute('data-id', taskDoc.id); // ID del documento
        
        applyColorRule(listItem, task.texto); // De colorRules.js

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

    // --- AQUÍ ESTÁ EL CAMBIO (Retraso para móviles) ---
    function initSortable() {
        document.querySelectorAll('.task-list').forEach(list => {
            new Sortable(list, {
                group: 'semana-tasks', 
                animation: 150,
                handle: '.task-item',
                delay: 200, // <--- Retraso de 200ms (Mantiene pulsado para arrastrar)
                delayOnTouchOnly: true, // <--- Solo en móviles, en PC es instantáneo
                filter: '.task-checkbox, .edit-task-btn, .delete-task-btn',
                onEnd: function (evt) {
                    const sourceList = evt.from;
                    const destList = evt.to;
                    const getIdsFromList = (listEl) => Array.from(listEl.querySelectorAll('li.task-item')).map(item => item.dataset.id);

                    if (sourceList === destList) {
                        saveTaskOrder(getIdsFromList(sourceList)); 
                    } else {
                        const taskId = evt.item.dataset.id;
                        const newDate = destList.closest('.day-column').dataset.date;
                        moveTask(taskId, newDate, getIdsFromList(sourceList), getIdsFromList(destList));
                    }
                }
            });
        });
    }

    async function addTask(text, date) {
        if (text.trim() === '' || !auth.currentUser) return;
        try {
            // Obtener orden más alto
            const qOrder = query(
                collection(db, "tareas_semanales"),
                where("user_id", "==", auth.currentUser.uid),
                where("fecha_tarea", "==", date),
                orderBy("orden", "desc"),
                limit(1)
            );
            const snapOrder = await getDocs(qOrder);
            const newOrder = snapOrder.empty ? 1 : snapOrder.docs[0].data().orden + 1;

            const newTask = {
                user_id: auth.currentUser.uid,
                texto: text,
                fecha_tarea: date,
                completada: false,
                orden: newOrder
            };
            
            const docRef = await addDoc(collection(db, "tareas_semanales"), newTask);
            renderTask({ id: docRef.id, data: () => newTask });
        } catch (error) { 
            console.error("Error al añadir tarea:", error);
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

    async function updateTask(id, isCompleted) {
        try { await updateDoc(doc(db, "tareas_semanales", id), { completada: isCompleted }); } catch(e) { console.error(e); }
    }

    async function deleteTask(id) {
        try { await deleteDoc(doc(db, "tareas_semanales", id)); } catch(e) { console.error(e); }
    }

    // --- Event Listeners ---
    weekGrid.addEventListener('click', (e) => {
        const listItem = e.target.closest('li.task-item');

        if (e.target.tagName === 'BUTTON' && e.target.closest('.task-input-group')) {
            const dayColumn = e.target.closest('.day-column');
            const date = dayColumn.dataset.date;
            const input = dayColumn.querySelector('input');
            addTask(input.value, date);
            input.value = ''; 
        }

        if (!listItem) return;
        const taskId = listItem.dataset.id;

        if (e.target.classList.contains('task-checkbox')) { const isCompleted = e.target.checked; listItem.classList.toggle('completed', isCompleted); updateTask(taskId, isCompleted); }
        else if (e.target.classList.contains('edit-task-btn')) { const currentText = listItem.querySelector('.task-text').textContent; editTask(taskId, currentText, listItem); }
        else if (e.target.classList.contains('delete-task-btn')) { listItem.remove(); deleteTask(taskId); }
    });

    weekGrid.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (e.target.tagName === 'INPUT' && e.target.closest('.task-input-group')) {
                const dayColumn = e.target.closest('.day-column');
                const date = dayColumn.dataset.date;
                const input = e.target;
                addTask(input.value, date);
                input.value = '';
                e.preventDefault();
            }
        }
    });
    
    // --- Listeners de Navegación de Semana ---
    prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7); 
        loadWeek(currentWeekStart);
    });
    
    nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7); 
        loadWeek(currentWeekStart);
    });
    
    // --- Lógica de Paneo (Arrastrar Fondo) ---
    let isPanning = false;
    let startX;
    let scrollLeft;

    weekGrid.addEventListener('mousedown', (e) => {
        const clickedOnTask = e.target.closest('.task-item, .task-input-group, button, input, .task-checkbox, .delete-task-btn, .edit-task-btn');
        if (e.button !== 0 || clickedOnTask) return;
        isPanning = true;
        weekGrid.classList.add('is-panning');
        startX = e.pageX - weekGrid.offsetLeft;
        scrollLeft = weekGrid.scrollLeft;
    });
    weekGrid.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        const x = e.pageX - weekGrid.offsetLeft;
        const walk = (x - startX) * 2; 
        weekGrid.scrollLeft = scrollLeft - walk;
    });
    window.addEventListener('mouseup', () => {
        isPanning = false;
        weekGrid.classList.remove('is-panning');
    });
    weekGrid.addEventListener('mouseleave', () => {
        isPanning = false;
        weekGrid.classList.remove('is-panning');
    });

    // --- Carga Inicial (Esperando Auth) ---
    auth.onAuthStateChanged(user => {
        if (user) {
            loadWeek(currentWeekStart);
        }
    });
});