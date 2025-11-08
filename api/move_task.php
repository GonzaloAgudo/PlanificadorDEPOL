<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) { 
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit; 
}
$user_id = $_SESSION['user_id'];

$data = json_decode(file_get_contents('php://input'), true);

$task_id = $data['task_id'] ?? 0;
$new_day = $data['new_day'] ?? '';
$source_list_ids = $data['source_list_ids'] ?? [];
$dest_list_ids = $data['dest_list_ids'] ?? [];

if ($task_id > 0 && !empty($new_day)) {
    // Usamos una transacción para asegurar que todo salga bien
    $conn->begin_transaction();
    try {
        
        // 1. Actualizar el día de la tarea movida
        $sql_move = "UPDATE tareas_semanales SET dia_semana = ? WHERE id = ? AND user_id = ?";
        $stmt_move = $conn->prepare($sql_move);
        $stmt_move->bind_param("sii", $new_day, $task_id, $user_id);
        $stmt_move->execute();
        $stmt_move->close();

        // 2. Reordenar la lista de ORIGEN (la que ha perdido la tarea)
        $sql_order_source = "UPDATE tareas_semanales SET orden = ? WHERE id = ? AND user_id = ?";
        $stmt_source = $conn->prepare($sql_order_source);
        foreach ($source_list_ids as $index => $id) {
            $orden = $index + 1;
            $stmt_source->bind_param("iii", $orden, $id, $user_id);
            $stmt_source->execute();
        }
        $stmt_source->close();

        // 3. Reordenar la lista de DESTINO (la que ha ganado la tarea)
        $sql_order_dest = "UPDATE tareas_semanales SET orden = ? WHERE id = ? AND user_id = ?";
        $stmt_dest = $conn->prepare($sql_order_dest);
        foreach ($dest_list_ids as $index => $id) {
            $orden = $index + 1;
            $stmt_dest->bind_param("iii", $orden, $id, $user_id);
            $stmt_dest->execute();
        }
        $stmt_dest->close();

        // Si todo fue bien, guardamos
        $conn->commit();
        echo json_encode(['success' => true]);
        
    } catch (Exception $e) {
        // Si algo falló, revertimos
        $conn->rollback();
        echo json_encode(['success' => false, 'message' => 'Error al mover la tarea.']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Faltan datos para mover la tarea.']);
}
$conn->close();
?>