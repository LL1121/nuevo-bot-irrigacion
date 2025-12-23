-- Actualización del esquema: Agregar tabla de mensajes para el panel de atención

USE irrigacion;

-- Tabla de mensajes (historial de conversaciones)
CREATE TABLE IF NOT EXISTS mensajes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telefono VARCHAR(20) NOT NULL,
    padron VARCHAR(20),
    remitente ENUM('bot', 'cliente', 'operador') NOT NULL,
    contenido TEXT NOT NULL,
    tipo_mensaje VARCHAR(50) DEFAULT 'text',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    leido BOOLEAN DEFAULT FALSE,
    INDEX idx_telefono (telefono),
    INDEX idx_timestamp (timestamp),
    INDEX idx_remitente (remitente),
    INDEX idx_telefono_timestamp (telefono, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de conversaciones activas (para el panel)
CREATE TABLE IF NOT EXISTS conversaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telefono VARCHAR(20) UNIQUE NOT NULL,
    nombre_cliente VARCHAR(255),
    padron VARCHAR(20),
    estado ENUM('activa', 'finalizada', 'espera') DEFAULT 'activa',
    operador_asignado VARCHAR(100),
    ultimo_mensaje TEXT,
    ultima_actividad DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    fecha_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
    mensajes_no_leidos INT DEFAULT 0,
    INDEX idx_estado (estado),
    INDEX idx_ultima_actividad (ultima_actividad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar datos de prueba
INSERT INTO conversaciones (telefono, nombre_cliente, padron, estado, ultimo_mensaje, mensajes_no_leidos) VALUES
('5491112345678', 'Juan Pérez', '001', 'activa', 'Hola, necesito consultar mi deuda', 2),
('5491187654321', 'María González', '002', 'activa', 'Buenos días', 1)
ON DUPLICATE KEY UPDATE ultima_actividad = CURRENT_TIMESTAMP;

INSERT INTO mensajes (telefono, padron, remitente, contenido) VALUES
('5491112345678', '001', 'cliente', 'Hola'),
('5491112345678', '001', 'bot', 'Bienvenido al sistema de Irrigación'),
('5491112345678', '001', 'cliente', 'Necesito consultar mi deuda'),
('5491187654321', '002', 'cliente', 'Buenos días'),
('5491187654321', '002', 'bot', 'Hola, ¿en qué puedo ayudarte?');

COMMIT;
