<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) { 
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit; 
}
$user_id = $_SESSION['user_id'];

$data = json_decode(file_get_contents('php://input'), true);
$task_ids = $data['task_ids'] ?? [];

if (!empty($task_ids)) {
    // Usamos una transacción para asegurarnos de que todos los cambios se aplican
    $conn->begin_transaction();
    try {
        $sql = "UPDATE tareas_semanales SET orden = ? WHERE id = ? AND user_id = ?";
        $stmt = $conn->prepare($sql);

        // Recorremos el array de IDs en el nuevo orden
        // El índice ($index) será el nuevo valor de 'orden'
        foreach ($task_ids as $index => $task_id) {
            $orden = $index + 1; // El orden empieza en 1
            $stmt->bind_param("iii", $orden, $task_id, $user_id);
            $stmt->execute();
        }
        $stmt->close();
        
        // Si todo fue bien, guardamos los cambios
        $conn->commit();
        echo json_encode(['success' => true]);
        
    } catch (Exception $e) {
        // Si algo falló, revertimos todo
        $conn->rollback();
        echo json_encode(['success' => false, 'message' => 'Error al actualizar el orden.']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'No se recibieron tareas.']);
}
$conn->close();
?>