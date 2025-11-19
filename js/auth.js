import { auth } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

console.log("--> auth.js ha cargado correctamente.");

// Lógica de Registro
const registerForm = document.getElementById('register-form');
if (registerForm) {
    console.log("--> Formulario de registro detectado.");
    
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log("--> Botón de registro pulsado.");

        const email = registerForm.querySelector('#username').value;
        const password = registerForm.querySelector('#password').value;
        const confirmPassword = registerForm.querySelector('#confirm-password').value;
        const errorMessage = document.getElementById('error-message');

        console.log("--> Datos capturados:", email);

        if (password !== confirmPassword) {
            console.warn("--> Las contraseñas no coinciden.");
            errorMessage.textContent = 'Las contraseñas no coinciden.';
            return;
        }

        if (password.length < 6) {
            console.warn("--> Contraseña muy corta.");
            errorMessage.textContent = 'La contraseña debe tener al menos 6 caracteres.';
            return;
        }

        console.log("--> Enviando datos a Firebase...");

        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                console.log("--> ¡ÉXITO! Usuario creado:", userCredential.user);
                alert('¡Usuario registrado con éxito! Ahora puedes iniciar sesión.');
                window.location.href = 'login.html';
            })
            .catch((error) => {
                console.error("--> ERROR DE FIREBASE:", error.code, error.message);
                
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage.textContent = 'Este email ya está registrado.';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage.textContent = 'El email no es válido.';
                } else if (error.code === 'auth/weak-password') {
                    errorMessage.textContent = 'La contraseña es demasiado débil.';
                } else if (error.code === 'auth/operation-not-allowed') {
                    errorMessage.textContent = 'Error: Habilita Email/Password en la consola de Firebase.';
                } else {
                    errorMessage.textContent = 'Error: ' + error.message;
                }
            });
    });
}

// Lógica de Login
const loginForm = document.getElementById('login-form');
if (loginForm) {
    console.log("--> Formulario de login detectado.");

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log("--> Botón de login pulsado.");

        const email = loginForm.querySelector('#username').value;
        const password = loginForm.querySelector('#password').value;
        const errorMessage = document.getElementById('error-message');

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                console.log("--> Login exitoso.");
                window.location.href = 'index.html';
            })
            .catch((error) => {
                console.error("--> ERROR DE LOGIN:", error.code);
                
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    errorMessage.textContent = 'Email o contraseña incorrectos.';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage.textContent = 'El email no es válido.';
                } else {
                    errorMessage.textContent = 'Error al iniciar sesión (' + error.code + ').';
                }
            });
    });
}