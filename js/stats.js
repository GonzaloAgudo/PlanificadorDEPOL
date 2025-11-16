document.addEventListener('DOMContentLoaded', () => {

    // --- Referencias al DOM ---
    const filtroBotones = document.querySelectorAll('.filtro-btn');
    const resumenTexto = document.getElementById('resumen-texto');
    const canvas = document.getElementById('statsChart');
    const ctx = canvas.getContext('2d');
    const inputFechaStats = document.getElementById('input-fecha-stats');
    const btnVerStatsDia = document.getElementById('btn-ver-stats-dia');
    const resultadoStatsDia = document.getElementById('resultado-stats-dia');
    
    // --- ¡NUEVO! Referencias a los filtros ---
    const activityFilterRadios = document.querySelectorAll('.activity-filter input');
    const topicSubFilter = document.querySelector('.topic-sub-filter');
    const topicFilterRadios = document.querySelectorAll('.topic-sub-filter input');
    const filtrosTiempo = document.querySelector('.filtros');
    const filtroDiaBox = document.querySelector('.filtro-dia');

    let miGrafico; 

    // --- Colores para los gráficos ---
    const TIPO_COLORES = {
        'estudio': 'rgba(40, 167, 69, 0.7)',  // Verde
        'clase': 'rgba(111, 66, 193, 0.7)',   // Violeta
        'psicotecnicos': 'rgba(253, 126, 20, 0.7)' // Naranja
    };

    // --- Funciones de formato ---
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

    // --- Función para pivotar datos para el gráfico "Conjunto" ---
    function pivotData(dataRows, labels) {
        const datasets = {
            'estudio': { label: 'Estudio', data: new Array(labels.length).fill(0), backgroundColor: TIPO_COLORES['estudio'], stack: 'A' },
            'clase': { label: 'Clase', data: new Array(labels.length).fill(0), backgroundColor: TIPO_COLORES['clase'], stack: 'A' },
            'psicotecnicos': { label: 'Psicotécnicos', data: new Array(labels.length).fill(0), backgroundColor: TIPO_COLORES['psicotecnicos'], stack: 'A' }
        };

        dataRows.forEach(row => {
            const label = row.label ?? row.label_mes;
            const tipo = row.tipo;
            const total = row.total;
            
            const index = labels.indexOf(label);
            if (index > -1 && datasets[tipo]) {
                datasets[tipo].data[index] = total;
            }
        });
        return Object.values(datasets).filter(ds => ds.data.some(d => d > 0));
    }


    // --- Función para dibujar el Gráfico ---
    function dibujarGrafico(labels, dataRows, filtroActividad, filtroTiempo) {
        if (miGrafico) miGrafico.destroy();

        let datasets = [];
        let chartType = 'bar';
        let isStacked = false;
        let indexAxis = 'x'; // Eje X por defecto
        
        let unidad = 'horas';
        if (filtroTiempo === 'today' || (filtroTiempo === 'day' && filtroActividad !== 'conjunto')) {
            unidad = 'minutos';
        }
        
        const convertirUnidad = (val) => (unidad === 'horas' ? (val / 60) : val);

        if (filtroActividad === 'temas') {
            // --- Lógica para Gráfico de Temas ---
            chartType = 'bar';
            indexAxis = 'y'; // ¡Horizontal!
            isStacked = false;

            const data = dataRows.map(row => convertirUnidad(row.total_minutos));
            const colores = dataRows.map((_, index) => generarColor(index));
            
            datasets.push({
                label: 'Horas por Tema',
                data: data,
                backgroundColor: colores,
                borderColor: colores.map(c => c.replace('0.7', '1')),
                borderWidth: 1
            });
            
        } else if (filtroActividad === 'conjunto') {
            // --- Lógica para Gráfico Conjunto ---
            isStacked = true;
            chartType = 'bar';
            
            const pivotedData = pivotData(dataRows, labels);
            pivotedData.forEach(ds => {
                ds.data = ds.data.map(convertirUnidad); 
            });
            datasets = pivotedData;

        } else {
            // --- Lógica para Gráfico Simple (Estudio, Clase, etc.) ---
            isStacked = false;
            chartType = 'bar';
            
            let color = TIPO_COLORES[filtroActividad] || TIPO_COLORES['estudio'];
            
            const data = labels.map(label => {
                const row = dataRows.find(r => (r.label ?? r.label_mes) === label);
                return row ? convertirUnidad(row.total) : 0;
            });

            datasets.push({
                label: filtroActividad.charAt(0).toUpperCase() + filtroActividad.slice(1),
                data: data,
                backgroundColor: color,
                borderColor: color.replace('0.7', '1'),
                borderWidth: 1
            });
        }
        
        const etiquetaEjeY = (unidad === 'minutos') ? 'Minutos' : 'Horas';
        const etiquetaEjeX = (unidad === 'minutos' || filtroActividad === 'temas') ? 'Horas' : '';

        // Formatear etiquetas de hora para el eje X
        let formattedLabels = labels;
        if (filtroTiempo === 'today') {
            formattedLabels = labels.map(h => `${h}:00`);
        }

        miGrafico = new Chart(ctx, {
            type: chartType,
            data: {
                labels: formattedLabels,
                datasets: datasets
            },
            options: {
                indexAxis: indexAxis, // 'x' para vertical, 'y' para horizontal
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { 
                        stacked: isStacked,
                        beginAtZero: true,
                        title: { display: true, text: (indexAxis === 'x' ? '' : etiquetaEjeX) }
                    },
                    y: {
                        stacked: isStacked,
                        beginAtZero: true,
                        title: { display: true, text: (indexAxis === 'y' ? '' : etiquetaEjeY) },
                        ticks: { autoSkip: false }
                    }
                },
                plugins: {
                    legend: {
                        display: (filtroActividad === 'conjunto') // Mostrar leyenda solo para 'conjunto'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                let value = (indexAxis === 'y') ? context.parsed.x : context.parsed.y;
                                if (label) { label += ': '; }
                                if (value !== null) {
                                    if (unidad === 'minutos') {
                                        label += value + ' min';
                                    } else {
                                        label += parseFloat(value).toFixed(2) + ' h';
                                    }
                                }
                                return label;
                            }
                        }
                    },
                    datalabels: { // Plugin para etiquetas en el gráfico de Temas
                        display: (filtroActividad === 'temas'), // Solo mostrar para 'temas'
                        color: '#333', 
                        anchor: 'end', 
                        align: 'right', 
                        offset: 4,     
                        font: { weight: 'bold' },
                        formatter: function(value, context) {
                            return parseFloat(value).toFixed(2) + ' h';
                        }
                    }
                }
            }
        });
    }

    // --- Función Principal de Fetch ---
    async function cargarEstadisticas() {
        if (miGrafico) miGrafico.destroy();
        canvas.style.display = 'block';

        const filtroActividad = document.querySelector('.activity-filter input:checked').value;
        
        // Mostrar/ocultar filtros de tiempo
        if (filtroActividad === 'temas') {
            filtrosTiempo.classList.add('hidden');
            filtroDiaBox.classList.add('hidden');
            topicSubFilter.classList.remove('hidden');
        } else {
            filtrosTiempo.classList.remove('hidden');
            filtroDiaBox.classList.remove('hidden');
            topicSubFilter.classList.add('hidden');
        }

        // Definir qué filtros se envían a la API
        let filtroTiempo = document.querySelector('.filtro-btn.active').dataset.filtro;
        let url;

        if (filtroActividad === 'temas') {
            const filtroTema = document.querySelector('.topic-sub-filter input:checked').value;
            url = `api/api-stats.php?tipo=temas&filtro_tema=${filtroTema}`;
            filtroTiempo = 'all-time'; // Para que la lógica del gráfico sepa que es horizontal
        } else {
            url = `api/api-stats.php?filtro=${filtroTiempo}&tipo=${filtroActividad}`;
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error de red al cargar estadísticas.');
            const data = await response.json();

            if (data.success) {
                const tiempoFormateado = formatearMinutos(data.total_minutos);
                let titulo = "Total"; // Título por defecto para 'temas'
                if(filtroTiempo === 'today') titulo = "Total Hoy";
                if(filtroTiempo === 'week') titulo = "Total Esta Semana";
                if(filtroTiempo === 'month') titulo = "Total Este Mes";
                if(filtroTiempo === 'year') titulo = "Total Este Año";
                resumenTexto.innerHTML = `${titulo}: <strong>${tiempoFormateado}</strong>`;

                let labels = [...new Set(data.data_rows.map(r => r.label ?? r.label_mes ?? r.tema))];

                if (data.data_rows.length > 0) {
                    dibujarGrafico(labels, data.data_rows, filtroActividad, filtroTiempo);
                } else {
                    if (miGrafico) miGrafico.destroy();
                    resumenTexto.innerHTML += "<br>Aún no hay datos para mostrar.";
                }

            } else {
                resumenTexto.textContent = `Error: ${data.message || 'No se pudieron cargar los datos.'}`;
            }
        } catch (error) {
            console.error(error);
            resumenTexto.textContent = "Error de red. Revisa la consola (F12).";
        }
    }

    // --- Consulta de día específico ---
    async function consultarDiaEspecifico() {
        const fecha = inputFechaStats.value;
        if (!fecha) {
            resultadoStatsDia.textContent = "Selecciona una fecha.";
            return;
        }
        resultadoStatsDia.textContent = "Cargando...";

        const filtroActividad = document.querySelector('.activity-filter input:checked').value;
        
        try {
            const response = await fetch(`api/api-stats.php?filtro=day&fecha=${fecha}&tipo=${filtroActividad}`);
            const data = await response.json();

            if (data.success) {
                const tiempoFormateado = formatearMinutos(data.total_minutos);
                resultadoStatsDia.textContent = `Total el ${fecha}: ${tiempoFormateado}`;
                
                if (data.data_rows.length > 0) {
                    let labels = [...new Set(data.data_rows.map(r => r.label ?? r.tipo))];
                    dibujarGrafico(labels, data.data_rows, filtroActividad, 'day');
                } else {
                    if (miGrafico) miGrafico.destroy();
                }

            } else {
                resultadoStatsDia.textContent = `Error: ${data.message}`;
            }
        } catch (error) {
            resultadoStatsDia.textContent = "Error de red al consultar.";
        }
    }

    // --- Listeners ---
    filtroBotones.forEach(btn => {
        btn.addEventListener('click', () => {
            filtroBotones.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cargarEstadisticas();
        });
    });

    activityFilterRadios.forEach(radio => {
        radio.addEventListener('change', cargarEstadisticas);
    });
    
    topicFilterRadios.forEach(radio => {
        radio.addEventListener('change', cargarEstadisticas);
    });

    btnVerStatsDia.addEventListener('click', () => {
        filtroBotones.forEach(b => b.classList.remove('active'));
        consultarDiaEspecifico();
    });

    // Carga inicial
    cargarEstadisticas();
    inputFechaStats.valueAsDate = new Date();
});