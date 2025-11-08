document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const mainNav = document.getElementById('main-nav');
    
    // --- NUEVOS ESTADOS ---
    let leaveTimer; // Temporizador para el hover
    let isPinned = false; // Estado de "bloqueo" por clic

    // --- Funciones ---
    
    // Abre el menú
    const openMenu = () => {
        clearTimeout(leaveTimer); // Cancela cualquier cierre pendiente
        mainNav.classList.add('active');
    };

    // Cierra el menú (SÓLO si no está "bloqueado")
    const closeMenu = () => {
        leaveTimer = setTimeout(() => {
            if (!isPinned) { // La comprobación clave
                mainNav.classList.remove('active');
            }
        }, 300); // 300ms de retardo
    };

    // --- Eventos de Hover (Pasar el cursor) ---
    
    menuToggle.addEventListener('mouseenter', openMenu);
    mainNav.addEventListener('mouseenter', openMenu);
    
    menuToggle.addEventListener('mouseleave', closeMenu);
    mainNav.addEventListener('mouseleave', closeMenu);

    // --- ¡NUEVO! Evento de Clic ---
    
    menuToggle.addEventListener('click', () => {
        // Invierte el estado de "bloqueo"
        isPinned = !isPinned;
        
        if (isPinned) {
            // Si acabamos de bloquearlo, nos aseguramos de que esté abierto
            mainNav.classList.add('active');
        } else {
            // Si lo acabamos de desbloquear (con el clic), lo cerramos
            mainNav.classList.remove('active');
        }
    });
});