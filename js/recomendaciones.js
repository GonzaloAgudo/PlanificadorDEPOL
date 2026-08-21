import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { TEMARIO_OFICIAL, getPesoNormalizado } from './temario-oficial.js';

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
 * - nota_relativa: nota media de tests/exámenes guardados con ese tema en
 *   Calcular Nota (0 si nunca se ha hecho un test de ese tema, 0.5 = neutral).
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

    const notasPorTema = {}; // tema -> { suma, count }
    const notasQ = query(
        collection(db, "notas_historial"),
        where("user_id", "==", uid)
    );
    const notasSnap = await getDocs(notasQ);
    notasSnap.forEach(docSnap => {
        const n = docSnap.data();
        if (!n.tema) return;
        if (!notasPorTema[n.tema]) notasPorTema[n.tema] = { suma: 0, count: 0 };
        notasPorTema[n.tema].suma += n.nota;
        notasPorTema[n.tema].count += 1;
    });

    const maxMinutos = Math.max(1, ...Object.values(minutosPorTema));

    const ranking = TEMARIO_OFICIAL.map(t => {
        const minutos = minutosPorTema[t.tema] || 0;
        const notaInfo = notasPorTema[t.tema];
        const notaMedia = notaInfo ? notaInfo.suma / notaInfo.count : null;

        const pesoNorm = getPesoNormalizado(t.media);
        const tiempoNorm = minutos / maxMinutos;
        const notaNorm = notaMedia !== null ? Math.min(1, notaMedia / 10) : 0.5;

        const cobertura = (0.5 * tiempoNorm) + (0.5 * notaNorm);
        const prioridad = pesoNorm * (1 - cobertura);

        return {
            ...t,
            minutos,
            notaMedia,
            numTests: notaInfo ? notaInfo.count : 0,
            pesoNorm,
            cobertura,
            prioridad
        };
    });

    ranking.sort((a, b) => b.prioridad - a.prioridad);
    return ranking;
}
