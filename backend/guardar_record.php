<?php
/*
 * guardar_record.php
 * Backend – Siembra de Arroz en Terreno Suave
 * Guarda el puntaje del jugador en MySQL (juego_piurano_db)
 * 
 * CONFIGURACIÓN:
 *   1. Importa el esquema SQL (ver esquema.sql)
 *   2. Ajusta $host, $usuario, $clave si es necesario
 *   3. Coloca este archivo en la carpeta backend/ junto al juego
 *   4. Sirve el juego desde XAMPP/WAMP (htdocs/) o servidor real
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// ── Configuración de conexión ──────────────────
$host    = 'bimoulrbih3vppbibjwq-mysql.services.clever-cloud.com';
$usuario = 'uecmbv5kiqweniav';
$clave   = 'OoyPcZ2A93OqU5FgMPfc';           // Cambiar si tienes contraseña
$base    = 'bimoulrbih3vppbibjwq';

// ── Recibir JSON ────────────────────────────────
$entrada = json_decode(file_get_contents('php://input'), true);

if (!$entrada) {
    echo json_encode(['ok' => false, 'msg' => 'Datos inválidos']);
    exit;
}

// ── Validar y sanear datos ──────────────────────
$nombre  = substr(trim($entrada['nombre_jugador'] ?? 'Anónimo'), 0, 50);
$puntaje = intval($entrada['puntaje_total']    ?? 0);
$tiempo  = intval($entrada['tiempo_segundos']  ?? 0);
$nivel   = intval($entrada['nivel_alcanzado']  ?? 2);

if (empty($nombre)) $nombre = 'Anónimo';
if ($puntaje < 0)   $puntaje = 0;
if ($tiempo  < 0)   $tiempo  = 0;
if ($nivel   < 1 || $nivel > 2) $nivel = 2;

// ── Conexión a MySQL ───────────────────────────
$conn = new mysqli($host, $usuario, $clave, $base);

if ($conn->connect_error) {
    echo json_encode([
        'ok'  => false,
        'msg' => 'Error de conexión: ' . $conn->connect_error
    ]);
    exit;
}

$conn->set_charset('utf8mb4');

// ── Insertar con sentencia preparada ───────────
$sql  = "INSERT INTO tabla_records (nombre_jugador, puntaje_total, tiempo_segundos, nivel_alcanzado)
         VALUES (?, ?, ?, ?)";
$stmt = $conn->prepare($sql);

if (!$stmt) {
    echo json_encode(['ok' => false, 'msg' => 'Error al preparar sentencia']);
    $conn->close();
    exit;
}

$stmt->bind_param('siii', $nombre, $puntaje, $tiempo, $nivel);

if ($stmt->execute()) {
    echo json_encode([
        'ok'  => true,
        'msg' => 'Récord guardado correctamente',
        'id'  => $stmt->insert_id
    ]);
} else {
    echo json_encode([
        'ok'  => false,
        'msg' => 'Error al ejecutar: ' . $stmt->error
    ]);
}

$stmt->close();
$conn->close();
?>
