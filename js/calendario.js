import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, query, where, getDocs, 
    doc, deleteDoc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { fetchColorRules, applyEventColorRule } from './colorRules.js';

document.addEventListener('DOMContentLoaded', () => {
    
    const calendarBody = document.getElementById('calendar-body');
    const monthYearTitle = document.getElementById('month-year-title');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const modeBtns = document.querySelectorAll('.mode-btn');

    let currentDate = new Date(); 
    let currentMode = 'clases'; // Por defecto

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    function formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // --- CAMBIO DE MODO ---
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Actualizar visual
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Actualizar lógica
            currentMode = btn.dataset.mode;
            renderCalendar(currentDate); // Recargar eventos
        });
    });

    async function renderCalendar(date) {
        if (!auth.currentUser) return;

        calendarBody.innerHTML = ''; 
        const year = date.getFullYear();
        const month = date.getMonth(); 
        
        monthYearTitle.textContent = `${monthNames[month]} ${year}`;

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        
        let firstDayOfWeek = firstDayOfMonth.getDay() - 1;
        if (firstDayOfWeek === -1) firstDayOfWeek = 6; 

        for (let i = 0; i < firstDayOfWeek; i++) {
            calendarBody.appendChild(createDayCell(null, true)); 
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDayDate = new Date(year, month, day);
            const dateString = formatDate(currentDayDate);
            calendarBody.appendChild(createDayCell(day, false, dateString));
        }

        const totalCells = 42; 
        const cellsRendered = firstDayOfWeek + daysInMonth;
        const remainingCells = totalCells - cellsRendered;
        
        for (let day = 1; day <= remainingCells; day++) {
            calendarBody.appendChild(createDayCell(null, true));
        }

        await fetchColorRules();
        fetchEvents(year, month + 1); 
    }

    function createDayCell(dayNumber, isOtherMonth, dateString = null) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        if (isOtherMonth) {
            cell.classList.add('day-other-month');
        } else {
            cell.innerHTML = `<span class="day-number">${dayNumber}</span>`;
        }
        
        if (dateString && !isOtherMonth) {
            cell.setAttribute('data-date', dateString);
            cell.addEventListener('click', (e) => {
                if(e.target.closest('.calendar-event')) return;
                
                // Texto personalizado según el modo
                const tipoTexto = currentMode === 'clases' ? 'clase/estudio' : 'entrenamiento';
                const text = prompt(`Añadir ${tipoTexto} para el ${dateString}:`);
                
                if (text && text.trim() !== '') {
                    addEvent(dateString, text);
                }
            });
        }
        return cell;
    }

    async function fetchEvents(year, month) {
        try {
            const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
            const endStr = `${year}-${String(month).padStart(2, '0')}-31`;

            // AHORA FILTRAMOS TAMBIÉN POR 'tipo_calendario'
            const q = query(
                collection(db, "calendario_eventos"),
                where("user_id", "==", auth.currentUser.uid),
                where("fecha_evento", ">=", startStr),
                where("fecha_evento", "<=", endStr),
                where("tipo_calendario", "==", currentMode) // <--- CLAVE
            );

            const querySnapshot = await getDocs(q);
            
            querySnapshot.forEach(doc => {
                const evento = doc.data();
                evento.id = doc.id; 
                
                const cell = document.querySelector(`.calendar-day[data-date="${evento.fecha_evento}"]`);
                if (cell) {
                    renderEvent(cell, evento);
                }
            });
        } catch (error) {
            console.error('Error al cargar eventos:', error);
            // Si falla por falta de índice, avisa en consola
        }
    }

    function renderEvent(cell, evento) {
        const eventEl = document.createElement('div');
        eventEl.className = 'calendar-event';
        eventEl.setAttribute('data-id', evento.id);
        
        applyEventColorRule(eventEl, evento.texto_evento); 
        
        eventEl.innerHTML = `
            <span class="event-text">${evento.texto_evento}</span>
            <button class="delete-event-btn">✕</button>
        `;
        
        eventEl.addEventListener('click', (e) => {
            e.stopPropagation(); 
            if (e.target.classList.contains('delete-event-btn')) return;

            const newText = prompt("Editar evento:", evento.texto_evento);
            if (newText && newText !== evento.texto_evento) {
                editEvent(evento.id, newText, eventEl);
            }
        });

        eventEl.querySelector('.delete-event-btn').addEventListener('click', (e) => {
            e.stopPropagation(); 
            if (confirm('¿Eliminar este evento?')) {
                deleteEvent(evento.id, eventEl);
            }
        });
        
        cell.appendChild(eventEl);
    }

    async function addEvent(dateString, text) {
        if (!auth.currentUser) return;
        try {
            const newEvent = {
                user_id: auth.currentUser.uid,
                fecha_evento: dateString,
                texto_evento: text,
                tipo_calendario: currentMode // <--- GUARDAMOS EL TIPO
            };
            
            const docRef = await addDoc(collection(db, "calendario_eventos"), newEvent);
            
            const cell = document.querySelector(`.calendar-day[data-date="${dateString}"]`);
            if (cell) {
                newEvent.id = docRef.id;
                renderEvent(cell, newEvent);
            }
        } catch (error) {
            console.error("Error añadiendo evento:", error);
            // Si es por índice, el usuario lo verá en consola
            alert('Error al añadir evento. Revisa la consola si es la primera vez (Índices).');
        }
    }

    async function editEvent(id, newText, eventEl) {
        try {
            const eventRef = doc(db, "calendario_eventos", id);
            await updateDoc(eventRef, {
                texto_evento: newText
            });
            eventEl.querySelector('.event-text').textContent = newText;
            applyEventColorRule(eventEl, newText); 
        } catch (error) {
            console.error("Error editando evento:", error);
            alert("No se pudo actualizar el evento.");
        }
    }

    async function deleteEvent(id, element) {
        try {
            await deleteDoc(doc(db, "calendario_eventos", id));
            element.remove(); 
        } catch (error) {
            console.error("Error eliminando evento:", error);
            alert('Error al eliminar evento.');
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

    auth.onAuthStateChanged(user => {
        if (user) {
            renderCalendar(currentDate);
        }
    });
});




