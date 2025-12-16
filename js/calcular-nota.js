document.addEventListener('DOMContentLoaded', () => {
    
    // Elementos del DOM
    const inputTotal = document.getElementById('input-total');
    const inputAciertos = document.getElementById('input-aciertos');
    const inputErrores = document.getElementById('input-errores');
    const valBlancas = document.getElementById('val-blancas');
    
    const finalScoreEl = document.getElementById('final-score');
    const scoreMsgEl = document.getElementById('score-message');
    const resultBox = document.querySelector('.result-box');
    
    const modeBtns = document.querySelectorAll('.mode-btn');

    // Estado
    let currentMode = 'teoria'; // 'teoria' (3 opciones) o 'psicos' (4 opciones)

    // --- 1. CAMBIO DE MODO ---
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
            calcular(); // Recalcular al cambiar el modo
        });
    });

    // --- 2. LISTENERS DE INPUTS ---
    // Calculamos cada vez que el usuario escribe algo
    [inputTotal, inputAciertos, inputErrores].forEach(input => {
        input.addEventListener('input', calcular);
    });

    function calcular() {
        // Obtener valores (si está vacío es 0)
        const P = parseFloat(inputTotal.value) || 0;
        const A = parseFloat(inputAciertos.value) || 0;
        const E = parseFloat(inputErrores.value) || 0;

        // Calcular Blancas
        const blancas = P - A - E;
        valBlancas.textContent = blancas >= 0 ? blancas : 'Error';

        // Validaciones básicas
        if (P <= 0) {
            resetResultado("Introduce nº preguntas");
            return;
        }
        if (blancas < 0) {
            resetResultado("Revisa los datos (A+E > Total)");
            return;
        }

        // --- FÓRMULA POLICÍA NACIONAL ---
        // n = número de opciones.
        // Teoría: 3 opciones (n=3) -> Penalización = 1 / (3-1) = 1/2 = 0.5
        // Psicos: 4 opciones (n=4) -> Penalización = 1 / (4-1) = 1/3 = 0.3333...
        
        let n = (currentMode === 'teoria') ? 3 : 4;
        
        // Numerador: A - (E / (n - 1))
        const penalizacion = E / (n - 1);
        const notaNeta = A - penalizacion;
        
        // Fórmula final: (NotaNeta * 10) / P
        let notaFinal = (notaNeta * 10) / P;

        // Mostrar resultado (Redondeo a 3 decimales típico de oposiciones)
        mostrarResultado(notaFinal);
    }

    function mostrarResultado(nota) {
        // Formatear a 3 decimales
        const notaFormatted = nota.toFixed(3);
        finalScoreEl.textContent = notaFormatted;

        // Estilos visuales (Aprobado >= 5.0)
        resultBox.classList.remove('pass', 'fail');
        
        if (nota >= 5) {
            resultBox.classList.add('pass');
            scoreMsgEl.textContent = "¡APTO! 🎉";
        } else {
            resultBox.classList.add('fail');
            scoreMsgEl.textContent = "NO APTO 💀";
        }
    }

    function resetResultado(msg) {
        finalScoreEl.textContent = "0.000";
        scoreMsgEl.textContent = msg;
        resultBox.classList.remove('pass', 'fail');
    }
});