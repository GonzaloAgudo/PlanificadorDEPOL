<?php
// ¡¡INICIA LA SESIÓN EN TODA LA APP!!
session_start();

// --- Tu configuración de antes ---
define('DB_HOST', 'fdb1031.runhosting.com'); 
define('DB_USER', '4480107_pomodoro');       
define('DB_NAME', '4480107_pomodoro');       
define('DB_PORT', 3306);                     
define('DB_PASS', 'Rata12345');
// ------------------------------------

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);

if ($conn->connect_error) {
    die("Conexión fallida: " . $conn->connect_error);
}

$conn->set_charset("utf8mb4");

// No pongas header('Content-Type: application/json'); aquí
// Lo pondremos en cada archivo de la API individualmente.
?>