<?php include 'includes/check_session.php'; ?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pomodoro Timer</title> 
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

    <main class="content-wrapper index-layout">

        <div class="pomodoro-app">
            
            <div class="activity-switcher">
                <button class="activity-btn active" data-activity="estudio">Estudio</button>
                <button class="activity-btn" data-activity="clase">Clase</button>
                <button class="activity-btn" data-activity="psicotecnicos">Psicotécnicos</button>
            </div>
            
            <div class="topic-input-container">
                <input type="text" id="topic-input" placeholder="¿Qué estás estudiando/viendo?">
            </div>
            
            <div id="pomodoro-ui">
                <div class="tabs">
                    <button class="tab-btn active" data-mode="estudio">Estudio</button>
                    <button class="tab-btn" data-mode="descanso">Descanso</button>
                </div>
                <div class="pomodoro-counter">
                    Pomodoros de hoy: <span id="pomodoro-count-display">0</span>
                </div>
                <div class="timer" id="timer-display">30:00</div>
                <div class="controles">
                    <button id="btn-iniciar">Iniciar</button>
                    <button id="btn-pausa">Pausa</button>
                    <button id="btn-reset">Guardar y Reset</button>
                </div>

                <button id="btn-pomodoro-manual" class="btn-manual-add">Añadir Tiempo Manual</button>
                <div class="config">
                    <h3><span id="config-icon">⚙️</span> Configuración</h3>
                    <div class="config-grid">
                        <div class="config-column">
                            <label for="input-estudio">Estudio (min):</label>
                            <input type="number" id="input-estudio" value="30">
                            <label for="input-descanso">Descanso (min):</label>
                            <input type="number" id="input-descanso" value="5">
                        </div>
                        <div class="config-column">
                            <label for="input-descanso-largo">Desc. Largo (min):</label>
                            <input type="number" id="input-descanso-largo" value="20">
                            <label for="input-ciclo-pomodoro">Pomos p/ciclo:</label>
                            <input type="number" id="input-ciclo-pomodoro" value="4">
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="stopwatch-ui" style="display: none;">
                <div class="timer" id="stopwatch-display">00:00:00</div>
                <div class="controles">
                    <button id="btn-stopwatch-start">Iniciar</button>
                    <button id="btn-stopwatch-pause">Pausa</button>
                    <button id="btn-stopwatch-save">Guardar y Reset</button>
                </div>
                <button id="btn-stopwatch-manual" class="btn-manual-add">Añadir Tiempo Manual</button>
            </div>

            <a href="stats.php" class="stats-link">Ver Estadísticas 📊</a>
        </div>

        <div class="task-list-container">
            <h2>Mis Tareas de Hoy</h2>
            <div class="task-input-group">
                <input type="text" id="new-task-input" placeholder="Añadir nueva tarea...">
                <button id="add-task-btn">➕</button>
            </div>
            <ul id="task-list">
                </ul>
        </div>
    
    </main>

    <script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>
    <script src="js/nav.js"></script>
    <script src="js/colorRules.js"></script>
    <script src="js/pomodoro.js"></script>
</body>
</html>