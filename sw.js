/**
 * Service worker: permite abrir y usar la aplicación sin conexión.
 *
 * Estrategias:
 *   - Páginas HTML  -> red primero, con la copia guardada como respaldo.
 *     Así se ve siempre la última versión y, sin cobertura, sigue abriendo.
 *   - Recursos propios (CSS, JS, iconos) -> copia guardada primero y
 *     actualización en segundo plano: la app arranca al instante.
 *   - Librerías externas (Firebase, Chart.js, Quill, Sortable, tipografías)
 *     -> se guardan la primera vez que se usan.
 *   - Firestore y autenticación -> NUNCA se interceptan (ver debeIgnorarse).
 *
 * Los datos sin conexión no los guarda este archivo, sino la caché propia de
 * Firestore, que se activa en js/firebase-config.js.
 *
 * Al cambiar archivos hay que subir el número de VERSION para que los
 * navegadores se descarguen la copia nueva.
 */
const VERSION = 'v2';
const CACHE_APP = `planificador-app-${VERSION}`;
const CACHE_EXTERNO = `planificador-externo-${VERSION}`;

// Todo lo necesario para que la aplicación arranque sin conexión
const ARCHIVOS = [
    './',
    'index.html',
    'sesion.html',
    'stats.html',
    'semana.html',
    'calendario.html',
    'progreso.html',
    'fisicas.html',
    'calcular-nota.html',
    'notas.html',
    'ajustes.html',
    'login.html',
    'register.html',
    'verificar.html',
    'manifest.webmanifest',
    'css/style.css',
    'js/ajustes.js',
    'js/auth.js',
    'js/auth-guard.js',
    'js/auth-guard-utils.js',
    'js/borrar-datos.js',
    'js/calcular-nota.js',
    'js/calendario.js',
    'js/colorRules.js',
    'js/firebase-config.js',
    'js/icons.js',
    'js/inicio.js',
    'js/nav.js',
    'js/notas.js',
    'js/pomodoro.js',
    'js/progreso.js',
    'js/fisicas.js',
    'js/baremo-fisicas.js',
    'js/pwa.js',
    'js/recomendaciones.js',
    'js/semana.js',
    'js/stats.js',
    'js/temario-oficial.js',
    'js/ui.js',
    'js/verificar.js',
    'assets/logo.png',
    'assets/icon-192.png',
    'assets/icon-512.png',
    'assets/apple-touch-icon.png',
    'assets/alarma.mp3'
];

/**
 * Peticiones que el service worker no debe tocar nunca.
 *
 * Firestore y la autenticación usan canales de larga duración y respuestas
 * en tiempo real: interceptarlas o guardarlas rompería la sincronización y
 * podría servir sesiones caducadas. Firestore ya trae su propia caché.
 */
function debeIgnorarse(url) {
    return [
        'firestore.googleapis.com',
        'identitytoolkit.googleapis.com',
        'securetoken.googleapis.com',
        'firebaseinstallations.googleapis.com',
        'google-analytics.com',
        'accounts.google.com',
        'apis.google.com'
    ].some(dominio => url.hostname.endsWith(dominio));
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_APP);
        // addAll falla entero si un archivo falla; se añaden de uno en uno
        // para que un recurso ausente no impida instalar el resto.
        await Promise.all(ARCHIVOS.map(async (archivo) => {
            try {
                await cache.add(new Request(archivo, { cache: 'reload' }));
            } catch (e) {
                console.warn('[sw] no se pudo guardar', archivo, e);
            }
        }));
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const nombres = await caches.keys();
        await Promise.all(
            nombres
                .filter(n => n !== CACHE_APP && n !== CACHE_EXTERNO)
                .map(n => caches.delete(n))
        );
        await self.clients.claim();
    })());
});

// Permite que la página pida activar de inmediato la versión nueva
self.addEventListener('message', (event) => {
    if (event.data === 'activar-ya') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (debeIgnorarse(url)) return;

    // Páginas: red primero, copia guardada como respaldo
    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const respuesta = await fetch(request);
                const cache = await caches.open(CACHE_APP);
                cache.put(request, respuesta.clone());
                return respuesta;
            } catch (e) {
                const guardada = await caches.match(request);
                return guardada || await caches.match('index.html');
            }
        })());
        return;
    }

    const esPropio = url.origin === self.location.origin;

    // Recursos propios: copia guardada primero, actualizando por detrás
    if (esPropio) {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_APP);
            const guardada = await cache.match(request);

            const enRed = fetch(request).then(respuesta => {
                if (respuesta && respuesta.ok) cache.put(request, respuesta.clone());
                return respuesta;
            }).catch(() => null);

            return guardada || await enRed || Response.error();
        })());
        return;
    }

    // Librerías externas: se guardan la primera vez que se piden
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_EXTERNO);
        const guardada = await cache.match(request);
        if (guardada) return guardada;
        try {
            const respuesta = await fetch(request);
            if (respuesta && (respuesta.ok || respuesta.type === 'opaque')) {
                cache.put(request, respuesta.clone());
            }
            return respuesta;
        } catch (e) {
            return Response.error();
        }
    })());
});
