import { db } from './firebase-config.js';
import {
    collection, query, where, getDocs, doc, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * Colecciones donde cada documento lleva el campo user_id.
 * Al eliminar la cuenta hay que barrerlas todas: si no, los datos se quedan
 * huérfanos en Firestore para siempre.
 */
const COLECCIONES_POR_USUARIO = [
    'sesiones_estudio',
    'tareas_semanales',
    'calendario_eventos',
    'bloc_notas',
    'notas_historial',
    'progreso_temario',
    'color_rules',
    'entrenamientos'
];

/**
 * Colecciones donde el identificador del documento es el propio uid.
 */
const DOCUMENTOS_POR_UID = [
    'preferencias_usuario',
    'config_progreso',
    'timers_activos'
];

// Firestore admite como mucho 500 operaciones por lote
const TAMANO_LOTE = 400;

/**
 * Borra de Firestore todo lo que pertenece a un usuario.
 *
 * @param {string} uid
 * @param {(texto: string) => void} [onProgreso] Callback para ir informando
 * @returns {Promise<number>} Número de documentos eliminados
 */
export async function borrarDatosDeUsuario(uid, onProgreso = () => {}) {
    let total = 0;

    for (const nombre of COLECCIONES_POR_USUARIO) {
        onProgreso(`Borrando ${nombre}…`);

        const q = query(collection(db, nombre), where('user_id', '==', uid));
        const snap = await getDocs(q);
        if (snap.empty) continue;

        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += TAMANO_LOTE) {
            const lote = writeBatch(db);
            docs.slice(i, i + TAMANO_LOTE).forEach(d => lote.delete(d.ref));
            await lote.commit();
        }
        total += docs.length;
    }

    for (const nombre of DOCUMENTOS_POR_UID) {
        onProgreso(`Borrando ${nombre}…`);
        try {
            await deleteDoc(doc(db, nombre, uid));
            total++;
        } catch (e) {
            // Si el documento no existe no pasa nada: seguimos con el resto
            console.warn(`No se pudo borrar ${nombre}/${uid}`, e);
        }
    }

    return total;
}
