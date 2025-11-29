import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, query, where, onSnapshot, 
    doc, updateDoc, deleteDoc, orderBy, limit, getDocs, writeBatch, setDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const tableHead = document.getElementById('table-header-row');
const tableBody = document.getElementById('progress-body');
const addRowBtn = document.getElementById('add-row-btn');
const addColBtn = document.getElementById('add-col-btn');
const loadingMsg = document.getElementById('loading-msg');

// Estado local
let dynamicColumns = []; 
let rowsData = [];       

const STATUS_OPTIONS = {
    'sin_empezar': { label: 'Sin empezar', color: '#e0e0e0', text: '#37352f' },
    'leido': { label: 'Leído', color: '#e3f2fd', text: '#0d47a1' },
    'leido_subrayado': { label: 'Leído y subr.', color: '#ffebee', text: '#c62828' },
    'estudiado': { label: 'Estudiado', color: '#f3e5f5', text: '#6a1b9a' },
    'repasado': { label: 'Repasado', color: '#fff8e1', text: '#f57f17' },
    'listo': { label: 'Listo', color: '#e8f5e9', text: '#1b5e20' }
};

// =======================================================
// 1. GESTIÓN DE COLUMNAS (CONFIGURACIÓN)
// =======================================================

async function loadConfig() {
    if (!auth.currentUser) return;
    const configRef = doc(db, "config_progreso", auth.currentUser.uid);

    onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) {
            dynamicColumns = docSnap.data().columns || [];
        } else {
            dynamicColumns = [
                { id: 'c_' + Date.now(), name: '1ª Lectura' },
                { id: 'c_' + (Date.now()+1), name: 'Esquema' }
            ];
            setDoc(configRef, { columns: dynamicColumns });
        }
        renderTable(); 
    });
}

async function addColumn() {
    const name = prompt("Nombre de la nueva columna (ej. 'Repaso Oral'):");
    if (!name) return;

    const newCol = { id: 'c_' + Date.now(), name: name };
    dynamicColumns.push(newCol);
    
    // 1. Guardar la nueva columna
    await saveColumnsConfig();
    
    // 2. Recalcular porcentajes de TODAS las filas (porque ahora el 100% es diferente)
    await recalculateAllDomains();
}

async function renameColumn(colId) {
    const col = dynamicColumns.find(c => c.id === colId);
    const newName = prompt("Nuevo nombre para la columna:", col.name);
    if (newName && newName !== col.name) {
        col.name = newName;
        await saveColumnsConfig();
    }
}

async function deleteColumn(colId) {
    if(!confirm("¿Borrar esta columna y sus datos?")) return;
    dynamicColumns = dynamicColumns.filter(c => c.id !== colId);
    
    // 1. Guardar la nueva configuración
    await saveColumnsConfig();

    // 2. Recalcular porcentajes (ahora hay menos columnas, el % sube)
    await recalculateAllDomains();
}

async function saveColumnsConfig() {
    const configRef = doc(db, "config_progreso", auth.currentUser.uid);
    await updateDoc(configRef, { columns: dynamicColumns });
}

// --- FUNCIÓN NUEVA: RECALCULAR TODO EL DOMINIO ---
async function recalculateAllDomains() {
    if (rowsData.length === 0) return;
    
    const batch = writeBatch(db);
    const totalCols = dynamicColumns.length;
    let updatesCount = 0;

    rowsData.forEach(row => {
        const checks = row.checks || {};
        // Contamos cuántos checks activos coinciden con las columnas que EXISTEN actualmente
        const checkedCount = dynamicColumns.filter(col => checks[col.id]).length;
        
        const nuevoDominio = totalCols === 0 ? 0 : Math.round((checkedCount / totalCols) * 100);

        // Si el porcentaje ha cambiado, lo añadimos a la actualización
        if (row.dominio !== nuevoDominio) {
            const rowRef = doc(db, "progreso_temario", row.id);
            batch.update(rowRef, { dominio: nuevoDominio });
            updatesCount++;
        }
    });

    if (updatesCount > 0) {
        await batch.commit();
        console.log(`Recalculados ${updatesCount} temas.`);
    }
}

// =======================================================
// 2. GESTIÓN DE DATOS (FILAS)
// =======================================================

function loadData() {
    if (!auth.currentUser) return;
    const q = query(
        collection(db, "progreso_temario"),
        where("user_id", "==", auth.currentUser.uid),
        orderBy("orden", "asc")
    );

    onSnapshot(q, (snapshot) => {
        loadingMsg.style.display = 'none';
        // Guardamos los datos en memoria para poder usarlos en recalculateAllDomains
        rowsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTable();
    });
}

async function addRow() {
    if (!auth.currentUser) return;
    const maxOrden = rowsData.length > 0 ? Math.max(...rowsData.map(r => r.orden)) : 0;
    
    try {
        await addDoc(collection(db, "progreso_temario"), {
            user_id: auth.currentUser.uid,
            orden: maxOrden + 1,
            tema: `Tema ${maxOrden + 1}`,
            estado: 'sin_empezar',
            dominio: 0,
            checks: {}, 
            comentarios: ''
        });
    } catch (e) { console.error(e); }
}

async function updateRow(id, field, value) {
    const rowRef = doc(db, "progreso_temario", id);
    await updateDoc(rowRef, { [field]: value });
}

async function updateCheck(id, colId, isChecked) {
    const row = rowsData.find(r => r.id === id);
    const currentChecks = row.checks || {};
    
    currentChecks[colId] = isChecked;
    
    // Calcular dominio solo para esta fila (más rápido)
    const totalCols = dynamicColumns.length;
    const checkedCount = dynamicColumns.filter(c => currentChecks[c.id]).length;
    const nuevoDominio = totalCols === 0 ? 0 : Math.round((checkedCount / totalCols) * 100);

    const rowRef = doc(db, "progreso_temario", id);
    await updateDoc(rowRef, { 
        [`checks.${colId}`]: isChecked,
        dominio: nuevoDominio
    });
}

async function deleteRow(id) {
    if(confirm("¿Eliminar tema?")) await deleteDoc(doc(db, "progreso_temario", id));
}

// =======================================================
// 3. RENDERIZADO (VISUAL)
// =======================================================

function renderTable() {
    // 1. Renderizar Cabeceras
    let headerHTML = `
        <th style="width: 200px;">Tema</th>
        <th style="width: 140px;">Estado</th>
        <th style="width: 80px;">Dominio</th>
    `;
    
    dynamicColumns.forEach(col => {
        headerHTML += `
            <th class="th-dynamic" data-col-id="${col.id}">
                <div class="col-header-content">
                    <span class="col-name">${col.name}</span>
                    <button class="btn-del-col" title="Borrar columna">×</button>
                </div>
            </th>
        `;
    });

    headerHTML += `<th style="width: 200px;">Comentarios</th><th style="width: 40px;"></th>`;
    tableHead.innerHTML = headerHTML;

    tableHead.querySelectorAll('.col-name').forEach(span => {
        span.addEventListener('click', (e) => {
            const colId = e.target.closest('th').dataset.colId;
            renameColumn(colId);
        });
    });
    tableHead.querySelectorAll('.btn-del-col').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            const colId = e.target.closest('th').dataset.colId;
            deleteColumn(colId);
        });
    });

    // 2. Renderizar Filas
    tableBody.innerHTML = '';
    rowsData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'progress-row';
        tr.setAttribute('data-id', row.id);

        let optionsHTML = '';
        for (const [key, val] of Object.entries(STATUS_OPTIONS)) {
            const selected = row.estado === key ? 'selected' : '';
            optionsHTML += `<option value="${key}" ${selected}>${val.label}</option>`;
        }
        const currStyle = STATUS_OPTIONS[row.estado || 'sin_empezar'];
        const selectStyle = `background-color: ${currStyle.color}; color: ${currStyle.text};`;

        const dom = row.dominio || 0;
        let barColor = dom === 100 ? '#4caf50' : '#2196f3'; 

        let rowHTML = `
            <td><input type="text" class="notion-input input-tema" value="${row.tema || ''}"></td>
            <td><select class="select-status" style="${selectStyle}">${optionsHTML}</select></td>
            <td>
                <div class="dominio-bar-container" title="${dom}%">
                    <div class="dominio-bar-fill" style="width: ${dom}%; background-color: ${barColor};"></div>
                    <span class="dominio-text">${dom}%</span>
                </div>
            </td>
        `;

        dynamicColumns.forEach(col => {
            const isChecked = row.checks && row.checks[col.id] ? 'checked' : '';
            rowHTML += `
                <td class="td-center">
                    <input type="checkbox" class="check-dynamic" data-col-id="${col.id}" ${isChecked}>
                </td>
            `;
        });

        rowHTML += `
            <td><input type="text" class="notion-input input-coments" value="${row.comentarios || ''}" placeholder="..."></td>
            <td class="td-center"><button class="btn-icon-del">🗑️</button></td>
        `;

        tr.innerHTML = rowHTML;

        tr.querySelector('.input-tema').addEventListener('change', (e) => updateRow(row.id, 'tema', e.target.value));
        tr.querySelector('.input-coments').addEventListener('change', (e) => updateRow(row.id, 'comentarios', e.target.value));
        tr.querySelector('.btn-icon-del').addEventListener('click', () => deleteRow(row.id));
        
        const select = tr.querySelector('.select-status');
        select.addEventListener('change', (e) => {
            updateRow(row.id, 'estado', e.target.value);
            const style = STATUS_OPTIONS[e.target.value];
            select.style.backgroundColor = style.color;
            select.style.color = style.text;
        });

        tr.querySelectorAll('.check-dynamic').forEach(chk => {
            chk.addEventListener('change', (e) => {
                updateCheck(row.id, e.target.dataset.colId, e.target.checked);
            });
        });

        tableBody.appendChild(tr);
    });
}

// --- INIT ---
addRowBtn.addEventListener('click', addRow);
addColBtn.addEventListener('click', addColumn);

new Sortable(tableBody, {
    animation: 150,
    handle: '.input-tema', 
    onEnd: async function (evt) {
        const itemIds = Array.from(tableBody.querySelectorAll('tr')).map(el => el.dataset.id);
        const batch = writeBatch(db);
        itemIds.forEach((id, index) => {
            batch.update(doc(db, "progreso_temario", id), { orden: index + 1 });
        });
        await batch.commit();
    }
});

auth.onAuthStateChanged(user => {
    if (user) {
        loadConfig(); 
        loadData();   
    } else window.location.href = 'login.html';
});