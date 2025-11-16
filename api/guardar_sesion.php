<?php
include '../includes/db_config.php'; 
header('Content-Type: application/json');

date_default_timezone_set('Europe/Madrid');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}
$user_id = $_SESSION['user_id'];

$data = json_decode(file_get_contents('php://input'), true);
$duracion = $data['duracion'] ?? 0;
$tipo = $data['tipo'] ?? 'estudio'; 
$tema = $data['tema'] ?? null; // <-- ¡NUEVO!

// Si el tema está vacío, lo guardamos como NULL
if (empty($tema)) {
    $tema = null;
}

$fecha = date('Y-m-d H:i:s'); 

if ($duracion > 0) {
    // --- SQL MODIFICADO ---
    $sql = "INSERT INTO sesiones_estudio (fecha_sesion, duracion_minutos, user_id, tipo, tema) VALUES (?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    // --- TIPO DE BIND MODIFICADO ---
    $stmt->bind_param("siiss", $fecha, $duracion, $user_id, $tipo, $tema); 
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Sesión guardada']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error al guardar']);
    }
    $stmt->close();
} else {
    echo json_encode(['success' => false, 'message' => 'Duración inválida.']);
}
$conn->close();
?>