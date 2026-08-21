/**
 * Avisos y diálogos propios de la aplicación.
 *
 * Sustituye a alert(), confirm() y prompt() del navegador, que bloquean la
 * página, no se pueden estilar y delatan que se trata de una web casera.
 *
 *   toast('Sesión guardada');
 *   if (await confirmDialog({ ... })) { ... }
 *   const nombre = await promptDialog({ ... });
 *   const datos = await formDialog({ ... });
 */

const ICON = {
    success: '<polyline points="20 6 9 17 4 12"/>',
    error: '<circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    warning: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/>',
    info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12" y2="8"/>'
};

function svg(paths, cls = 'icon') {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
        `stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------------ */
/*  Avisos flotantes                                                   */
/* ------------------------------------------------------------------ */

let toastHost = null;

function getToastHost() {
    if (!toastHost || !document.body.contains(toastHost)) {
        toastHost = document.createElement('div');
        toastHost.className = 'toast-host';
        toastHost.setAttribute('role', 'status');
        toastHost.setAttribute('aria-live', 'polite');
        document.body.appendChild(toastHost);
    }
    return toastHost;
}

/**
 * Muestra un aviso flotante que desaparece solo.
 * @param {string} message
 * @param {{type?: 'info'|'success'|'error'|'warning', duration?: number}} options
 */
export function toast(message, options = {}) {
    const { type = 'info', duration = 4200 } = options;
    const host = getToastHost();

    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `
        <span class="toast__icon">${svg(ICON[type] || ICON.info, 'icon icon--sm')}</span>
        <span class="toast__msg">${escapeHtml(message)}</span>
        <button class="toast__close" aria-label="Cerrar aviso">
            ${svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 'icon icon--sm')}
        </button>
    `;

    const remove = () => {
        if (!el.isConnected) return;
        el.classList.add('is-leaving');
        setTimeout(() => el.remove(), 180);
    };

    el.querySelector('.toast__close').addEventListener('click', remove);
    host.appendChild(el);
    if (duration > 0) setTimeout(remove, duration);

    return remove;
}

/* ------------------------------------------------------------------ */
/*  Diálogos                                                           */
/* ------------------------------------------------------------------ */

/**
 * Diálogo genérico con campos. Es la base de confirmDialog y promptDialog.
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.message]        Texto explicativo (admite saltos de línea)
 * @param {Array}  [opts.fields]         [{ name, label, type, value, placeholder, hint, autocomplete }]
 * @param {string} [opts.confirmText]
 * @param {string} [opts.cancelText]
 * @param {boolean}[opts.danger]         Da estilo destructivo al botón principal
 * @param {Function}[opts.validate]      (valores) => boolean. Si se define, el
 *                                       botón principal solo se activa si devuelve true
 * @returns {Promise<object|null>} Los valores de los campos, o null si se cancela
 */
export function formDialog(opts) {
    const {
        title,
        message = '',
        fields = [],
        confirmText = 'Aceptar',
        cancelText = 'Cancelar',
        danger = false,
        validate = null
    } = opts;

    return new Promise(resolve => {
        const previousFocus = document.activeElement;

        const overlay = document.createElement('div');
        overlay.className = 'ui-dialog-overlay';

        const fieldsHtml = fields.map(f => {
            const id = `ui-field-${f.name}`;
            const common = `id="${id}" name="${escapeHtml(f.name)}" class="input"` +
                (f.placeholder ? ` placeholder="${escapeHtml(f.placeholder)}"` : '') +
                (f.autocomplete ? ` autocomplete="${escapeHtml(f.autocomplete)}"` : '');
            const control = f.type === 'textarea'
                ? `<textarea ${common} rows="3">${escapeHtml(f.value || '')}</textarea>`
                : `<input type="${escapeHtml(f.type || 'text')}" ${common} value="${escapeHtml(f.value || '')}">`;
            return `
                <div class="field">
                    <label class="field__label" for="${id}">${escapeHtml(f.label || '')}</label>
                    ${control}
                    ${f.hint ? `<p class="field__hint">${f.hint}</p>` : ''}
                </div>`;
        }).join('');

        overlay.innerHTML = `
            <div class="ui-dialog" role="dialog" aria-modal="true" aria-labelledby="ui-dialog-title">
                <div class="ui-dialog__head">
                    <h2 id="ui-dialog-title">${escapeHtml(title)}</h2>
                </div>
                <form class="ui-dialog__body">
                    ${message ? `<p class="ui-dialog__msg">${message}</p>` : ''}
                    ${fieldsHtml}
                </form>
                <div class="ui-dialog__foot">
                    <button type="button" class="btn btn--secondary" data-act="cancel">${escapeHtml(cancelText)}</button>
                    <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-act="ok">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.classList.add('has-dialog');

        const form = overlay.querySelector('form');
        const okBtn = overlay.querySelector('[data-act="ok"]');
        const cancelBtn = overlay.querySelector('[data-act="cancel"]');
        const inputs = [...form.querySelectorAll('input, textarea')];

        const values = () => {
            const out = {};
            inputs.forEach(i => { out[i.name] = i.value; });
            return out;
        };

        const refresh = () => {
            if (typeof validate === 'function') okBtn.disabled = !validate(values());
        };

        const close = (result) => {
            document.removeEventListener('keydown', onKey, true);
            overlay.remove();
            document.body.classList.remove('has-dialog');
            if (previousFocus && previousFocus.focus) previousFocus.focus();
            resolve(result);
        };

        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); close(null); }
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !okBtn.disabled) {
                e.preventDefault();
                close(values());
            }
        };

        okBtn.addEventListener('click', () => close(values()));
        cancelBtn.addEventListener('click', () => close(null));
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });
        inputs.forEach(i => i.addEventListener('input', refresh));
        document.addEventListener('keydown', onKey, true);

        refresh();
        setTimeout(() => { (inputs[0] || okBtn).focus(); if (inputs[0]) inputs[0].select(); }, 20);
    });
}

/**
 * Pregunta de sí o no. Sustituye a confirm().
 * @returns {Promise<boolean>}
 */
export async function confirmDialog(opts) {
    const res = await formDialog({
        confirmText: 'Confirmar',
        ...opts,
        fields: []
    });
    return res !== null;
}

/**
 * Pide un texto. Sustituye a prompt().
 * @returns {Promise<string|null>} El texto, o null si se cancela
 */
export async function promptDialog(opts) {
    const {
        title,
        label = '',
        value = '',
        placeholder = '',
        confirmText = 'Guardar',
        multiline = false,
        required = true,
        message = ''
    } = opts;

    const res = await formDialog({
        title,
        message,
        confirmText,
        fields: [{ name: 'value', label, value, placeholder, type: multiline ? 'textarea' : 'text' }],
        validate: required ? (v) => v.value.trim().length > 0 : null
    });

    return res === null ? null : res.value.trim();
}
