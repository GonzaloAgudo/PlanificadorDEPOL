/**
 * Sustituye Cloud Firestore por un doble de prueba durante la ejecucion.
 *
 * recomendaciones.js importa el SDK desde la red de distribucion de Google.
 * Este gancho intercepta esa resolucion y la redirige al doble local, lo que
 * permite ejercitar el motor de recomendaciones sin red y de forma
 * determinista, sin modificar ni una linea del codigo de produccion.
 */
import { registerHooks } from 'node:module';

const SDK_FIRESTORE = 'firebase-firestore.js';

registerHooks({
    resolve(especificador, contexto, siguiente) {
        if (especificador.startsWith('https://') && especificador.endsWith(SDK_FIRESTORE)) {
            return siguiente(new URL('./doble-firestore.mjs', import.meta.url).href, contexto);
        }
        return siguiente(especificador, contexto);
    }
});
