-- Migración: Agregar columna bot_mode a la tabla usuarios
-- Fecha: 2025-12-26

USE irrigacion;

-- Agregar columna bot_mode si no existe
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS bot_mode ENUM('active', 'paused') DEFAULT 'active' NOT NULL
AFTER dni;

-- Verificar
SELECT telefono, dni, bot_mode FROM usuarios LIMIT 5;
