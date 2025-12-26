import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- Referencias al DOM ---
    const filtroBotones = document.querySelectorAll('.filtro-btn');
    const resumenTexto = document.getElementById('resumen-texto');
    const canvas = document.getElementById('statsChart');
    const ctx = canvas.getContext('2d');
    
    // Navegación nueva
    const btnPrev = document.getElementById('btn-prev-period');
    const btnNext = document.getElementById('btn-next-period');
    const periodDisplay = document.getElementById('period-display');

    const activityFilterRadios = document.querySelectorAll('.activity-filter input');
    const topicSubFilter = document.querySelector('.topic-sub-filter');
    const topicFilterCheckboxes = document.querySelectorAll('.topic-sub-filter input');

    // --- ESTADO GLOBAL ---
    let miGrafico; 
    let currentDate = new Date(); // Puntero de fecha actual
    let currentRange = 'day';     // 'day', 'week', 'month', 'year'

    const TIPO_COLORES = {
        'estudio': 'rgba(40, 167, 69, 0.7)',       
        'clase': 'rgba(111, 66, 193, 0.7)',        
        'psicotecnicos': 'rgba(253, 126, 20, 0.7)', 
        'test': 'rgba(220, 53, 69, 0.7)'           
    };

    // ==========================================
    //  UTILIDADES
    // ==========================================

    function formatearMinutos(totalMinutos) {
        const horas = Math.floor(totalMinutos / 60);
        const minutos = totalMinutos % 60;
        return `${horas} h ${minutos} min`;
    }

    function generarColor(index) {
        const hue = (200 + (index * 40)) % 360;
        return `hsla(${hue}, 70%, 60%, 0.7)`;
    }

    function esTestOExamen(tema) {
        if (!tema) return false;
        const t = tema.toLowerCase().trim();
        return t.startsWith('test') || t.startsWith('examen');
    }

    // Actualiza el texto entre las flechas (Ej: "Octubre 2023")
    function updatePeriodLabel() {
        const options = { year: 'numeric' };
        
        if (currentRange === 'day') {
            options.month = 'long';
            options.day = 'numeric';
            // Si es hoy, poner "Hoy"
            const today = new Date();
            if (currentDate.toDateString() === today.toDateString()) {
                periodDisplay.textContent = `Hoy (${currentDate.getDate()})`;
                return;
            }
        } else if (currentRange === 'week') {
            // Calcular inicio y fin de semana para mostrar
            const start = getStartOfPeriod(currentDate, 'week');
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            periodDisplay.textContent = `${start.getDate()}/${start.getMonth()+1} - ${end.getDate()}/${end.getMonth()+1}`;
            return;
        } else if (currentRange === 'month') {
            options.month = 'long';
        }
        // Year solo muestra year (ya en options)
        
        periodDisplay.textContent = currentDate.toLocaleDateString('es-ES', options);
    }

    // Calcula el inicio del periodo según el puntero actual
    function getStartOfPeriod(date, range) {
        const d = new Date(date);
        if (range === 'day') {
            d.setHours(0,0,0,0);
        } else if (range === 'week') {
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lunes
            d.setDate(diff);
            d.setHours(0,0,0,0);
        } else if (range === 'month') {
            d.setDate(1);
            d.setHours(0,0,0,0);
        } else if (range === 'year') {
            d.setMonth(0, 1);
            d.setHours(0,0,0,0);
        }
        return d;
    }

    // Avanzar o Retroceder fecha
    function changeDate(offset) {
        if (currentRange === 'day') currentDate.setDate(currentDate.getDate() + offset);
        else if (currentRange === 'week') currentDate.setDate(currentDate.getDate() + (offset * 7));
        else if (currentRange === 'month') currentDate.setMonth(currentDate.getMonth() + offset);
        else if (currentRange === 'year') currentDate.setFullYear(currentDate.getFullYear() + offset);
        
        updatePeriodLabel();
        cargarEstadisticas();
    }

    // ==========================================
    //  LÓGICA DE DATOS Y GRÁFICOS
    // ==========================================

    function distribuirMinutosEnHoras(sesion, datasets, labels) {
        const endDate = sesion.fecha_sesion.toDate();
        const durationMins = sesion.duracion_minutos;
        const startDate = new Date(endDate.getTime() - (durationMins * 60000));
        
        const tipoSesion = datasets[sesion.tipo] ? sesion.tipo : 'estudio';
        const targetDataset = datasets[tipoSesion];

        let pointer = new Date(startDate);
        const safetyEnd = new Date(endDate.getTime() + 1000); 

        while (pointer < safetyEnd) {
            // Solo dibujamos si el puntero coincide con el día que estamos viendo
            if (pointer.getDate() === currentDate.getDate()) {
                const hour = pointer.getHours();
                const label = `${hour}:00`;
                const index = labels.indexOf(label);
                if (index > -1) targetDataset.data[index] += 1; // Sumamos 1 minuto
            }
            pointer.setMinutes(pointer.getMinutes() + 1);
            if (pointer > endDate) break;
        }
    }

    function pivotData(sessions, labels, timeUnit) {
        const datasets = {
            'estudio': { label: 'Estudio', data: new Array(labels.length).fill(0), backgroundColor: TIPO_COLORES['estudio'], stack: 'A' },
            'clase': { label: 'Clase', data: new Array(labels.length).fill(0), backgroundColor: TIPO_COLORES['clase'], stack: 'A' },
            'psicotecnicos': { label: 'Psicotécnicos', data: new Array(labels.length).fill(0), backgroundColor: TIPO_COLORES['psicotecnicos'], stack: 'A' },
            'test': { label: 'Test', data: new Array(labels.length).fill(0), backgroundColor: TIPO_COLORES['test'], stack: 'A' }
        };

        sessions.forEach(s => {
            if (timeUnit === 'day') {
                distribuirMinutosEnHoras(s, datasets, labels);
            } else {
                let label;
                const date = s.fecha_sesion.toDate(); 

                if (timeUnit === 'week') {
                    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                    label = days[date.getDay()];
                }
                else if (timeUnit === 'month') label = `${String(date.getDate()).padStart(2,'0')}`;
                else if (timeUnit === 'year') {
                    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    label = months[date.getMonth()];
                }

                const index = labels.indexOf(label);
                const tipoSesion = datasets[s.tipo] ? s.tipo : 'estudio';

                if (index > -1 && datasets[tipoSesion]) {
                    datasets[tipoSesion].data[index] += s.duracion_minutos;
                }
            }
        });
        
        return Object.values(datasets).filter(ds => ds.data.some(d => d > 0));
    }

    function dibujarGrafico(labels, sessions, filtroActividad, filtroTiempo) {
        if (miGrafico) miGrafico.destroy();

        // Referencia al contenedor del canvas (para cambiarle la altura)
        const chartContainer = canvas.parentElement;

        let datasets = [];
        let isStacked = false;
        let unidad = 'horas';
        
        if (filtroTiempo === 'day') {
            unidad = 'minutos';
        }
        
        const convertirUnidad = (val) => (unidad === 'horas' ? (val / 60) : val);

        // --- CASO 1: TEMAS (Horizontal) ---
        if (filtroActividad === 'temas') {
            const temaMap = {};
            sessions.forEach(s => {
                if(s.tema) temaMap[s.tema] = (temaMap[s.tema] || 0) + s.duracion_minutos;
            });
            
            const sortedTemas = Object.keys(temaMap).sort((a, b) => temaMap[b] - temaMap[a]); 

            // --- LÓGICA DE ALTURA DINÁMICA ---
            // Calculamos: 35px por cada tema + 50px de margen
            // Si hay 20 temas -> 750px de alto. Si hay 3 -> 155px.
            const dynamicHeight = (sortedTemas.length * 35) + 50;
            // Aplicamos la altura al contenedor (importante que sea .chart-container)
            chartContainer.style.height = `${Math.max(300, dynamicHeight)}px`; 

            const data = sortedTemas.map(t => (temaMap[t] / 60)); 
            const colores = sortedTemas.map((_, i) => generarColor(i));
            
            miGrafico = new Chart(ctx, {
                type: 'bar', 
                data: { 
                    labels: sortedTemas, 
                    datasets: [{
                        label: 'Horas',
                        data: data,
                        backgroundColor: colores,
                        borderWidth: 1
                    }] 
                },
                options: {
                    indexAxis: 'y', 
                    responsive: true, 
                    maintainAspectRatio: false, // CLAVE: Permite que el canvas se estire
                    scales: { x: { beginAtZero: true } },
                    plugins: { legend: { display: false } }
                }
            });
            return;
        } 
        
        // --- CASO 2: RESTO DE GRÁFICOS (RESET ALTURA) ---
        
        // Si no es el gráfico de temas, volvemos a la altura estándar (300px)
        chartContainer.style.height = '300px';

        if (filtroActividad === 'conjunto') {
            isStacked = true;
            const pivotedData = pivotData(sessions, labels, filtroTiempo);
            pivotedData.forEach(ds => { ds.data = ds.data.map(convertirUnidad); });
            datasets = pivotedData;
        } else {
            isStacked = false;
            const pivotedData = pivotData(sessions, labels, filtroTiempo);
            const ds = pivotedData.find(d => d.label.toLowerCase() === filtroActividad.toLowerCase());
            
            if (ds) {
                ds.data = ds.data.map(convertirUnidad);
                datasets.push(ds);
            }
        }
        
        const etiquetaEjeY = (unidad === 'minutos') ? 'Minutos' : 'Horas';

        miGrafico = new Chart(ctx, {
            type: 'bar',
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: isStacked },
                    y: { 
                        beginAtZero: true, 
                        stacked: isStacked, 
                        title: { display: true, text: etiquetaEjeY } 
                    }
                },
                plugins: {
                    legend: { display: (filtroActividad === 'conjunto') },
                    datalabels: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (unidad === 'minutos') {
                                    return label + Math.round(context.parsed.y) + ' min';
                                } else {
                                    return label + context.parsed.y.toFixed(2) + ' h';
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    async function cargarEstadisticas() {
        if (!auth.currentUser) return;
        
        const filtroActividad = document.querySelector('.activity-filter input:checked').value;
        
        // Manejo de UI de subfiltros
        if (filtroActividad === 'temas') {
            topicSubFilter.classList.remove('hidden');
        } else {
            topicSubFilter.classList.add('hidden');
        }

        // Calcular Start y End según la navegación actual
        let startDate = getStartOfPeriod(currentDate, currentRange);
        let endDate = new Date(startDate);
        let labels = [];

        if (currentRange === 'day') {
            endDate.setHours(23,59,59,999);
            // Labels horas 0-23
            if (filtroActividad !== 'temas') for(let i=0; i<24; i++) labels.push(`${i}:00`);
            
        } else if (currentRange === 'week') {
            endDate.setDate(endDate.getDate() + 6);
            endDate.setHours(23,59,59,999);
            if (filtroActividad !== 'temas') labels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            
        } else if (currentRange === 'month') {
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(0); 
            endDate.setHours(23,59,59,999);
            if (filtroActividad !== 'temas') {
                for(let i=1; i<=endDate.getDate(); i++) labels.push(`${String(i).padStart(2,'0')}`);
            }
            
        } else if (currentRange === 'year') {
            endDate.setMonth(11, 31);
            endDate.setHours(23,59,59,999);
            if (filtroActividad !== 'temas') labels = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        }

        try {
            let q = query(
                collection(db, "sesiones_estudio"),
                where("user_id", "==", auth.currentUser.uid),
                where("fecha_sesion", ">=", Timestamp.fromDate(startDate)),
                where("fecha_sesion", "<=", Timestamp.fromDate(endDate)) 
            );

            const querySnapshot = await getDocs(q);
            let sessions = [];
            let totalMinutos = 0;
            const checkedBoxes = Array.from(document.querySelectorAll('.topic-sub-filter input:checked')).map(cb => cb.value);

            querySnapshot.forEach(doc => {
                const data = doc.data();
                
                // Normalización
                let tipoReal = data.tipo;
                if (esTestOExamen(data.tema)) tipoReal = 'test';
                data.tipo = tipoReal;

                // Filtrado en memoria
                let include = false;
                if (filtroActividad === 'temas') {
                    if (data.tema && checkedBoxes.includes(tipoReal)) include = true;
                } else if (filtroActividad === 'conjunto') {
                    include = true;
                } else {
                    if (tipoReal === filtroActividad) include = true;
                }

                if (include) {
                    sessions.push(data);
                    totalMinutos += data.duracion_minutos;
                }
            });

            const tiempoFormateado = formatearMinutos(totalMinutos);
            resumenTexto.innerHTML = `Total: <strong>${tiempoFormateado}</strong>`;

            dibujarGrafico(labels, sessions, filtroActividad, currentRange);

        } catch (error) {
            console.error(error);
            resumenTexto.textContent = "Error cargando datos.";
        }
    }

    // --- EVENT LISTENERS ---

    // 1. Botones de Rango (Día, Semana, Mes, Año)
    filtroBotones.forEach(btn => {
        btn.addEventListener('click', () => {
            filtroBotones.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Al cambiar de modo, reseteamos al día de hoy para no perdernos
            currentRange = btn.dataset.filtro;
            currentDate = new Date(); 
            
            updatePeriodLabel();
            cargarEstadisticas();
        });
    });

    // 2. Flechas de Navegación
    btnPrev.addEventListener('click', () => changeDate(-1));
    btnNext.addEventListener('click', () => changeDate(1));

    // 3. Filtros de Actividad (Radio buttons)
    activityFilterRadios.forEach(radio => radio.addEventListener('change', cargarEstadisticas));
    topicFilterCheckboxes.forEach(chk => chk.addEventListener('change', cargarEstadisticas));

    // --- INICIALIZACIÓN ---
    auth.onAuthStateChanged(user => {
        if (user) {
            updatePeriodLabel();
            cargarEstadisticas();
        }
    });
});