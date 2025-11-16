<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) { 
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit; 
}
$user_id = $_SESSION['user_id'];
date_default_timezone_set('Europe/Madrid');

$tareas = [];
$pomodoro_count = 0;

// 1. Obtener las tareas de HOY (CURDATE() obtiene la fecha actual)
$sql_tasks = "SELECT id, texto, completada FROM tareas_semanales WHERE fecha_tarea = CURDATE() AND user_id = ? ORDER BY orden ASC";
$stmt_tasks = $conn->prepare($sql_tasks);
$stmt_tasks->bind_param("i", $user_id);
$stmt_tasks->execute();
$result_tasks = $stmt_tasks->get_result();

if ($result_tasks) {
    while ($row = $result_tasks->fetch_assoc()) {
        $row['id'] = (int)$row['id'];
        $row['completada'] = (bool)$row['completada'];
        $tareas[] = $row;
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Error al cargar tareas: ' . $conn->error]);
    $stmt_tasks->close();
    $conn->close();
    exit;
}
$stmt_tasks->close();

// 2. Obtener el conteo de pomodoros de hoy
$sql_count = "SELECT COUNT(id) as total_pomodoros FROM sesiones_estudio WHERE DATE(fecha_sesion) = CURDATE() AND user_id = ? AND tipo = 'estudio'";
$stmt_count = $conn->prepare($sql_count);
$stmt_count->bind_param("i", $user_id);
$stmt_count->execute();
$result_count = $stmt_count->get_result();

if ($result_count) {
    $pomodoro_count = (int)$result_count->fetch_assoc()['total_pomodoros'];
}
$stmt_count->close();
$conn->close();

echo json_encode(['success' => true, 'tasks' => $tareas, 'pomodoro_count' => $pomodoro_count]);
?>