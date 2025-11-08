<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}
$user_id = $_SESSION['user_id'];

date_default_timezone_set('Europe/Madrid'); 

$response = [ 'success' => false, 'labels' => [], 'data' => [], 'total_minutos' => 0 ];
$filtro = $_GET['filtro'] ?? 'today';

try {
    $sql = "";
    $params = [$user_id]; // user_id es SIEMPRE el primer parámetro
    $tipos_params = "i"; // "i" de integer

    switch ($filtro) {
        case 'today':
            $sql = "SELECT HOUR(fecha_sesion) as label, SUM(duracion_minutos) as total
                    FROM sesiones_estudio
                    WHERE DATE(fecha_sesion) = CURDATE() AND user_id = ?
                    GROUP BY label ORDER BY label ASC;";
            break;
        case 'week':
            $sql = "SELECT DATE_FORMAT(fecha_sesion, '%W') as label, SUM(duracion_minutos) as total
                    FROM sesiones_estudio
                    WHERE YEARWEEK(fecha_sesion, 1) = YEARWEEK(CURDATE(), 1) AND user_id = ?
                    GROUP BY label ORDER BY DAYOFWEEK(fecha_sesion);";
            break;
        case 'month':
            $sql = "SELECT DATE_FORMAT(fecha_sesion, '%d-%m') as label, SUM(duracion_minutos) as total
                    FROM sesiones_estudio
                    WHERE MONTH(fecha_sesion) = MONTH(CURDATE()) AND YEAR(fecha_sesion) = YEAR(CURDATE()) AND user_id = ?
                    GROUP BY label ORDER BY fecha_sesion;";
            break;
        case 'year':
            $sql = "SELECT DATE_FORMAT(fecha_sesion, '%M') as label_mes, MONTH(fecha_sesion) as num_mes, SUM(duracion_minutos) as total
                    FROM sesiones_estudio
                    WHERE YEAR(fecha_sesion) = YEAR(CURDATE()) AND user_id = ?
                    GROUP BY label_mes, num_mes ORDER BY num_mes;";
            break;
        case 'day':
            if (empty($_GET['fecha'])) throw new Exception("No se proporcionó fecha.");
            $fecha_filtro = $_GET['fecha'];
            $sql = "SELECT 'Total del día' as label, SUM(duracion_minutos) as total
                    FROM sesiones_estudio
                    WHERE DATE(fecha_sesion) = ? AND user_id = ?
                    GROUP BY label;";
            $params = [$fecha_filtro, $user_id]; // El orden cambia
            $tipos_params = "si"; // string, integer
            break;
    }

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($tipos_params, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();
    
    // ... (El resto del bucle while para procesar $result es el mismo) ...
    $total_general = 0;
    $labels = [];
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $total = (int)($row['total'] ?? 0);
        if ($filtro == 'day') {
            $total_general = $total;
        } else {
            $labels[] = $row['label'] ?? ($row['label_mes'] ?? 'N/A');
            $data[] = $total;
            $total_general += $total;
        }
    }
    $response = ['success' => true, 'labels' => $labels, 'data' => $data, 'total_minutos' => $total_general];
    $stmt->close();
} catch (Exception $e) {
    $response['message'] = $e->getMessage();
}
$conn->close();
echo json_encode($response);
?>