<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) { 
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit; 
}
$user_id = $_SESSION['user_id'];
date_default_timezone_set('Europe/Madrid'); // Asegura la zona horaria

$data = json_decode(file_get_contents('php://input'), true);
$texto = $data['text'] ?? '';

if (!empty($texto)) {
    
    // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
    // Obtiene la fecha de HOY (ej: "2025-11-15") en lugar del nombre "Sábado"
    $fecha_actual = date('Y-m-d');

    // 1. Calcular el 'orden' para la fecha de hoy
    $sql_max = "SELECT MAX(orden) as max_orden FROM tareas_semanales WHERE user_id = ? AND fecha_tarea = ?";
    $stmt_max = $conn->prepare($sql_max);
    $stmt_max->bind_param("is", $user_id, $fecha_actual);
    $stmt_max->execute();
    $new_orden = ($stmt_max->get_result()->fetch_assoc()['max_orden'] ?? 0) + 1;
    $stmt_max->close();

    // 2. Insertar usando la columna 'fecha_tarea'
    $sql = "INSERT INTO tareas_semanales (fecha_tarea, texto, completada, user_id, orden) VALUES (?, ?, FALSE, ?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ssii", $fecha_actual, $texto, $user_id, $new_orden);
    
    if ($stmt->execute()) {
        $new_id = $conn->insert_id;
        // Devuelve el objeto de la tarea para que 'pomodoro.js' pueda dibujarla
        echo json_encode(['success' => true, 'task' => ['id' => $new_id, 'texto' => $texto, 'completada' => false, 'fecha_tarea' => $fecha_actual]]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error al guardar la tarea.']);
    }
    $stmt->close();
} else {
    echo json_encode(['success' => false, 'message' => 'El texto no puede estar vacío.']);
}
$conn->close();
?>