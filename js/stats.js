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

    // --- Función para pivotar datos para el gráfico "Conjunto" ---
    function pivotData(dataRows, labels) {
        // Inicializa los datasets
        const datasets = {
            'estudio': { label: 'Estudio', data: new Array(labels.length).fill(0), backgroundColor: TIPO_COLORES['estudio'], stack: 'A' },
            'clase': { label: 'Clase', data: new Array(labels.length).fill(0), backgroundColor: TIPO_COLORES['clase'], stack: 'A' },
            'psicotecnicos': { label: 'Psicotécnicos', data: new Array(labels.length).fill(0), backgroundColor: TIPO_COLORES['psicotecnicos'], stack: 'A' }
        };

        // Rellena los datos
        dataRows.forEach(row => {
            const label = row.label ?? row.label_mes;
            const tipo = row.tipo;
            const total = row.total;
            
            const index = labels.indexOf(label);
            if (index > -1 && datasets[tipo]) {
                datasets[tipo].data[index] = total;
            }
        });

        // Devuelve solo los datasets que tienen algún dato
        return Object.values(datasets).filter(ds => ds.data.some(d => d > 0));
    }


    // --- Función para dibujar el Gráfico ---
    function dibujarGrafico(labels, dataRows, filtroActividad, filtroTiempo) {
        if (miGrafico) miGrafico.destroy();

        let datasets = [];
        let chartType = 'bar';
        let isStacked = false;
        
        // --- Lógica de Unidades (Minutos vs Horas) ---
        let unidad = 'horas';
        if (filtroTiempo === 'today' || (filtroTiempo === 'day' && filtroActividad !== 'conjunto')) {
            unidad = 'minutos';
        }
        
        const convertirUnidad = (val) => (unidad === 'horas' ? (val / 60) : val);

        // --- Lógica de Tipo de Gráfico (Simple vs Apilado) ---
        if (filtroActividad === 'conjunto') {
            isStacked = true;
            chartType = 'bar';
            
            const pivotedData = pivotData(dataRows, labels);
            pivotedData.forEach(ds => {
                ds.data = ds.data.map(convertirUnidad); 
            });
            datasets = pivotedData;

        } else {
            // Gráfico simple
            isStacked = false;
            chartType = 'bar';
            
            let color;
            if (filtroActividad === 'estudio') color = TIPO_COLORES['estudio'];
            else if (filtroActividad === 'clase') color = TIPO_COLORES['clase'];
            else if (filtroActividad === 'psicotecnicos') color = TIPO_COLORES['psicotecnicos'];
            else color = TIPO_COLORES['estudio'];
            
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
        
        // --- Definir etiquetas ---
        const etiquetaLeyenda = (unidad === 'minutos') ? 'Minutos' : 'Horas';
        const etiquetaEjeY = (unidad === 'minutos') ? 'Minutos' : 'Horas';

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
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { stacked: isStacked },
                    y: {
                        beginAtZero: true,
                        stacked: isStacked,
                        title: { display: true, text: etiquetaEjeY }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) { label += ': '; }
                                if (context.parsed.y !== null) {
                                    if (unidad === 'minutos') {
                                        label += context.parsed.y + ' min';
                                    } else {
                                        label += parseFloat(context.parsed.y).toFixed(2) + ' h';
                                    }
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    // --- Función Principal de Fetch ---
    async function cargarEstadisticas() {
        
        canvas.style.display = 'block';

        const filtroTiempo = document.querySelector('.filtro-btn.active').dataset.filtro;
        const filtroActividad = document.querySelector('.activity-filter input:checked').value;
        
        if(filtroTiempo === 'day') return; 

        let url = `api/api-stats.php?filtro=${filtroTiempo}&tipo=${filtroActividad}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error de red al cargar estadísticas.');
            const data = await response.json();

            if (data.success) {
                const tiempoFormateado = formatearMinutos(data.total_minutos);
                let titulo = "Hoy";
                if(filtroTiempo === 'week') titulo = "Esta Semana";
                if(filtroTiempo === 'month') titulo = "Este Mes";
                if(filtroTiempo === 'year') titulo = "Este Año";
                resumenTexto.innerHTML = `Total ${titulo}: <strong>${tiempoFormateado}</strong>`;

                // Preparar etiquetas (labels) para el gráfico
                let labels = [...new Set(data.data_rows.map(r => r.label ?? r.label_mes))];

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
            resumenTexto.textContent = "Error de red. Revisa la consola (F12) para más detalles.";
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
            
            if(btn.dataset.filtro !== 'day') {
                cargarEstadisticas();
            }
        });
    });

    activityFilterRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if(document.querySelector('.filtro-btn.active').dataset.filtro === 'day') {
                consultarDiaEspecifico();
            } else {
                cargarEstadisticas();
            }
        });
    });

    btnVerStatsDia.addEventListener('click', () => {
        filtroBotones.forEach(b => b.classList.remove('active'));
        // (No activamos ningún botón de filtro de tiempo)
        consultarDiaEspecifico();
    });

    // Carga inicial
    cargarEstadisticas();
    inputFechaStats.valueAsDate = new Date();
});