import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { TEMARIO_OFICIAL, getPesoNormalizado, TEMA_GLOBAL } from './temario-oficial.js';

/**
 * Calcula, para cada uno de los 45 temas oficiales, una prioridad de estudio:
 *
 *   Prioridad = Peso_examen_normalizado × (1 − Cobertura)
 *   Cobertura = 0.5 × tiempo_relativo_estudiado + 0.5 × nota_relativa
 *
 * - Peso_examen_normalizado: cuánto pesa el tema en las convocatorias reales
 *   2020-2025 (ver temario-oficial.js), en relación al tema con más peso.
 * - tiempo_relativo_estudiado: minutos de estudio dedicados a ese tema
 *   (sesiones tipo "estudio"), en relación al tema más estudiado.
 * - nota_relativa: nota media ponderada de los tests y exámenes de ese tema
 *   (0.5 = neutral si no hay ninguno). Los exámenes globales, que abarcan
 *   todo el temario, entran en la media de todos los temas con un peso
 *   proporcional a las preguntas que cada uno aporta al examen real.
 *
 * Así, un tema que pesa mucho en el examen real y está poco estudiado o con
 * mala nota sube al principio; uno ya bien cubierto baja aunque pese mucho.
 *
 * @param {*} db Instancia de Firestore
 * @param {string} uid UID del usuario
 * @returns {Promise<Array>} Los 45 temas ordenados de mayor a menor prioridad
 */
export async function calcularRecomendaciones(db, uid) {
    const minutosPorTema = {};
    const sesionesQ = query(
        collection(db, "sesiones_estudio"),
        where("user_id", "==", uid),
        where("tipo", "==", "estudio")
    );
    const sesionesSnap = await getDocs(sesionesQ);
    sesionesSnap.forEach(docSnap => {
        const s = docSnap.data();
        const tema = s.tema;
        if (!tema || tema === 'Sin tema') return;
        minutosPorTema[tema] = (minutosPorTema[tema] || 0) + (s.duracion_minutos || 0);
    });

    const notasPorTema = {};   // tema -> { suma, count }
    const notasGlobales = [];  // exámenes de todo el temario

    const notasQ = query(
        collection(db, "notas_historial"),
        where("user_id", "==", uid)
    );
    const notasSnap = await getDocs(notasQ);
    notasSnap.forEach(docSnap => {
        const n = docSnap.data();
        if (!n.tema) return;

        if (n.tema === TEMA_GLOBAL) {
            notasGlobales.push(n.nota);
            return;
        }
        if (!notasPorTema[n.tema]) notasPorTema[n.tema] = { suma: 0, count: 0 };
        notasPorTema[n.tema].suma += n.nota;
        notasPorTema[n.tema].count += 1;
    });

    const maxMinutos = Math.max(1, ...Object.values(minutosPorTema));

    const ranking = TEMARIO_OFICIAL.map(t => {
        const minutos = minutosPorTema[t.tema] || 0;
        const pesoNorm = getPesoNormalizado(t.media);

        // Nota media ponderada.
        //
        // Un test de un tema concreto dice mucho sobre ese tema, así que pesa 1.
        // Un examen global reparte sus preguntas entre los 45 temas según la
        // presencia real de cada uno en la convocatoria: de un simulacro
        // completo salen unas 6 preguntas del Tema 8 pero solo media del
        // Tema 45, así que informa mucho del primero y casi nada del segundo.
        // Ese reparto es justo pesoNorm (media del tema / media del tema con
        // más preguntas).
        const propio = notasPorTema[t.tema];
        let sumaPonderada = propio ? propio.suma : 0;
        let pesoTotal = propio ? propio.count : 0;

        for (const nota of notasGlobales) {
            sumaPonderada += nota * pesoNorm;
            pesoTotal += pesoNorm;
        }

        const notaMedia = pesoTotal > 0 ? sumaPonderada / pesoTotal : null;

        const tiempoNorm = minutos / maxMinutos;
        const notaNorm = notaMedia !== null ? Math.min(1, notaMedia / 10) : 0.5;

        const cobertura = (0.5 * tiempoNorm) + (0.5 * notaNorm);
        const prioridad = pesoNorm * (1 - cobertura);

        return {
            ...t,
            minutos,
            notaMedia,
            numTests: propio ? propio.count : 0,
            numGlobales: notasGlobales.length,
            pesoNorm,
            cobertura,
            prioridad
        };
    });

    ranking.sort((a, b) => b.prioridad - a.prioridad);
    return ranking;
}
