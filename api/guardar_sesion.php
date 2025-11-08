<?php
include '../includes/db_config.php'; // Inicia sesión
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}
$user_id = $_SESSION['user_id'];

$data = json_decode(file_get_contents('php://input'), true);
$duracion = $data['duracion'] ?? 0;
$tipo = $data['tipo'] ?? 'estudio'; // <-- ¡NUEVO!
$fecha = date('Y-m-d H:i:s'); 

if ($duracion > 0) {
    // --- SQL MODIFICADO ---
    $sql = "INSERT INTO sesiones_estudio (fecha_sesion, duracion_minutos, user_id, tipo) VALUES (?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    // --- TIPO DE BIND MODIFICADO ---
    $stmt->bind_param("siis", $fecha, $duracion, $user_id, $tipo); 
    
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