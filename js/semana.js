document.addEventListener('DOMContentLoaded', () => {

    const weekGrid = document.querySelector('.week-grid');
    const weekTitle = document.getElementById('week-title');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    
    // Nombres de meses para el título
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
        // 1. Limpiar todas las listas
        document.querySelectorAll('.task-list').forEach(list => list.innerHTML = '');
        
        // 2. Calcular las 7 fechas de esta semana
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            dates.push(date);
        }
        
        const monday = dates[0];
        const sunday = dates[6];

        // 3. Actualizar la UI (Títulos y atributos data-date)
        weekTitle.textContent = `Semana del ${monday.getDate()} ${monthNames[monday.getMonth()]} al ${sunday.getDate()} ${monthNames[sunday.getMonth()]} ${sunday.getFullYear()}`;
        
        document.querySelectorAll('.day-column').forEach((col, index) => {
            const date = dates[index];
            col.setAttribute('data-date', formatDate(date));
            col.querySelector('.day-date').textContent = `(${date.getDate()}/${date.getMonth() + 1})`;
        });

        // 4. Cargar las reglas de color (de colorRules.js)
        await fetchColorRules();
        
        // 5. Pedir a la API las tareas para este rango de fechas
        try {
            const response = await fetch(`api/get_semana.php?start=${formatDate(monday)}&end=${formatDate(sunday)}`);
            const data = await response.json();
            
            if (data.success) {
                // 6. Dibujar las tareas en sus columnas correctas
                data.tasks.forEach(task => renderTask(task));
                // 7. Reactivar el drag-and-drop en las listas
                initSortable(); 
            } else {
                console.error(data.message);
            }
        } catch (error) {
            console.error('Error de red:', error);
        }
    }

    // --- Lógica de Tareas (Modificada) ---

    async function saveTaskOrder(taskIds) {
        try {
            await fetch('api/update_task_order.php', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_ids: taskIds })
            });
        } catch (error) { console.error('Error al guardar el orden:', error); }
    }
    
    async function moveTask(taskId, newDate, sourceListIds, destListIds) {
        try {
            const response = await fetch('api/move_task.php', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_id: taskId,
                    new_date: newDate, // Enviar la nueva fecha
                    source_list_ids: sourceListIds,
                    dest_list_ids: destListIds
                })
            });
            const data = await response.json();
            if (!data.success) { location.reload(); }
        } catch (error) { console.error('Error al mover la tarea:', error); }
    }
    
    function renderTask(task) {
        // Encuentra la columna por la fecha, no por el nombre del día
        const cell = document.querySelector(`.day-column[data-date="${task.fecha_tarea}"]`);
        if (!cell) return;

        const taskList = cell.querySelector('.task-list'); 
        const listItem = document.createElement('li');
        listItem.className = 'task-item'; 
        listItem.setAttribute('data-id', task.id);
        
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

    function initSortable() {
        document.querySelectorAll('.task-list').forEach(list => {
            new Sortable(list, {
                group: 'semana-tasks', 
                animation: 150,
                handle: '.task-item',
                filter: '.task-checkbox, .edit-task-btn, .delete-task-btn',
                onEnd: function (evt) {
                    const sourceList = evt.from;
                    const destList = evt.to;
                    const getIdsFromList = (listEl) => Array.from(listEl.querySelectorAll('li.task-item')).map(item => item.dataset.id);

                    if (sourceList === destList) {
                        // Reordenar en el mismo día
                        saveTaskOrder(getIdsFromList(sourceList)); 
                    } else {
                        // Mover a un día diferente
                        const taskId = evt.item.dataset.id;
                        // ¡NUEVO! Obtenemos la FECHA de la columna de destino
                        const newDate = destList.closest('.day-column').dataset.date;
                        
                        moveTask(taskId, newDate, getIdsFromList(sourceList), getIdsFromList(destList));
                    }
                }
            });
        });
    }

    async function addTask(text, date) { // <-- Ahora recibe una fecha
        if (text.trim() === '') return;
        try {
            const response = await fetch('api/add_semana.php', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, date: date }) // <-- Envía la fecha
            });
            const data = await response.json();
            if (data.success) { renderTask(data.task); } else { alert(data.message); }
        } catch (error) { alert('Error de red al añadir tarea.'); }
    }
    
    async function editTask(id, currentText, taskElement) {
        const newText = prompt('Editar tarea:', currentText);
        if (newText !== null && newText.trim() !== '' && newText !== currentText) {
            try {
                const response = await fetch('api/update_task_text.php', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id, text: newText })
                });
                const data = await response.json();
                if (data.success) {
                    taskElement.querySelector('.task-text').textContent = newText;
                    applyColorRule(taskElement, newText);
                } else { alert(data.message); }
            } catch (error) { alert('Error de red al editar tarea.'); }
        }
    }

    async function updateTask(id, isCompleted) {
        try { await fetch('api/update_semana.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, completed: isCompleted }) }); } catch (error) { alert('Error de red al actualizar tarea.'); }
    }

    async function deleteTask(id) {
        try { await fetch('api/delete_semana.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }) }); } catch (error) { alert('Error de red al eliminar tarea.'); }
    }

    // --- Event Listeners (Modificados) ---
    weekGrid.addEventListener('click', (e) => {
        const listItem = e.target.closest('li.task-item');

        if (e.target.tagName === 'BUTTON' && e.target.closest('.task-input-group')) {
            const dayColumn = e.target.closest('.day-column');
            const date = dayColumn.dataset.date; // <-- Obtiene la fecha de la columna
            const input = dayColumn.querySelector('input');
            addTask(input.value, date); // <-- Pasa la fecha
            input.value = ''; 
        }

        if (!listItem) return;
        const taskId = parseInt(listItem.dataset.id);

        if (e.target.classList.contains('task-checkbox')) { const isCompleted = e.target.checked; listItem.classList.toggle('completed', isCompleted); updateTask(taskId, isCompleted); }
        else if (e.target.classList.contains('edit-task-btn')) { const currentText = listItem.querySelector('.task-text').textContent; editTask(taskId, currentText, listItem); }
        else if (e.target.classList.contains('delete-task-btn')) { listItem.remove(); deleteTask(taskId); }
    });

    weekGrid.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (e.target.tagName === 'INPUT' && e.target.closest('.task-input-group')) {
                const dayColumn = e.target.closest('.day-column');
                const date = dayColumn.dataset.date; // <-- Obtiene la fecha
                const input = e.target;
                addTask(input.value, date); // <-- Pasa la fecha
                input.value = '';
                e.preventDefault();
            }
        }
    });
    
    // --- Listeners de Navegación de Semana ---
    prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7); // Resta 7 días
        loadWeek(currentWeekStart);
    });
    
    nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7); // Suma 7 días
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
        const walk = (x - startX) * 2; // Multiplicador para mover más rápido
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

    // --- Carga Inicial ---
    loadWeek(currentWeekStart);
});