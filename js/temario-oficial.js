// Datos de referencia: nº medio de preguntas por tema en las convocatorias
// oficiales 2020-2025 del examen CNP (Escala Básica). Es un dato fijo, no
// depende del usuario ni de Firebase.
export const TEMARIO_OFICIAL = [
    { numero: 1, tema: "Tema 1", bloque: "CIENCIAS JURÍDICAS", nombre: "EL DERECHO", media: 3.0 },
    { numero: 2, tema: "Tema 2", bloque: "CIENCIAS JURÍDICAS", nombre: "LA CONSTITUCIÓN ESPAÑOLA I", media: 3.8 },
    { numero: 3, tema: "Tema 3", bloque: "CIENCIAS JURÍDICAS", nombre: "LA CONSTITUCIÓN ESPAÑOLA II", media: 2.6 },
    { numero: 4, tema: "Tema 4", bloque: "CIENCIAS JURÍDICAS", nombre: "LA UNIÓN EUROPEA", media: 3.3 },
    { numero: 5, tema: "Tema 5", bloque: "CIENCIAS JURÍDICAS", nombre: "LA ORGANIZACIÓN Y FUNCIONAMIENTO DE LA AGE", media: 1.5 },
    { numero: 6, tema: "Tema 6", bloque: "CIENCIAS JURÍDICAS", nombre: "LOS FUNCIONARIOS PÚBLICOS", media: 2.6 },
    { numero: 7, tema: "Tema 7", bloque: "CIENCIAS JURÍDICAS", nombre: "EL MINISTERIO DEL INTERIOR", media: 2.6 },
    { numero: 8, tema: "Tema 8", bloque: "CIENCIAS JURÍDICAS", nombre: "LA DIRECCIÓN GENERAL DE LA POLICÍA", media: 6.3 },
    { numero: 9, tema: "Tema 9", bloque: "CIENCIAS JURÍDICAS", nombre: "LA LO DE FUERZAS Y CUERPOS DE SEGURIDAD", media: 3.0 },
    { numero: 10, tema: "Tema 10", bloque: "CIENCIAS JURÍDICAS", nombre: "ENTRADA, LIBRE CIRCULACIÓN Y RESIDENCIA EN ESPAÑA", media: 3.3 },
    { numero: 11, tema: "Tema 11", bloque: "CIENCIAS JURÍDICAS", nombre: "INFRACCIONES EN MATERIA DE EXTRANJERÍA Y SU RÉGIMEN SANCIONADOR", media: 2.3 },
    { numero: 12, tema: "Tema 12", bloque: "CIENCIAS JURÍDICAS", nombre: "LA PROTECCIÓN INTERNACIONAL", media: 2.8 },
    { numero: 13, tema: "Tema 13", bloque: "CIENCIAS JURÍDICAS", nombre: "DISPOSICIONES GENERALES EN MATERIA DE SEGURIDAD PRIVADA", media: 2.6 },
    { numero: 14, tema: "Tema 14", bloque: "CIENCIAS JURÍDICAS", nombre: "LA LO DE PROTECCIÓN DE LA SEGURIDAD CIUDADANA", media: 4.0 },
    { numero: 15, tema: "Tema 15", bloque: "CIENCIAS JURÍDICAS", nombre: "MEDIDAS PARA LA PROTECCIÓN DE INFRAESTRUCTURAS CRÍTICAS", media: 1.3 },
    { numero: 16, tema: "Tema 16", bloque: "CIENCIAS JURÍDICAS", nombre: "DERECHO PENAL PARTE GENERAL", media: 3.3 },
    { numero: 17, tema: "Tema 17", bloque: "CIENCIAS JURÍDICAS", nombre: "DERECHO PENAL ESPECIAL", media: 3.5 },
    { numero: 18, tema: "Tema 18", bloque: "CIENCIAS JURÍDICAS", nombre: "DELITOS CONTRA EL PATRIMONIO Y CONTRA EL ORDEN SOCIOECONÓMICO", media: 3.5 },
    { numero: 19, tema: "Tema 19", bloque: "CIENCIAS JURÍDICAS", nombre: "DELITOS CONTRA EL ORDEN PÚBLICO", media: 1.75 },
    { numero: 20, tema: "Tema 20", bloque: "CIENCIAS JURÍDICAS", nombre: "DELITOS INFORMÁTICOS", media: 2.0 },
    { numero: 21, tema: "Tema 21", bloque: "CIENCIAS JURÍDICAS", nombre: "DERECHO PROCESAL PENAL", media: 4.1 },
    { numero: 22, tema: "Tema 22", bloque: "CIENCIAS JURÍDICAS", nombre: "ESTATUTO DE LA VÍCTIMA DEL DELITO", media: 2.0 },
    { numero: 23, tema: "Tema 23", bloque: "CIENCIAS JURÍDICAS", nombre: "POLÍTICAS DE IGUALDAD, PROTECCIÓN Y NO DISCRIMINACIÓN EN LA AGE", media: 2.5 },
    { numero: 24, tema: "Tema 24", bloque: "CIENCIAS JURÍDICAS", nombre: "INTRODUCCIÓN A LA PRL", media: 0.6 },
    { numero: 25, tema: "Tema 25", bloque: "CIENCIAS JURÍDICAS", nombre: "MARCO NORMATIVO BÁSICO EN PRL", media: 2.0 },
    { numero: 26, tema: "Tema 26", bloque: "CIENCIAS JURÍDICAS", nombre: "LA PROTECCIÓN DE DATOS DE CARÁCTER PERSONAL", media: 2.5 },
    { numero: 27, tema: "Tema 27", bloque: "CIENCIAS SOCIALES", nombre: "DERECHOS HUMANOS", media: 1.8 },
    { numero: 28, tema: "Tema 28", bloque: "CIENCIAS SOCIALES", nombre: "GLOBALIZACIÓN Y ANTIGLOBALIZACIÓN", media: 1.6 },
    { numero: 29, tema: "Tema 29", bloque: "CIENCIAS SOCIALES", nombre: "ACTITUDES Y VALORES SOCIALES", media: 1.5 },
    { numero: 30, tema: "Tema 30", bloque: "CIENCIAS SOCIALES", nombre: "PRINCIPIOS ÉTICOS DE LA SOCIEDAD ACTUAL", media: 1.6 },
    { numero: 31, tema: "Tema 31", bloque: "CIENCIAS SOCIALES", nombre: "INMIGRACIÓN", media: 1.0 },
    { numero: 32, tema: "Tema 32", bloque: "CIENCIAS SOCIALES", nombre: "CONCEPTO DE GEOGRAFÍA HUMANA", media: 1.1 },
    { numero: 33, tema: "Tema 33", bloque: "CIENCIAS SOCIALES", nombre: "LA SEGURIDAD", media: 1.0 },
    { numero: 34, tema: "Tema 34", bloque: "CIENCIAS SOCIALES", nombre: "DROGODEPENDENCIAS", media: 1.8 },
    { numero: 35, tema: "Tema 35", bloque: "CIENCIAS SOCIALES", nombre: "EL DESARROLLO SOSTENIBLE", media: 1.5 },
    { numero: 36, tema: "Tema 36", bloque: "CIENCIAS SOCIALES", nombre: "GRAMÁTICA DE LA LENGUA ESPAÑOLA", media: 2.0 },
    { numero: 37, tema: "Tema 37", bloque: "CIENCIAS SOCIALES", nombre: "ORTOGRAFÍA DE LA LENGUA ESPAÑOLA", media: 1.5 },
    { numero: 38, tema: "Tema 38", bloque: "MATERIAS TÉCNICO CIENTÍFICAS", nombre: "FUNDAMENTOS DE SISTEMAS OPERATIVOS", media: 1.0 },
    { numero: 39, tema: "Tema 39", bloque: "MATERIAS TÉCNICO CIENTÍFICAS", nombre: "REDES INFORMÁTICAS", media: 1.25 },
    { numero: 40, tema: "Tema 40", bloque: "MATERIAS TÉCNICO CIENTÍFICAS", nombre: "INTELIGENCIA", media: 1.75 },
    { numero: 41, tema: "Tema 41", bloque: "MATERIAS TÉCNICO CIENTÍFICAS", nombre: "CIBERDELINCUENCIA", media: 2.6 },
    { numero: 42, tema: "Tema 42", bloque: "MATERIAS TÉCNICO CIENTÍFICAS", nombre: "ORIGEN DE LAS ARMAS DE FUEGO", media: 3.0 },
    { numero: 43, tema: "Tema 43", bloque: "MATERIAS TÉCNICO CIENTÍFICAS", nombre: "EL VEHÍCULO PRIORITARIO", media: 1.8 },
    { numero: 44, tema: "Tema 44", bloque: "MATERIAS TÉCNICO CIENTÍFICAS", nombre: "LA SEGURIDAD EN LA CONDUCCIÓN DE LOS VEHÍCULOS PRIORITARIOS", media: 1.3 },
    { numero: 45, tema: "Tema 45", bloque: "MATERIAS TÉCNICO CIENTÍFICAS", nombre: "PRL EN SEGURIDAD VIAL", media: 0.5 },
];

const MEDIA_MAXIMA = Math.max(...TEMARIO_OFICIAL.map(t => t.media));

// Peso normalizado (0-1) de un tema según su presencia histórica en el examen real.
export function getPesoNormalizado(media) {
    if (!MEDIA_MAXIMA) return 0;
    return media / MEDIA_MAXIMA;
}

// "LA CONSTITUCIÓN ESPAÑOLA I" -> "La Constitución Española I" (solo para mostrar).
export function formatNombreTema(nombre) {
    return nombre
        .toLowerCase()
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}
