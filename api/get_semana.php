<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) { exit; }
$user_id = $_SESSION['user_id'];

// Recibe la fecha de inicio (Lunes) y fin (Domingo) de la semana
$start_date = $_GET['start'] ?? '';
$end_date = $_GET['end'] ?? '';

if (empty($start_date) || empty($end_date)) {
    echo json_encode(['success' => false, 'message' => 'Fechas no proporcionadas']);
    exit;
}

$tareas = [];
// Busca tareas DENTRO de ese rango de fechas
$sql = "SELECT id, fecha_tarea, texto, completada 
        FROM tareas_semanales 
        WHERE user_id = ? AND fecha_tarea BETWEEN ? AND ?
        ORDER BY fecha_tarea ASC, orden ASC";

$stmt = $conn->prepare($sql);
$stmt->bind_param("iss", $user_id, $start_date, $end_date);
$stmt->execute();
$result = $stmt->get_result();

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $row['id'] = (int)$row['id'];
        $row['completada'] = (bool)$row['completada'];
        $tareas[] = $row;
    }
    echo json_encode(['success' => true, 'tasks' => $tareas]);
} else {
    echo json_encode(['success' => false, 'message' => 'Error al consultar tareas']);
}
$conn->close();
?>