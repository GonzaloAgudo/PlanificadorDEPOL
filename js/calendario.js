document.addEventListener('DOMContentLoaded', () => {
    
    const calendarBody = document.getElementById('calendar-body');
    const monthYearTitle = document.getElementById('month-year-title');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');

    let currentDate = new Date(); 
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    async function renderCalendar(date) {
        calendarBody.innerHTML = ''; 
        const year = date.getFullYear();
        const month = date.getMonth(); 
        monthYearTitle.textContent = `${monthNames[month]} ${year}`;
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const lastDayOfPrevMonth = new Date(year, month, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const daysInPrevMonth = lastDayOfPrevMonth.getDate();
        let firstDayOfWeek = firstDayOfMonth.getDay() - 1;
        if (firstDayOfWeek === -1) firstDayOfWeek = 6; 
        for (let i = 0; i < firstDayOfWeek; i++) {
            const day = daysInPrevMonth - firstDayOfWeek + i + 1;
            calendarBody.appendChild(createDayCell(day, true)); 
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            calendarBody.appendChild(createDayCell(day, false, dateString));
        }
        const totalCells = 42; 
        const cellsRendered = firstDayOfWeek + daysInMonth;
        const remainingCells = totalCells - cellsRendered;
        for (let day = 1; day <= remainingCells; day++) {
            calendarBody.appendChild(createDayCell(day, true));
        }
        
        // ¡NUEVO! Carga las reglas de color PRIMERO
        await fetchColorRules();
        fetchEvents(month + 1, year); 
    }

    function createDayCell(dayNumber, isOtherMonth, dateString = null) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        if (isOtherMonth) {
            cell.classList.add('day-other-month');
        }
        cell.innerHTML = `<span class="day-number">${dayNumber}</span>`;
        if (dateString) {
            cell.setAttribute('data-date', dateString);
            cell.addEventListener('click', () => {
                const text = prompt(`Añadir clase para el ${dateString}:`);
                if (text && text.trim() !== '') {
                    addEvent(dateString, text);
                }
            });
        }
        return cell;
    }

    async function fetchEvents(month, year) {
        try {
            const response = await fetch(`api/get_eventos.php?month=${month}&year=${year}`); 
            const data = await response.json();
            if (data.success) {
                data.eventos.forEach(evento => {
                    const cell = document.querySelector(`.calendar-day[data-date="${evento.fecha_evento}"]`);
                    if (cell) {
                        renderEvent(cell, evento);
                    }
                });
            }
        } catch (error) {
            console.error('Error de red al cargar eventos:', error);
        }
    }

    function renderEvent(cell, evento) {
        const eventEl = document.createElement('div');
        eventEl.className = 'calendar-event';
        eventEl.setAttribute('data-id', evento.id);
        
        // ¡NUEVO! Lógica de color dinámica
        applyEventColorRule(eventEl, evento.texto_evento); 
        
        eventEl.innerHTML = `
            <span class="event-text">${evento.texto_evento}</span>
            <button class="delete-event-btn">✕</button>
        `;
        
        eventEl.querySelector('.delete-event-btn').addEventListener('click', (e) => {
            e.stopPropagation(); 
            if (confirm('¿Eliminar esta clase?')) {
                deleteEvent(evento.id, eventEl);
            }
        });
        
        cell.appendChild(eventEl);
    }

    async function addEvent(dateString, text) {
        try {
            const response = await fetch('api/add_evento.php', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: dateString, text: text })
            });
            const data = await response.json();
            if (data.success) {
                const cell = document.querySelector(`.calendar-day[data-date="${dateString}"]`);
                if (cell) {
                    renderEvent(cell, data.evento);
                }
            } else {
                alert(data.message);
            }
        } catch (error) {
            alert('Error de red al añadir evento.');
        }
    }

    async function deleteEvent(id, element) {
        try {
            const response = await fetch('api/delete_evento.php', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id })
            });
            const data = await response.json();
            if (data.success) {
                element.remove(); 
            } else {
                alert(data.message);
            }
        } catch (error) {
            alert('Error de red al eliminar evento.');
        }
    }

    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
    });

    renderCalendar(currentDate);
});