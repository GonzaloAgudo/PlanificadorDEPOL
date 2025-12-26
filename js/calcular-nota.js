import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, query, where, getDocs, 
    deleteDoc, updateDoc, doc, onSnapshot, orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
    const btnSaveGrade = document.getElementById('btn-save-grade');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    const listContainer = document.getElementById('grades-list');
    
    // --- CORRECCIÓN AQUÍ: Selector actualizado al nuevo nombre de clase ---
    const filterCheckboxes = document.querySelectorAll('.chart-filters-modern input');
    
    const ctx = document.getElementById('progressChart').getContext('2d');

    // --- ESTADO ---
    let currentMode = 'teoria';
    let lastCalculatedScore = 0;
    let chartInstance = null;
    let editingId = null; 
    let cachedGrades = []; // Guardamos los datos para filtrarlos rápido

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
            scoreMsgEl.textContent = "¡APTO! 🎉";
        } else {
            resultBox.classList.add('fail');
            scoreMsgEl.textContent = "NO APTO 💀";
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
        if (!auth.currentUser) return alert("Debes iniciar sesión");

        const title = inpTitle.value.trim();
        const score = parseFloat(inpScore.value);
        const dateVal = inpDate.value;

        if (!title || isNaN(score) || !dateVal) return alert("Rellena todos los campos");

        try {
            if (editingId) {
                await updateDoc(doc(db, "notas_historial", editingId), {
                    titulo: title, nota: score, fecha: dateVal
                });
                resetForm();
            } else {
                await addDoc(collection(db, "notas_historial"), {
                    user_id: auth.currentUser.uid,
                    titulo: title, nota: score, fecha: dateVal,
                    timestamp: new Date()
                });
                inpTitle.value = '';
                inpScore.value = '';
            }
        } catch (error) {
            console.error(error);
            alert("Error al guardar");
        }
    });

    btnCancelEdit.addEventListener('click', resetForm);

    function resetForm() {
        editingId = null;
        inpTitle.value = '';
        inpScore.value = '';
        inpDate.valueAsDate = new Date();
        btnSaveGrade.innerHTML = '<span class="btn-icon">+</span> Añadir'; // Icono recuperado
        btnCancelEdit.classList.add('hidden');
        formContainer.classList.remove('editing-mode');
    }

    function startEdit(data) {
        editingId = data.id;
        inpTitle.value = data.titulo;
        inpScore.value = data.nota;
        inpDate.value = data.fecha;
        
        btnSaveGrade.innerHTML = '<span class="btn-icon">💾</span> Guardar';
        btnCancelEdit.classList.remove('hidden');
        formContainer.classList.add('editing-mode');
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inpTitle.focus();
    }

    // CARGA DE DATOS
    function loadGrades() {
        if (!auth.currentUser) return;

        const q = query(
            collection(db, "notas_historial"),
            where("user_id", "==", auth.currentUser.uid),
            orderBy("fecha", "asc") 
        );

        onSnapshot(q, (snapshot) => {
            const grades = [];
            listContainer.innerHTML = '';

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                grades.push({ id: docSnap.id, ...data });
            });

            // Guardamos en memoria para filtrar rápido
            cachedGrades = grades;

            // Lista (invertida para ver últimos)
            [...grades].reverse().forEach(g => renderListItem(g));

            // Gráfico
            filterAndRenderChart();
        });
    }

    function renderListItem(data) {
        const li = document.createElement('li');
        li.className = 'grade-item';
        
        const dateObj = new Date(data.fecha);
        const dateStr = dateObj.toLocaleDateString();
        const isApto = data.nota >= 5;
        const badgeClass = isApto ? 'apto' : 'no-apto';
        
        const isExam = data.titulo.toLowerCase().includes('examen');
        const icon = isExam ? '🏆' : '📝';

        li.innerHTML = `
            <div style="display:flex; align-items:center;">
                <span class="grade-badge ${badgeClass}">${data.nota.toFixed(2)}</span>
                <div>
                    <strong>${icon} ${data.titulo}</strong>
                    <div style="font-size:0.8rem; color:#888;">${dateStr}</div>
                </div>
            </div>
            <div class="grade-actions">
                <button class="btn-action-grade btn-edit-grade" title="Editar">✏️</button>
                <button class="btn-action-grade btn-del-grade" title="Borrar">🗑️</button>
            </div>
        `;

        li.querySelector('.btn-edit-grade').addEventListener('click', () => startEdit(data));
        li.querySelector('.btn-del-grade').addEventListener('click', async () => {
            if(confirm("¿Borrar registro?")) {
                if (editingId === data.id) resetForm();
                await deleteDoc(doc(db, "notas_historial", data.id));
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
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: (context) => {
                        const val = context.raw;
                        // Diferenciamos visualmente examen de test en el punto
                        const item = dataArray[context.dataIndex];
                        const isExam = item && item.titulo.toLowerCase().includes('examen');
                        
                        // Si es examen: Dorado si aprueba, Rojo oscuro si suspende
                        // Si es test: Verde si aprueba, Rojo normal si suspende
                        if (isExam) return val >= 5 ? '#ffc107' : '#c62828';
                        return val >= 5 ? '#28a745' : '#dc3545';
                    },
                    pointRadius: 5,
                    pointHoverRadius: 7,
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
                        grid: { color: '#f0f0f0' }
                    },
                    x: { grid: { display: false } }
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

    auth.onAuthStateChanged(user => {});
});