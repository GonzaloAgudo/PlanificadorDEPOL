/**
 * Convocatorias: separan la preparación en etapas.
 *
 * Quien no aprueba vuelve a empezar con la convocatoria siguiente, y no le
 * sirve ver mezclado lo de la anterior: estadísticas, notas y
 * recomendaciones deben partir de cero. Cada usuario crea sus convocatorias
 * con la fecha en que empezó a prepararlas, porque no todos se presentan el
 * mismo año.
 *
 * Una convocatoria va desde su fecha de inicio hasta el día anterior al
 * inicio de la siguiente; la última sigue abierta. Así no hay huecos ni
 * solapes, y basta con guardar la fecha de inicio.
 */
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/** Fecha local en formato 'AAAA-MM-DD', el mismo que usan los campos de fecha de texto. */
export function claveFecha(fecha) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** 'AAAA-MM-DD' -> Date a las 00:00 en hora local. */
export function fechaDesdeClave(clave) {
    const [y, m, d] = clave.split('-').map(Number);
    return new Date(y, m - 1, d);
}

/**
 * Ordena por fecha de inicio y añade a cada una su fecha de fin
 * (exclusiva): el inicio de la siguiente, o null si es la última.
 */
export function ordenarConvocatorias(lista) {
    const ordenadas = [...lista]
        .filter(c => c && c.fecha_inicio)
        .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
    return ordenadas.map((c, i) => ({
        ...c,
        fecha_fin: i + 1 < ordenadas.length ? ordenadas[i + 1].fecha_inicio : null
    }));
}

/**
 * La convocatoria en curso: la última que ya ha empezado.
 * Si todas empiezan en el futuro, o no hay ninguna, devuelve null.
 */
export function convocatoriaActual(ordenadas, hoy = new Date()) {
    const clave = claveFecha(hoy);
    const empezadas = ordenadas.filter(c => c.fecha_inicio <= clave);
    return empezadas.length ? empezadas[empezadas.length - 1] : null;
}

/**
 * Intervalo de fechas que abarca una convocatoria: desde (incluido) y
 * hasta (excluido, o null si sigue abierta). Sin convocatoria, null: no
 * se filtra nada.
 */
export function rangoDe(convocatoria) {
    if (!convocatoria) return null;
    return {
        desde: fechaDesdeClave(convocatoria.fecha_inicio),
        hasta: convocatoria.fecha_fin ? fechaDesdeClave(convocatoria.fecha_fin) : null
    };
}

/** ¿Cae la fecha (Date) dentro del rango? Un rango null lo admite todo. */
export function dentroDeRango(fecha, rango) {
    if (!rango) return true;
    if (fecha < rango.desde) return false;
    return !rango.hasta || fecha < rango.hasta;
}

/** Convocatorias del usuario, ordenadas y con su fecha de fin calculada. */
export async function cargarConvocatorias(db, uid) {
    const snap = await getDocs(query(collection(db, 'convocatorias'), where('id_usuario', '==', uid)));
    const lista = [];
    snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
    return ordenarConvocatorias(lista);
}

/** Texto para mostrar una convocatoria: "Convocatoria 2027 (desde el 14/10/2026)". */
export function describirConvocatoria(c) {
    const desde = fechaDesdeClave(c.fecha_inicio).toLocaleDateString('es-ES');
    return `${c.nombre} (desde el ${desde})`;
}

/**
 * Rellena un <select> con las convocatorias, más la opción de ver todo el
 * historial, y deja elegida la convocatoria en curso.
 */
export function rellenarSelectorConvocatorias(select, ordenadas, hoy = new Date()) {
    const actual = convocatoriaActual(ordenadas, hoy);
    select.innerHTML = '';
    [...ordenadas].reverse().forEach(c => {
        const texto = c === actual ? `${c.nombre} (en curso)` : c.nombre;
        select.add(new Option(texto, c.id));
    });
    select.add(new Option('Todo el historial', ''));
    select.value = actual ? actual.id : '';
}

/** Rango de la convocatoria elegida en el <select>, o null para todo el historial. */
export function rangoSeleccionado(select, ordenadas) {
    return rangoDe(ordenadas.find(c => c.id === select.value) || null);
}
