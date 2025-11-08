<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) { exit; }
$user_id = $_SESSION['user_id'];

$data = json_decode(file_get_contents('php://input'), true);
$texto = $data['text'] ?? '';
$fecha = $data['date'] ?? ''; 

if (!empty($texto) && !empty($fecha)) {
    $sql = "INSERT INTO calendario_eventos (fecha_evento, texto_evento, user_id) VALUES (?, ?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ssi", $fecha, $texto, $user_id);
    // ... (el resto del if/else es igual) ...
    if ($stmt->execute()) {
        $new_id = $conn->insert_id;
        echo json_encode(['success' => true, 'evento' => ['id' => $new_id, 'fecha_evento' => $fecha, 'texto_evento' => $texto]]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error al guardar el evento']);
    }
    $stmt->close();
}
$conn->close();
?>