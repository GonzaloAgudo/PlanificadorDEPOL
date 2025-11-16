<?php include 'includes/check_session.php'; ?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tareas Semanales</title>
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

    <main class="content-wrapper semana-layout">
        <div class="week-tasks-container">
            
            <div class="week-header">
                <button id="prev-week-btn" class="week-nav-btn">&lt;</button>
                <h1 id="week-title">Cargando...</h1>
                <button id="next-week-btn" class="week-nav-btn">&gt;</button>
            </div>
            <a href="ajustes.php" class="settings-link-icon" title="Ajustes de color">⚙️</a>
            <div class="week-grid">
                
                <div class="day-column" data-day-id="Lunes" data-date="">
                    <h2>Lunes <span class="day-date"></span></h2>
                    <div class="task-input-group">
                        <input type="text" placeholder="Nueva tarea...">
                        <button data-day="Lunes">➕</button>
                    </div>
                    <ul class="task-list"></ul> 
                </div>

                <div class="day-column" data-day-id="Martes" data-date="">
                    <h2>Martes <span class="day-date"></span></h2>
                    <div class="task-input-group">
                        <input type="text" placeholder="Nueva tarea...">
                        <button data-day="Martes">➕</button>
                    </div>
                    <ul class="task-list"></ul>
                </div>
                
                <div class="day-column" data-day-id="Miércoles" data-date="">
                    <h2>Miércoles <span class="day-date"></span></h2>
                    <div class="task-input-group">
                        <input type="text" placeholder="Nueva tarea...">
                        <button data-day="Miércoles">➕</button>
                    </div>
                    <ul class="task-list"></ul>
                </div>

                <div class="day-column" data-day-id="Jueves" data-date="">
                    <h2>Jueves <span class="day-date"></span></h2>
                    <div class="task-input-group">
                        <input type="text" placeholder="Nueva tarea...">
                        <button data-day="Jueves">➕</button>
                    </div>
                    <ul class="task-list"></ul>
                </div>
                
                <div class="day-column" data-day-id="Viernes" data-date="">
                    <h2>Viernes <span class="day-date"></span></h2>
                    <div class="task-input-group">
                        <input type="text" placeholder="Nueva tarea...">
                        <button data-day="Viernes">➕</button>
                    </div>
                    <ul class="task-list"></ul>
                </div>

                <div class="day-column" data-day-id="Sábado" data-date="">
                    <h2>Sábado <span class="day-date"></span></h2>
                    <div class="task-input-group">
                        <input type="text" placeholder="Nueva tarea...">
                        <button data-day="Sábado">➕</button>
                    </div>
                    <ul class="task-list"></ul>
                </div>
                
                <div class="day-column" data-day-id="Domingo" data-date="">
                    <h2>Domingo <span class="day-date"></span></h2>
                    <div class="task-input-group">
                        <input type="text" placeholder="Nueva tarea...">
                        <button data-day="Domingo">➕</button>
                    </div>
                    <ul class="task-list"></ul>
                </div>

            </div> </div>
    </main>

    <script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>
    <script src="js/nav.js"></script>
    <script src="js/colorRules.js"></script>
    <script src="js/semana.js"></script>
    
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