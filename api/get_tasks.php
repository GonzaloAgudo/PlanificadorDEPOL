<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) { exit; } 
$user_id = $_SESSION['user_id'];

// --- Lógica para saber el día actual en Español ---
$dias_semana = [ 1 => 'Lunes', 2 => 'Martes', 3 => 'Miércoles', 4 => 'Jueves', 5 => 'Viernes', 6 => 'Sábado', 7 => 'Domingo' ];
$dia_actual = $dias_semana[date('N')];

$tareas = [];
$pomodoro_count = 0;

// 1. Obtener las tareas de hoy
$sql_tasks = "SELECT id, texto, completada FROM tareas_semanales WHERE dia_semana = ? AND user_id = ? ORDER BY orden ASC";
$stmt_tasks = $conn->prepare($sql_tasks);
$stmt_tasks->bind_param("si", $dia_actual, $user_id);
$stmt_tasks->execute();
$result_tasks = $stmt_tasks->get_result();

if ($result_tasks) {
    while ($row = $result_tasks->fetch_assoc()) {
        $row['id'] = (int)$row['id'];
        $row['completada'] = (bool)$row['completada'];
        $tareas[] = $row;
    }
}
$stmt_tasks->close();

// --- ¡CORRECCIÓN AQUÍ! ---
// 2. Obtener el conteo de pomodoros de hoy (SOLO de tipo 'estudio')
$sql_count = "SELECT COUNT(id) as total_pomodoros FROM sesiones_estudio WHERE DATE(fecha_sesion) = CURDATE() AND user_id = ? AND tipo = 'estudio'";
$stmt_count = $conn->prepare($sql_count);
$stmt_count->bind_param("i", $user_id);
$stmt_count->execute();
$result_count = $stmt_count->get_result();

if ($result_count) {
    $pomodoro_count = (int)$result_count->fetch_assoc()['total_pomodoros'];
}
$stmt_count->close();
// --- FIN DE LA CORRECCIÓN ---

$conn->close();

// Devolvemos ambas cosas
echo json_encode(['success' => true, 'tasks' => $tareas, 'pomodoro_count' => $pomodoro_count]);
?>