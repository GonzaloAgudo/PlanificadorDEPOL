// Controla el acceso a las páginas internas: sin sesión iniciada se va a
// login, y con el correo sin verificar, a la pantalla de verificación.
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { necesitaVerificar } from './auth-guard-utils.js';

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }

    if (necesitaVerificar(user)) {
        window.location.replace('verificar.html');
        return;
    }

    document.body.style.display = 'block';
});
