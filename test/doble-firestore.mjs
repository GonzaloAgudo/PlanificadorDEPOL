/**
 * Doble de prueba de Cloud Firestore.
 *
 * Reproduce la parte del SDK que usa recomendaciones.js: construir una
 * consulta con filtros de igualdad y recorrer el resultado. Los datos los
 * inyecta la prueba mediante cargarDatos(), lo que permite ejercitar el
 * motor de recomendaciones sin red, sin cuenta y de forma determinista.
 */

let almacen = {};

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
            if (f.operador !== '==') {
                throw new Error(`Operador no contemplado en el doble: ${f.operador}`);
            }
            return doc[f.campo] === f.valor;
        })
    );

    return {
        forEach(fn) {
            documentos.forEach(doc => fn({ data: () => doc }));
        }
    };
}
