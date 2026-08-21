import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- Referencias al DOM ---
    const filtroBotones = document.querySelectorAll('.filtro-btn');
    const resumenTexto = document.getElementById('resumen-texto');
    const canvas = document.getElementById('statsChart');
    const ctx = canvas.getContext('2d');
    
    const btnPrev = document.getElementById('btn-prev-period');
    const btnNext = document.getElementById('btn-next-period');
    const periodDisplay = document.getElementById('period-display');

    const activityFilterRadios = document.querySelectorAll('.activity-filter input');
    const topicSubFilter = document.querySelector('.topic-sub-filter');

    // --- ESTADO GLOBAL ---
    let miGrafico; 
    let currentDate = new Date(); 
    let currentRange = 'day';     

    // Paleta de categorías (coincide con las variables --c-cat-* del CSS)
    const TIPO_COLORES = {
        'estudio': '#1c4e80',
        'clase': '#58487f',
        'psicotecnicos': '#9a6a2f',
        'test': '#9b2c2c',
        'examen': '#1f6f4a',
        'opowar': '#2b6b73',
        'voltea': '#6b5a2b'
    };

    // Colores de la retícula y las etiquetas, en la línea sobria del resto
    const C_GRID = '#eceef1';
    const C_TICK = '#5b6673';

    // ETIQUETAS LIMPIAS POR DEFECTO
    const NOMBRES_TIPOS = {
        'estudio': 'Estudio',
        'clase': 'Clase',
        'psicotecnicos': 'Psicotécnicos',
        'test': 'Test',
        'examen': 'Examen',
        'opowar': 'Opowar',
        'voltea': 'Voltea'
    };

    // ==========================================
    //  UTILIDADES Y LIMPIEZA
    // ==========================================

    function formatearMinutos(totalMinutos) {
        const horas = Math.floor(totalMinutos / 60);
        const minutos = Math.round(totalMinutos % 60);
        return `${horas} h ${minutos} min`;
    }

    // LIMPIAR EMOJIS SIN ROMPER NÚMEROS
    function removeEmojis(text) {
        if (!text) return '';
        // Filtra los rangos Unicode de los emojis pictográficos y caritas
        return text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1FA70}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u2B50]/gu, '')
                   .replace(/[\u200D\uFE0F]/g, '') // Elimina caracteres invisibles de unión de emojis
                   .trim();
    }

    // GENERADOR DE COLORES MATEMÁTICO (ÁNGULO ÁUREO)
    function getColorForType(tipo) {
        const t = tipo.toLowerCase().trim();
        if (TIPO_COLORES[t]) return TIPO_COLORES[t];
        
        let hash = 0;
        for (let i = 0; i < t.length; i++) {
            hash = t.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // Multiplicar por el ángulo áureo asegura la máxima separación cromática posible
        const hue = Math.floor((Math.abs(hash) * 137.508) % 360);
        return `hsl(${hue}, 30%, 42%)`; // Tono apagado, en línea con la paleta fija
    }

    function updatePeriodLabel() {
        const options = { year: 'numeric' };
        
        if (currentRange === 'day') {
            options.month = 'long';
            options.day = 'numeric';
            const today = new Date();
            if (currentDate.toDateString() === today.toDateString()) {
                periodDisplay.textContent = `Hoy (${currentDate.getDate()})`;
                return;
            }
        } else if (currentRange === 'week') {
            const start = getStartOfPeriod(currentDate, 'week');
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            periodDisplay.textContent = `${start.getDate()}/${start.getMonth()+1} - ${end.getDate()}/${end.getMonth()+1}`;
            return;
        } else if (currentRange === 'month') {
            options.month = 'long';
        }
        
        periodDisplay.textContent = currentDate.toLocaleDateString('es-ES', options);
    }

    function getStartOfPeriod(date, range) {
        const d = new Date(date);
        if (range === 'day') {
            d.setHours(0,0,0,0);
        } else if (range === 'week') {
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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

    function initDataset(datasets, tipo, labelsLength) {
        if (!datasets[tipo]) {
            const cleanTipo = removeEmojis(tipo);
            const finalLabel = NOMBRES_TIPOS[tipo.toLowerCase().trim()] || (cleanTipo.charAt(0).toUpperCase() + cleanTipo.slice(1));
            
            datasets[tipo] = { 
                label: finalLabel, 
                data: new Array(labelsLength).fill(0), 
                backgroundColor: getColorForType(tipo), 
                stack: 'A' 
            };
        }
        return datasets[tipo];
    }

    function distribuirMinutosEnHoras(sesion, datasets, labels) {
        let endDateStr = sesion.fecha_sesion;
        let endDate = (endDateStr && endDateStr.toDate) ? endDateStr.toDate() : new Date(endDateStr);
        
        const durationMins = sesion.duracion_minutos;
        const startDate = new Date(endDate.getTime() - (durationMins * 60000));
        
        const tipoSesion = sesion.tipo || 'estudio';
        const targetDataset = initDataset(datasets, tipoSesion, labels.length);

        let pointer = new Date(startDate);
        const safetyEnd = new Date(endDate.getTime() + 1000); 

        while (pointer < safetyEnd) {
            if (pointer.getDate() === currentDate.getDate()) {
                const hour = pointer.getHours();
                const label = `${hour}:00`;
                const index = labels.indexOf(label);
                if (index > -1) targetDataset.data[index] += 1;
            }
            pointer.setMinutes(pointer.getMinutes() + 1);
            if (pointer > endDate) break;
        }
    }

    function pivotData(sessions, labels, timeUnit) {
        const datasets = {};

        // Inicializar los por defecto para que el orden visual sea siempre el mismo
        Object.keys(TIPO_COLORES).forEach(tipo => initDataset(datasets, tipo, labels.length));

        sessions.forEach(s => {
            const tipoSesion = s.tipo || 'estudio';
            
            if (timeUnit === 'day') {
                distribuirMinutosEnHoras(s, datasets, labels);
            } else {
                let label;
                let dateStr = s.fecha_sesion;
                let date = (dateStr && dateStr.toDate) ? dateStr.toDate() : new Date(dateStr);

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
                if (index > -1) {
                    const targetDataset = initDataset(datasets, tipoSesion, labels.length);
                    targetDataset.data[index] += s.duracion_minutos;
                }
            }
        });
        
        return Object.values(datasets).filter(ds => ds.data.some(d => d > 0));
    }

    function dibujarGrafico(labels, sessions, filtroActividad, filtroTiempo) {
        if (miGrafico) miGrafico.destroy();
        const chartContainer = canvas.parentElement;
        let datasets = [];
        let isStacked = false;
        let unidad = 'horas';
        
        if (filtroTiempo === 'day') unidad = 'minutos';
        const convertirUnidad = (val) => (unidad === 'horas' ? (val / 60) : val);

        if (filtroActividad === 'temas') {
            const temaMap = {};
            sessions.forEach(s => {
                if(s.tema) {
                    // Limpiamos los emojis de los temas antes de sumarlos
                    const cleanTema = removeEmojis(s.tema);
                    temaMap[cleanTema] = (temaMap[cleanTema] || 0) + s.duracion_minutos;
                }
            });
            
            const sortedTemas = Object.keys(temaMap).sort((a, b) => temaMap[b] - temaMap[a]); 
            const dynamicHeight = (sortedTemas.length * 35) + 50;
            chartContainer.style.height = `${Math.max(300, dynamicHeight)}px`; 

            const data = sortedTemas.map(t => (temaMap[t] / 60)); 
            const colores = sortedTemas.map(t => getColorForType(t));
            
            miGrafico = new Chart(ctx, {
                type: 'bar', 
                data: { 
                    labels: sortedTemas, 
                    datasets: [{ label: 'Horas', data: data, backgroundColor: colores, borderWidth: 1 }] 
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            beginAtZero: true,
                            grid: { color: C_GRID },
                            border: { display: false },
                            ticks: { color: C_TICK }
                        },
                        y: {
                            grid: { display: false },
                            border: { display: false },
                            ticks: { color: C_TICK }
                        }
                    },
                    plugins: { legend: { display: false } }
                }
            });
            return;
        } 
        
        chartContainer.style.height = '300px';

        if (filtroActividad === 'conjunto') {
            isStacked = true;
            const pivotedData = pivotData(sessions, labels, filtroTiempo);
            pivotedData.forEach(ds => { ds.data = ds.data.map(convertirUnidad); });
            datasets = pivotedData;
        } else {
            isStacked = false;
            const pivotedData = pivotData(sessions, labels, filtroTiempo);
            
            const ds = pivotedData.find(d => {
                if (filtroActividad === 'clase') return d.label.includes('Clase');
                return d.label.toLowerCase() === removeEmojis(filtroActividad).toLowerCase();
            });
            
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
                    x: {
                        stacked: isStacked,
                        grid: { display: false },
                        border: { color: C_GRID },
                        ticks: { color: C_TICK }
                    },
                    y: {
                        beginAtZero: true,
                        stacked: isStacked,
                        title: { display: true, text: etiquetaEjeY, color: C_TICK },
                        grid: { color: C_GRID },
                        border: { display: false },
                        ticks: { color: C_TICK }
                    }
                },
                plugins: {
                    legend: {
                        display: (filtroActividad === 'conjunto'),
                        labels: { color: C_TICK, boxWidth: 12, boxHeight: 12, usePointStyle: false }
                    },
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
        
        const checkedRadio = document.querySelector('.activity-filter input:checked');
        if(!checkedRadio) return;
        const filtroActividad = checkedRadio.value;
        
        if (filtroActividad === 'temas') {
            topicSubFilter.classList.remove('hidden');
            topicSubFilter.style.display = 'flex';
        } else {
            topicSubFilter.classList.add('hidden');
            topicSubFilter.style.display = 'none';
        }

        let startDate = getStartOfPeriod(currentDate, currentRange);
        let endDate = new Date(startDate);
        let labels = [];

        if (currentRange === 'day') {
            endDate.setHours(23,59,59,999);
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
            
            const checkboxes = document.querySelectorAll('.topic-sub-filter input:checked');
            const checkedBoxes = Array.from(checkboxes).map(cb => cb.value);

            querySnapshot.forEach(doc => {
                const data = doc.data();
                
                let tipoReal = data.tipo || 'estudio';
                if (tipoReal === 'seminario') tipoReal = 'clase';
                data.tipo = tipoReal;

                let include = false;
                if (filtroActividad === 'temas') {
                    if (checkedBoxes.length > 0) {
                        include = checkedBoxes.includes(tipoReal);
                    } else {
                        include = false;
                    }
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

    filtroBotones.forEach(btn => {
        btn.addEventListener('click', () => {
            filtroBotones.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRange = btn.dataset.filtro;
            currentDate = new Date(); 
            updatePeriodLabel();
            cargarEstadisticas();
        });
    });

    btnPrev.addEventListener('click', () => changeDate(-1));
    btnNext.addEventListener('click', () => changeDate(1));

    activityFilterRadios.forEach(radio => radio.addEventListener('change', cargarEstadisticas));

    const topicCheckboxes = document.querySelectorAll('.topic-sub-filter input');
    topicCheckboxes.forEach(chk => chk.addEventListener('change', cargarEstadisticas));

    auth.onAuthStateChanged(user => {
        if (user) {
            updatePeriodLabel();
            cargarEstadisticas();
        }
    });
});