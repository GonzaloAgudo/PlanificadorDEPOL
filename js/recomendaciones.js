import { collection, query, where, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { TEMARIO_OFICIAL, getPesoNormalizado, esTemaOficial } from './temario-oficial.js';
import { claveFecha } from './convocatorias.js';

/**
 * Punto de partida al ordenar: mientras no haya notas de un tema, se le trata
 * como un 5 (ni bien ni mal). PESO_NEUTRO marca cuánta evidencia hace falta
 * para dejar atrás esa suposición: con peso 1, un test propio de un tema
 * (que también pesa 1) ya mueve el valor hasta la mitad del camino.
 *
 * Solo afecta al orden de las recomendaciones; la nota que se muestra en
 * pantalla es siempre la media real.
 */
const NOTA_NEUTRA = 5;
const PESO_NEUTRO = 1;

/**
 * Calcula, para cada uno de los 45 temas oficiales, una prioridad de estudio:
 *
 *   Prioridad = Peso_examen_normalizado × (1 − Cobertura)
 *   Cobertura = 0.5 × tiempo_relativo_estudiado + 0.5 × nota_relativa
 *
 * - Peso_examen_normalizado: cuánto pesa el tema en las convocatorias reales
 *   2020-2025 (ver temario-oficial.js), en relación al tema con más peso.
 * - tiempo_relativo_estudiado: minutos de estudio dedicados a ese tema
 *   (sesiones de actividad "estudio"), en relación al tema más estudiado.
 *   Una sesión dedicada a varios temas reparte su tiempo a partes iguales.
 * - nota_relativa: nota media ponderada de los tests y exámenes que
 *   incluyen ese tema (ver pesoEnExamen). Para ordenar se parte además de un
 *   5 neutro, de modo que un tema con muy pocos datos no se dé por cubierto
 *   (ver notaParaOrden más abajo); la nota que se muestra sí es la media real.
 *
 * Con un rango (el de la convocatoria en curso) solo cuentan las sesiones y
 * las notas de ese periodo: cada convocatoria empieza de cero.
 *
 * Así, un tema que pesa mucho en el examen real y está poco estudiado o con
 * mala nota sube al principio; uno ya bien cubierto baja aunque pese mucho.
 *
 * @param {*} db Instancia de Firestore
 * @param {string} uid UID del usuario
 * @param {{desde: Date, hasta: Date|null}|null} [rango] Periodo que se tiene en cuenta
 * @returns {Promise<Array>} Los 45 temas ordenados de mayor a menor prioridad
 */
export async function calcularRecomendaciones(db, uid, rango = null) {
    const filtrosSesion = [where("id_usuario", "==", uid), where("actividad", "==", "estudio")];
    const filtrosNota = [where("id_usuario", "==", uid)];
    if (rango) {
        // Las sesiones guardan la fecha como Timestamp; las notas, como texto
        filtrosSesion.push(where("fecha", ">=", Timestamp.fromDate(rango.desde)));
        filtrosNota.push(where("fecha", ">=", claveFecha(rango.desde)));
        if (rango.hasta) {
            filtrosSesion.push(where("fecha", "<", Timestamp.fromDate(rango.hasta)));
            filtrosNota.push(where("fecha", "<", claveFecha(rango.hasta)));
        }
    }

    const minutosPorTema = {};
    const sesionesSnap = await getDocs(query(collection(db, "sesiones_estudio"), ...filtrosSesion));
    sesionesSnap.forEach(docSnap => {
        const s = docSnap.data();
        const temas = (s.temas || []).filter(Boolean);
        if (temas.length === 0) return;
        const reparto = (s.duracion_minutos || 0) / temas.length;
        temas.forEach(t => { minutosPorTema[t] = (minutosPorTema[t] || 0) + reparto; });
    });

    const notasPorTema = {};   // tema -> { suma, peso, examenes }
    const notasSnap = await getDocs(query(collection(db, "calificaciones"), ...filtrosNota));
    notasSnap.forEach(docSnap => {
        const n = docSnap.data();
        const temas = (n.temas || []).filter(esTemaOficial);
        if (temas.length === 0) return;

        const pesos = pesosEnExamen(temas);
        temas.forEach(t => {
            if (!notasPorTema[t]) notasPorTema[t] = { suma: 0, peso: 0, examenes: 0 };
            notasPorTema[t].suma += n.nota * pesos[t];
            notasPorTema[t].peso += pesos[t];
            notasPorTema[t].examenes += 1;
        });
    });

    const maxMinutos = Math.max(1, ...Object.values(minutosPorTema));

    const ranking = TEMARIO_OFICIAL.map(t => {
        const minutos = minutosPorTema[t.tema] || 0;
        const pesoNorm = getPesoNormalizado(t.media);

        // Nota media ponderada (ver pesosEnExamen)
        const acumulado = notasPorTema[t.tema];
        const sumaPonderada = acumulado ? acumulado.suma : 0;
        const pesoTotal = acumulado ? acumulado.peso : 0;

        // Nota que se muestra: la media real, sin retocar.
        const notaMedia = pesoTotal > 0 ? sumaPonderada / pesoTotal : null;

        // Nota que se usa para ordenar: la misma media, pero partiendo de un 5
        // ("todavía no sé nada de este tema") con peso 1. Cada nota aleja de ese
        // 5 en proporción a lo que realmente ha medido, así que un único examen
        // global no puede dar por cubiertos los 45 temas de golpe: al Tema 8 lo
        // examina de verdad y lo mueve, y al Tema 45, del que apenas entra media
        // pregunta, lo deja prácticamente como estaba. Según se acumulan notas,
        // el 5 inicial pierde influencia y el valor converge a la media real.
        const notaParaOrden = (sumaPonderada + NOTA_NEUTRA * PESO_NEUTRO) / (pesoTotal + PESO_NEUTRO);

        const tiempoNorm = minutos / maxMinutos;
        const notaNorm = Math.min(1, notaParaOrden / 10);

        const cobertura = (0.5 * tiempoNorm) + (0.5 * notaNorm);
        const prioridad = pesoNorm * (1 - cobertura);

        return {
            ...t,
            minutos,
            notaMedia,
            notaParaOrden,
            numExamenes: acumulado ? acumulado.examenes : 0,
            pesoNorm,
            cobertura,
            prioridad
        };
    });

    ranking.sort((a, b) => b.prioridad - a.prioridad);
    return ranking;
}

/**
 * Cuánto informa un examen sobre cada uno de los temas que incluye.
 *
 * Un examen no reparte sus preguntas por igual: cada tema aporta más o
 * menos según su presencia en el examen real. De un simulacro completo
 * salen unas 6 preguntas del Tema 8 pero solo media del Tema 45, así que
 * informa mucho del primero y casi nada del segundo.
 *
 *   peso(tema) = peso_normalizado(tema) / máximo peso_normalizado del examen
 *
 * El tema más preguntado del examen pesa 1 y el resto, en proporción. La
 * regla abarca los dos casos extremos sin tratarlos aparte: un test de un
 * solo tema pesa 1 para ese tema, y un examen de todo el temario pesa en
 * cada tema justo su peso normalizado, porque su máximo es el del tema más
 * preguntado de todo el temario, que vale 1.
 */
export function pesosEnExamen(temas) {
    const pesoNorm = Object.fromEntries(
        TEMARIO_OFICIAL.filter(t => temas.includes(t.tema))
            .map(t => [t.tema, getPesoNormalizado(t.media)])
    );
    const maximo = Math.max(...Object.values(pesoNorm));
    return Object.fromEntries(Object.entries(pesoNorm).map(([t, p]) => [t, p / maximo]));
}
