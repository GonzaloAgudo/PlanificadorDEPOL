/**
 * Pruebas de caja blanca de la logica de dominio.
 *
 * Se ejecutan con el corredor de pruebas incorporado en Node:
 *     node --import ./test/enlace.mjs --test "test/*.test.mjs"
 *
 * Cubren los modulos que no dependen ni de la interfaz ni de la base de
 * datos: baremo-fisicas, temario-oficial y recomendaciones (esta ultima
 * con un doble de prueba en lugar de Firestore).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PRUEBAS, MEDIA_MINIMA, PUNTOS_ELIMINATORIOS,
    calcularPuntos, evaluarConjunto, siguienteEscalon,
    unidadBarra, formatearMarca, marcaAFormulario, marcaDesdeFormulario
} from '../js/baremo-fisicas.js';

import {
    TEMARIO_OFICIAL, TEMA_GLOBAL, getPesoNormalizado, formatNombreTema
} from '../js/temario-oficial.js';

import { calcularRecomendaciones } from '../js/recomendaciones.js';
import { cargarDatos } from './doble-firestore.mjs';

/* ================================================================
   PU-01 a PU-05 · Conversion de marca a puntuacion
   ================================================================ */

test('PU-01 · valores frontera en una prueba donde menos es mejor', () => {
    // Agilidad, hombres: el 10 se obtiene con 8,2" o menos (82 decimas)
    assert.equal(calcularPuntos('agilidad', 'hombres', 81), 10, 'por debajo del limite');
    assert.equal(calcularPuntos('agilidad', 'hombres', 82), 10, 'justo en el limite');
    assert.equal(calcularPuntos('agilidad', 'hombres', 83), 9, 'una decima peor');
});

test('PU-02 · valores frontera en una prueba donde mas es mejor', () => {
    // Barra, hombres: el 5 se obtiene con 10 repeticiones o mas
    assert.equal(calcularPuntos('barra', 'hombres', 11), 5, 'por encima del limite');
    assert.equal(calcularPuntos('barra', 'hombres', 10), 5, 'justo en el limite');
    assert.equal(calcularPuntos('barra', 'hombres', 9), 4, 'una repeticion menos');
});

test('PU-03 · una marca peor que el ultimo escalon puntua cero', () => {
    assert.equal(calcularPuntos('agilidad', 'hombres', 117), 0, 'una decima peor que el 1');
    assert.equal(calcularPuntos('carrera', 'mujeres', 400), 0, 'muy por debajo');
    assert.equal(calcularPuntos('barra', 'hombres', 4), 0, 'menos de 5 repeticiones');
    assert.equal(calcularPuntos('barra', 'hombres', 0), 0, 'ninguna repeticion');
});

test('PU-04 · entradas invalidas devuelven null y no cero', () => {
    // Distinguirlas importa: un cero elimina, un dato ausente no
    assert.equal(calcularPuntos('agilidad', 'hombres', NaN), null);
    assert.equal(calcularPuntos('agilidad', 'hombres', Infinity), null);
    assert.equal(calcularPuntos('agilidad', 'hombres', undefined), null);
    assert.equal(calcularPuntos('natacion', 'hombres', 100), null, 'prueba inexistente');
    assert.equal(calcularPuntos('agilidad', 'mixto', 100), null, 'baremo inexistente');
});

test('PU-05 · las seis tablas son monotonas y cubren de 0 a 10', () => {
    for (const prueba of Object.keys(PRUEBAS)) {
        for (const baremo of ['hombres', 'mujeres']) {
            const menosEsMejor = PRUEBAS[prueba].mejorEs === 'menos';
            const obtenidos = new Set();

            for (let marca = 0; marca <= 500; marca++) {
                const p = calcularPuntos(prueba, baremo, marca);
                if (p !== null) obtenidos.add(p);
            }
            // Los once resultados posibles deben ser alcanzables
            assert.equal(obtenidos.size, 11,
                `${prueba}/${baremo}: se obtienen ${obtenidos.size} puntuaciones distintas`);

            // Mejorar la marca nunca puede bajar la puntuacion
            let anterior = calcularPuntos(prueba, baremo, menosEsMejor ? 500 : 0);
            for (let i = 1; i <= 500; i++) {
                const marca = menosEsMejor ? 500 - i : i;
                const actual = calcularPuntos(prueba, baremo, marca);
                assert.ok(actual >= anterior,
                    `${prueba}/${baremo}: la puntuacion baja al mejorar la marca ${marca}`);
                anterior = actual;
            }
        }
    }
});

/* ================================================================
   PU-06 a PU-10 · Criterio de superacion del conjunto
   ================================================================ */

test('PU-06 · sin ninguna marca registrada', () => {
    const r = evaluarConjunto([null, null, null]);
    assert.equal(r.estado, 'sin-datos');
    assert.equal(r.media, null);
    assert.equal(r.registradas, 0);
    assert.equal(r.faltan, MEDIA_MINIMA * 3);
});

test('PU-07 · con marcas suficientes pero incompletas', () => {
    const r = evaluarConjunto([8, 7, null]);
    assert.equal(r.estado, 'incompleto');
    assert.equal(r.suma, 15);
    assert.equal(r.registradas, 2);
    assert.equal(r.faltan, 0, 'ya supera el minimo total exigido');
});

test('PU-08 · media insuficiente con las tres pruebas registradas', () => {
    const r = evaluarConjunto([4, 4, 5]);
    assert.equal(r.estado, 'no-apto');
    assert.equal(r.suma, 13);
    assert.equal(r.faltan, 2, 'le faltan 2 puntos para los 15 exigidos');
    assert.equal(r.margen, 0);
});

test('PU-09 · media suficiente con las tres pruebas registradas', () => {
    const r = evaluarConjunto([5, 5, 5]);
    assert.equal(r.estado, 'apto');
    assert.equal(r.media, 5);
    assert.equal(r.margen, 0, 'justo en el limite');

    const holgado = evaluarConjunto([9, 8, 7]);
    assert.equal(holgado.estado, 'apto');
    assert.equal(holgado.margen, 9, '24 puntos frente a los 15 exigidos');
});

test('PU-10 · un cero elimina aunque la media sea alta', () => {
    // El caso critico: media 6,67 y aun asi eliminado
    const r = evaluarConjunto([10, 10, PUNTOS_ELIMINATORIOS]);
    assert.equal(r.estado, 'eliminado');
    assert.ok(r.media > MEDIA_MINIMA, 'la media supera el minimo y aun asi elimina');
    assert.deepEqual(r.eliminatorias, [2], 'senala cual es la prueba eliminatoria');

    // Y elimina tambien antes de tener las tres marcas
    const parcial = evaluarConjunto([0, null, null]);
    assert.equal(parcial.estado, 'eliminado', 'prevalece sobre el estado incompleto');
});

/* ================================================================
   PU-11 · Siguiente escalon
   ================================================================ */

test('PU-11 · marca necesaria para subir un punto', () => {
    // Agilidad hombres con 100 decimas: hoy son 6 puntos, el 7 esta en 97
    assert.equal(calcularPuntos('agilidad', 'hombres', 100), 6);
    assert.deepEqual(siguienteEscalon('agilidad', 'hombres', 100),
                     { objetivo: 97, puntos: 7 });

    // Con un 10 ya no hay escalon superior
    assert.equal(calcularPuntos('agilidad', 'hombres', 80), 10);
    assert.equal(siguienteEscalon('agilidad', 'hombres', 80), null);
});

/* ================================================================
   PU-12 a PU-13 · Conversion de unidades
   ================================================================ */

test('PU-12 · la unidad de la barra depende del baremo', () => {
    assert.equal(unidadBarra('hombres'), 'repeticiones');
    assert.equal(unidadBarra('mujeres'), 'segundos');
});

test('PU-13 · ida y vuelta entre formulario y almacenamiento', () => {
    const casos = [
        ['agilidad', 'hombres', 104],  // 10,4 segundos
        ['carrera',  'hombres', 205],  // 3'25"
        ['carrera',  'mujeres', 249],
        ['barra',    'hombres', 12],
        ['barra',    'mujeres', 63]
    ];
    for (const [prueba, baremo, marca] of casos) {
        const form = marcaAFormulario(prueba, marca);
        const vuelta = marcaDesdeFormulario(prueba, form.principal, form.secundario);
        assert.equal(vuelta, marca,
            `${prueba}: ${marca} -> ${JSON.stringify(form)} -> ${vuelta}`);
        assert.ok(typeof formatearMarca(prueba, baremo, marca) === 'string');
    }
});

/* ================================================================
   PU-14 a PU-15 · Datos de referencia del temario
   ================================================================ */

test('PU-14 · integridad del temario oficial', () => {
    assert.equal(TEMARIO_OFICIAL.length, 45, 'deben ser 45 temas');

    const numeros = TEMARIO_OFICIAL.map(t => t.numero);
    assert.deepEqual(numeros, Array.from({ length: 45 }, (_, i) => i + 1),
        'numerados de 1 a 45 sin huecos ni repeticiones');

    const bloques = new Set(TEMARIO_OFICIAL.map(t => t.bloque));
    assert.equal(bloques.size, 3, 'tres bloques oficiales');

    for (const t of TEMARIO_OFICIAL) {
        assert.ok(t.media > 0, `el tema ${t.numero} tiene peso nulo o negativo`);
        assert.ok(t.nombre && t.tema, `el tema ${t.numero} esta incompleto`);
    }
});

test('PU-15 · peso normalizado', () => {
    const maxima = Math.max(...TEMARIO_OFICIAL.map(t => t.media));
    assert.equal(getPesoNormalizado(maxima), 1, 'el tema con mas peso vale 1');

    for (const t of TEMARIO_OFICIAL) {
        const p = getPesoNormalizado(t.media);
        assert.ok(p > 0 && p <= 1, `el tema ${t.numero} se normaliza fuera de (0,1]`);
    }
    assert.equal(formatNombreTema('LA CONSTITUCIÓN ESPAÑOLA I'),
                 'La Constitución Española I');
});

/* ================================================================
   PU-16 a PU-20 · Motor de recomendaciones
   ================================================================ */

const UID = 'usuario-de-prueba';
const temaMasPesado = TEMARIO_OFICIAL.reduce((a, b) => (a.media > b.media ? a : b));
const temaMenosPesado = TEMARIO_OFICIAL.reduce((a, b) => (a.media < b.media ? a : b));

function sesion(tema, minutos) {
    return { id_usuario: UID, actividad: 'estudio', tema, duracion_minutos: minutos };
}
function nota(tema, valor) {
    return { id_usuario: UID, tema, nota: valor };
}

test('PU-16 · sin datos, ordena por peso en el examen', () => {
    cargarDatos({ sesiones_estudio: [], calificaciones: [] });
    return calcularRecomendaciones(null, UID).then(r => {
        assert.equal(r.length, 45);
        assert.equal(r[0].numero, temaMasPesado.numero,
            'el primero debe ser el tema que mas pesa en el examen');
        assert.equal(r[44].numero, temaMenosPesado.numero,
            'el ultimo, el que menos pesa');
    });
});

test('PU-17 · estudiar un tema lo baja en la lista', async () => {
    cargarDatos({
        sesiones_estudio: [sesion(temaMasPesado.tema, 600)],
        calificaciones: []
    });
    const r = await calcularRecomendaciones(null, UID);
    const posicion = r.findIndex(t => t.numero === temaMasPesado.numero);
    assert.ok(posicion > 0,
        'el tema mas pesado ya no encabeza la lista tras estudiarlo 10 horas');
    assert.equal(r[posicion].minutos, 600);
});

test('PU-18 · las sesiones sin tema no computan', async () => {
    cargarDatos({
        sesiones_estudio: [sesion('Sin tema', 5000), sesion(null, 5000)],
        calificaciones: []
    });
    const r = await calcularRecomendaciones(null, UID);
    assert.ok(r.every(t => t.minutos === 0),
        'ningun tema debe acumular minutos de sesiones sin tema asignado');
});

test('PU-19 · un examen global no da por cubiertos los 45 temas', async () => {
    cargarDatos({
        sesiones_estudio: [],
        calificaciones: [nota(TEMA_GLOBAL, 10)]
    });
    const r = await calcularRecomendaciones(null, UID);

    const pesado = r.find(t => t.numero === temaMasPesado.numero);
    const ligero = r.find(t => t.numero === temaMenosPesado.numero);

    // El global evalua de verdad al tema que mas preguntas aporta, y
    // apenas dice nada del que menos
    assert.ok(pesado.notaParaOrden > ligero.notaParaOrden,
        'el examen global debe mover mas la nota del tema con mas peso');
    assert.ok(ligero.notaParaOrden < 6,
        'el tema con menos peso apenas se aleja del 5 neutro');
});

test('PU-20 · la nota mostrada es la media real, sin el 5 neutro', async () => {
    cargarDatos({
        sesiones_estudio: [],
        calificaciones: [nota(temaMasPesado.tema, 8), nota(temaMasPesado.tema, 6)]
    });
    const r = await calcularRecomendaciones(null, UID);
    const t = r.find(x => x.numero === temaMasPesado.numero);

    assert.equal(t.notaMedia, 7, 'la media real de 8 y 6 es 7');
    assert.notEqual(t.notaParaOrden, t.notaMedia,
        'el valor de ordenacion si incorpora el 5 neutro');

    const sinNotas = r.find(x => x.numero === temaMenosPesado.numero);
    assert.equal(sinNotas.notaMedia, null,
        'un tema sin calificaciones no muestra nota inventada');
});

/* ================================================================
   PU-21 a PU-23 · Calculo de calificaciones
   ================================================================
   La formula esta incrustada en el modulo de la pantalla y no se
   exporta, asi que se replica aqui identica para poder ejercitarla.
   Se documenta como deuda tecnica en el capitulo 10.
*/

function calcularNota(modo, totalPreguntas, aciertos, errores) {
    const P = totalPreguntas, A = aciertos, E = errores;
    const blancas = P - A - E;
    if (P <= 0 || blancas < 0) return null;
    const n = (modo === 'teoria') ? 3 : 4;
    return ((A - E / (n - 1)) * 10) / P;
}

test('PU-21 · penalizacion del examen de conocimientos (3 opciones)', () => {
    // Cada error descuenta medio acierto
    assert.equal(calcularNota('teoria', 100, 100, 0), 10, 'todo acertado');
    assert.equal(calcularNota('teoria', 100, 0, 0), 0, 'todo en blanco');
    assert.equal(calcularNota('teoria', 100, 60, 40), 4, '60 - 20 = 40 sobre 100');
    assert.equal(calcularNota('teoria', 100, 50, 0), 5, 'la mitad acertada, resto en blanco');
});

test('PU-22 · penalizacion de la prueba psicotecnica (4 opciones)', () => {
    // Cada error descuenta un tercio de acierto
    assert.equal(calcularNota('psico', 100, 100, 0), 10);

    // 30 errores descuentan 10 aciertos: (60 - 10) sobre 90 preguntas
    const esperado = (60 - 30 / 3) * 10 / 90;
    assert.ok(Math.abs(calcularNota('psico', 90, 60, 30) - esperado) < 1e-9,
        'el descuento debe ser de un tercio por error');

    // Con los mismos datos, el psicotecnico penaliza menos que la teoria
    assert.ok(calcularNota('psico', 100, 60, 40) > calcularNota('teoria', 100, 60, 40));
});

test('PU-23 · datos incoherentes no producen nota', () => {
    assert.equal(calcularNota('teoria', 100, 60, 50), null, 'aciertos + errores > total');
    assert.equal(calcularNota('teoria', 0, 0, 0), null, 'sin preguntas');
    assert.equal(calcularNota('teoria', -10, 0, 0), null, 'total negativo');
    // Todo fallado da nota negativa: es correcto, la penalizacion asi lo indica
    assert.ok(calcularNota('teoria', 100, 0, 100) < 0);
});
