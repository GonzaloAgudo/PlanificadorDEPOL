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
    let currentMode = 'clases'; 

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
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
            renderCalendar(currentDate); 
        });
    });

    // --- SCROLL AUTOMÁTICO AL DÍA DE HOY (MÓVIL) ---
    function scrollToToday() {
        // Pequeño timeout para asegurar que el DOM se ha pintado
        setTimeout(() => {
            const todayEl = document.querySelector('.calendar-day.is-today');
            if (todayEl) {
                todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    }

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
        await fetchEvents(year, month + 1);
        
        // Al terminar de cargar todo, hacemos scroll si es el mes actual
        const now = new Date();
        if (month === now.getMonth() && year === now.getFullYear()) {
            scrollToToday();
        }
    }

    function createDayCell(dayNumber, isOtherMonth, dateString = null) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        
        // 1. DETECTAR HOY
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (dateString === todayStr && !isOtherMonth) {
            cell.classList.add('is-today');
        }

        // 2. DETECTAR FIN DE SEMANA (Automático)
        if (dateString && !isOtherMonth) {
            const dateStruct = new Date(dateString);
            const dayOfWeek = dateStruct.getDay(); 
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                cell.classList.add('is-weekend'); 
            }
        }

        if (isOtherMonth) {
            cell.classList.add('day-other-month');
        } else {
            const dayNamesShort = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
            let dayNameHTML = '';
            if(dateString) {
                const dateStruct = new Date(dateString);
                const dayName = dayNamesShort[dateStruct.getDay()];
                dayNameHTML = `<span class="d-name" style="font-size:0.8rem; color:#888; font-weight:normal; margin-left:5px;">${dayName}</span>`;
            }
            cell.innerHTML = `<span class="day-number"><span class="d-num">${dayNumber}</span>${dayNameHTML}</span>`;
        }
        
        if (dateString && !isOtherMonth) {
            cell.setAttribute('data-date', dateString);
            cell.addEventListener('click', (e) => {
                // Si pulsa en un evento visible, no hacemos nada aquí (lo maneja el evento)
                if(e.target.closest('.calendar-event')) return;
                
                // LÓGICA ESPECIAL: Si hay un festivo oculto en este día
                if (cell.dataset.festivoId) {
                    const removeFestivo = confirm("Este día está marcado como Festivo. ¿Quieres quitar el festivo?");
                    if (removeFestivo) {
                        // Borramos el evento oculto
                        // Como no tenemos el elemento visual del evento aquí, lo buscamos o llamamos a delete directo
                        deleteDoc(doc(db, "calendario_eventos", cell.dataset.festivoId))
                            .then(() => {
                                cell.classList.remove('is-weekend');
                                delete cell.dataset.festivoId;
                                // Si era finde real, volvemos a poner la clase, si no, la quitamos
                                const dObj = new Date(dateString);
                                if (dObj.getDay() === 0 || dObj.getDay() === 6) cell.classList.add('is-weekend');
                            })
                            .catch(err => console.error(err));
                        return; // Salimos para no abrir el prompt de añadir
                    }
                }

                const tipoTexto = currentMode === 'clases' ? 'clase/estudio' : 'entrenamiento';
                const text = prompt(`Añadir ${tipoTexto} para el ${dateString}:\n(Escribe "Festivo" para marcar en rojo)`);
                
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

            const q = query(
                collection(db, "calendario_eventos"),
                where("user_id", "==", auth.currentUser.uid),
                where("fecha_evento", ">=", startStr),
                where("fecha_evento", "<=", endStr),
                where("tipo_calendario", "==", currentMode) 
            );

            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
                const evento = doc.data();
                evento.id = doc.id; 
                const cell = document.querySelector(`.calendar-day[data-date="${evento.fecha_evento}"]`);
                if (cell) renderEvent(cell, evento);
            });
        } catch (error) {
            console.error('Error al cargar eventos:', error);
        }
    }

    function renderEvent(cell, evento) {
        const isFestivo = evento.texto_evento.trim().toLowerCase() === 'festivo';

        // --- 3. GESTIÓN DE FESTIVOS ---
        if (isFestivo) {
            cell.classList.add('is-weekend'); // Pintar rojo
            cell.dataset.festivoId = evento.id; // Guardar ID en la celda para poder borrarlo al hacer click en el día
        }
        // ------------------------------

        const eventEl = document.createElement('div');
        eventEl.className = 'calendar-event';
        
        // Si es festivo, le añadimos la clase para ocultarlo
        if (isFestivo) eventEl.classList.add('festivo-hidden');

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
                // Si deja de ser festivo
                if (isFestivo && newText.toLowerCase() !== 'festivo') {
                    cell.classList.remove('is-weekend');
                    delete cell.dataset.festivoId;
                    eventEl.classList.remove('festivo-hidden');
                }
                editEvent(evento.id, newText, eventEl);
            }
        });

        eventEl.querySelector('.delete-event-btn').addEventListener('click', (e) => {
            e.stopPropagation(); 
            if (confirm('¿Eliminar este evento?')) {
                if (isFestivo) {
                    cell.classList.remove('is-weekend');
                    delete cell.dataset.festivoId;
                }
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
                tipo_calendario: currentMode
            };
            const docRef = await addDoc(collection(db, "calendario_eventos"), newEvent);
            const cell = document.querySelector(`.calendar-day[data-date="${dateString}"]`);
            if (cell) {
                newEvent.id = docRef.id;
                renderEvent(cell, newEvent);
            }
        } catch (error) {
            console.error("Error añadiendo evento:", error);
            alert('Error al añadir evento.');
        }
    }

    async function editEvent(id, newText, eventEl) {
        try {
            await updateDoc(doc(db, "calendario_eventos", id), { texto_evento: newText });
            eventEl.querySelector('.event-text').textContent = newText;
            applyEventColorRule(eventEl, newText); 
            // Si acabamos de convertir un evento normal a festivo, hay que recargar para aplicar estilos o hacerlo manual
            if (newText.toLowerCase() === 'festivo') {
                // Truco rápido: Recargar el calendario es lo más seguro visualmente
                // renderCalendar(currentDate); 
                // O forzar reload de página:
                 location.reload();
            }
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
        if (user) renderCalendar(currentDate);
    });
});