document.addEventListener('DOMContentLoaded', () => {

    const weekGrid = document.querySelector('.week-grid');

    // --- Lógica de Paneo (Arrastrar Fondo) ---
    let isPanning = false;

    weekGrid.addEventListener('mousedown', (e) => {
        const clickedOnTask = e.target.closest('.task-item, .task-input-group, button, input, .task-checkbox, .delete-task-btn, .edit-task-btn');
        if (e.button !== 0 || clickedOnTask) {
            return;
        }
        isPanning = true;
        weekGrid.classList.add('is-panning');
    });

    weekGrid.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        weekGrid.scrollLeft -= e.movementX;
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
        weekGrid.classList.remove('is-panning');
    });
    
    weekGrid.addEventListener('mouseleave', () => {
        isPanning = false;
        weekGrid.classList.remove('is-panning');
    });
    // --- Fin Lógica de Paneo ---


    // --- Lógica de Tareas ---

    async function saveTaskOrder(taskIds) {
        try {
            await fetch('api/update_task_order.php', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_ids: taskIds })
            });
        } catch (error) {
            console.error('Error al guardar el orden:', error);
            alert('Error al guardar el nuevo orden.');
        }
    }
    
    async function moveTask(taskId, newDay, sourceListIds, destListIds) {
        try {
            const response = await fetch('api/move_task.php', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_id: taskId,
                    new_day: newDay,
                    source_list_ids: sourceListIds,
                    dest_list_ids: destListIds
                })
            });
            const data = await response.json();
            if (!data.success) {
                alert('Error al mover la tarea: ' + data.message);
                location.reload(); 
            }
        } catch (error) {
            console.error('Error al mover la tarea:', error);
        }
    }
    
    function renderTask(task) {
        const dayColumn = document.querySelector(`.day-column[data-day-id="${task.dia_semana}"]`);
        if (!dayColumn) return;

        const taskList = dayColumn.querySelector('.task-list'); 
        
        const listItem = document.createElement('li');
        listItem.className = 'task-item'; 
        listItem.setAttribute('data-id', task.id);
        
        // ¡NUEVO! Lógica de color dinámica
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

    async function loadWeeklyTasks() {
        try {
            // ¡NUEVO! Carga las reglas de color PRIMERO
            await fetchColorRules();
            
            const response = await fetch('api/get_semana.php'); 
            const data = await response.json();
            
            if (data.success) {
                document.querySelectorAll('.task-list').forEach(list => list.innerHTML = '');
                data.tasks.forEach(task => renderTask(task));
                initSortable(); 
            } else {
                console.error(data.message);
            }
        } catch (error) {
            console.error('Error de red:', error);
        }
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
                    
                    const getIdsFromList = (listEl) => {
                        const items = listEl.querySelectorAll('li.task-item');
                        return Array.from(items).map(item => item.dataset.id);
                    };

                    if (sourceList === destList) {
                        const taskIdsInOrder = getIdsFromList(sourceList);
                        saveTaskOrder(taskIdsInOrder); 
                    } else {
                        const taskId = evt.item.dataset.id;
                        const newDay = destList.closest('.day-column').dataset.dayId;
                        const sourceListIds = getIdsFromList(sourceList);
                        const destListIds = getIdsFromList(destList);
                        moveTask(taskId, newDay, sourceListIds, destListIds);
                    }
                }
            });
        });
    }

    async function addTask(text, day) {
        if (text.trim() === '') return;
        try {
            const response = await fetch('api/add_semana.php', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, day: day })
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
                    
                    // ¡NUEVO! Re-aplica la regla de color
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

    weekGrid.addEventListener('click', (e) => {
        const listItem = e.target.closest('li.task-item');
        if (e.target.tagName === 'BUTTON' && e.target.dataset.day) {
            const day = e.target.dataset.day;
            const input = e.target.closest('.task-input-group').querySelector('input');
            addTask(input.value, day);
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
            if (e.target.tagName === 'INPUT' && e.target.getAttribute('type') === 'text') {
                const button = e.target.nextElementSibling;
                if (button && button.dataset.day) {
                    const day = button.dataset.day;
                    const input = e.target;
                    addTask(input.value, day);
                    input.value = '';
                    e.preventDefault();
                }
            }
        }
    });

    loadWeeklyTasks();
});