import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAqNtbwF2fi_x7R2tYtovwwV7JmaChVv4E",
    authDomain: "planificadordepol.firebaseapp.com",
    projectId: "planificadordepol",
    storageBucket: "planificadordepol.firebasestorage.app",
    messagingSenderId: "35528001640",
    appId: "1:35528001640:web:b2d088e18d6608dedcd3dd",
    measurementId: "G-CNDW743XN4"
  };

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

/**
 * Firestore con caché persistente en el navegador.
 *
 * Es lo que permite consultar y registrar datos sin conexión: las lecturas se
 * sirven de la copia local y las escrituras se guardan en cola y se envían al
 * recuperar la red. El service worker (sw.js) se encarga de que la aplicación
 * en sí abra sin conexión, pero los datos los guarda esta caché.
 *
 * persistentMultipleTabManager permite tener varias pestañas abiertas a la
 * vez; sin él, solo la primera podría usar la caché.
 */
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});
