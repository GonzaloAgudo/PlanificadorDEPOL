/**
 * Selector de varios temas con casillas.
 *
 * Sustituye a los desplegables de un solo tema: un test o una sesión de
 * estudio pueden abarcar varios temas sueltos. Muestra los 45 temas
 * oficiales, una casilla «Todo el temario» que los marca o desmarca de golpe
 * y, si se pide, los temas propios del usuario (asignaturas, bloques...).
 */
import { TEMAS_OFICIALES, esTemaOficial, resumirTemas } from './temario-oficial.js';
import { icon } from './icons.js';

function escapar(texto) {
    return String(texto).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

/**
 * @param {HTMLElement} raiz Contenedor vacío donde se pinta el selector
 * @param {object} [opciones]
 * @param {string} [opciones.etiqueta] Nombre accesible del selector
 * @param {string} [opciones.vacio] Texto cuando no hay ningún tema marcado
 * @param {string[]} [opciones.propios] Temas propios del usuario
 * @param {() => Promise<string|null>} [opciones.alAnadir] Pide un tema nuevo; sin ella no se ofrece añadir
 * @param {(tema: string) => Promise<boolean>} [opciones.alBorrar] Borra un tema propio; sin ella no se ofrece borrar
 */
export function crearSelectorTemas(raiz, opciones = {}) {
    const {
        etiqueta = 'Temas',
        vacio = 'Sin tema',
        alAnadir = null,
        alBorrar = null
    } = opciones;

    let propios = [...new Set((opciones.propios || []).filter(t => t && !esTemaOficial(t)))];
    // Temas que aparecen en datos antiguos pero no están en ninguna lista
    let sueltos = [];
    let marcados = new Set();
    const oyentes = [];

    raiz.classList.add('selector-temas');
    raiz.innerHTML = `
        <button type="button" class="modern-select selector-temas__resumen"
                aria-haspopup="true" aria-expanded="false" aria-label="${escapar(etiqueta)}"></button>
        <div class="selector-temas__panel" hidden>
            <label class="selector-temas__opcion selector-temas__opcion--todo">
                <input type="checkbox" data-todo> Todo el temario
            </label>
            <div class="selector-temas__rejilla">
                ${TEMAS_OFICIALES.map(t => `
                    <label class="selector-temas__opcion">
                        <input type="checkbox" value="${escapar(t)}"> ${escapar(t.replace('Tema ', 'T'))}
                    </label>`).join('')}
            </div>
            <div class="selector-temas__propios"></div>
            ${alAnadir ? `<button type="button" class="btn btn--ghost btn--sm selector-temas__anadir">${icon('plus', 'icon--sm')}Añadir tema propio</button>` : ''}
        </div>`;

    const boton = raiz.querySelector('.selector-temas__resumen');
    const panel = raiz.querySelector('.selector-temas__panel');
    const casillaTodo = raiz.querySelector('[data-todo]');
    const zonaPropios = raiz.querySelector('.selector-temas__propios');

    function pintarPropios() {
        const lista = [...propios, ...sueltos];
        zonaPropios.innerHTML = lista.length ? `
            <p class="selector-temas__titulo">Otros</p>
            ${lista.map(t => `
                <div class="selector-temas__fila">
                    <label class="selector-temas__opcion">
                        <input type="checkbox" value="${escapar(t)}" ${marcados.has(t) ? 'checked' : ''}> ${escapar(t)}
                    </label>
                    ${alBorrar && propios.includes(t)
                        ? `<button type="button" class="btn-icon selector-temas__borrar" data-borrar="${escapar(t)}"
                                   title="Borrar de tu lista" aria-label="Borrar ${escapar(t)} de tu lista">${icon('trash', 'icon--sm')}</button>`
                        : ''}
                </div>`).join('')}` : '';
    }

    function sincronizar() {
        raiz.querySelectorAll('input[value]').forEach(c => { c.checked = marcados.has(c.value); });
        const oficiales = TEMAS_OFICIALES.filter(t => marcados.has(t)).length;
        casillaTodo.checked = oficiales === TEMAS_OFICIALES.length;
        casillaTodo.indeterminate = oficiales > 0 && oficiales < TEMAS_OFICIALES.length;
        const temas = obtener();
        boton.textContent = resumirTemas(temas, vacio);
        boton.classList.toggle('selector-temas__resumen--vacio', temas.length === 0);
    }

    function avisar() {
        const temas = obtener();
        oyentes.forEach(fn => fn(temas));
    }

    function abrir(si) {
        panel.hidden = !si;
        boton.setAttribute('aria-expanded', String(si));
        if (!si) return;
        // En una columna estrecha el panel no cabe hacia la derecha: se
        // alinea entonces con el borde derecho del selector
        panel.classList.remove('selector-temas__panel--derecha');
        if (panel.getBoundingClientRect().right > document.documentElement.clientWidth - 8) {
            panel.classList.add('selector-temas__panel--derecha');
        }
    }

    /** Temas marcados: primero los oficiales en su orden, luego el resto. */
    function obtener() {
        const otros = [...propios, ...sueltos].filter(t => marcados.has(t));
        return [...TEMAS_OFICIALES.filter(t => marcados.has(t)), ...otros];
    }

    function fijar(temas) {
        const lista = Array.isArray(temas) ? temas.filter(Boolean) : [];
        sueltos = lista.filter(t => !esTemaOficial(t) && !propios.includes(t));
        marcados = new Set(lista);
        pintarPropios();
        sincronizar();
    }

    /** Carga la lista de temas propios sin marcar ninguno. */
    function fijarPropios(lista) {
        propios = [...new Set((lista || []).filter(t => t && !esTemaOficial(t)))];
        sueltos = sueltos.filter(t => !propios.includes(t));
        pintarPropios();
        sincronizar();
    }

    function anadirPropio(tema) {
        if (!tema) return;
        if (!esTemaOficial(tema) && !propios.includes(tema)) {
            propios.push(tema);
            sueltos = sueltos.filter(t => t !== tema);
        }
        marcados.add(tema);
        pintarPropios();
        sincronizar();
        avisar();
    }

    boton.addEventListener('click', () => abrir(panel.hidden));

    document.addEventListener('click', (e) => {
        if (!panel.hidden && !raiz.contains(e.target)) abrir(false);
    });
    raiz.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !panel.hidden) { abrir(false); boton.focus(); }
    });

    panel.addEventListener('change', (e) => {
        const casilla = e.target;
        if (casilla.matches('[data-todo]')) {
            TEMAS_OFICIALES.forEach(t => casilla.checked ? marcados.add(t) : marcados.delete(t));
        } else if (casilla.value) {
            casilla.checked ? marcados.add(casilla.value) : marcados.delete(casilla.value);
        }
        sincronizar();
        avisar();
    });

    panel.addEventListener('click', async (e) => {
        const borrar = e.target.closest('[data-borrar]');
        if (borrar && alBorrar) {
            const tema = borrar.dataset.borrar;
            if (await alBorrar(tema)) {
                propios = propios.filter(t => t !== tema);
                marcados.delete(tema);
                pintarPropios();
                sincronizar();
                avisar();
            }
            return;
        }
        if (e.target.closest('.selector-temas__anadir') && alAnadir) {
            anadirPropio(await alAnadir());
        }
    });

    fijar([]);

    return {
        obtener,
        fijar,
        anadirPropio,
        fijarPropios,
        limpiar: () => fijar([]),
        alCambiar: (fn) => oyentes.push(fn)
    };
}
