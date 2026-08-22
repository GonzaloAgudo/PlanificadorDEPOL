// Registra el service worker y avisa cuando hay una versión nueva.
import { toast } from './ui.js';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registro = await navigator.serviceWorker.register('sw.js');

            // Si aparece una versión nueva mientras la app está abierta, se
            // avisa en lugar de cambiarla por sorpresa a media tarea.
            registro.addEventListener('updatefound', () => {
                const nuevo = registro.installing;
                if (!nuevo) return;

                nuevo.addEventListener('statechange', () => {
                    const hayVersionAnterior = navigator.serviceWorker.controller;
                    if (nuevo.state === 'installed' && hayVersionAnterior) {
                        toast('Hay una versión nueva. Recarga la página para usarla.', {
                            type: 'info',
                            duration: 0
                        });
                    }
                });
            });
        } catch (error) {
            // Sin service worker la aplicación funciona igual, solo que sin
            // acceso sin conexión: no merece la pena molestar al usuario.
            console.warn('No se pudo registrar el service worker:', error);
        }
    });
}
