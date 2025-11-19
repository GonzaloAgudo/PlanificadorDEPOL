// Importa la autenticación y la función de 'escucha'
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Escucha los cambios de estado de autenticación
onAuthStateChanged(auth, (user) => {
    if (user) {
        // El usuario ha iniciado sesión.
        // Opcional: podemos mostrar el contenido principal si estaba oculto
        document.body.style.display = 'block'; 
    } else {
        // El usuario no ha iniciado sesión.
        // Redirigir a login.html
        window.location.href = 'login.html';
    }
});