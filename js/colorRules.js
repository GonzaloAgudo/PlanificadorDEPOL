// Este objeto contendrá las reglas de color una vez cargadas
let userColorRules = [];

// Función para cargar las reglas de color desde la API
async function fetchColorRules() {
    // Evita volver a cargar si ya las tenemos
    if (userColorRules.length > 0) {
        return;
    }
    try {
        const response = await fetch('api/get_color_rules.php');
        const data = await response.json();
        if (data.success) {
            userColorRules = data.rules;
        } else {
            console.error('Error fetching color rules:', data.message);
        }
    } catch (error) {
        console.error('Error de red al cargar reglas de color:', error);
    }
}

// Función para aplicar la regla de color a un elemento de TAREA
function applyColorRule(element, text) {
    // 1. Limpiar cualquier color anterior
    element.style.backgroundColor = '';
    element.style.borderLeftColor = '';

    const textLower = text.toLowerCase();
    
    // 2. Encontrar la primera regla que coincida
    const rule = userColorRules.find(r => textLower.startsWith(r.keyword.toLowerCase()));

    // 3. Aplicar los colores en línea
    if (rule) {
        element.style.backgroundColor = rule.bg_color;
        element.style.borderLeftColor = rule.border_color;
    }
}

// Función para aplicar la regla de color a un elemento de CALENDARIO
function applyEventColorRule(element, text) {
    element.style.backgroundColor = '';
    element.style.borderLeftColor = '';
    const textLower = text.toLowerCase();
    
    const rule = userColorRules.find(r => textLower.startsWith(r.keyword.toLowerCase()));

    if (rule) {
        element.style.backgroundColor = rule.bg_color;
        element.style.borderLeftColor = rule.border_color;
    } else {
        // Un color por defecto si no hay regla
        element.style.backgroundColor = '#f4f4f4';
        element.style.borderLeftColor = 'var(--color-secundario)';
    }
}