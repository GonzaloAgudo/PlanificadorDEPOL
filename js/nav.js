// Importa la autenticación y la función de 'signOut'
import { auth } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const mainNav = document.getElementById('main-nav');
    const logoutLink = document.querySelector('.logout-link'); // Busca el enlace de logout
    
    let leaveTimer; 
    let isPinned = false; 

    const openMenu = () => {
        clearTimeout(leaveTimer); 
        mainNav.classList.add('active');
    };

    const closeMenu = () => {
        leaveTimer = setTimeout(() => {
            if (!isPinned) { 
                mainNav.classList.remove('active');
            }
        }, 300); 
    };

    // Eventos de Hover
    menuToggle.addEventListener('mouseenter', openMenu);
    mainNav.addEventListener('mouseenter', openMenu);
    menuToggle.addEventListener('mouseleave', closeMenu);
    mainNav.addEventListener('mouseleave', closeMenu);

    // Evento de Clic
    menuToggle.addEventListener('click', () => {
        isPinned = !isPinned;
        if (isPinned) {
            mainNav.classList.add('active');
        } else {
            mainNav.classList.remove('active');
        }
    });
    
    // --- ¡NUEVA LÓGICA DE LOGOUT! ---
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault(); // Evita que el enlace navegue
            if (confirm('¿Seguro que quieres cerrar sesión?')) {
                signOut(auth).then(() => {
                    // Cierre de sesión exitoso, redirige a login
                    window.location.href = 'login.html';
                }).catch((error) => {
                    console.error('Error al cerrar sesión:', error);
                });
            }
        });
    }
    // --- FIN DE LA NUEVA LÓGICA ---
});