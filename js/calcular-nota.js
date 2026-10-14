import { db, auth } from './firebase-config.js';
import {
    collection, addDoc, query, where,
    deleteDoc, updateDoc, doc, onSnapshot, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { cubreTodoElTemario, resumirTemas } from './temario-oficial.js';
import { crearSelectorTemas } from './selector-temas.js';
import {
    cargarConvocatorias, rellenarSelectorConvocatorias, rangoSeleccionado, claveFecha
} from './convocatorias.js';
import { icon } from './icons.js';
import { toast, confirmDialog } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // --- REFERENCIAS DOM ---
    const inputTotal = document.getElementById('input-total');
    const inputAciertos = document.getElementById('input-aciertos');
    const inputErrores = document.getElementById('input-errores');
    const valBlancas = document.getElementById('val-blancas');
    const finalScoreEl = document.getElementById('final-score');
    const scoreMsgEl = document.getElementById('score-message');
    const resultBox = document.querySelector('.result-box');
    const modeBtns = document.querySelectorAll('.mode-btn');

    const viewCalc = document.getElementById('view-calculator');
    const viewProgress = document.getElementById('view-progress');
    const btnGoProgress = document.getElementById('btn-go-progress');
    const btnBackCalc = document.getElementById('btn-back-calc');
    
    const formContainer = document.querySelector('.add-grade-form');
    const inpTitle = document.getElementById('grade-title');
    const inpScore = document.getElementById('grade-score');
    const inpDate = document.getElementById('grade-date');
    const selectorTemas = crearSelectorTemas(document.getElementById('grade-temas'), {
        etiqueta: 'Temas del examen',
        vacio: 'Sin tema asociado'
    });
    const btnSaveGrade = document.getElementById('btn-save-grade');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    const listContainer = document.getElementById('grades-list');
    const selectorConvocatoria = document.getElementById('filtro-convocatoria');
    
    // --- CORRECCIÓN AQUÍ: Selector actualizado al nuevo nombre de clase ---
    const filterCheckboxes = document.querySelectorAll('.chart-filters-modern input');
    
    const ctx = document.getElementById('progressChart').getContext('2d');

    // --- ESTADO ---
    let currentMode = 'teoria';
    let lastCalculatedScore = 0;
    let chartInstance = null;
    let editingId = null; 
    let todasLasNotas = [];  // Todo lo que hay en Firestore, en orden de fecha
    let cachedGrades = [];   // Las de la convocatoria elegida
    let convocatorias = [];

    // Inicializar fecha
    inpDate.valueAsDate = new Date();

    // ======================================================
    //  1. LÓGICA CALCULADORA
    // ======================================================

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
            calcular();
        });
    });

    [inputTotal, inputAciertos, inputErrores].forEach(input => {
        input.addEventListener('input', calcular);
    });

    function calcular() {
        const P = parseFloat(inputTotal.value) || 0;
        const A = parseFloat(inputAciertos.value) || 0;
        const E = parseFloat(inputErrores.value) || 0;
        const blancas = P - A - E;
        
        valBlancas.textContent = blancas >= 0 ? blancas : 'Error';

        if (P <= 0 || blancas < 0) {
            resetResultado();
            return;
        }

        let n = (currentMode === 'teoria') ? 3 : 4;
        const penalizacion = E / (n - 1);
        const notaNeta = A - penalizacion;
        let notaFinal = (notaNeta * 10) / P;

        lastCalculatedScore = notaFinal;
        mostrarResultado(notaFinal);
    }

    function mostrarResultado(nota) {
        const notaFormatted = nota.toFixed(3);
        finalScoreEl.textContent = notaFormatted;

        resultBox.classList.remove('pass', 'fail');
        if (nota >= 5) {
            resultBox.classList.add('pass');
            scoreMsgEl.textContent = "Apto";
        } else {
            resultBox.classList.add('fail');
            scoreMsgEl.textContent = "No apto";
        }
    }

    function resetResultado() {
        finalScoreEl.textContent = "0.000";
        scoreMsgEl.textContent = "Introduce tus datos";
        resultBox.classList.remove('pass', 'fail');
        lastCalculatedScore = 0;
    }

    // ======================================================
    //  2. PROGRESO, EDICIÓN Y FILTROS
    // ======================================================

    btnGoProgress.addEventListener('click', () => {
        viewCalc.classList.add('hidden');
        viewProgress.classList.remove('hidden');
        if (lastCalculatedScore !== 0 && !editingId) {
            inpScore.value = lastCalculatedScore.toFixed(3);
            inpTitle.focus(); 
        }
        loadGrades();
    });

    btnBackCalc.addEventListener('click', () => {
        viewProgress.classList.add('hidden');
        viewCalc.classList.remove('hidden');
        resetForm();
    });

    // LISTENERS DE FILTROS (Actualizado)
    filterCheckboxes.forEach(cb => {
        cb.addEventListener('change', function() {
            // 1. Actualizar visualmente la "píldora"
            const parentLabel = this.closest('.filter-pill');
            if (this.checked) {
                parentLabel.classList.add('active');
            } else {
                parentLabel.classList.remove('active');
            }

            // 2. Filtrar el gráfico
            filterAndRenderChart();
        });
    });

    // GUARDAR (CREAR/EDITAR)
    btnSaveGrade.addEventListener('click', async () => {
        if (!auth.currentUser) return toast('Debes iniciar sesión.', { type: 'error' });

        const title = inpTitle.value.trim();
        const score = parseFloat(inpScore.value);
        const dateVal = inpDate.value;
        const temas = selectorTemas.obtener();

        if (!title || isNaN(score) || !dateVal) return toast('Rellena el título, la nota y la fecha.', { type: 'warning' });

        try {
            if (editingId) {
                await updateDoc(doc(db, "calificaciones", editingId), {
                    titulo: title, nota: score, fecha: dateVal, temas
                });
                resetForm();
            } else {
                await addDoc(collection(db, "calificaciones"), {
                    id_usuario: auth.currentUser.uid,
                    titulo: title, nota: score, fecha: dateVal, temas,
                    fecha_registro: new Date()
                });
                inpTitle.value = '';
                inpScore.value = '';
                selectorTemas.limpiar();
            }
        } catch (error) {
            console.error(error);
            toast('No se pudo guardar la nota.', { type: 'error' });
        }
    });

    btnCancelEdit.addEventListener('click', resetForm);

    function resetForm() {
        editingId = null;
        inpTitle.value = '';
        inpScore.value = '';
        selectorTemas.limpiar();
        inpDate.valueAsDate = new Date();
        btnSaveGrade.innerHTML = `${icon('plus')}Añadir`;
        btnCancelEdit.classList.add('hidden');
        formContainer.classList.remove('editing-mode');
    }

    function startEdit(data) {
        editingId = data.id;
        inpTitle.value = data.titulo;
        inpScore.value = data.nota;
        inpDate.value = data.fecha;
        selectorTemas.fijar(data.temas || []);

        btnSaveGrade.innerHTML = `${icon('save')}Guardar cambios`;
        btnCancelEdit.classList.remove('hidden');
        formContainer.classList.add('editing-mode');
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inpTitle.focus();
    }

    // CARGA DE DATOS
    let convocatoriasCargadas = false;

    async function loadGrades() {
        if (!auth.currentUser) return;

        if (!convocatoriasCargadas) {
            try {
                convocatorias = await cargarConvocatorias(db, auth.currentUser.uid);
                rellenarSelectorConvocatorias(selectorConvocatoria, convocatorias);
                convocatoriasCargadas = true;
            } catch (error) {
                console.error("Error cargando convocatorias:", error);
            }
        }

        const q = query(
            collection(db, "calificaciones"),
            where("id_usuario", "==", auth.currentUser.uid),
            orderBy("fecha", "asc") 
        );

        onSnapshot(q, (snapshot) => {
            const grades = [];
            listContainer.innerHTML = '';

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                grades.push({ id: docSnap.id, ...data });
            });

            todasLasNotas = grades;
            pintarNotas();
        });
    }

    // Lista y gráfica de la convocatoria elegida. Se filtra en memoria: la
    // suscripción ya trae todas las notas y así cambiar de convocatoria no
    // obliga a volver a consultar Firestore.
    function pintarNotas() {
        const rango = rangoSeleccionado(selectorConvocatoria, convocatorias);
        const desde = rango ? claveFecha(rango.desde) : null;
        const hasta = rango && rango.hasta ? claveFecha(rango.hasta) : null;
        cachedGrades = todasLasNotas.filter(g =>
            (!desde || g.fecha >= desde) && (!hasta || g.fecha < hasta));

        listContainer.innerHTML = '';
        if (cachedGrades.length === 0) {
            listContainer.innerHTML = '<p class="empty-msg">No hay notas en esta convocatoria.</p>';
        }
        // Lista (invertida para ver últimos)
        [...cachedGrades].reverse().forEach(g => renderListItem(g));

        // Gráfico
        filterAndRenderChart();
    }

    selectorConvocatoria.addEventListener('change', pintarNotas);

    function renderListItem(data) {
        const li = document.createElement('li');
        li.className = 'grade-item';

        const dateObj = new Date(data.fecha);
        const dateStr = dateObj.toLocaleDateString();
        const isApto = data.nota >= 5;
        const badgeClass = isApto ? 'apto' : 'no-apto';

        const isExam = data.titulo.toLowerCase().includes('examen');
        const tipoIcon = isExam ? icon('award', 'icon--sm') : icon('document', 'icon--sm');
        const ambito = !data.temas || data.temas.length === 0 ? ''
            : cubreTodoElTemario(data.temas) ? 'Examen global'
            : resumirTemas(data.temas);
        const meta = [dateStr, ambito].filter(Boolean).join(' · ');

        li.innerHTML = `
            <div class="grade-main">
                <span class="grade-badge ${badgeClass}">${data.nota.toFixed(2)}</span>
                <div>
                    <strong>${data.titulo}</strong>
                    <div class="grade-meta">${meta}</div>
                </div>
            </div>
            <div class="grade-actions">
                <span class="u-subtle" title="${isExam ? 'Examen' : 'Test'}">${tipoIcon}</span>
                <button class="btn-action-grade btn-edit-grade" title="Editar" aria-label="Editar">${icon('edit', 'icon--sm')}</button>
                <button class="btn-action-grade btn-del-grade" title="Borrar" aria-label="Borrar">${icon('trash', 'icon--sm')}</button>
            </div>
        `;

        li.querySelector('.btn-edit-grade').addEventListener('click', () => startEdit(data));
        li.querySelector('.btn-del-grade').addEventListener('click', async () => {
            const ok = await confirmDialog({
                title: 'Borrar nota',
                message: `Se eliminará <strong>${data.titulo}</strong> del historial.`,
                confirmText: 'Borrar',
                danger: true
            });
            if (ok) {
                if (editingId === data.id) resetForm();
                await deleteDoc(doc(db, "calificaciones", data.id));
                toast('Nota borrada.');
            }
        });

        listContainer.appendChild(li);
    }

    // --- FILTRADO Y RENDERIZADO DEL GRÁFICO ---
    function filterAndRenderChart() {
        // Corrección selectores para encontrar los inputs dentro de los filtros modernos
        const showExam = document.querySelector('.chart-filters-modern input[value="examen"]').checked;
        const showTest = document.querySelector('.chart-filters-modern input[value="test"]').checked;

        // Filtrar datos
        const filteredData = cachedGrades.filter(g => {
            const isExam = g.titulo.toLowerCase().includes('examen');
            
            // Lógica:
            // 1. Es examen Y quiero ver exámenes -> TRUE
            if (isExam && showExam) return true;
            // 2. NO es examen (es test) Y quiero ver tests -> TRUE
            if (!isExam && showTest) return true;
            
            return false;
        });

        renderChart(filteredData);
    }

    function renderChart(dataArray) {
        const labels = dataArray.map(g => {
            const d = new Date(g.fecha);
            return `${d.getDate()}/${d.getMonth()+1}`; 
        });
        const dataPoints = dataArray.map(g => g.nota);

        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Nota',
                    data: dataPoints,
                    borderColor: '#1c4e80',
                    backgroundColor: 'rgba(28, 78, 128, 0.08)',
                    borderWidth: 2,
                    // El color indica aprobado/suspenso; el tamaño, examen frente a test
                    pointBackgroundColor: (context) => (context.raw >= 5 ? '#1f6f4a' : '#9b2c2c'),
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: (context) => {
                        const item = dataArray[context.dataIndex];
                        const isExam = item && item.titulo.toLowerCase().includes('examen');
                        return isExam ? 7 : 4.5;
                    },
                    pointHoverRadius: 8,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 10,
                        grid: { color: '#eceef1' },
                        border: { display: false },
                        ticks: { color: '#5b6673' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#5b6673' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            afterLabel: function(context) {
                                return dataArray[context.dataIndex].titulo;
                            }
                        }
                    }
                }
            }
        });
    }
});