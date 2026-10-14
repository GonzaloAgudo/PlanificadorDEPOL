/**
 * Doble de prueba de Cloud Firestore.
 *
 * Reproduce la parte del SDK que usan recomendaciones.js y convocatorias.js:
 * construir una consulta con filtros de igualdad o de rango, recorrer el
 * resultado y representar fechas con Timestamp. Los datos los
 * inyecta la prueba mediante cargarDatos(), lo que permite ejercitar el
 * motor de recomendaciones sin red, sin cuenta y de forma determinista.
 */

let almacen = {};

/** Equivalente mínimo del Timestamp de Firestore. */
export class Timestamp {
    constructor(milisegundos) { this.milisegundos = milisegundos; }
    static fromDate(fecha) { return new Timestamp(fecha.getTime()); }
    toMillis() { return this.milisegundos; }
    toDate() { return new Date(this.milisegundos); }
}

// Las fechas se comparan por su instante; el resto de valores, tal cual
const comparable = v => (v instanceof Timestamp ? v.toMillis() : v);

const OPERADORES = {
    '==': (a, b) => a === b,
    '<': (a, b) => a < b,
    '<=': (a, b) => a <= b,
    '>': (a, b) => a > b,
    '>=': (a, b) => a >= b
};

export function cargarDatos(datos) {
    almacen = datos;
}

export function collection(_db, nombre) {
    return { nombre };
}

export function where(campo, operador, valor) {
    return { campo, operador, valor };
}

export function query(col, ...filtros) {
    return { coleccion: col.nombre, filtros };
}

export async function getDocs(q) {
    const documentos = (almacen[q.coleccion] || []).filter(doc =>
        q.filtros.every(f => {
            const cumple = OPERADORES[f.operador];
            if (!cumple) {
                throw new Error(`Operador no contemplado en el doble: ${f.operador}`);
            }
            // Como en Firestore, un documento sin el campo no cumple el filtro
            if (!(f.campo in doc)) return false;
            return cumple(comparable(doc[f.campo]), comparable(f.valor));
        })
    );

    return {
        forEach(fn) {
            documentos.forEach((doc, i) => fn({ id: doc.id || `doc-${i}`, data: () => doc }));
        }
    };
}
