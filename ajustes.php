<?php include 'includes/check_session.php'; ?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ajustes</title>
    <link rel="icon" href="assets/logo.png" type="image/png">
    <link rel="stylesheet" href="css/style.css">
</head>
<body>

    <button id="menu-toggle">☰</button>
    <nav id="main-nav">
        <ul>
            <li><a href="index.php">Pomodoro</a></li>
            <li><a href="stats.php">Estadísticas</a></li>
            <li><a href="semana.php">Planificador Semanal</a></li>
            <li><a href="calendario.php">Calendario</a></li>
            <li><a href="ajustes.php">Ajustes</a></li> <li><a href="logout.php" class="logout-link">Cerrar Sesión</a></li>
        </ul>
    </nav>

    <main class="content-wrapper settings-layout">
        <div class="settings-container">
            <h1>Ajustes de Colores</h1>

            <form id="rule-form" class="settings-card">
                <h2 id="form-title">Añadir Nueva Regla</h2>
                <input type="hidden" id="rule-id-input">
                
                <div class="form-group">
                    <label for="keyword-input">Palabra clave (ej: "clase", "test")</label>
                    <input type="text" id="keyword-input" placeholder="La tarea empieza por..." required>
                </div>
                
                <div class="form-group">
                    <label>Elige un color</label>
                    <div class="color-palette" id="color-palette">
                        </div>
                    <input type="hidden" id="bg-color-input">
                    <input type="hidden" id="border-color-input">
                </div>
                
                <div class="form-buttons">
                    <button type="submit" id="save-rule-btn">Guardar Regla</button>
                    <button type="button" id="cancel-edit-btn" style="display: none;">Cancelar</button>
                </div>
                <p id="rule-error-message"></p>
            </form>

            <div class="settings-card">
                <h2>Reglas Actuales</h2>
                <ul id="rules-list">
                    </ul>
            </div>
        </div>
    </main>

    <script src="js/nav.js"></script>
    <script src="js/colorRules.js"></script> <script src="js/ajustes.js"></script> </body>
</html>