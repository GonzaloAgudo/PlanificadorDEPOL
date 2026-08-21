import { auth } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendEmailVerification,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { toast, promptDialog } from './ui.js';

const errorBox = document.getElementById('error-message');

/** Traduce los códigos de error de Firebase a algo legible. */
function mensajeDeError(error) {
    switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
            return 'El correo o la contraseña no son correctos.';
        case 'auth/invalid-email':
            return 'Esa dirección de correo no es válida.';
        case 'auth/email-already-in-use':
            return 'Ya existe una cuenta con ese correo.';
        case 'auth/weak-password':
            return 'La contraseña debe tener al menos 6 caracteres.';
        case 'auth/too-many-requests':
            return 'Demasiados intentos. Espera un momento antes de volver a probar.';
        case 'auth/network-request-failed':
            return 'No hay conexión con el servidor. Comprueba tu red.';
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
            return 'Se cerró la ventana de Google antes de terminar.';
        case 'auth/popup-blocked':
            return 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes de este sitio.';
        case 'auth/account-exists-with-different-credential':
            return 'Ya hay una cuenta con ese correo creada con otro método de acceso.';
        case 'auth/operation-not-allowed':
            return 'Ese método de acceso no está habilitado en el proyecto de Firebase.';
        case 'auth/unauthorized-domain':
            return 'Este dominio no está autorizado en Firebase para iniciar sesión.';
        default:
            return 'No se ha podido completar la operación. Inténtalo de nuevo.';
    }
}

function mostrarError(texto) {
    if (errorBox) errorBox.textContent = texto;
    else toast(texto, { type: 'error' });
}

function limpiarError() {
    if (errorBox) errorBox.textContent = '';
}

/** Bloquea el botón mientras se procesa, para evitar envíos repetidos. */
function ocupado(boton, texto) {
    if (!boton) return () => {};
    const original = boton.innerHTML;
    boton.disabled = true;
    boton.textContent = texto;
    return () => { boton.disabled = false; boton.innerHTML = original; };
}

/** A dónde mandar al usuario según su estado de verificación. */
function destinoTrasEntrar(user) {
    const soloGoogle = user.providerData.every(p => p.providerId === 'google.com');
    if (user.emailVerified || soloGoogle) return 'index.html';
    return 'verificar.html';
}

// ==============================================================
//  Acceso con Google
// ==============================================================
const googleBtn = document.getElementById('btn-google');
if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
        limpiarError();
        const listo = ocupado(googleBtn, 'Conectando…');
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            const cred = await signInWithPopup(auth, provider);
            window.location.href = destinoTrasEntrar(cred.user);
        } catch (error) {
            console.error('Error con Google:', error.code, error.message);
            mostrarError(mensajeDeError(error));
            listo();
        }
    });
}

// ==============================================================
//  Registro
// ==============================================================
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        limpiarError();

        const email = registerForm.querySelector('#username').value.trim();
        const password = registerForm.querySelector('#password').value;
        const confirmPassword = registerForm.querySelector('#confirm-password').value;
        const submitBtn = registerForm.querySelector('button[type="submit"]');

        if (password !== confirmPassword) {
            return mostrarError('Las dos contraseñas no coinciden.');
        }
        if (password.length < 6) {
            return mostrarError('La contraseña debe tener al menos 6 caracteres.');
        }

        const listo = ocupado(submitBtn, 'Creando cuenta…');
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(cred.user);
            window.location.href = 'verificar.html';
        } catch (error) {
            console.error('Error al registrar:', error.code, error.message);
            mostrarError(mensajeDeError(error));
            listo();
        }
    });
}

// ==============================================================
//  Acceso con correo y contraseña
// ==============================================================
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        limpiarError();

        const email = loginForm.querySelector('#username').value.trim();
        const password = loginForm.querySelector('#password').value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        const listo = ocupado(submitBtn, 'Accediendo…');
        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            window.location.href = destinoTrasEntrar(cred.user);
        } catch (error) {
            console.error('Error al acceder:', error.code, error.message);
            mostrarError(mensajeDeError(error));
            listo();
        }
    });
}

// ==============================================================
//  Recuperar contraseña
// ==============================================================
const forgotLink = document.getElementById('btn-forgot');
if (forgotLink) {
    forgotLink.addEventListener('click', async (e) => {
        e.preventDefault();
        limpiarError();

        const actual = document.getElementById('username');
        const email = await promptDialog({
            title: 'Restablecer contraseña',
            message: 'Te enviaremos un enlace para crear una contraseña nueva.',
            label: 'Correo electrónico',
            value: actual ? actual.value.trim() : '',
            placeholder: 'tucorreo@ejemplo.com',
            confirmText: 'Enviar enlace'
        });
        if (!email) return;

        try {
            await sendPasswordResetEmail(auth, email);
            toast('Si existe una cuenta con ese correo, recibirás el enlace en unos minutos.', { type: 'success', duration: 7000 });
        } catch (error) {
            console.error('Error al enviar el correo:', error.code);
            mostrarError(mensajeDeError(error));
        }
    });
}
