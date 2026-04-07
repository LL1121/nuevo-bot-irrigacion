-- Irrigación Bot - PostgreSQL Initialization Script
-- Este script se ejecuta automáticamente al iniciar el contenedor

-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Crear schema
CREATE SCHEMA IF NOT EXISTS irrigacion;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS irrigacion.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_interaction TIMESTAMP
);

-- Tabla de conversaciones
CREATE TABLE IF NOT EXISTS irrigacion.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES irrigacion.users(id) ON DELETE CASCADE,
    topic VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Tabla de mensajes
CREATE TABLE IF NOT EXISTS irrigacion.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES irrigacion.conversations(id) ON DELETE CASCADE,
    sender VARCHAR(50) NOT NULL, -- 'user', 'bot', 'admin'
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'document'
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de webhooks
CREATE TABLE IF NOT EXISTS irrigacion.webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Tabla de tokens
CREATE TABLE IF NOT EXISTS irrigacion.tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES irrigacion.users(id) ON DELETE CASCADE,
    token_type VARCHAR(50) NOT NULL,
    token_value TEXT NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);

-- Crear índices para optimización
CREATE INDEX idx_users_phone ON irrigacion.users(phone_number);
CREATE INDEX idx_conversations_user_id ON irrigacion.conversations(user_id);
CREATE INDEX idx_conversations_status ON irrigacion.conversations(status);
CREATE INDEX idx_messages_conversation_id ON irrigacion.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON irrigacion.messages(created_at);
CREATE INDEX idx_webhooks_processed ON irrigacion.webhooks(processed);
CREATE INDEX idx_tokens_user_id ON irrigacion.tokens(user_id);

-- Crear funciones de actualización automática
CREATE OR REPLACE FUNCTION irrigacion.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER trigger_users_update BEFORE UPDATE ON irrigacion.users
    FOR EACH ROW EXECUTE FUNCTION irrigacion.update_timestamp();

CREATE TRIGGER trigger_conversations_update BEFORE UPDATE ON irrigacion.conversations
    FOR EACH ROW EXECUTE FUNCTION irrigacion.update_timestamp();

-- Permisos
GRANT USAGE ON SCHEMA irrigacion TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA irrigacion TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA irrigacion TO postgres;

-- Log de inicialización
SELECT 'PostgreSQL initialization completed successfully' AS status;
