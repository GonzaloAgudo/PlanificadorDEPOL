import { db, auth } from './firebase-config.js';
import { collection, doc, writeBatch, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const collectionInput = document.getElementById('collection-name');
    const jsonInput = document.getElementById('json-data');
    const migrateBtn = document.getElementById('migrate-btn');
    const statusEl = document.getElementById('status');

    // Formulario de acceso rápido, por si la sesión no está iniciada
    const loginContainer = document.createElement('div');
    loginContainer.innerHTML = `
        <div id="quick-login" class="card" style="margin-bottom: 24px;">
            <div class="card__body">
                <p class="section-label">Acceso rápido</p>
                <div class="field-row">
                    <input type="email" id="mig-email" class="input" placeholder="Correo electrónico">
                    <input type="password" id="mig-pass" class="input" placeholder="Contraseña">
                    <button id="mig-login-btn" class="btn btn--secondary">Entrar</button>
                </div>
            </div>
        </div>
    `;

    const mainEl = document.querySelector('main');
    const header = mainEl.querySelector('.page-header');
    if (header) header.insertAdjacentElement('afterend', loginContainer);
    else mainEl.prepend(loginContainer);

    document.getElementById('mig-login-btn').addEventListener('click', () => {
        const email = document.getElementById('mig-email').value;
        const password = document.getElementById('mig-pass').value;
        signInWithEmailAndPassword(auth, email, password)
            .then(user => alert(`¡Logueado como ${user.user.email}!`))
            .catch(e => alert(`Error login: ${e.message}`));
    });

    let currentUser = null;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            statusEl.textContent = `Sesión iniciada como ${user.email} (UID: ${user.uid})`;
            statusEl.style.color = '#1f6f4a';
            migrateBtn.disabled = false;
            document.getElementById('quick-login').style.display = 'none';
        } else {
            statusEl.textContent = 'Sin sesión iniciada. Usa el formulario de acceso rápido.';
            statusEl.style.color = '#9b2c2c';
            migrateBtn.disabled = true;
            document.getElementById('quick-login').style.display = 'block';
        }
    });

    migrateBtn.addEventListener('click', async () => {
        const collectionName = collectionInput.value.trim();
        const jsonText = jsonInput.value.trim();

        if (!collectionName || !jsonText || !currentUser) {
            alert('Faltan datos o no estás logueado.');
            return;
        }

        let data = [];
        try {
            const parsed = JSON.parse(jsonText);
            
            // Lógica para formato phpMyAdmin
            if (Array.isArray(parsed)) {
                const tableData = parsed.find(item => item.type === 'table' && Array.isArray(item.data));
                if (tableData) {
                    data = tableData.data;
                } else {
                    // Es un array simple (como el que te pegué yo)
                    data = parsed;
                }
            } else if (typeof parsed === 'object') {
                const keys = Object.keys(parsed);
                if (keys.length === 1 && Array.isArray(parsed[keys[0]])) {
                    data = parsed[keys[0]];
                }
            }

        } catch (e) {
            statusEl.textContent = 'Error al leer el JSON: ' + e.message;
            return;
        }
        
        if (!data || data.length === 0) {
             statusEl.textContent = 'El JSON está vacío o no contiene datos válidos.';
             return;
        }

        statusEl.textContent = `Preparando ${data.length} documentos…`;
        migrateBtn.disabled = true;

        try {
            const batchSize = 450;
            let batches = [];
            let currentBatch = writeBatch(db);
            let operationCounter = 0;

            data.forEach((item, index) => {
                
                // --- ¡CORRECCIÓN DE TIPOS DE DATOS! ---
                if (item.duracion_minutos) {
                    item.duracion_minutos = parseInt(item.duracion_minutos, 10);
                }
                if (item.orden) {
                    item.orden = parseInt(item.orden, 10);
                }
                if (item.completada) {
                    item.completada = !!item.completada; // Convierte a booleano
                }
                // --- FIN DE LA CORRECCIÓN ---

                // Corregir formato de fecha
                if (item.fecha_sesion && typeof item.fecha_sesion === 'string') {
                    const safeDate = item.fecha_sesion.replace(" ", "T");
                    item.fecha_sesion = Timestamp.fromDate(new Date(safeDate));
                }
                
                item.user_id = currentUser.uid; 
                if (item.id) delete item.id; 

                const docRef = doc(collection(db, collectionName)); 
                currentBatch.set(docRef, item);
                operationCounter++;

                if (operationCounter === batchSize || index === data.length - 1) {
                    batches.push(currentBatch.commit());
                    currentBatch = writeBatch(db); 
                    operationCounter = 0;
                }
            });

            statusEl.textContent = `Enviando ${batches.length} lotes a Firestore…`;
            
            await Promise.all(batches);

            statusEl.textContent = `Listo: ${data.length} documentos migrados a '${collectionName}'.`;
            statusEl.style.color = '#1f6f4a';
            jsonInput.value = '';
            
        } catch (e) {
            console.error(e);
            statusEl.textContent = 'Error de Firestore: ' + e.message;
            statusEl.style.color = '#9b2c2c';
        }
        
        migrateBtn.disabled = false;
    });
});