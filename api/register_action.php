<?php
include '../includes/db_config.php';
header('Content-Type: application/json');

$username = $_POST['username'] ?? '';
$password = $_POST['password'] ?? '';
$confirm_password = $_POST['confirm-password'] ?? ''; // <-- CAMBIO: Obtenemos el nuevo campo

// --- CAMBIO: Comprobación de campos y coincidencia ---
if (empty($username) || empty($password) || empty($confirm_password)) {
    echo json_encode(['success' => false, 'message' => 'Todos los campos son requeridos.']);
    exit;
}

if ($password !== $confirm_password) {
    echo json_encode(['success' => false, 'message' => 'Las contraseñas no coinciden.']);
    exit;
}
// --- FIN DEL CAMBIO ---

// 1. Comprobar si el usuario ya existe
$sql_check = "SELECT id FROM usuarios WHERE username = ?";
$stmt_check = $conn->prepare($sql_check);
$stmt_check->bind_param("s", $username);
$stmt_check->execute();
if ($stmt_check->get_result()->num_rows > 0) {
    echo json_encode(['success' => false, 'message' => 'Ese nombre de usuario ya existe.']);
    $stmt_check->close();
    $conn->close();
    exit;
}
$stmt_check->close();

// 2. Hashear la contraseña (¡MUY IMPORTANTE!)
$password_hash = password_hash($password, PASSWORD_DEFAULT);

// 3. Insertar nuevo usuario
$sql_insert = "INSERT INTO usuarios (username, password_hash) VALUES (?, ?)";
$stmt_insert = $conn->prepare($sql_insert);
$stmt_insert->bind_param("ss", $username, $password_hash);

if ($stmt_insert->execute()) {
    echo json_encode(['success' => true, 'message' => 'Usuario registrado con éxito.']);
} else {
    echo json_encode(['success' => false, 'message' => 'Error al registrar el usuario.']);
}
$stmt_insert->close();
$conn->close();
?>