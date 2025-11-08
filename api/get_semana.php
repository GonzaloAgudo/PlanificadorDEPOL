<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) { exit; }
$user_id = $_SESSION['user_id'];

$tareas = [];
// --- CAMBIO AQUÍ ---
$sql = "SELECT id, dia_semana, texto, completada 
        FROM tareas_semanales 
        WHERE user_id = ?
        ORDER BY FIELD(dia_semana, 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'), orden ASC";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $user_id);
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