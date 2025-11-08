document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const errorMessage = document.getElementById('error-message');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            
            try {
                // RUTA CORREGIDA
                const response = await fetch('api/login_action.php', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                
                if (data.success) {
                    window.location.href = 'index.php'; // Redirige a la app
                } else {
                    errorMessage.textContent = data.message || 'Error al iniciar sesión.';
                }
            } catch (error) {
                errorMessage.textContent = 'Error de red.';
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMessage.textContent = ''; // Limpiar errores previos

            // --- CAMBIO AQUÍ: Comprobación en el navegador ---
            const password = registerForm.querySelector('#password').value;
            const confirmPassword = registerForm.querySelector('#confirm-password').value;

            if (password !== confirmPassword) {
                errorMessage.textContent = 'Las contraseñas no coinciden.';
                return; // Detiene el envío
            }
            // --- FIN DEL CAMBIO ---

            const formData = new FormData(registerForm);

            try {
                // RUTA CORREGIDA
                const response = await fetch('api/register_action.php', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();

                if (data.success) {
                    window.location.href = 'login.html'; // Éxito, redirige a login
                } else {
                    errorMessage.textContent = data.message || 'Error al registrarse.';
                }
            } catch (error) {
                errorMessage.textContent = 'Error de red.';
            }
        });
    }
});