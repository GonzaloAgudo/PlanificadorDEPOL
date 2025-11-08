<?php
session_start(); // Unirse a la sesión
session_unset(); // Borrar todas las variables de sesión
session_destroy(); // Destruir la sesión

// Redirigir a la página de login
header('Location: login.html');
exit;
?>