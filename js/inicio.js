import { db, auth } from './firebase-config.js';
import {
    collection, query, where, getDocs, orderBy, doc, updateDoc, getDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { icon } from './icons.js';
import { calcularRecomendaciones } from './recomendaciones.js';
import { formatNombreTema } from './temario-oficial.js';

const saludoEl = document.getElementById('saludo');
const fechaEl = document.getElementById('fecha-hoy');
const kpiHoy = document.getElementById('kpi-hoy');
const kpiSemana = document.getElementById('kpi-semana');
const kpiRacha = document.getElementById('kpi-racha');
const kpiSesiones = document.getElementById('kpi-sesiones');
const listaTareas = document.getElementById('inicio-tareas');
const listaEventos = document.getElementById('inicio-eventos');
const listaRecos = document.getElementById('inicio-recos');

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function claveFecha(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function formatearMinutos(min) {
    const total = Math.round(min);
    if (total < 60) return `${total} min`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
}

function saludoSegunHora() {
    const h = new Date().getHours();
    if (h < 6) return 'Buenas noches';
    if (h < 14) return 'Buenos días';
    if (h < 21) return 'Buenas tardes';
    return 'Buenas noches';
}

function pintarCabecera(user) {
    const hoy = new Date();
    const nombre = user.displayName ? user.displayName.split(' ')[0] : '';
    if (saludoEl) saludoEl.textContent = nombre ? `${saludoSegunHora()}, ${nombre}` : saludoSegunHora();
    if (fechaEl) {
        fechaEl.textContent = `${DIAS[hoy.getDay()]}, ${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`;
    }
}

/**
 * Trae las sesiones de los últimos 60 días de una sola vez: con eso se
 * calculan las cifras de hoy, las de la semana y la racha sin repetir
 * consultas contra Firestore.
 */
async function cargarResumenSesiones(uid) {
    const desde = new Date();
    desde.setDate(desde.getDate() - 60);
    desde.setHours(0, 0, 0, 0);

    const q = query(
        collection(db, 'sesiones_estudio'),
        where('user_id', '==', uid),
        where('fecha_sesion', '>=', Timestamp.fromDate(desde))
    );
    const snap = await getDocs(q);

    const hoyClave = claveFecha(new Date());

    // Lunes de la semana en curso
    const inicioSemana = new Date();
    const dia = inicioSemana.getDay();
    inicioSemana.setDate(inicioSemana.getDate() - (dia === 0 ? 6 : dia - 1));
    inicioSemana.setHours(0, 0, 0, 0);

    let minutosHoy = 0;
    let minutosSemana = 0;
    let sesionesHoy = 0;
    const diasConEstudio = new Set();

    snap.forEach(d => {
        const s = d.data();
        if (!s.fecha_sesion || !s.fecha_sesion.toDate) return;
        const fecha = s.fecha_sesion.toDate();
        const minutos = Number(s.duracion_minutos) || 0;
        const clave = claveFecha(fecha);

        diasConEstudio.add(clave);
        if (clave === hoyClave) {
            minutosHoy += minutos;
            sesionesHoy++;
        }
        if (fecha >= inicioSemana) minutosSemana += minutos;
    });

    // Racha: días consecutivos con alguna sesión, contando desde hoy (o ayer,
    // para no romperla si aún no se ha estudiado hoy)
    let racha = 0;
    const cursor = new Date();
    if (!diasConEstudio.has(claveFecha(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (diasConEstudio.has(claveFecha(cursor))) {
        racha++;
        cursor.setDate(cursor.getDate() - 1);
    }

    if (kpiHoy) kpiHoy.textContent = formatearMinutos(minutosHoy);
    if (kpiSemana) kpiSemana.textContent = formatearMinutos(minutosSemana);
    if (kpiRacha) kpiRacha.textContent = racha === 1 ? '1 día' : `${racha} días`;
    if (kpiSesiones) kpiSesiones.textContent = String(sesionesHoy);

    return { minutosHoy, minutosSemana, racha };
}

/**
 * Cuenta atrás para la convocatoria y progreso del objetivo semanal.
 * Ambos son opcionales: cada bloque solo aparece si está configurado en
 * Ajustes, para no dejar huecos vacíos en la pantalla.
 *
 * @param {number} minutosSemana Minutos ya estudiados en la semana en curso
 */
async function cargarObjetivos(uid, minutosSemana) {
    const panel = document.getElementById('panel-objetivos');
    const cuentaAtras = document.getElementById('cuenta-atras');
    const meta = document.getElementById('meta-semanal');
    if (!panel) return;

    let prefs = {};
    try {
        const snap = await getDoc(doc(db, 'preferencias_usuario', uid));
        if (snap.exists()) prefs = snap.data();
    } catch (error) {
        console.error('Error cargando objetivos:', error);
        return;
    }

    let hayAlgo = false;

    // --- Cuenta atrás ---
    if (prefs.fecha_examen) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const [y, m, d] = prefs.fecha_examen.split('-').map(Number);
        const examen = new Date(y, m - 1, d);

        const dias = Math.round((examen - hoy) / 86400000);
        const numEl = document.getElementById('countdown-dias');
        const fechaEl = document.getElementById('countdown-fecha');

        if (dias > 0) {
            numEl.textContent = dias;
            cuentaAtras.querySelector('.countdown__label').textContent =
                dias === 1 ? 'día para la convocatoria' : 'días para la convocatoria';
        } else if (dias === 0) {
            numEl.textContent = '¡Hoy!';
            cuentaAtras.querySelector('.countdown__label').textContent = 'es la convocatoria';
        } else {
            numEl.textContent = Math.abs(dias);
            cuentaAtras.querySelector('.countdown__label').textContent =
                dias === -1 ? 'día desde la convocatoria' : 'días desde la convocatoria';
        }
        cuentaAtras.classList.toggle('is-pasado', dias < 0);
        fechaEl.textContent = `${d} de ${MESES[m - 1]} de ${y}`;
        cuentaAtras.classList.remove('hidden');
        hayAlgo = true;
    }

    // --- Objetivo semanal ---
    const horasMeta = prefs.meta_semanal_horas;
    if (typeof horasMeta === 'number' && horasMeta > 0) {
        const minutosMeta = horasMeta * 60;
        const porcentaje = Math.min(100, Math.round((minutosSemana / minutosMeta) * 100));
        const restante = Math.max(0, minutosMeta - minutosSemana);

        document.getElementById('goal-hecho').textContent = formatearMinutos(minutosSemana);
        document.getElementById('goal-total').textContent = `de ${formatearMinutos(minutosMeta)}`;

        const fill = document.getElementById('goal-fill');
        fill.style.width = `${porcentaje}%`;
        meta.classList.toggle('is-cumplido', porcentaje >= 100);

        document.getElementById('goal-resto').textContent = restante === 0
            ? `Objetivo cumplido (${porcentaje}%)`
            : `Te faltan ${formatearMinutos(restante)} · ${porcentaje}%`;

        meta.classList.remove('hidden');
        hayAlgo = true;
    }

    if (hayAlgo) panel.classList.remove('hidden');
}

async function cargarTareasDeHoy(uid) {
    if (!listaTareas) return;
    const hoyClave = claveFecha(new Date());

    const q = query(
        collection(db, 'tareas_semanales'),
        where('user_id', '==', uid),
        where('fecha_tarea', '==', hoyClave),
        orderBy('orden', 'asc')
    );
    const snap = await getDocs(q);

    if (snap.empty) {
        listaTareas.innerHTML = '<li class="empty-msg">No tienes tareas para hoy.</li>';
        return;
    }

    listaTareas.innerHTML = '';
    snap.forEach(d => {
        const t = d.data();
        const li = document.createElement('li');
        li.className = 'task-item' + (t.completada ? ' completed' : '');
        li.style.cursor = 'default';
        li.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${t.completada ? 'checked' : ''}>
            <span class="task-text">${t.texto}</span>
        `;
        li.querySelector('.task-checkbox').addEventListener('change', (e) => {
            li.classList.toggle('completed', e.target.checked);
            updateDoc(doc(db, 'tareas_semanales', d.id), { completada: e.target.checked });
        });
        listaTareas.appendChild(li);
    });
}

async function cargarProximosEventos(uid) {
    if (!listaEventos) return;

    // Solo se filtra por usuario y se ordena en el navegador: así no hace
    // falta ningún índice compuesto nuevo en Firestore.
    const q = query(collection(db, 'calendario_eventos'), where('user_id', '==', uid));
    const snap = await getDocs(q);

    const hoyClave = claveFecha(new Date());
    const proximos = snap.docs
        .map(d => d.data())
        .filter(e => e.fecha_evento && e.fecha_evento >= hoyClave)
        .sort((a, b) => a.fecha_evento.localeCompare(b.fecha_evento))
        .slice(0, 5);

    if (!proximos.length) {
        listaEventos.innerHTML = '<li class="empty-msg">No hay nada previsto próximamente.</li>';
        return;
    }

    listaEventos.innerHTML = proximos.map(e => {
        const [y, m, d] = e.fecha_evento.split('-');
        const esHoy = e.fecha_evento === hoyClave;
        return `
            <li class="evento-item">
                <span class="evento-fecha${esHoy ? ' is-today' : ''}">
                    <b>${d}</b><span>${MESES[Number(m) - 1].slice(0, 3)}</span>
                </span>
                <span class="evento-texto">
                    ${e.texto_evento}
                    <span class="evento-tipo">${e.tipo_calendario === 'entrenamientos' ? 'Entrenamiento' : 'Clase'}</span>
                </span>
            </li>`;
    }).join('');
}

async function cargarRecomendaciones(uid) {
    if (!listaRecos) return;
    try {
        const ranking = await calcularRecomendaciones(db, uid);
        listaRecos.innerHTML = ranking.slice(0, 3).map((t, i) => `
            <li class="reco-mini">
                <span class="reco-mini__rank">${i + 1}</span>
                <span class="reco-mini__body">
                    <span class="reco-mini__title">Tema ${t.numero} · ${formatNombreTema(t.nombre)}</span>
                    <span class="reco-mini__meta">
                        ${icon('award', 'icon--sm')} ${t.media.toFixed(1)} preg./examen
                        · ${t.minutos ? formatearMinutos(t.minutos) + ' estudiadas' : 'sin estudiar'}
                    </span>
                </span>
            </li>`).join('');
    } catch (error) {
        console.error('Error al calcular recomendaciones:', error);
        listaRecos.innerHTML = '<li class="empty-msg">No se pudieron calcular.</li>';
    }
}

auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    pintarCabecera(user);
    try {
        // El objetivo semanal necesita saber cuánto se lleva estudiado, así
        // que espera al resumen; el resto se carga en paralelo.
        const [resumen] = await Promise.all([
            cargarResumenSesiones(user.uid),
            cargarTareasDeHoy(user.uid),
            cargarProximosEventos(user.uid),
            cargarRecomendaciones(user.uid)
        ]);
        await cargarObjetivos(user.uid, resumen ? resumen.minutosSemana : 0);
    } catch (error) {
        console.error('Error cargando el inicio:', error);
    }
});
