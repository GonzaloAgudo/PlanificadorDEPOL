/**
 * Migración de los nombres de colecciones y campos de Firestore.
 *
 * Herramienta de un solo uso. Los nombres pasaron de una mezcla de inglés y
 * español a español en todo el modelo de datos, y Firestore no sabe renombrar
 * campos: hay que leer cada documento y volver a escribirlo.
 *
 * Solo migra los datos del usuario con la sesión iniciada, porque las reglas
 * de seguridad no dejan tocar los de nadie más.
 *
 * El proceso es repetible sin riesgo. Los documentos conservan su
 * identificador, así que volver a escribirlos no crea duplicados, y lo
 * antiguo solo se borra después de comprobar que lo nuevo está guardado.
 */
import { db, auth } from './firebase-config.js';
import {
    collection, query, where, getDocs, doc, getDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firestore admite como mucho 500 operaciones por lote
const TAMANO_LOTE = 400;

const ESTADOS_TEMPORIZADOR = { running: 'en_curso', paused: 'en_pausa', stopped: 'detenido' };

/**
 * Colecciones cuyos documentos llevan el uid del dueño en un campo.
 * "campos" traduce los nombres antiguos a los nuevos; "conocidos" son los
 * que ya tenían buen nombre. Cualquier otro campo se conserva igual, pero se
 * avisa de él porque la aplicación no lo usa.
 */
const COLECCIONES = [
    {
        origen: 'sesiones_estudio', destino: 'sesiones_estudio',
        campos: { user_id: 'id_usuario', fecha_sesion: 'fecha', tipo: 'actividad' },
        conocidos: ['duracion_minutos', 'tema', 'descripcion']
    },
    {
        origen: 'tareas_semanales', destino: 'tareas_semanales',
        campos: { user_id: 'id_usuario', texto: 'descripcion', fecha_tarea: 'fecha' },
        conocidos: ['completada', 'orden']
    },
    {
        origen: 'calendario_eventos', destino: 'eventos_calendario',
        campos: { user_id: 'id_usuario', fecha_evento: 'fecha', texto_evento: 'titulo', tipo_calendario: 'calendario' },
        conocidos: ['descripcion']
    },
    {
        origen: 'bloc_notas', destino: 'cuadernos',
        campos: { user_id: 'id_usuario', updatedAt: 'fecha_modificacion' },
        conocidos: ['titulo', 'contenido', 'orden']
    },
    {
        origen: 'notas_historial', destino: 'calificaciones',
        campos: { user_id: 'id_usuario', timestamp: 'fecha_registro' },
        conocidos: ['titulo', 'nota', 'fecha', 'tema']
    },
    {
        origen: 'progreso_temario', destino: 'progreso_temario',
        campos: { user_id: 'id_usuario', checks: 'columnas_completadas' },
        conocidos: ['orden', 'tema', 'estado', 'dominio', 'comentarios']
    },
    {
        origen: 'color_rules', destino: 'reglas_color',
        campos: { user_id: 'id_usuario', keyword: 'palabra_clave', bg_color: 'color_fondo', border_color: 'color_borde' },
        conocidos: []
    },
    {
        origen: 'entrenamientos', destino: 'marcas_fisicas',
        campos: { user_id: 'id_usuario', creado: 'fecha_registro' },
        conocidos: ['prueba', 'marca', 'puntos', 'baremo', 'fecha']
    }
];

/**
 * Colecciones con un único documento por usuario, identificado por su uid.
 * "valores" transforma el contenido de un campo ya renombrado.
 */
const DOCUMENTOS_POR_UID = [
    {
        origen: 'preferencias_usuario', destino: 'preferencias_usuario',
        campos: { temas_custom: 'temas_personalizados', tipos_custom: 'actividades_personalizadas' },
        conocidos: ['fecha_examen', 'meta_semanal_horas', 'baremo_fisicas']
    },
    {
        origen: 'config_progreso', destino: 'configuracion_progreso',
        campos: { columns: 'columnas' },
        conocidos: [],
        valores: {
            columnas: cols => Array.isArray(cols) ? cols.map(c => renombrar(c, { name: 'nombre' })) : cols
        }
    },
    {
        origen: 'timers_activos', destino: 'temporizadores',
        campos: {
            status: 'estado', endTime: 'instante_fin', totalDuration: 'duracion_segundos',
            timeLeft: 'segundos_restantes', mode: 'modo', activity: 'actividad',
            topic: 'tema', lastUpdated: 'ultima_actualizacion'
        },
        conocidos: [],
        valores: { estado: v => ESTADOS_TEMPORIZADOR[v] || v }
    }
];

/**
 * Devuelve una copia del objeto con las claves renombradas.
 * Si el nombre nuevo ya existía (la app nueva llegó a escribirlo antes de
 * migrar), se conserva ese valor, salvo en las listas, que se combinan.
 */
function renombrar(datos, campos, valores = {}) {
    const nuevo = {};
    for (const [clave, valor] of Object.entries(datos)) {
        if (!(clave in campos)) nuevo[clave] = valor;
    }
    for (const [antiguo, actual] of Object.entries(campos)) {
        if (!(antiguo in datos)) continue;
        const valor = datos[antiguo];
        if (!(actual in nuevo)) nuevo[actual] = valor;
        else if (Array.isArray(nuevo[actual]) && Array.isArray(valor)) {
            nuevo[actual] = [...new Set([...nuevo[actual], ...valor])];
        }
    }
    for (const [campo, transformar] of Object.entries(valores)) {
        if (campo in nuevo) nuevo[campo] = transformar(nuevo[campo]);
    }
    return nuevo;
}

function camposDesconocidos(datos, def) {
    const validos = new Set([...Object.keys(def.campos), ...Object.values(def.campos), ...def.conocidos]);
    return Object.keys(datos).filter(c => !validos.has(c));
}

function tieneCamposAntiguos(datos, def) {
    return Object.keys(def.campos).some(c => c in datos);
}

/**
 * Lee lo que queda por migrar sin escribir nada.
 */
async function analizar(uid) {
    const plan = [];

    for (const def of COLECCIONES) {
        const snap = await getDocs(query(collection(db, def.origen), where('user_id', '==', uid)));
        const desconocidos = new Set();
        const docs = snap.docs.map(d => {
            const datos = d.data();
            camposDesconocidos(datos, def).forEach(c => desconocidos.add(c));
            return { id: d.id, ref: d.ref, nuevo: renombrar(datos, def.campos, def.valores) };
        });
        plan.push({ def, docs, desconocidos: [...desconocidos] });
    }

    for (const def of DOCUMENTOS_POR_UID) {
        const snap = await getDoc(doc(db, def.origen, uid));
        const datos = snap.exists() ? snap.data() : null;
        const pendiente = datos && (def.origen !== def.destino || tieneCamposAntiguos(datos, def));
        if (!pendiente) {
            plan.push({ def, docs: [], desconocidos: [], porUid: true });
            continue;
        }
        let nuevo = renombrar(datos, def.campos, def.valores);
        if (def.origen !== def.destino) {
            // Si la app nueva ya creó el documento, lo antiguo tiene prioridad
            // en los campos que vienen de ahí: es el que tiene los datos reales.
            const actual = await getDoc(doc(db, def.destino, uid));
            if (actual.exists()) nuevo = { ...actual.data(), ...nuevo };
        }
        plan.push({
            def, porUid: true,
            docs: [{ id: uid, ref: snap.ref, nuevo }],
            desconocidos: camposDesconocidos(datos, def)
        });
    }
    return plan;
}

async function enLotes(operaciones) {
    for (let i = 0; i < operaciones.length; i += TAMANO_LOTE) {
        const lote = writeBatch(db);
        operaciones.slice(i, i + TAMANO_LOTE).forEach(op => op(lote));
        await lote.commit();
    }
}

/**
 * Escribe lo nuevo, comprueba que está y solo entonces borra lo antiguo.
 */
async function migrar(uid, plan, informar) {
    // 1. Escribir con los nombres nuevos, conservando el identificador
    for (const { def, docs } of plan) {
        if (!docs.length) continue;
        informar(`Escribiendo ${def.destino} (${docs.length})…`);
        await enLotes(docs.map(d => lote => lote.set(doc(db, def.destino, d.id), d.nuevo)));
    }

    // 2. Comprobar que todo lo escrito está en su sitio
    informar('Comprobando…');
    for (const { def, docs, porUid } of plan) {
        if (!docs.length) continue;
        if (porUid) {
            const snap = await getDoc(doc(db, def.destino, uid));
            if (!snap.exists() || tieneCamposAntiguos(snap.data(), def)) {
                throw new Error(`${def.destino}/${uid} no ha quedado bien guardado.`);
            }
            continue;
        }
        const snap = await getDocs(query(collection(db, def.destino), where('id_usuario', '==', uid)));
        const guardados = new Set(snap.docs.map(d => d.id));
        const faltan = docs.filter(d => !guardados.has(d.id));
        if (faltan.length) {
            throw new Error(`Faltan ${faltan.length} documentos en ${def.destino}. No se ha borrado nada antiguo.`);
        }
    }

    // 3. Borrar lo antiguo de las colecciones que cambian de nombre
    for (const { def, docs } of plan) {
        if (!docs.length || def.origen === def.destino) continue;
        informar(`Borrando ${def.origen}…`);
        await enLotes(docs.map(d => lote => lote.delete(d.ref)));
    }
}

// --- Interfaz ---

const resumen = document.getElementById('resumen');
const btnMigrar = document.getElementById('btn-migrar');
const estado = document.getElementById('estado');
let planActual = null;

function escapar(texto) {
    return String(texto).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function pintarResumen(plan) {
    const filas = plan.map(({ def, docs, desconocidos }) => {
        const destino = def.origen === def.destino ? def.destino : `${def.origen} → ${def.destino}`;
        const aviso = desconocidos.length
            ? `<br><span class="u-small u-muted">Campos que la aplicación no usa (se conservan): ${desconocidos.map(escapar).join(', ')}</span>`
            : '';
        return `<tr><td><code>${escapar(destino)}</code>${aviso}</td><td>${docs.length}</td></tr>`;
    }).join('');
    const total = plan.reduce((n, p) => n + p.docs.length, 0);
    resumen.innerHTML = `
        <table class="tabla-migracion">
            <thead><tr><th>Colección</th><th>Pendientes</th></tr></thead>
            <tbody>${filas}</tbody>
        </table>`;
    btnMigrar.disabled = total === 0;
    return total;
}

async function revisar(uid) {
    estado.textContent = 'Revisando tus datos…';
    planActual = await analizar(uid);
    const total = pintarResumen(planActual);
    estado.textContent = total === 0
        ? 'No queda nada por migrar: tus datos ya usan los nombres nuevos.'
        : `${total} documentos por migrar.`;
}

btnMigrar.addEventListener('click', async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !planActual) return;
    btnMigrar.disabled = true;
    try {
        await migrar(uid, planActual, texto => { estado.textContent = texto; });
        await revisar(uid);
        estado.textContent = 'Migración terminada. ' + estado.textContent;
    } catch (error) {
        console.error(error);
        estado.textContent = `Error: ${error.message}`;
        btnMigrar.disabled = false;
    }
});

onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    document.body.style.display = 'block';
    revisar(user.uid).catch(error => {
        console.error(error);
        estado.textContent = `Error al revisar: ${error.message}`;
    });
});
