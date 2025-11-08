<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) { exit; }
$user_id = $_SESSION['user_id'];

$dias_semana = [ 1 => 'Lunes', 2 => 'Martes', 3 => 'Miércoles', 4 => 'Jueves', 5 => 'Viernes', 6 => 'Sábado', 7 => 'Domingo' ];
$dia_actual = $dias_semana[date('N')];
$data = json_decode(file_get_contents('php://input'), true);
$texto = $data['text'] ?? '';

if (!empty($texto)) {
    // --- NUEVA LÓGICA DE ORDEN ---
    $sql_max = "SELECT MAX(orden) as max_orden FROM tareas_semanales WHERE user_id = ? AND dia_semana = ?";
    $stmt_max = $conn->prepare($sql_max);
    $stmt_max->bind_param("is", $user_id, $dia_actual);
    $stmt_max->execute();
    $new_orden = ($stmt_max->get_result()->fetch_assoc()['max_orden'] ?? 0) + 1;
    $stmt_max->close();
    // --- FIN LÓGICA DE ORDEN ---

    // --- SQL MODIFICADO ---
    $sql = "INSERT INTO tareas_semanales (texto, dia_semana, completada, user_id, orden) VALUES (?, ?, FALSE, ?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ssii", $texto, $dia_actual, $user_id, $new_orden);
    
    if ($stmt->execute()) {
        $new_id = $conn->insert_id;
        echo json_encode(['success' => true, 'task' => ['id' => $new_id, 'texto' => $texto, 'completada' => false]]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error al guardar la tarea']);
    }
    $stmt->close();
}
$conn->close();
?>