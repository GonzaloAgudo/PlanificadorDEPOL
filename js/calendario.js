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

    // --- ELEMENTOS DEL MODAL ---
    const modal = document.getElementById('event-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.getElementById('modal-desc');
    const modalId = document.getElementById('modal-event-id');
    const btnSave = document.getElementById('btn-modal-save');
    const btnCancel = document.getElementById('btn-modal-cancel');
    const btnDelete = document.getElementById('btn-modal-delete');
    
    const modalHeader = document.querySelector('.modal-content h2'); 

    let currentDate = new Date(); 
    let currentMode = 'clases'; 
    let activeCellElement = null; 
    let targetDateForNewEvent = null; 

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

    // --- SCROLL AUTOMÁTICO (SOLO MÓVIL) ---
    function scrollToToday() {
        if (window.innerWidth > 768) return; 
        setTimeout(() => {
            const todayEl = document.querySelector('.calendar-day.is-today');
            if (todayEl) {
                todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    }

    // --- FUNCIONES DEL MODAL ---
    
    // Función unificada para abrir el modal (Crear o Editar)
    function openModal(id, title, desc, cellElement, dateForNew = null) {
        modalId.value = id || ''; 
        modalTitle.value = title || '';
        modalDesc.value = desc || ''; 
        activeCellElement = cellElement;
        targetDateForNewEvent = dateForNew;

        // Cambiar textos visuales
        if (id) {
            modalHeader.textContent = "Detalles del Evento"; // Texto más neutro
            btnDelete.style.display = 'block'; 
        } else {
            modalHeader.textContent = "Nuevo Evento";
            btnDelete.style.display = 'none'; 
        }

        modal.classList.remove('hidden');
        // Sin foco automático: el usuario pulsa el input para escribir.
    }

    function closeModal() {
        modal.classList.add('hidden');
        modalId.value = '';
        modalTitle.value = '';
        modalDesc.value = '';
        targetDateForNewEvent = null;
    }

    btnCancel.addEventListener('click', closeModal);
    
    // --- LÓGICA DE GUARDADO (CREAR O EDITAR) ---
    btnSave.addEventListener('click', async () => {
        const id = modalId.value;
        const newTitle = modalTitle.value.trim();
        const newDesc = modalDesc.value.trim();
        
        if (!newTitle) return alert("El título es obligatorio");

        try {
            if (id) {
                // CASO 1: EDITAR EVENTO EXISTENTE
                const eventRef = doc(db, "calendario_eventos", id);
                await updateDoc(eventRef, {
                    texto_evento: newTitle,
                    descripcion: newDesc
                });

                renderCalendar(currentDate);

            } else {
                // CASO 2: CREAR NUEVO EVENTO
                if (!targetDateForNewEvent) return;

                const newEvent = {
                    user_id: auth.currentUser.uid,
                    fecha_evento: targetDateForNewEvent,
                    texto_evento: newTitle,
                    descripcion: newDesc,
                    tipo_calendario: currentMode
                };
                
                await addDoc(collection(db, "calendario_eventos"), newEvent);
                renderCalendar(currentDate);
            }
            
            closeModal();

        } catch (e) {
            console.error(e);
            alert("Error al guardar");
        }
    });

    // Borrar desde el modal
    btnDelete.addEventListener('click', async () => {
        const id = modalId.value;
        if (!id) return;
        
        if (confirm("¿Seguro que quieres borrar este evento?")) {
            try {
                const oldTitle = modalTitle.value;
                if (oldTitle.toLowerCase() === 'festivo' && activeCellElement) {
                    activeCellElement.classList.remove('is-weekend');
                    delete activeCellElement.dataset.festivoId;
                }

                await deleteDoc(doc(db, "calendario_eventos", id));
                renderCalendar(currentDate);
                closeModal();
            } catch (e) {
                console.error(e);
                alert("Error al borrar");
            }
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // --- RENDERIZADO DEL CALENDARIO ---
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
        
        const now = new Date();
        if (month === now.getMonth() && year === now.getFullYear()) {
            scrollToToday();
        }
    }

    function createDayCell(dayNumber, isOtherMonth, dateString = null) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (dateString === todayStr && !isOtherMonth) cell.classList.add('is-today');

        if (dateString && !isOtherMonth) {
            const dateStruct = new Date(dateString);
            const dayOfWeek = dateStruct.getDay(); 
            if (dayOfWeek === 0 || dayOfWeek === 6) cell.classList.add('is-weekend'); 
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
                if(e.target.closest('.calendar-event')) return;
                
                if (cell.dataset.festivoId) {
                    openModal(cell.dataset.festivoId, "Festivo", "", cell);
                    return;
                }

                // Abrir modal vacío para crear
                openModal(null, '', '', cell, dateString);
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

        if (isFestivo) {
            cell.classList.add('is-weekend'); 
            cell.dataset.festivoId = evento.id; 
        }

        const eventEl = document.createElement('div');
        eventEl.className = 'calendar-event';
        if (isFestivo) eventEl.classList.add('festivo-hidden');

        eventEl.setAttribute('data-id', evento.id);
        
        applyEventColorRule(eventEl, evento.texto_evento); 
        
        let descIndicator = '';
        if (evento.descripcion && evento.descripcion.trim() !== '') {
            descIndicator = '<span class="has-desc-indicator" title="Ver detalles"></span>';
        }

        eventEl.innerHTML = `
            <span class="event-text">${evento.texto_evento}</span>
            ${descIndicator}
        `;
        
        eventEl.addEventListener('click', (e) => {
            e.stopPropagation(); 
            // Abrimos modal en modo edición
            openModal(evento.id, evento.texto_evento, evento.descripcion, cell);
        });
        
        cell.appendChild(eventEl);
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