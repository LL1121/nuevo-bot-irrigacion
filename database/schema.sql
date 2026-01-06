-- Base de Datos Ligera: Solo Usuarios y Sesiones
DROP TABLE IF EXISTS usuarios;

CREATE TABLE usuarios (
  telefono VARCHAR(20) PRIMARY KEY,
  dni VARCHAR(20) NOT NULL,
  bot_mode ENUM('active', 'paused') DEFAULT 'active' NOT NULL,
  last_update DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dni (dni)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Datos de prueba
INSERT INTO usuarios (telefono, dni) VALUES
('5491234567890', '12345678'),
('5499876543210', '87654321')
ON DUPLICATE KEY UPDATE last_update = CURRENT_TIMESTAMP;
