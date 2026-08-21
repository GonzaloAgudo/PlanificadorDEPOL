import { auth } from './firebase-config.js';
import {
    onAuthStateChanged, sendEmailVerification, signOut, reload,
    verifyBeforeUpdateEmail, reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { toast, formDialog } from './ui.js';
import { necesitaVerificar } from './auth-guard-utils.js';

const emailEl = document.getElementById('verify-email');
const btnResend = document.getElementById('btn-resend');
const btnCheck = document.getElementById('btn-check');
const btnLogout = document.getElementById('btn-logout');
const btnCambiarCorreo = document.getElementById('btn-cambiar-correo');

// Espera de cortesía entre reenvíos, para no agotar la cuota de Firebase
const ESPERA_REENVIO = 60;
let restante = 0;
let temporizador = null;

function iniciarCuentaAtras() {
    restante = ESPERA_REENVIO;
    btnResend.disabled = true;
    clearInterval(temporizador);
    temporizador = setInterval(() => {
        restante--;
        if (restante <= 0) {
            clearInterval(temporizador);
            btnResend.disabled = false;
            btnResend.textContent = 'Reenviar correo';
        } else {
            btnResend.textContent = `Reenviar correo (${restante} s)`;
        }
    }, 1000);
}

/**
 * Envía el correo la primera vez que se llega aquí en esta pestaña.
 *
 * Hace falta porque el correo solo se manda automáticamente al registrarse:
 * una cuenta antigua sin verificar aterrizaría aquí sin haber recibido nada.
 * La marca en sessionStorage evita reenviarlo en cada recarga.
 */
async function enviarSiEsLaPrimeraVez(user) {
    const marca = `verif-enviado:${user.uid}`;
    if (sessionStorage.getItem(marca)) return;

    try {
        await sendEmailVerification(user);
        sessionStorage.setItem(marca, '1');
        iniciarCuentaAtras();
    } catch (error) {
        // Si Firebase corta por exceso de envíos no es un fallo real:
        // el usuario ya tiene un correo esperándole en la bandeja
        if (error.code !== 'auth/too-many-requests') {
            console.error('Error al enviar la verificación:', error.code);
        }
        sessionStorage.setItem(marca, '1');
    }
}

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace('login.html');
        return;
    }
    // Si ya está verificado no pinta nada quedarse aquí
    if (!necesitaVerificar(user)) {
        window.location.replace('index.html');
        return;
    }
    if (emailEl) emailEl.textContent = user.email;
    document.body.style.display = 'block';
    enviarSiEsLaPrimeraVez(user);
});

if (btnResend) {
    btnResend.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await sendEmailVerification(user);
            toast('Te hemos enviado el correo de verificación.', { type: 'success' });
            iniciarCuentaAtras();
        } catch (error) {
            console.error('Error al reenviar:', error.code);
            if (error.code === 'auth/too-many-requests') {
                toast('Has pedido demasiados correos seguidos. Espera unos minutos.', { type: 'warning' });
                iniciarCuentaAtras();
            } else {
                toast('No se pudo enviar el correo. Inténtalo más tarde.', { type: 'error' });
            }
        }
    });
}

if (btnCheck) {
    btnCheck.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;

        btnCheck.disabled = true;
        const textoOriginal = btnCheck.textContent;
        btnCheck.textContent = 'Comprobando…';

        try {
            // reload() vuelve a pedir el estado real de la cuenta al servidor
            await reload(user);
            if (auth.currentUser.emailVerified) {
                toast('Correo verificado. Entrando…', { type: 'success' });
                setTimeout(() => window.location.replace('index.html'), 600);
                return;
            }
            toast('Todavía no consta como verificado. Abre el enlace del correo y vuelve a intentarlo.', { type: 'warning', duration: 6000 });
        } catch (error) {
            console.error('Error al comprobar:', error);
            toast('No se pudo comprobar el estado. Inténtalo de nuevo.', { type: 'error' });
        } finally {
            btnCheck.disabled = false;
            btnCheck.textContent = textoOriginal;
        }
    });
}

/**
 * Cambiar la dirección de correo de la cuenta.
 *
 * Sin esto, quien se equivoque al teclear su correo al registrarse (o quien
 * usara una dirección que ya no controla) se queda bloqueado para siempre:
 * no puede verificar, y sin verificar no puede entrar.
 *
 * Se usa verifyBeforeUpdateEmail: manda el enlace a la dirección NUEVA y solo
 * aplica el cambio cuando se abre, así que al terminar la cuenta queda además
 * verificada. El identificador interno no cambia, de modo que se conservan
 * todas las sesiones, tareas, apuntes y notas ya guardados.
 */
async function cambiarCorreo() {
    const user = auth.currentUser;
    if (!user) return;

    const usaContrasena = user.providerData.some(p => p.providerId === 'password');
    if (!usaContrasena) {
        toast('Esta cuenta accede con Google, así que su correo se gestiona desde tu cuenta de Google.', { type: 'info', duration: 7000 });
        return;
    }

    const datos = await formDialog({
        title: 'Cambiar el correo de la cuenta',
        message: 'Enviaremos el enlace de confirmación a la <strong>dirección nueva</strong>. ' +
                 'Conservarás todos tus datos: solo cambia la dirección con la que accedes.',
        fields: [
            { name: 'email', label: 'Nueva dirección de correo', type: 'email', placeholder: 'tucorreo@ejemplo.com', autocomplete: 'email' },
            { name: 'password', label: 'Tu contraseña actual', type: 'password', autocomplete: 'current-password' }
        ],
        confirmText: 'Enviar confirmación',
        validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()) && v.password.length > 0
    });
    if (!datos) return;

    const nuevoEmail = datos.email.trim();
    if (nuevoEmail.toLowerCase() === (user.email || '').toLowerCase()) {
        toast('Esa es la dirección que ya tiene la cuenta.', { type: 'warning' });
        return;
    }

    try {
        // Firebase exige sesión reciente para cambiar el correo
        const cred = EmailAuthProvider.credential(user.email, datos.password);
        await reauthenticateWithCredential(user, cred);
    } catch (error) {
        console.error('Error al reautenticar:', error.code);
        toast(
            error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential'
                ? 'La contraseña no es correcta.'
                : 'No se pudo verificar tu identidad. Inténtalo de nuevo.',
            { type: 'error' }
        );
        return;
    }

    try {
        await verifyBeforeUpdateEmail(user, nuevoEmail);
        toast(`Enlace enviado a ${nuevoEmail}. Ábrelo para completar el cambio y luego entra con la dirección nueva.`,
              { type: 'success', duration: 0 });
    } catch (error) {
        console.error('Error al cambiar el correo:', error.code);
        if (error.code === 'auth/email-already-in-use') {
            toast('Ya existe otra cuenta con esa dirección.', { type: 'error' });
        } else if (error.code === 'auth/invalid-email') {
            toast('Esa dirección de correo no es válida.', { type: 'error' });
        } else {
            toast('No se pudo enviar la confirmación. Inténtalo más tarde.', { type: 'error' });
        }
    }
}

if (btnCambiarCorreo) {
    btnCambiarCorreo.addEventListener('click', (e) => {
        e.preventDefault();
        cambiarCorreo();
    });
}

if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        await signOut(auth);
        window.location.replace('login.html');
    });
}
