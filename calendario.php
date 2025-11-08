<?php include 'includes/check_session.php'; ?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Calendario</title> 
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
                <li><a href="ajustes.php">Ajustes</a></li>
                <li><a href="logout.php" class="logout-link">Cerrar Sesión</a></li>
            </ul>
	</nav>

    <main class="content-wrapper calendario-layout">
        <div class="calendar-container">
            <div class="calendar-header">
                <button id="prev-month-btn">&lt;</button>
                <h1 id="month-year-title">Cargando...</h1>
                <button id="next-month-btn">&gt;</button>
            </div>
            <div class="calendar-grid-header">
                <div>Lunes</div>
                <div>Martes</div>
                <div>Miércoles</div>
                <div>Jueves</div>
                <div>Viernes</div>
                <div>Sábado</div>
                <div>Domingo</div>
            </div>
            <div class="calendar-grid-body" id="calendar-body">
                </div>
        </div>
    </main>

    <script src="js/nav.js"></script>
    <script src="js/calendario.js"></script> 
    <script src="js/colorRules.js"></script> <script src="js/pomodoro.js"></script>
    <script>
        (function() {
            history.pushState(null, null, location.href);
            window.addEventListener('popstate', function () {
                window.location.replace('index.php');
            });
        })();
    </script>
</body>
</html>