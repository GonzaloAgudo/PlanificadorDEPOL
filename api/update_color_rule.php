<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) { exit; }
$user_id = $_SESSION['user_id'];

$data = json_decode(file_get_contents('php://input'), true);
$id = $data['id'] ?? 0;
$keyword = $data['keyword'] ?? '';
$bg_color = $data['bg_color'] ?? '';
$border_color = $data['border_color'] ?? '';

if ($id <= 0 || empty($keyword) || empty($bg_color) || empty($border_color)) {
    echo json_encode(['success' => false, 'message' => 'Datos incompletos.']);
    exit;
}

$sql = "UPDATE color_rules SET keyword = ?, bg_color = ?, border_color = ? WHERE id = ? AND user_id = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("sssii", $keyword, $bg_color, $border_color, $id, $user_id);

if ($stmt->execute()) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => 'Error al actualizar la regla.']);
}
$stmt->close();
$conn->close();
?>