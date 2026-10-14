// Construye la barra lateral de navegación común a todas las páginas.
import { auth } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { icon } from './icons.js';
import { confirmDialog } from './ui.js';

const INICIO = 'index.html';

// Marca que hay una entrada de Inicio justo debajo en el historial
const CLAVE_INICIO_DEBAJO = 'inicioDebajo';

function paginaDe(url) {
    return url.pathname.split('/').pop() || INICIO;
}

function leerMarca() {
    try { return sessionStorage.getItem(CLAVE_INICIO_DEBAJO) === '1'; } catch { return false; }
}

function fijarMarca(valor) {
    try {
        if (valor) sessionStorage.setItem(CLAVE_INICIO_DEBAJO, '1');
        else sessionStorage.removeItem(CLAVE_INICIO_DEBAJO);
    } catch { /* sin sessionStorage se navega igual, solo que sin la marca */ }
}

/**
 * Hace que el botón de atrás se comporte como en una app del móvil.
 *
 * Cada sección es una página distinta, así que el navegador apilaba todas
 * las visitadas y «atrás» las recorría una a una. Ahora Inicio es la raíz:
 * desde Inicio se entra a las secciones con normalidad, pero entre secciones
 * cada una sustituye a la anterior en el historial. Así, desde cualquier
 * sección, «atrás» lleva a Inicio, y desde Inicio se sale de la aplicación.
 */
function activarNavegacionTipoApp(paginaActual) {
    if (paginaActual === INICIO) {
        fijarMarca(false);
    } else if (!document.referrer.startsWith(location.origin)) {
        // Se ha llegado a la sección desde fuera: debajo no hay ningún Inicio
        fijarMarca(false);
    }

    document.addEventListener('click', (e) => {
        const enlace = e.target.closest('a[href]');
        if (!enlace || enlace.target || e.defaultPrevented) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        const url = new URL(enlace.href, location.href);
        if (url.origin !== location.origin || !paginaDe(url).endsWith('.html')) return;
        if (url.pathname === location.pathname) return; // anclas dentro de la misma página

        if (paginaActual === INICIO) {
            fijarMarca(true);
            return; // navegación normal: Inicio queda debajo
        }

        e.preventDefault();
        if (paginaDe(url) === INICIO && leerMarca()) {
            fijarMarca(false);
            history.back();
        } else {
            location.replace(url.href);
        }
    });

    // Al volver con «atrás», el navegador puede mostrar la página tal como
    // estaba en memoria. Se recarga para que los datos no estén desfasados.
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) location.reload();
    });
}

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
        { name: 'Pruebas físicas', link: 'fisicas.html', icon: 'pesas' },
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

    activarNavegacionTipoApp(currentPage);

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
