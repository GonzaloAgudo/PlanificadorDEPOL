// Importa la autenticación y la función de 'signOut'
import { auth } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const mainNav = document.getElementById('main-nav');
    
    // 1. GENERAR EL HTML DEL MENÚ AUTOMÁTICAMENTE
    // Definimos las páginas y sus enlaces
    const menuItems = [
        { name: 'Pomodoro', link: 'index.html' },
        { name: 'Estadísticas', link: 'stats.html' },
        { name: 'Planificador Semanal', link: 'semana.html' },
        { name: 'Calendario', link: 'calendario.html' },
        { name: 'Bloc de Notas', link: 'notas.html' },
        { name: 'Progreso', link: 'progreso.html' },
        { name: 'Ajustes', link: 'ajustes.html' }
    ];

    // Detectar en qué página estamos para poner la clase "active"
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    let menuHTML = '<ul>';
    
    menuItems.forEach(item => {
        const isActive = currentPage === item.link ? 'class="active"' : '';
        menuHTML += `<li><a href="${item.link}" ${isActive}>${item.name}</a></li>`;
    });

    // Añadimos el botón de cerrar sesión al final
    menuHTML += `<li><a href="#" class="logout-link">Cerrar Sesión</a></li>`;
    menuHTML += '</ul>';

    // Inyectamos el HTML en el nav
    if (mainNav) mainNav.innerHTML = menuHTML;


    // 2. LÓGICA DE INTERACCIÓN (Hover, Click, etc.)
    const menuToggle = document.getElementById('menu-toggle');
    const logoutLink = document.querySelector('.logout-link'); // Ahora sí existe en el DOM
    
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
    if (menuToggle) {
        menuToggle.addEventListener('mouseenter', openMenu);
        menuToggle.addEventListener('mouseleave', closeMenu);
        // Evento de Clic (Pin)
        menuToggle.addEventListener('click', () => {
            isPinned = !isPinned;
            if (isPinned) mainNav.classList.add('active');
            else mainNav.classList.remove('active');
        });
    }

    if (mainNav) {
        mainNav.addEventListener('mouseenter', openMenu);
        mainNav.addEventListener('mouseleave', closeMenu);
    }
    
    // 3. LÓGICA DE LOGOUT
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault(); 
            if (confirm('¿Seguro que quieres cerrar sesión?')) {
                signOut(auth).then(() => {
                    window.location.href = 'login.html';
                }).catch((error) => {
                    console.error('Error al cerrar sesión:', error);
                });
            }
        });
    }
});