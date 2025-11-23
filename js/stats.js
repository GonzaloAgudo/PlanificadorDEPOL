import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- Referencias al DOM ---
    const filtroBotones = document.querySelectorAll('.filtro-btn');
    const resumenTexto = document.getElementById('resumen-texto');
    const canvas = document.getElementById('statsChart');
    const ctx = canvas.getContext('2d');
    const inputFechaStats = document.getElementById('input-fecha-stats');
    const btnVerStatsDia = document.getElementById('btn-ver-stats-dia');
    const resultadoStatsDia = document.getElementById('resultado-stats-dia');
    
    const activityFilterRadios = document.querySelectorAll('.activity-filter input');
    const topicSubFilter = document.querySelector('.topic-sub-filter');
    const topicFilterCheckboxes = document.querySelectorAll('.topic-sub-filter input');
    const filtrosTiempo = document.querySelector('.filtros');
    const filtroDiaBox = document.querySelector('.filtro-dia');

    let miGrafico; 

    // 1. AÑADIDO COLOR PARA TEST
    const TIPO_COLORES = {
        'estudio': 'rgba(40, 167, 69, 0.7)',       // Verde
        'clase': 'rgba(111, 66, 193, 0.7)',        // Morado
        'psicotecnicos': 'rgba(253, 126, 20, 0.7)', // Naranja
        'test': 'rgba(220, 53, 69, 0.7)'           // Rojo (Nuevo)
    };

    function formatearMinutos(totalMinutos) {
        const horas = Math.floor(totalMinutos / 60);
        const minutos = totalMinutos % 60;
        return `${horas} horas y ${minutos} minutos`;
    }

    function generarColor(index) {
        const HUE_START = 200; 
        const HUE_STEP = 40;   
        const hue = (HUE_START + (index * HUE_STEP)) % 360;
        return `hsla(${hue}, 70%, 60%, 0.7)`;
    }

    function esTestOExamen(tema) {
        if (!tema) return false;
        const t = tema.toLowerCase().trim();
        return t.startsWith('test') || t.startsWith('examen');
    }

    // 2. MODIFICADO PARA INCLUIR TEST EN GRÁFICAS APILADAS
    function pivotData(sessions, labels, timeUnit) {
        const datasets = {
            'estudio': { label: 'Estudio', data: new Array(labels.length).fill(0), backgroundColor: TIPO_COLORES['estudio'], stack: 'A' },
            'clase': { label: 'Clase', data: new Array(labels.length).fill(0), backgroundColor: TIPO_COLORES['clase'], stack: 'A' },
            'psicotecnicos': { label: 'Psicotécnicos', data: new Array(labels.length).fill(0), backgroundColor: TIPO_COLORES['psicotecnicos'], stack: 'A' },
            'test': { label: 'Test', data: new Array(labels.length).fill(0), backgroundColor: TIPO_COLORES['test'], stack: 'A' }
        };

        sessions.forEach(s => {
            let label;
            const date = s.fecha_sesion.toDate(); 

            if (timeUnit === 'today') label = `${date.getHours()}:00`;
            else if (timeUnit === 'week') {
                const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                label = days[date.getDay()];
            }
            else if (timeUnit === 'month') label = `${String(date.getDate()).padStart(2,'0')}-${String(date.getMonth()+1).padStart(2,'0')}`;
            else if (timeUnit === 'year') {
                const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                label = months[date.getMonth()];
            }
            else if (timeUnit === 'day') label = 'Total';

            const index = labels.indexOf(label);
            // Aseguramos que el tipo exista en datasets, si no, lo ignoramos o lo metemos a estudio por defecto
            const tipoSesion = datasets[s.tipo] ? s.tipo : 'estudio';

            if (index > -1 && datasets[tipoSesion]) {
                datasets[tipoSesion].data[index] += s.duracion_minutos;
            }
        });
        return Object.values(datasets).filter(ds => ds.data.some(d => d > 0));
    }

    function dibujarGrafico(labels, sessions, filtroActividad, filtroTiempo) {
        if (miGrafico) miGrafico.destroy();

        let datasets = [];
        let chartType = 'bar';
        let isStacked = false;
        let indexAxis = 'x';
        
        let unidad = 'horas';
        if (filtroTiempo === 'today' || (filtroTiempo === 'day' && filtroActividad !== 'conjunto')) {
            unidad = 'minutos';
        }
        
        const convertirUnidad = (val) => (unidad === 'horas' ? (val / 60) : val);

        if (filtroActividad === 'temas') {
            chartType = 'bar';
            indexAxis = 'y'; 
            unidad = 'horas'; 

            const temaMap = {};
            sessions.forEach(s => {
                if(s.tema) {
                    temaMap[s.tema] = (temaMap[s.tema] || 0) + s.duracion_minutos;
                }
            });
            
            const sortedTemas = Object.keys(temaMap).sort((a, b) => {
                 const esTemaA = a.toLowerCase().startsWith('tema');
                 const esTemaB = b.toLowerCase().startsWith('tema');
                 if (esTemaA && !esTemaB) return -1;
                 if (!esTemaA && esTemaB) return 1;
                 
                 const numA = parseInt(a.replace(/\D/g, '')) || 999;
                 const numB = parseInt(b.replace(/\D/g, '')) || 999;
                 return numA - numB;
            });

            const data = sortedTemas.map(t => (temaMap[t] / 60)); 
            const colores = sortedTemas.map((_, i) => generarColor(i));
            
            labels = sortedTemas;

            datasets.push({
                label: 'Horas por Tema',
                data: data,
                backgroundColor: colores,
                borderColor: colores.map(c => c.replace('0.7', '1')),
                borderWidth: 1
            });

            const maxVal = Math.max(...data);
            
            miGrafico = new Chart(ctx, {
                type: 'bar', 
                data: { labels: labels, datasets: datasets },
                options: {
                    indexAxis: 'y', 
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { 
                            beginAtZero: true, 
                            title: { display: true, text: 'Horas' }, 
                            max: maxVal * 1.2 
                        },
                        y: { ticks: { autoSkip: false } }
                    },
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            color: '#333', anchor: 'end', align: 'right', offset: 4, font: { weight: 'bold' },
                            formatter: (value) => parseFloat(value).toFixed(2) + ' h'
                        }
                    }
                },
                plugins: [ChartDataLabels]
            });
            return;
        } 
        
        if (filtroActividad === 'conjunto') {
            isStacked = true;
            const pivotedData = pivotData(sessions, labels, filtroTiempo);
            pivotedData.forEach(ds => { ds.data = ds.data.map(convertirUnidad); });
            datasets = pivotedData;
        } else {
            isStacked = false;
            let color = TIPO_COLORES[filtroActividad] || TIPO_COLORES['estudio'];
            
            const dataMap = new Array(labels.length).fill(0);
            sessions.forEach(s => {
                let label;
                const date = s.fecha_sesion.toDate();
                if (filtroTiempo === 'today') label = `${date.getHours()}:00`;
                else if (filtroTiempo === 'week') { const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']; label = days[date.getDay()]; }
                else if (filtroTiempo === 'month') label = `${String(date.getDate()).padStart(2,'0')}-${String(date.getMonth()+1).padStart(2,'0')}`;
                else if (filtroTiempo === 'year') { const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']; label = months[date.getMonth()]; }
                else if (filtroTiempo === 'day') label = 'Total';
                
                const idx = labels.indexOf(label);
                if(idx > -1) dataMap[idx] += s.duracion_minutos;
            });

            datasets.push({
                label: filtroActividad.charAt(0).toUpperCase() + filtroActividad.slice(1),
                data: dataMap.map(convertirUnidad),
                backgroundColor: color,
                borderColor: color.replace('0.7', '1'),
                borderWidth: 1
            });
        }
        
        const etiquetaEjeY = (unidad === 'minutos') ? 'Minutos' : 'Horas';

        miGrafico = new Chart(ctx, {
            type: 'bar',
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { stacked: isStacked },
                    y: { beginAtZero: true, stacked: isStacked, title: { display: true, text: etiquetaEjeY } }
                },
                plugins: {
                    legend: { display: (filtroActividad === 'conjunto') },
                    datalabels: { display: false } 
                }
            }
        });
    }

    async function cargarEstadisticas() {
        if (miGrafico) miGrafico.destroy();
        if (!auth.currentUser) return;

        const filtroTiempo = document.querySelector('.filtro-btn.active').dataset.filtro;
        // Ahora filtroActividad puede ser: 'estudio', 'clase', 'psicotecnicos', 'test', 'conjunto', 'temas'
        const filtroActividad = document.querySelector('.activity-filter input:checked').value;
        
        // --- CAMBIO 1: YA NO OCULTAMOS LOS FILTROS DE TIEMPO SI ES 'TEMAS' ---
        // UI Toggle
        if (filtroActividad === 'temas') {
            filtrosTiempo.classList.remove('hidden'); // Antes era add('hidden')
            filtroDiaBox.classList.add('hidden'); // Esto sí lo dejamos oculto porque el gráfico de temas no tiene sentido para "ver stats día específico" de la misma forma
            topicSubFilter.classList.remove('hidden');
        } else {
            filtrosTiempo.classList.remove('hidden');
            filtroDiaBox.classList.remove('hidden');
            topicSubFilter.classList.add('hidden');
        }

        if(filtroTiempo === 'day' && filtroActividad !== 'temas') return; 

        let startDate = new Date();
        let endDate = new Date();
        let labels = [];

        // --- CAMBIO 2: ELIMINAR EL IF QUE FORZABA LA FECHA PARA 'TEMAS' ---
        /* BLOQUE ELIMINADO:
        if (filtroActividad === 'temas') {
            startDate = new Date('2000-01-01'); 
        } else { ... }
        */

        // AHORA LA LÓGICA DE TIEMPO APLICA A TODO, INCLUIDO 'TEMAS'
        if (filtroTiempo === 'today') {
            startDate.setHours(0,0,0,0);
            endDate.setHours(23,59,59,999);
            // Si es Temas, no necesitamos labels de horas (00:00, 01:00...), las labels serán los nombres de los temas después.
            // Si NO es Temas, generamos las horas:
            if (filtroActividad !== 'temas') {
                for(let i=0; i<24; i++) labels.push(`${i}:00`);
            }
        } else if (filtroTiempo === 'week') {
            const day = startDate.getDay(); 
            const diff = startDate.getDate() - day + (day == 0 ? -6:1); 
            startDate.setDate(diff); startDate.setHours(0,0,0,0);
            endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23,59,59,999);
            
            if (filtroActividad !== 'temas') {
                labels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            }
        } else if (filtroTiempo === 'month') {
            startDate.setDate(1); startDate.setHours(0,0,0,0);
            endDate.setMonth(endDate.getMonth() + 1); endDate.setDate(0); endDate.setHours(23,59,59,999);
            
            if (filtroActividad !== 'temas') {
                for(let i=1; i<=endDate.getDate(); i++) labels.push(`${String(i).padStart(2,'0')}-${String(startDate.getMonth()+1).padStart(2,'0')}`);
            }
        } else if (filtroTiempo === 'year') {
            startDate.setMonth(0, 1); startDate.setHours(0,0,0,0);
            endDate.setMonth(11, 31); endDate.setHours(23,59,59,999);
            
            if (filtroActividad !== 'temas') {
                labels = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            }
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
                
                // NORMALIZACIÓN DE CATEGORÍAS
                let tipoReal = data.tipo;
                if (esTestOExamen(data.tema)) {
                    tipoReal = 'test';
                }
                data.tipo = tipoReal;

                let include = false;
                
                if (filtroActividad === 'temas') {
                    if (data.tema) {
                        if (checkedBoxes.includes(tipoReal)) {
                            include = true;
                        }
                    }
                } 
                else if (filtroActividad === 'conjunto') {
                    include = true; 
                } 
                else {
                    if (tipoReal === filtroActividad) {
                        include = true;
                    }
                }

                if (include) {
                    sessions.push(data);
                    totalMinutos += data.duracion_minutos;
                }
            });

            const tiempoFormateado = formatearMinutos(totalMinutos);
            
            // --- CAMBIO 3: AJUSTAR EL TÍTULO DINÁMICAMENTE ---
            let titulo = "Total";
            if(filtroTiempo === 'today') titulo = "Total Hoy";
            else if(filtroTiempo === 'week') titulo = "Total Esta Semana";
            else if(filtroTiempo === 'month') titulo = "Total Este Mes";
            else if(filtroTiempo === 'year') titulo = "Total Este Año";
            
            // Si es temas, añadimos contexto, pero respetando el tiempo
            if (filtroActividad === 'temas') titulo += " (Por Temas)";

            resumenTexto.innerHTML = `${titulo}: <strong>${tiempoFormateado}</strong>`;

            dibujarGrafico(labels, sessions, filtroActividad, filtroTiempo);

        } catch (error) {
            console.error(error);
            resumenTexto.textContent = "Error cargando datos.";
        }
    }

    async function consultarDiaEspecifico() {
        if (miGrafico) miGrafico.destroy();
        const fechaInput = inputFechaStats.value;
        if (!fechaInput) return;
        
        const startOfDay = new Date(fechaInput); startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date(fechaInput); endOfDay.setHours(23,59,59,999);
        
        const filtroActividad = document.querySelector('.activity-filter input:checked').value;

        try {
            let q = query(
                collection(db, "sesiones_estudio"),
                where("user_id", "==", auth.currentUser.uid),
                where("fecha_sesion", ">=", Timestamp.fromDate(startOfDay)),
                where("fecha_sesion", "<=", Timestamp.fromDate(endOfDay))
            );
            const querySnapshot = await getDocs(q);
            let sessions = [];
            let totalMinutos = 0;

            querySnapshot.forEach(doc => {
                const data = doc.data();

                // NORMALIZACIÓN DE TIPO (Igual que arriba)
                let tipoReal = data.tipo;
                if (esTestOExamen(data.tema)) {
                    tipoReal = 'test';
                }
                data.tipo = tipoReal;

                let include = false;
                
                if (filtroActividad === 'conjunto') {
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
            resultadoStatsDia.textContent = `Total el ${fechaInput}: ${tiempoFormateado}`;
            
            if (sessions.length > 0) {
                dibujarGrafico(['Total'], sessions, filtroActividad, 'day');
            }

        } catch (error) {
            resultadoStatsDia.textContent = "Error al consultar.";
        }
    }

    filtroBotones.forEach(btn => {
        btn.addEventListener('click', () => {
            filtroBotones.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if(btn.dataset.filtro !== 'day') cargarEstadisticas();
        });
    });

    activityFilterRadios.forEach(radio => radio.addEventListener('change', cargarEstadisticas));
    topicFilterCheckboxes.forEach(chk => chk.addEventListener('change', cargarEstadisticas));

    btnVerStatsDia.addEventListener('click', () => {
        filtroBotones.forEach(b => b.classList.remove('active'));
        consultarDiaEspecifico();
    });

    auth.onAuthStateChanged(user => {
        if (user) {
            cargarEstadisticas();
        }
    });
    
    inputFechaStats.valueAsDate = new Date();
});