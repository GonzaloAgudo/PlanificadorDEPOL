// Construye la barra lateral de navegación común a todas las páginas.
import { auth } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { icon } from './icons.js';
import { confirmDialog } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const mainNav = document.getElementById('main-nav');
    const menuToggle = document.getElementById('menu-toggle');
    if (!mainNav) return;

    const menuItems = [
        { name: 'Inicio', link: 'index.html', icon: 'home' },
        { name: 'Sesión de estudio', link: 'sesion.html', icon: 'timer' },
        { name: 'Estadísticas', link: 'stats.html', icon: 'chart' },
        { name: 'Planificador semanal', link: 'semana.html', icon: 'board' },
        { name: 'Calendario', link: 'calendario.html', icon: 'calendar' },
        { name: 'Progreso del temario', link: 'progreso.html', icon: 'checklist' },
        { name: 'Calculadora de nota', link: 'calcular-nota.html', icon: 'calculator' },
        { name: 'Apuntes', link: 'notas.html', icon: 'notebook' },
        { name: 'Ajustes', link: 'ajustes.html', icon: 'settings' }
    ];

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    const links = menuItems.map(item => {
        const isActive = currentPage === item.link ? ' class="active"' : '';
        const current = currentPage === item.link ? ' aria-current="page"' : '';
        return `<li><a href="${item.link}"${isActive}${current}>${icon(item.icon)}<span>${item.name}</span></a></li>`;
    }).join('');

    mainNav.innerHTML = `
        <div class="nav-brand">
            <img src="assets/logo.png" alt="">
            <span>
                <span class="nav-brand__name">Planificador</span>
                <span class="nav-brand__sub">Oposición CNP</span>
            </span>
        </div>
        <div class="nav-scroll">
            <p class="nav-section">Navegación</p>
            <ul>${links}</ul>
        </div>
        <div class="nav-footer">
            <a href="#" class="logout-link">${icon('logout')}<span>Cerrar sesión</span></a>
        </div>
    `;

    // Velo que cubre el contenido cuando el menú se abre en pantallas pequeñas
    const scrim = document.createElement('div');
    scrim.className = 'nav-scrim';
    document.body.appendChild(scrim);

    const openMenu = () => {
        mainNav.classList.add('active');
        scrim.classList.add('active');
    };
    const closeMenu = () => {
        mainNav.classList.remove('active');
        scrim.classList.remove('active');
    };

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            if (mainNav.classList.contains('active')) closeMenu();
            else openMenu();
        });
    }

    scrim.addEventListener('click', closeMenu);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });

    // Al navegar a otra sección desde el móvil, el menú se cierra solo
    mainNav.querySelectorAll('a[href]:not(.logout-link)').forEach(a => {
        a.addEventListener('click', closeMenu);
    });

    const logoutLink = mainNav.querySelector('.logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const ok = await confirmDialog({
                title: 'Cerrar sesión',
                message: 'Volverás a la pantalla de acceso.',
                confirmText: 'Cerrar sesión'
            });
            if (!ok) return;
            signOut(auth)
                .then(() => { window.location.href = 'login.html'; })
                .catch((error) => { console.error('Error al cerrar sesión:', error); });
        });
    }
});
