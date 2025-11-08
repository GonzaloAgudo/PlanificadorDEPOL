<?php include 'includes/check_session.php'; ?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Estadísticas de Estudio</title> 
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

    <main class="content-wrapper stats-layout">
        <div class="stats-app">
            
            <h1>Mis Estadísticas</h1>
            
            <div class="activity-filter">
                <label>
                    <input type="radio" name="activity-type" value="estudio" checked> Estudio
                </label>
                <label>
                    <input type="radio" name="activity-type" value="clase"> Clase
                </label>
                <label>
                    <input type="radio" name="activity-type" value="psicotecnicos"> Psicotécnicos
                </label>
                <label class="conjunto-label"> <input type="radio" name="activity-type" value="conjunto"> Conjunto
                </label>
            </div>
            <div class="filtros">
                <button class="filtro-btn active" data-filtro="today">Hoy</button>
                <button class="filtro-btn" data-filtro="week">Semana</button>
                <button class="filtro-btn" data-filtro="month">Mes</button>
                <button class="filtro-btn" data-filtro="year">Año</button>
            </div>

            <div class="resumen-stats" id="resumen-texto">
                Cargando datos...
            </div>
            <div class="chart-container">
                <canvas id="statsChart"></canvas>
            </div>
            <div class="filtro-dia">
                <h3>Consultar un día específico</h3>
                <input type="date" id="input-fecha-stats">
                <button id="btn-ver-stats-dia">Consultar</button>
                <div id="resultado-stats-dia"></div>
            </div>

        </div>
    </main>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="js/nav.js"></script>
    <script src="js/stats.js"></script>

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