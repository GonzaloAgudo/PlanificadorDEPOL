import { db, auth } from './firebase-config.js';
import {
    collection, query, where, getDocs, addDoc, deleteDoc, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { icon } from './icons.js';
import { toast, formDialog, confirmDialog } from './ui.js';
import {
    PRUEBAS, calcularPuntos, siguienteEscalon, formatearMarca,
    marcaDesdeFormulario, evaluarConjunto
} from './baremo-fisicas.js';

const contTarjetas = document.getElementById('tarjetas-pruebas');
const historial = document.getElementById('historial-marcas');
const mediaEl = document.getElementById('media-puntos');
const detalleEl = document.getElementById('detalle-puntos');
const avisoBaremo = document.getElementById('aviso-baremo');
const baremoEl = document.getElementById('baremo-actual');

const COLOR = { agilidad: '#1c4e80', barra: '#58487f', carrera: '#1f6f4a' };

/**
 * Marca claramente insuficiente en cada prueba, usada solo para preguntar al
 * baremo cuál es el umbral del primer punto cuando aún no hay ninguna marca.
 */
const PEOR_MARCA = { agilidad: 999, barra: 0, carrera: 9999 };

let baremo = null;      // 'hombres' | 'mujeres' | null
let marcas = [];        // todas las marcas del usuario
let grafico = null;

const listaPruebas = Object.values(PRUEBAS).sort((a, b) => a.orden - b.orden);

/** Nombre de la segunda prueba, que cambia según el baremo. */
function nombrePrueba(p) {
    if (p.id !== 'barra') return p.nombre;
    return baremo === 'mujeres' ? 'Suspensión en barra' : 'Dominadas';
}

function marcasDe(pruebaId) {
    return marcas.filter(m => m.prueba === pruebaId);
}

/** La mejor marca de una prueba, según si conviene más o menos. */
function mejorMarca(pruebaId) {
    const lista = marcasDe(pruebaId);
    if (!lista.length) return null;
    const menos = PRUEBAS[pruebaId].mejorEs === 'menos';
    return lista.reduce((mejor, m) =>
        (menos ? m.marca < mejor.marca : m.marca > mejor.marca) ? m : mejor);
}

function ultimaMarca(pruebaId) {
    const lista = marcasDe(pruebaId);
    if (!lista.length) return null;
    return lista.reduce((u, m) => (m.fecha > u.fecha ? m : u));
}

// ------------------------------------------------------------------
//  Registro de una marca nueva
// ------------------------------------------------------------------

function camposDeMarca(pruebaId) {
    const hoy = new Date().toISOString().slice(0, 10);

    if (pruebaId === 'carrera') {
        return [
            { name: 'min', label: 'Minutos', type: 'number', placeholder: '3' },
            { name: 'seg', label: 'Segundos', type: 'number', placeholder: '25' },
            { name: 'fecha', label: 'Fecha', type: 'date', value: hoy }
        ];
    }
    if (pruebaId === 'agilidad') {
        return [
            { name: 'valor', label: 'Tiempo en segundos', type: 'text', placeholder: '10,4',
              hint: 'Con un decimal. Por ejemplo 10,4' },
            { name: 'fecha', label: 'Fecha', type: 'date', value: hoy }
        ];
    }
    const esMujeres = baremo === 'mujeres';
    return [
        { name: 'valor',
          label: esMujeres ? 'Tiempo suspendida, en segundos' : 'Dominadas completas',
          type: 'number', placeholder: esMujeres ? '63' : '12' },
        { name: 'fecha', label: 'Fecha', type: 'date', value: hoy }
    ];
}

function leerMarca(pruebaId, v) {
    return pruebaId === 'carrera'
        ? marcaDesdeFormulario('carrera', v.min, v.seg)
        : marcaDesdeFormulario(pruebaId, v.valor, null);
}

async function registrarMarca(pruebaId) {
    if (!baremo) {
        toast('Elige antes tu baremo en Ajustes.', { type: 'warning' });
        return;
    }
    const prueba = PRUEBAS[pruebaId];

    const datos = await formDialog({
        title: `Nueva marca · ${nombrePrueba(prueba)}`,
        message: prueba.ayuda,
        fields: camposDeMarca(pruebaId),
        confirmText: 'Guardar marca',
        validate: (v) => leerMarca(pruebaId, v) !== null && !!v.fecha
    });
    if (!datos) return;

    const marca = leerMarca(pruebaId, datos);
    const puntos = calcularPuntos(pruebaId, baremo, marca);

    try {
        await addDoc(collection(db, 'entrenamientos'), {
            user_id: auth.currentUser.uid,
            prueba: pruebaId,
            marca,
            puntos,
            baremo,
            fecha: datos.fecha,
            creado: new Date()
        });
        toast(`${formatearMarca(pruebaId, baremo, marca)} · ${puntos} ${puntos === 1 ? 'punto' : 'puntos'}`,
              { type: 'success' });
        await cargarMarcas();
    } catch (error) {
        console.error('Error guardando la marca:', error);
        toast('No se pudo guardar la marca.', { type: 'error' });
    }
}

async function borrarMarca(id, texto) {
    const ok = await confirmDialog({
        title: 'Borrar marca',
        message: `Se eliminará <strong>${texto}</strong> del historial.`,
        confirmText: 'Borrar',
        danger: true
    });
    if (!ok) return;
    try {
        await deleteDoc(doc(db, 'entrenamientos', id));
        toast('Marca borrada.');
        await cargarMarcas();
    } catch (error) {
        console.error(error);
        toast('No se pudo borrar la marca.', { type: 'error' });
    }
}

// ------------------------------------------------------------------
//  Pintado
// ------------------------------------------------------------------

function pintarTarjetas() {
    contTarjetas.innerHTML = listaPruebas.map(p => {
        const mejor = mejorMarca(p.id);
        const ultima = ultimaMarca(p.id);
        const puntos = mejor && baremo ? calcularPuntos(p.id, baremo, mejor.marca) : null;

        let pie;
        if (!mejor) {
            // Sin marca, lo útil es saber a partir de dónde se deja de eliminar
            const minimo = baremo ? siguienteEscalon(p.id, baremo, PEOR_MARCA[p.id]) : null;
            pie = minimo
                ? `<span class="prueba-card__pie">Desde ${formatearMarca(p.id, baremo, minimo.objetivo)} se evita el 0</span>`
                : '<span class="prueba-card__pie">Sin marcas todavía</span>';
        } else if (!baremo) {
            pie = '<span class="prueba-card__pie">Elige tu baremo para ver los puntos</span>';
        } else if (puntos === 0) {
            const sig = siguienteEscalon(p.id, baremo, mejor.marca);
            pie = `<span class="prueba-card__pie is-elim">Un 0 elimina. Con ${formatearMarca(p.id, baremo, sig.objetivo)} sales del 0</span>`;
        } else {
            const sig = siguienteEscalon(p.id, baremo, mejor.marca);
            pie = sig
                ? `<span class="prueba-card__pie">Para ${sig.puntos} puntos: ${formatearMarca(p.id, baremo, sig.objetivo)}</span>`
                : '<span class="prueba-card__pie is-max">Puntuación máxima alcanzada</span>';
        }

        const ultimaTxt = ultima && mejor && ultima.marca !== mejor.marca
            ? `<span class="prueba-card__ultima">Última: ${formatearMarca(p.id, baremo, ultima.marca)}</span>`
            : '';

        return `
            <article class="prueba-card${puntos === 0 ? ' es-eliminatoria' : ''}">
                <div class="prueba-card__head">
                    <span class="prueba-card__orden">${p.orden}</span>
                    <h3>${nombrePrueba(p)}</h3>
                </div>
                <div class="prueba-card__cifras">
                    <span class="prueba-card__marca">${mejor ? formatearMarca(p.id, baremo, mejor.marca) : '—'}</span>
                    <span class="prueba-card__puntos${puntos !== null ? ' tiene-puntos' : ''}">
                        ${puntos !== null ? puntos : '—'}<small>/10</small>
                    </span>
                </div>
                ${ultimaTxt}
                ${pie}
                <button class="btn btn--secondary btn--sm btn--block" data-registrar="${p.id}">
                    ${icon('plus', 'icon--sm')}Registrar marca
                </button>
            </article>`;
    }).join('');

    contTarjetas.querySelectorAll('[data-registrar]').forEach(b => {
        b.addEventListener('click', () => registrarMarca(b.dataset.registrar));
    });
}

/** Puntuación de cada prueba a partir de la mejor marca; null si no hay. */
function puntosActuales() {
    return listaPruebas.map(p => {
        const mejor = mejorMarca(p.id);
        return mejor && baremo ? calcularPuntos(p.id, baremo, mejor.marca) : null;
    });
}

function pintarResumen() {
    const panel = document.getElementById('estado-fisicas');
    const etiqueta = document.getElementById('estado-etiqueta');

    if (!baremo) {
        panel.dataset.estado = 'sin-datos';
        etiqueta.textContent = 'Sin baremo';
        document.getElementById('estado-detalle').textContent = 'Elige tu baremo en Ajustes para calcular los puntos.';
        mediaEl.textContent = '—';
        detalleEl.textContent = '';
        return;
    }

    const puntos = puntosActuales();
    const r = evaluarConjunto(puntos);

    // Un plural correcto se nota, y aquí se lee muchas veces
    const pts = (n) => `${String(n).replace('.', ',')} ${n === 1 ? 'punto' : 'puntos'}`;

    const TEXTOS = {
        'sin-datos': ['Sin marcas', 'Registra tus marcas para saber si superas el corte.'],
        'eliminado': ['Eliminado', ''],   // se completa abajo con la prueba culpable
        'incompleto': ['Incompleto', ''],
        'no-apto': ['No apto', ''],
        'apto': ['Apto', '']
    };
    const [titulo] = TEXTOS[r.estado];

    let detalle;
    if (r.estado === 'eliminado') {
        const nombres = r.eliminatorias.map(i => nombrePrueba(listaPruebas[i])).join(' y ');
        detalle = `Un 0 en ${nombres} deja fuera, aunque la media sea suficiente.`;
    } else if (r.estado === 'sin-datos') {
        detalle = TEXTOS['sin-datos'][1];
    } else if (r.estado === 'incompleto') {
        const faltan = listaPruebas.filter((p, i) => puntos[i] === null).map(nombrePrueba).join(' y ');
        detalle = `Falta registrar ${faltan}. Llevas ${pts(r.suma)} de los 15 necesarios.`;
    } else if (r.estado === 'no-apto') {
        detalle = `Te ${r.faltan === 1 ? 'falta' : 'faltan'} ${pts(r.faltan)} para llegar a la media de 5.`;
    } else {
        detalle = r.margen > 0
            ? `Superas el corte con ${pts(r.margen)} de margen.`
            : 'Superas el corte justo, sin margen.';
    }

    panel.dataset.estado = r.estado;
    etiqueta.textContent = titulo;
    document.getElementById('estado-detalle').textContent = detalle;
    mediaEl.textContent = r.media === null ? '—' : r.media.toFixed(2).replace('.', ',');

    detalleEl.textContent = listaPruebas
        .map((p, i) => `${nombrePrueba(p)}: ${puntos[i] === null ? 'sin marca' : puntos[i]}`)
        .join('  ·  ');
}

function pintarHistorial() {
    if (!marcas.length) {
        historial.innerHTML = '<li class="empty-msg">Todavía no has registrado ninguna marca.</li>';
        return;
    }

    const ordenadas = [...marcas].sort((a, b) => b.fecha.localeCompare(a.fecha));
    historial.innerHTML = ordenadas.map(m => {
        const p = PRUEBAS[m.prueba];
        const texto = formatearMarca(m.prueba, m.baremo || baremo, m.marca);
        const [y, mm, d] = m.fecha.split('-');
        return `
            <li class="marca-item">
                <span class="marca-item__punto" style="background:${COLOR[m.prueba]}"></span>
                <span class="marca-item__cuerpo">
                    <span class="marca-item__prueba">${p ? nombrePrueba(p) : m.prueba}</span>
                    <span class="marca-item__fecha">${d}/${mm}/${y}</span>
                </span>
                <span class="marca-item__marca">${texto}</span>
                <span class="badge badge--mono">${m.puntos ?? '—'} pts</span>
                <button class="btn-icon btn-icon--danger btn-icon--sm" data-borrar="${m.id}"
                        data-texto="${texto}" title="Borrar" aria-label="Borrar marca">
                    ${icon('trash', 'icon--sm')}
                </button>
            </li>`;
    }).join('');

    historial.querySelectorAll('[data-borrar]').forEach(b => {
        b.addEventListener('click', () => borrarMarca(b.dataset.borrar, b.dataset.texto));
    });
}

function pintarGrafico() {
    const canvas = document.getElementById('chart-fisicas');
    if (!canvas || typeof Chart === 'undefined') return;
    if (grafico) grafico.destroy();

    const fechas = [...new Set(marcas.map(m => m.fecha))].sort();
    if (!fechas.length) return;

    const datasets = listaPruebas.map(p => {
        const suyas = marcasDe(p.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
        return {
            label: nombrePrueba(p),
            data: suyas.map(m => ({ x: m.fecha, y: m.puntos })),
            borderColor: COLOR[p.id],
            backgroundColor: COLOR[p.id],
            borderWidth: 2,
            pointRadius: 4,
            tension: 0.25,
            spanGaps: true
        };
    }).filter(d => d.data.length);

    grafico = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels: fechas, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            parsing: false,
            scales: {
                y: {
                    min: 0, max: 10,
                    ticks: { stepSize: 2, color: '#5b6673' },
                    grid: { color: '#eceef1' },
                    border: { display: false },
                    title: { display: true, text: 'Puntos', color: '#5b6673' }
                },
                x: {
                    type: 'category',
                    grid: { display: false },
                    ticks: { color: '#5b6673' }
                }
            },
            plugins: {
                legend: { labels: { color: '#5b6673', boxWidth: 12, boxHeight: 12 } },
                datalabels: { display: false }
            }
        }
    });
}

function pintarTodo() {
    if (baremoEl) {
        baremoEl.textContent = baremo
            ? `Baremo: ${baremo === 'mujeres' ? 'mujeres' : 'hombres'}`
            : 'Baremo sin elegir';
    }
    avisoBaremo.classList.toggle('hidden', !!baremo);
    pintarResumen();
    pintarTarjetas();
    pintarHistorial();
    pintarGrafico();
}

// ------------------------------------------------------------------
//  Carga
// ------------------------------------------------------------------

async function cargarMarcas() {
    // Se ordena en el navegador para no necesitar un índice compuesto nuevo
    const q = query(collection(db, 'entrenamientos'), where('user_id', '==', auth.currentUser.uid));
    const snap = await getDocs(q);
    marcas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    pintarTodo();
}

auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    try {
        const prefs = await getDoc(doc(db, 'preferencias_usuario', user.uid));
        if (prefs.exists() && prefs.data().baremo_fisicas) {
            baremo = prefs.data().baremo_fisicas;
        }
        await cargarMarcas();
    } catch (error) {
        console.error('Error cargando las pruebas físicas:', error);
        toast('No se pudieron cargar tus marcas.', { type: 'error' });
    }
});
