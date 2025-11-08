<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) { 
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit; 
}
$user_id = $_SESSION['user_id'];

$rules = [];
$sql = "SELECT id, keyword, bg_color, border_color FROM color_rules WHERE user_id = ? ORDER BY keyword ASC";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

while ($row = $result->fetch_assoc()) {
    $rules[] = $row;
}

echo json_encode(['success' => true, 'rules' => $rules]);
$stmt->close();
$conn->close();
?>