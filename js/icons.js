/**
 * Conjunto de iconos de trazo (24x24, currentColor).
 *
 * Se usan tanto en el HTML estático (copiando el <svg> correspondiente) como
 * en el marcado que generan los módulos JS, mediante la función icon().
 *
 * Cada entrada contiene solo el interior del <svg>; los atributos comunes
 * (viewBox, stroke, linecap...) los pone icon().
 */
const PATHS = {
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',

    // Navegación principal
    timer: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
    chart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="15"/>',
    board: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="3" y1="10" x2="21" y2="10"/>',
    checklist: '<polyline points="4 7 6 9 10 5"/><polyline points="4 16 6 18 10 14"/><line x1="13" y1="7" x2="20" y2="7"/><line x1="13" y1="17" x2="20" y2="17"/>',
    calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6.5" x2="16" y2="6.5"/><line x1="8.5" y1="11.5" x2="8.5" y2="11.5"/><line x1="12" y1="11.5" x2="12" y2="11.5"/><line x1="15.5" y1="11.5" x2="15.5" y2="11.5"/><line x1="8.5" y1="15.5" x2="8.5" y2="15.5"/><line x1="12" y1="15.5" x2="12" y2="15.5"/><line x1="15.5" y1="15.5" x2="15.5" y2="15.5"/>',
    notebook: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',

    // Acciones
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    play: '<polygon points="6 4 20 12 6 20 6 4"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    reset: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    moveNext: '<polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>',

    // Direcciones
    chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><line x1="12" y1="19" x2="5" y2="12"/><line x1="12" y1="5" x2="5" y2="12"/>',
    more: '<line x1="12" y1="5" x2="12" y2="5"/><line x1="12" y1="12" x2="12" y2="12"/><line x1="12" y1="19" x2="12" y2="19"/>',
    grip: '<line x1="9" y1="6" x2="9" y2="6"/><line x1="9" y1="12" x2="9" y2="12"/><line x1="9" y1="18" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="6"/><line x1="15" y1="12" x2="15" y2="12"/><line x1="15" y1="18" x2="15" y2="18"/>',

    // Contenido / datos
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    award: '<circle cx="12" cy="9" r="6"/><polyline points="8.5 14 7.5 22 12 19.5 16.5 22 15.5 14"/>',
    document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="15" y1="13" x2="9" y2="13"/><line x1="15" y1="17" x2="9" y2="17"/>',
    book: '<path d="M2 4h6a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2z"/><path d="M22 4h-6a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.86.83c0 1.67-2.46 2.5-2.46 2.5"/><line x1="12" y1="17" x2="12" y2="17"/>',
    warning: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/>',
    filter: '<polygon points="21 4 3 4 10 12.5 10 19 14 21 14 12.5 21 4"/>',

    // Autenticación
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 6 12 13 2 6"/>',
    lock: '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
};

/**
 * Devuelve el marcado SVG de un icono.
 * @param {string} name  Clave dentro de PATHS
 * @param {string} extraClass  Clases adicionales para el <svg>
 */
export function icon(name, extraClass = '') {
    const d = PATHS[name];
    if (!d) return '';
    const cls = extraClass ? `icon ${extraClass}` : 'icon';
    return `<svg class="${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" ` +
        `stroke="currentColor" stroke-width="1.75" stroke-linecap="round" ` +
        `stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
}

export { PATHS };
