/**
 * Baremos oficiales de las pruebas físicas (CNP, Escala Básica).
 *
 * Cada prueba se puntúa de 0 a 10 según la marca obtenida, con tablas
 * distintas para hombres y mujeres.
 *
 * Para evitar problemas con los decimales, las marcas se guardan siempre en
 * una unidad entera:
 *   - agilidad : décimas de segundo (10,4" -> 104)
 *   - barra    : repeticiones (hombres) o segundos (mujeres)
 *   - carrera  : segundos totales (3'25" -> 205)
 */

export const PRUEBAS = {
    agilidad: {
        id: 'agilidad',
        nombre: 'Circuito de agilidad',
        orden: 1,
        // Menos es mejor
        mejorEs: 'menos',
        unidad: 'decimas',
        ayuda: 'Tiempo del circuito, en segundos con un decimal.'
    },
    barra: {
        id: 'barra',
        nombre: 'Barra',
        orden: 2,
        mejorEs: 'mas',
        // La unidad depende del baremo: repeticiones o segundos
        unidad: 'variable',
        ayuda: 'Dominadas completas (hombres) o tiempo suspendido (mujeres).'
    },
    carrera: {
        id: 'carrera',
        nombre: 'Carrera 1.000 m',
        orden: 3,
        mejorEs: 'menos',
        unidad: 'segundos',
        ayuda: 'Tiempo de la carrera, en minutos y segundos.'
    }
};

/**
 * Tablas de puntuación.
 *
 * En las pruebas donde menos es mejor, cada entrada indica el tiempo MÁXIMO
 * (incluido) con el que aún se obtiene esa puntuación. En las que más es
 * mejor, la marca MÍNIMA (incluida) necesaria para alcanzarla.
 */
const TABLAS = {
    agilidad: {
        // Décimas de segundo. 82 = 8,2"
        hombres: [
            { puntos: 10, limite: 82 }, { puntos: 9, limite: 88 },
            { puntos: 8, limite: 93 },  { puntos: 7, limite: 97 },
            { puntos: 6, limite: 101 }, { puntos: 5, limite: 105 },
            { puntos: 4, limite: 109 }, { puntos: 3, limite: 112 },
            { puntos: 2, limite: 114 }, { puntos: 1, limite: 116 }
        ],
        mujeres: [
            { puntos: 10, limite: 93 },  { puntos: 9, limite: 98 },
            { puntos: 8, limite: 103 },  { puntos: 7, limite: 108 },
            { puntos: 6, limite: 112 },  { puntos: 5, limite: 116 },
            { puntos: 4, limite: 120 },  { puntos: 3, limite: 123 },
            { puntos: 2, limite: 125 },  { puntos: 1, limite: 127 }
        ]
    },
    barra: {
        // Hombres: repeticiones
        hombres: [
            { puntos: 10, limite: 17 }, { puntos: 9, limite: 16 },
            { puntos: 8, limite: 15 },  { puntos: 7, limite: 14 },
            { puntos: 6, limite: 12 },  { puntos: 5, limite: 10 },
            { puntos: 4, limite: 8 },   { puntos: 3, limite: 7 },
            { puntos: 2, limite: 6 },   { puntos: 1, limite: 5 }
        ],
        // Mujeres: segundos suspendida en la barra
        mujeres: [
            { puntos: 10, limite: 95 }, { puntos: 9, limite: 86 },
            { puntos: 8, limite: 78 },  { puntos: 7, limite: 70 },
            { puntos: 6, limite: 63 },  { puntos: 5, limite: 57 },
            { puntos: 4, limite: 52 },  { puntos: 3, limite: 46 },
            { puntos: 2, limite: 41 },  { puntos: 1, limite: 36 }
        ]
    },
    carrera: {
        // Segundos totales. 174 = 2'54"
        hombres: [
            { puntos: 10, limite: 174 }, { puntos: 9, limite: 180 },
            { puntos: 8, limite: 186 },  { puntos: 7, limite: 192 },
            { puntos: 6, limite: 198 },  { puntos: 5, limite: 204 },
            { puntos: 4, limite: 210 },  { puntos: 3, limite: 216 },
            { puntos: 2, limite: 222 },  { puntos: 1, limite: 228 }
        ],
        mujeres: [
            { puntos: 10, limite: 204 }, { puntos: 9, limite: 213 },
            { puntos: 8, limite: 222 },  { puntos: 7, limite: 231 },
            { puntos: 6, limite: 240 },  { puntos: 5, limite: 249 },
            { puntos: 4, limite: 258 },  { puntos: 3, limite: 267 },
            { puntos: 2, limite: 276 },  { puntos: 1, limite: 285 }
        ]
    }
};

/** Media mínima exigida en el conjunto de las tres pruebas. */
export const MEDIA_MINIMA = 5;

/** Puntuación que elimina directamente, se saque lo que se saque en el resto. */
export const PUNTOS_ELIMINATORIOS = 0;

/**
 * Evalúa el conjunto de las tres pruebas según el criterio de la convocatoria:
 * un 0 en cualquiera de ellas elimina, y hay que alcanzar una media de 5.
 *
 * @param {Array<number|null>} puntos Puntuación de cada prueba; null si no hay marca
 * @returns {{estado: string, media: number|null, suma: number, faltan: number,
 *            margen: number, eliminatorias: number[], registradas: number}}
 *
 * estado: 'sin-datos' | 'eliminado' | 'incompleto' | 'no-apto' | 'apto'
 */
export function evaluarConjunto(puntos) {
    const total = puntos.length;
    const registradas = puntos.filter(p => p !== null);
    const eliminatorias = puntos
        .map((p, i) => (p === PUNTOS_ELIMINATORIOS ? i : -1))
        .filter(i => i !== -1);

    const suma = registradas.reduce((a, b) => a + b, 0);
    const media = registradas.length ? suma / registradas.length : null;
    const minimoTotal = MEDIA_MINIMA * total;

    // Un cero elimina aunque falten pruebas por registrar o la media sea alta
    if (eliminatorias.length) {
        return { estado: 'eliminado', media, suma, faltan: 0, margen: 0,
                 eliminatorias, registradas: registradas.length };
    }
    if (!registradas.length) {
        return { estado: 'sin-datos', media: null, suma: 0, faltan: minimoTotal,
                 margen: 0, eliminatorias, registradas: 0 };
    }
    if (registradas.length < total) {
        return { estado: 'incompleto', media, suma, faltan: Math.max(0, minimoTotal - suma),
                 margen: 0, eliminatorias, registradas: registradas.length };
    }

    const apto = suma >= minimoTotal;
    return {
        estado: apto ? 'apto' : 'no-apto',
        media, suma,
        faltan: apto ? 0 : minimoTotal - suma,
        margen: apto ? suma - minimoTotal : 0,
        eliminatorias,
        registradas: registradas.length
    };
}

/** Unidad real de la prueba de barra, que cambia según el baremo. */
export function unidadBarra(baremo) {
    return baremo === 'mujeres' ? 'segundos' : 'repeticiones';
}

/**
 * Puntuación (0-10) que corresponde a una marca.
 * @param {string} prueba  'agilidad' | 'barra' | 'carrera'
 * @param {string} baremo  'hombres' | 'mujeres'
 * @param {number} marca   En la unidad entera de la prueba
 */
export function calcularPuntos(prueba, baremo, marca) {
    const tabla = TABLAS[prueba] && TABLAS[prueba][baremo];
    if (!tabla || !Number.isFinite(marca)) return null;

    const menosEsMejor = PRUEBAS[prueba].mejorEs === 'menos';

    // Las tablas van de 10 a 1: la primera que se cumple es la puntuación
    for (const fila of tabla) {
        if (menosEsMejor ? marca <= fila.limite : marca >= fila.limite) {
            return fila.puntos;
        }
    }
    return 0;
}

/**
 * Qué marca hace falta para subir un punto.
 * @returns {{objetivo: number, puntos: number}|null} null si ya tiene un 10
 */
export function siguienteEscalon(prueba, baremo, marca) {
    const tabla = TABLAS[prueba][baremo];
    const actuales = calcularPuntos(prueba, baremo, marca);
    if (actuales === null || actuales === 10) return null;

    const fila = tabla.find(f => f.puntos === actuales + 1);
    if (!fila) return null;
    return { objetivo: fila.limite, puntos: fila.puntos };
}

/* ------------------------------------------------------------------ */
/*  Conversión entre lo que se escribe y lo que se guarda              */
/* ------------------------------------------------------------------ */

/** 104 -> "10,4""  |  205 -> "3'25""  |  12 -> "12" */
export function formatearMarca(prueba, baremo, marca) {
    if (!Number.isFinite(marca)) return '—';

    if (prueba === 'agilidad') {
        return (marca / 10).toFixed(1).replace('.', ',') + '"';
    }
    if (prueba === 'carrera') {
        const min = Math.floor(marca / 60);
        const seg = marca % 60;
        return `${min}'${String(seg).padStart(2, '0')}"`;
    }
    // barra
    return baremo === 'mujeres' ? `${marca}"` : `${marca} rep.`;
}

/** Igual que formatearMarca pero sin unidades, para rellenar formularios. */
export function marcaAFormulario(prueba, marca) {
    if (!Number.isFinite(marca)) return { principal: '', secundario: '' };
    if (prueba === 'agilidad') return { principal: (marca / 10).toFixed(1).replace('.', ','), secundario: '' };
    if (prueba === 'carrera') return { principal: String(Math.floor(marca / 60)), secundario: String(marca % 60) };
    return { principal: String(marca), secundario: '' };
}

/**
 * Convierte lo escrito en el formulario a la unidad entera que se guarda.
 * @returns {number|null} null si lo escrito no es válido
 */
export function marcaDesdeFormulario(prueba, principal, secundario) {
    if (prueba === 'agilidad') {
        const n = parseFloat(String(principal).replace(',', '.'));
        if (!Number.isFinite(n) || n <= 0) return null;
        return Math.round(n * 10);
    }
    if (prueba === 'carrera') {
        const min = parseInt(principal, 10);
        const seg = parseInt(secundario, 10);
        if (!Number.isFinite(min) || min < 0) return null;
        const s = Number.isFinite(seg) ? seg : 0;
        if (s < 0 || s > 59) return null;
        const total = min * 60 + s;
        return total > 0 ? total : null;
    }
    const n = parseInt(principal, 10);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
}

export { TABLAS };
