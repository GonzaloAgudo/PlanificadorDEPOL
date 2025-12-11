import { db, auth } from './firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Variable para guardar las reglas en memoria y no pedirlas constantemente
let cachedRules = [];

/**
 * Carga las reglas de color desde Firebase y las guarda en memoria.
 */
export async function fetchColorRules() {
    if (!auth.currentUser) return;
    try {
        const q = query(collection(db, "color_rules"), where("user_id", "==", auth.currentUser.uid));
        const snapshot = await getDocs(q);
        cachedRules = snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error("Error cargando reglas de color:", error);
    }
}

/**
 * Aplica el color a un elemento de la LISTA DE TAREAS (Borde izquierdo y fondo sutil)
 */
export function applyColorRule(element, text) {
    if (!text) return;
    const textLower = text.toLowerCase();
    
    const rule = cachedRules.find(r => textLower.includes(r.keyword.toLowerCase()));
    
    if (rule) {
        // Estilo para lista de tareas (más sutil)
        element.style.borderLeftColor = rule.border_color || rule.bg_color;
        // Opcional: Si quieres que toda la fila tenga un fondo muy suave
        // element.style.backgroundColor = rule.bg_color + '33'; // Agrega transparencia hex
    }
}

/**
 * Aplica el color a un EVENTO DEL CALENDARIO (Estilo etiqueta completa)
 */
export function applyEventColorRule(element, text) {
    if (!text) return;
    const textLower = text.toLowerCase();
    
    // Buscar si el texto del evento contiene alguna palabra clave
    const rule = cachedRules.find(r => textLower.includes(r.keyword.toLowerCase()));
    
    if (rule) {
        // 1. Color de Fondo (El que elegiste en el selector)
        element.style.backgroundColor = rule.bg_color;
        
        // 2. Color de la Franja Izquierda (El borde oscuro)
        // Si existe border_color úsalo, si no, usa el mismo del fondo
        element.style.borderLeftColor = rule.border_color || rule.bg_color;
        
        // 3. Color del Texto
        // Por defecto oscuro para legibilidad en colores pastel
        element.style.color = '#333';
        
        // Excepción: Si el fondo es muy oscuro (como el rojo "Festivo"), poner texto blanco
        // (Esto es un cálculo simple de brillo)
        if (isDarkColor(rule.bg_color)) {
            element.style.color = 'white';
        }
    }
}

// Función auxiliar para saber si un color Hex es oscuro (para poner texto blanco)
function isDarkColor(hex) {
    if(!hex) return false;
    const c = hex.substring(1);      // Strip #
    const rgb = parseInt(c, 16);   // Convert rrggbb to decimal
    const r = (rgb >> 16) & 0xff;  // Extract red
    const g = (rgb >>  8) & 0xff;  // Extract green
    const b = (rgb >>  0) & 0xff;  // Extract blue

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709

    return luma < 128; // Si es menor a 128, es oscuro
}