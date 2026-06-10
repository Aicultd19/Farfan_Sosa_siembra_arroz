<?php
/*═══════════════════════════════════════════════════════
  SIEMBRA DE ARROZ – UNP Ingeniería Informática 2026-1
  Archivo: backend/obtener_records.php
  Descripción: Devuelve el TOP 15 de puntajes en JSON
               para mostrar el ranking en la pantalla
               de inicio del juego.
═══════════════════════════════════════════════════════*/

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once 'config_db.php';

try {
    $pdo  = getConexion();
    $stmt = $pdo->query(
        'SELECT nombre_jugador, puntaje_total, tiempo_segundos,
                nivel_alcanzado, fecha_registro
         FROM   tabla_records
         ORDER  BY puntaje_total DESC
         LIMIT  15'
    );
    $records = $stmt->fetchAll();
    echo json_encode($records);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([]);
}
