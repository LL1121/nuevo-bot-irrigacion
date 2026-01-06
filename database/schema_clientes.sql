-- Esquema completo optimizado: Clientes + Mensajes
-- Fecha: 2026-01-06

USE irrigacion;

-- Desactivar foreign key checks
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- TABLA CLIENTES (Auto-registro desde WhatsApp)
-- ============================================
DROP TABLE IF EXISTS mensajes;
DROP TABLE IF EXISTS clientes;

CREATE TABLE clientes (
  telefono VARCHAR(20) PRIMARY KEY,
  nombre VARCHAR(255) DEFAULT 'Sin Nombre',
  dni VARCHAR(20),
  bot_activo BOOLEAN DEFAULT TRUE,
  ultima_interaccion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ultima_interaccion (ultima_interaccion),
  INDEX idx_bot_activo (bot_activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mensajes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  telefono VARCHAR(20) NOT NULL,
  remitente ENUM('bot', 'cliente', 'operador') NOT NULL,
  contenido TEXT NOT NULL,
  tipo_mensaje VARCHAR(50) DEFAULT 'text',
  media_url VARCHAR(500),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  leido BOOLEAN DEFAULT FALSE,
  INDEX idx_telefono (telefono),
  INDEX idx_timestamp (timestamp),
  INDEX idx_telefono_timestamp (telefono, timestamp),
  FOREIGN KEY (telefono) REFERENCES clientes(telefono) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- DATOS DE PRUEBA
-- ============================================
INSERT INTO clientes (telefono, nombre, dni, bot_activo) VALUES
('5491112345678', 'Juan Pérez', '12345678', TRUE),
('5491187654321', 'María González', '87654321', TRUE)
ON DUPLICATE KEY UPDATE ultima_interaccion = CURRENT_TIMESTAMP;

INSERT INTO mensajes (telefono, remitente, contenido, tipo_mensaje) VALUES
('5491112345678', 'cliente', 'Hola, necesito ayuda', 'text'),
('5491112345678', 'bot', 'Hola Juan, ¿en qué puedo ayudarte?', 'text'),
('5491187654321', 'cliente', 'Quiero consultar mi deuda', 'text'),
('5491187654321', 'bot', 'Por favor ingresa tu DNI', 'text');

-- Reactivar foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

COMMIT;
