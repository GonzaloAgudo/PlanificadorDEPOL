<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) { exit; }
$user_id = $_SESSION['user_id'];

$data = json_decode(file_get_contents('php://input'), true);
$texto = $data['text'] ?? '';
$fecha = $data['date'] ?? ''; // <-- Ahora recibe una fecha (ej: '2025-11-17')

if (!empty($texto) && !empty($fecha)) {
    // Calcular el 'orden'
    $sql_max = "SELECT MAX(orden) as max_orden FROM tareas_semanales WHERE user_id = ? AND fecha_tarea = ?";
    $stmt_max = $conn->prepare($sql_max);
    $stmt_max->bind_param("is", $user_id, $fecha);
    $stmt_max->execute();
    $new_orden = ($stmt_max->get_result()->fetch_assoc()['max_orden'] ?? 0) + 1;
    $stmt_max->close();

    // Insertar con la fecha exacta
    $sql = "INSERT INTO tareas_semanales (fecha_tarea, texto, completada, user_id, orden) VALUES (?, ?, FALSE, ?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ssii", $fecha, $texto, $user_id, $new_orden);
    
    if ($stmt->execute()) {
        $new_id = $conn->insert_id;
        echo json_encode(['success' => true, 'task' => ['id' => $new_id, 'texto' => $texto, 'fecha_tarea' => $fecha, 'completada' => false]]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error al guardar la tarea']);
    }
    $stmt->close();
} else {
    echo json_encode(['success' => false, 'message' => 'Faltan datos (fecha o texto)']);
}
$conn->close();
?>