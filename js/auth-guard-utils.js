/**
 * Ayudas de autenticación compartidas.
 *
 * Va en un módulo aparte de auth-guard.js a propósito: ese se ejecuta al
 * importarlo y redirige, así que la pantalla de verificación no puede
 * importarlo sin entrar en un bucle de redirecciones.
 */

/**
 * ¿Hay que exigir a este usuario que verifique su correo?
 *
 * Las cuentas de Google llegan verificadas por el propio proveedor, así que
 * la verificación solo se pide a quien entra con correo y contraseña.
 */
export function necesitaVerificar(user) {
    if (!user) return false;
    if (user.emailVerified) return false;
    return user.providerData.some(p => p.providerId === 'password');
}
