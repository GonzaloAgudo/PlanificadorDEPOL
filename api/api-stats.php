<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}
$user_id = $_SESSION['user_id'];
date_default_timezone_set('Europe/Madrid'); 

$tipo = $_GET['tipo'] ?? 'estudio'; 
$filtro = $_GET['filtro'] ?? 'today';

$response = [ 'success' => true, 'data_rows' => [], 'total_minutos' => 0 ];

try {
    $sql = "";
    $params = [];
    $tipos_params = "";

    // --- ¡NUEVA LÓGICA PARA 'TEMAS'! ---
    if ($tipo == 'temas') {
        $filtro_tema = $_GET['filtro_tema'] ?? 'ambas';
        
        $sql = "SELECT tema, SUM(duracion_minutos) as total_minutos 
                FROM sesiones_estudio 
                WHERE user_id = ? 
                AND tema IS NOT NULL AND tema != ''";
        
        $params[] = $user_id;
        $tipos_params = "i";

        if ($filtro_tema == 'estudio') {
            $sql .= " AND tipo = 'estudio'";
        } elseif ($filtro_tema == 'clase') {
            $sql .= " AND tipo = 'clase'";
        } else {
            // 'ambas' - no añade más filtros
            $sql .= " AND (tipo = 'estudio' OR tipo = 'clase')";
        }
        
        $sql .= " GROUP BY tema 
                  ORDER BY
                    CASE WHEN tema LIKE 'Tema %' THEN 1 ELSE 2 END ASC,
                    CAST(SUBSTRING(tema FROM 6) AS UNSIGNED) ASC,
                    tema ASC";

    // Lógica para 'conjunto'
    } elseif ($tipo == 'conjunto') {
        $params = [$user_id];
        $tipos_params = "i";
        
        switch ($filtro) {
            case 'today':
                $sql = "SELECT HOUR(fecha_sesion) as label, tipo, SUM(duracion_minutos) as total
                        FROM sesiones_estudio
                        WHERE DATE(fecha_sesion) = CURDATE() AND user_id = ?
                        GROUP BY label, tipo ORDER BY label ASC, tipo ASC;";
                break;
            case 'week':
                $sql = "SELECT DATE_FORMAT(fecha_sesion, '%W') as label, tipo, SUM(duracion_minutos) as total
                        FROM sesiones_estudio
                        WHERE YEARWEEK(fecha_sesion, 1) = YEARWEEK(CURDATE(), 1) AND user_id = ?
                        GROUP BY label, tipo ORDER BY WEEKDAY(fecha_sesion) ASC, tipo ASC;";
                break;
            case 'month':
                $sql = "SELECT DATE_FORMAT(fecha_sesion, '%d-%m') as label, tipo, SUM(duracion_minutos) as total
                        FROM sesiones_estudio
                        WHERE MONTH(fecha_sesion) = MONTH(CURDATE()) AND YEAR(fecha_sesion) = YEAR(CURDATE()) AND user_id = ?
                        GROUP BY label, tipo ORDER BY fecha_sesion, tipo ASC;";
                break;
            case 'year':
                $sql = "SELECT DATE_FORMAT(fecha_sesion, '%M') as label_mes, MONTH(fecha_sesion) as num_mes, tipo, SUM(duracion_minutos) as total
                        FROM sesiones_estudio
                        WHERE YEAR(fecha_sesion) = YEAR(CURDATE()) AND user_id = ?
                        GROUP BY label_mes, num_mes, tipo ORDER BY num_mes, tipo ASC;";
                break;
            case 'day': 
                $fecha_filtro = $_GET['fecha'] ?? CURDATE();
                $sql = "SELECT 'Total' as label, tipo, SUM(duracion_minutos) as total
                        FROM sesiones_estudio
                        WHERE DATE(fecha_sesion) = ? AND user_id = ?
                        GROUP BY tipo ORDER BY tipo ASC;";
                $params = [$fecha_filtro, $user_id];
                $tipos_params = "si";
                break;
        }
    
    // Lógica para filtros individuales
    } else {
        $params = [$user_id, $tipo];
        $tipos_params = "is";

        switch ($filtro) {
            case 'today':
                $sql = "SELECT HOUR(fecha_sesion) as label, SUM(duracion_minutos) as total
                        FROM sesiones_estudio
                        WHERE DATE(fecha_sesion) = CURDATE() AND user_id = ? AND tipo = ?
                        GROUP BY label ORDER BY label ASC;";
                break;
            case 'week':
                $sql = "SELECT DATE_FORMAT(fecha_sesion, '%W') as label, SUM(duracion_minutos) as total
                        FROM sesiones_estudio
                        WHERE YEARWEEK(fecha_sesion, 1) = YEARWEEK(CURDATE(), 1) AND user_id = ? AND tipo = ?
                        GROUP BY label ORDER BY WEEKDAY(fecha_sesion) ASC;";
                break;
            case 'month':
                $sql = "SELECT DATE_FORMAT(fecha_sesion, '%d-%m') as label, SUM(duracion_minutos) as total
                        FROM sesiones_estudio
                        WHERE MONTH(fecha_sesion) = MONTH(CURDATE()) AND YEAR(fecha_sesion) = YEAR(CURDATE()) AND user_id = ? AND tipo = ?
                        GROUP BY label ORDER BY fecha_sesion;";
                break;
            case 'year':
                $sql = "SELECT DATE_FORMAT(fecha_sesion, '%M') as label_mes, MONTH(fecha_sesion) as num_mes, SUM(duracion_minutos) as total
                        FROM sesiones_estudio
                        WHERE YEAR(fecha_sesion) = YEAR(CURDATE()) AND user_id = ? AND tipo = ?
                        GROUP BY label_mes, num_mes ORDER BY num_mes;";
                break;
            case 'day':
                if (empty($_GET['fecha'])) throw new Exception("No se proporcionó fecha.");
                $fecha_filtro = $_GET['fecha'];
                $sql = "SELECT 'Total del día' as label, SUM(duracion_minutos) as total
                        FROM sesiones_estudio
                        WHERE DATE(fecha_sesion) = ? AND user_id = ? AND tipo = ?
                        GROUP BY label;";
                $params = [$fecha_filtro, $user_id, $tipo]; 
                $tipos_params = "sis"; 
                break;
        }
    }

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($tipos_params, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $total_general = 0;
    $data_rows = [];

    while ($row = $result->fetch_assoc()) {
        $total = (int)($row['total'] ?? ($row['total_minutos'] ?? 0));
        $total_general += $total;
        $data_rows[] = $row;
    }

    $response['data_rows'] = $data_rows; 
    $response['total_minutos'] = $total_general;
    $stmt->close();

} catch (Exception $e) {
    $response['success'] = false;
    $response['message'] = $e->getMessage();
}
$conn->close();
echo json_encode($response);
?>