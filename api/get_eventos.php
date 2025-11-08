<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) { exit; }
$user_id = $_SESSION['user_id'];

$month = intval($_GET['month'] ?? 0);
$year = intval($_GET['year'] ?? 0);

if ($month > 0 && $year > 0) {
    $eventos = [];
    $sql = "SELECT id, fecha_evento, texto_evento FROM calendario_eventos 
            WHERE MONTH(fecha_evento) = ? AND YEAR(fecha_evento) = ? AND user_id = ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("iii", $month, $year, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    // ... (el resto del if/else es igual) ...
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $row['id'] = (int)$row['id'];
            $eventos[] = $row;
        }
        echo json_encode(['success' => true, 'eventos' => $eventos]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Error al consultar eventos']);
    }
    $stmt->close();
}
$conn->close();
?>