
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- TU CONFIGURACIÓN (Pega aquí tus claves reales de Firebase) ---
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

// Exportamos las herramientas para usarlas en otros archivos
export const auth = getAuth(app);
export const db = getFirestore(app);

