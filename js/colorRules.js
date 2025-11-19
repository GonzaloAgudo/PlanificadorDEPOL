import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let userColorRules = [];
let rulesLoaded = false; 

// Añadimos 'export' para poder usarla en otros archivos
export async function fetchColorRules() {
    if (rulesLoaded || !auth.currentUser) {
        return;
    }
    
    try {
        const q = query(collection(db, "color_rules"), where("user_id", "==", auth.currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        userColorRules = []; 
        querySnapshot.forEach((doc) => {
            userColorRules.push(doc.data());
        });
        
        rulesLoaded = true; 
    } catch (error) {
        console.error('Error al cargar reglas de color:', error);
    }
}

// Añadimos 'export'
export function applyColorRule(element, text) {
    element.style.backgroundColor = '';
    element.style.borderLeftColor = '';
    const textLower = text.toLowerCase();
    const rule = userColorRules.find(r => textLower.startsWith(r.keyword.toLowerCase()));

    if (rule) {
        element.style.backgroundColor = rule.bg_color;
        element.style.borderLeftColor = rule.border_color;
    }
}

// Añadimos 'export'
export function applyEventColorRule(element, text) {
    element.style.backgroundColor = '';
    element.style.borderLeftColor = '';
    const textLower = text.toLowerCase();
    const rule = userColorRules.find(r => textLower.startsWith(r.keyword.toLowerCase()));

    if (rule) {
        element.style.backgroundColor = rule.bg_color;
        element.style.borderLeftColor = rule.border_color;
    } else {
        element.style.backgroundColor = '#f4f4f4';
        element.style.borderLeftColor = 'var(--color-secundario)';
    }
}