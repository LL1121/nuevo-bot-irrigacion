-- Script de creación de base de datos para Bot de Irrigación
-- MySQL 5.7+

-- Crear base de datos
CREATE DATABASE IF NOT EXISTS irrigacion CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE irrigacion;

-- Tabla de regantes (usuarios del sistema)
CREATE TABLE IF NOT EXISTS regantes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    padron VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    direccion VARCHAR(255),
    hectareas DECIMAL(10, 2) DEFAULT 0,
    cultivo VARCHAR(100),
    deuda DECIMAL(10, 2) DEFAULT 0,
    estado VARCHAR(50) DEFAULT 'Activo',
    turno VARCHAR(100) DEFAULT 'No asignado',
    fecha_alta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_padron (padron),
    INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Datos de prueba
INSERT INTO regantes (padron, nombre, telefono, direccion, hectareas, cultivo, deuda, estado, turno) VALUES
('001', 'Juan Pérez', '5491112345678', 'Calle Falsa 123, Malargüe', 10.5, 'Soja', 30000, 'Activo', '15/12/2024'),
('002', 'María González', '5491187654321', 'Av. Siempreviva 742, Malargüe', 15.0, 'Maíz', 0, 'Activo', '20/12/2024'),
('003', 'Carlos Rodríguez', '5491198765432', 'San Martín 456, Malargüe', 8.0, 'Trigo', 15000, 'Activo', '10/01/2025'),
('12345', 'Ana López', '5491123456789', 'Belgrano 789, Malargüe', 12.0, 'Vid', 0, 'Activo', '05/01/2025');

-- Tabla de historial de consultas (opcional, para tracking)
CREATE TABLE IF NOT EXISTS consultas_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    padron VARCHAR(20) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    tipo_consulta VARCHAR(50) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_padron_fecha (padron, fecha),
    FOREIGN KEY (padron) REFERENCES regantes(padron) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vista para consultas rápidas
CREATE OR REPLACE VIEW vista_regantes_activos AS
SELECT 
    padron,
    nombre,
    telefono,
    hectareas,
    cultivo,
    deuda,
    turno
FROM regantes
WHERE estado = 'Activo';

COMMIT;
