<?php
// Este archivo se incluirá en index.php, stats.php, etc.
session_start();

// Si no existe la variable de sesión 'user_id', redirige a login
if (!isset($_SESSION['user_id'])) {
    header('Location: login.html');
    exit;
}

// Si sí existe, guardamos el ID para usarlo en las consultas
$user_id = $_SESSION['user_id'];
?>