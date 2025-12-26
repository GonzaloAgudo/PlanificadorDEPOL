import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, query, where, getDocs, 
    deleteDoc, updateDoc, doc, onSnapshot, orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    
    // --- REFERENCIAS CALCULADORA ---
    const inputTotal = document.getElementById('input-total');
    const inputAciertos = document.getElementById('input-aciertos');
    const inputErrores = document.getElementById('input-errores');
    const valBlancas = document.getElementById('val-blancas');
    const finalScoreEl = document.getElementById('final-score');
    const scoreMsgEl = document.getElementById('score-message');
    const resultBox = document.querySelector('.result-box');
    const modeBtns = document.querySelectorAll('.mode-btn');

    // --- REFERENCIAS PROGRESO ---
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
    
    // Gráficos
    const ctxExams = document.getElementById('examsChart').getContext('2d');
    const ctxTests = document.getElementById('testsChart').getContext('2d');

    // Estado
    let currentMode = 'teoria';
    let lastCalculatedScore = 0;
    let examsChartInstance = null;
    let testsChartInstance = null;
    
    // ESTADO DE EDICIÓN
    let editingId = null; // Si esto tiene valor, estamos editando

    // Inicializar fecha hoy
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
    //  2. LÓGICA DE PROGRESO Y EDICIÓN
    // ======================================================

    // IR A VISTA PROGRESO
    btnGoProgress.addEventListener('click', () => {
        viewCalc.classList.add('hidden');
        viewProgress.classList.remove('hidden');
        
        // Si acabamos de calcular, lo ponemos en el input (si no estamos editando)
        if (lastCalculatedScore !== 0 && !editingId) {
            inpScore.value = lastCalculatedScore.toFixed(3);
            inpTitle.focus(); 
        }
        loadGrades();
    });

    // VOLVER A CALCULADORA
    btnBackCalc.addEventListener('click', () => {
        viewProgress.classList.add('hidden');
        viewCalc.classList.remove('hidden');
        resetForm(); // Limpiamos formulario al salir
    });

    // --- GUARDAR (CREAR O EDITAR) ---
    btnSaveGrade.addEventListener('click', async () => {
        if (!auth.currentUser) return alert("Debes iniciar sesión");

        const title = inpTitle.value.trim();
        const score = parseFloat(inpScore.value);
        const dateVal = inpDate.value;

        if (!title || isNaN(score) || !dateVal) {
            return alert("Rellena Título, Nota y Fecha");
        }

        try {
            if (editingId) {
                // MODO EDICIÓN: Actualizar existente
                const docRef = doc(db, "notas_historial", editingId);
                await updateDoc(docRef, {
                    titulo: title,
                    nota: score,
                    fecha: dateVal
                });
                resetForm(); // Salir del modo edición
            } else {
                // MODO CREACIÓN: Nuevo
                await addDoc(collection(db, "notas_historial"), {
                    user_id: auth.currentUser.uid,
                    titulo: title,
                    nota: score,
                    fecha: dateVal,
                    timestamp: new Date()
                });
                // Limpiamos campos pero mantenemos fecha
                inpTitle.value = '';
                inpScore.value = '';
            }
        } catch (error) {
            console.error(error);
            alert("Error al guardar");
        }
    });

    // CANCELAR EDICIÓN
    btnCancelEdit.addEventListener('click', resetForm);

    function resetForm() {
        editingId = null;
        inpTitle.value = '';
        inpScore.value = '';
        inpDate.valueAsDate = new Date();
        
        // Restaurar UI
        btnSaveGrade.innerHTML = '+';
        btnSaveGrade.title = "Añadir nota";
        btnCancelEdit.classList.add('hidden');
        formContainer.classList.remove('editing-mode');
    }

    function startEdit(data) {
        editingId = data.id;
        
        // Rellenar inputs
        inpTitle.value = data.titulo;
        inpScore.value = data.nota;
        inpDate.value = data.fecha;
        
        // Cambiar UI para indicar edición
        btnSaveGrade.innerHTML = '💾'; // Icono de guardar
        btnSaveGrade.title = "Guardar cambios";
        btnCancelEdit.classList.remove('hidden');
        formContainer.classList.add('editing-mode');
        
        // Scroll hacia el formulario (útil en móvil)
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

            // Lista (invertida para ver lo último arriba)
            [...grades].reverse().forEach(g => renderListItem(g));

            updateCharts(grades);
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

        // Listener Editar
        li.querySelector('.btn-edit-grade').addEventListener('click', () => {
            startEdit(data);
        });

        // Listener Borrar
        li.querySelector('.btn-del-grade').addEventListener('click', async () => {
            if(confirm("¿Borrar registro permanentemente?")) {
                // Si borramos lo que estamos editando, cancelar edición
                if (editingId === data.id) resetForm();
                await deleteDoc(doc(db, "notas_historial", data.id));
            }
        });

        listContainer.appendChild(li);
    }

    function updateCharts(allGrades) {
        const examGrades = allGrades.filter(g => g.titulo.toLowerCase().includes('examen'));
        const testGrades = allGrades.filter(g => !g.titulo.toLowerCase().includes('examen'));

        if (examsChartInstance) examsChartInstance.destroy();
        examsChartInstance = createChart(ctxExams, examGrades, 'Exámenes', '#007bff');

        if (testsChartInstance) testsChartInstance.destroy();
        testsChartInstance = createChart(ctxTests, testGrades, 'Tests', '#6f42c1');
    }

    function createChart(ctx, dataArray, label, color) {
        const labels = dataArray.map(g => {
            const d = new Date(g.fecha);
            return `${d.getDate()}/${d.getMonth()+1}`; 
        });
        const dataPoints = dataArray.map(g => g.nota);

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: dataPoints,
                    borderColor: color,
                    backgroundColor: color.replace(')', ', 0.1)').replace('rgb', 'rgba'),
                    borderWidth: 2,
                    pointBackgroundColor: (context) => {
                        const val = context.raw;
                        return val >= 5 ? '#28a745' : '#dc3545';
                    },
                    pointRadius: 4,
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