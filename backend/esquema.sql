-- ═══════════════════════════════════════════════════
--  ESQUEMA MySQL – Siembra de Arroz en Terreno Suave
--  Videojuego – Costumbres Piuranas 2026
--  Ejecutar en phpMyAdmin o consola MySQL
-- ═══════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS juego_piurano_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE juego_piurano_db;

CREATE TABLE IF NOT EXISTS tabla_records (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    nombre_jugador   VARCHAR(50)  NOT NULL,
    puntaje_total    INT          NOT NULL DEFAULT 0,
    tiempo_segundos  INT          NOT NULL DEFAULT 0,
    nivel_alcanzado  INT          NOT NULL DEFAULT 2,
    fecha_registro   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Vista de top 10 puntajes
CREATE OR REPLACE VIEW top_records AS
SELECT
    ROW_NUMBER() OVER (ORDER BY puntaje_total DESC, tiempo_segundos ASC) AS posicion,
    nombre_jugador,
    puntaje_total,
    tiempo_segundos,
    nivel_alcanzado,
    DATE_FORMAT(fecha_registro, '%d/%m/%Y %H:%i') AS fecha
FROM tabla_records
LIMIT 10;

-- Consulta de ejemplo para ver los records:
-- SELECT * FROM top_records;
