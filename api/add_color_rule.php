<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) { exit; }
$user_id = $_SESSION['user_id'];

$data = json_decode(file_get_contents('php://input'), true);
$keyword = $data['keyword'] ?? '';
$bg_color = $data['bg_color'] ?? '';
$border_color = $data['border_color'] ?? '';

if (empty($keyword) || empty($bg_color) || empty($border_color)) {
    echo json_encode(['success' => false, 'message' => 'Datos incompletos.']);
    exit;
}

$sql = "INSERT INTO color_rules (user_id, keyword, bg_color, border_color) VALUES (?, ?, ?, ?)";
$stmt = $conn->prepare($sql);
$stmt->bind_param("isss", $user_id, $keyword, $bg_color, $border_color);

if ($stmt->execute()) {
    $new_id = $conn->insert_id;
    echo json_encode([
        'success' => true, 
        'rule' => [
            'id' => $new_id, 
            'keyword' => $keyword, 
            'bg_color' => $bg_color, 
            'border_color' => $border_color
        ]
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Error al guardar la regla.']);
}
$stmt->close();
$conn->close();
?>