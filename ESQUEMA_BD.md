# Esquema Base de Datos - Bot Irrigación

```mermaid
erDiagram
  users {
    UUID id PK
    VARCHAR phone_number UNIQUE
    VARCHAR name
    VARCHAR email
    VARCHAR status
    TIMESTAMP created_at
    TIMESTAMP updated_at
    TIMESTAMP last_interaction
  }
  conversations {
    UUID id PK
    UUID user_id FK
    VARCHAR topic
    VARCHAR status
    TIMESTAMP created_at
    TIMESTAMP updated_at
    TIMESTAMP resolved_at
  }
  messages {
    UUID id PK
    UUID conversation_id FK
    VARCHAR sender
    TEXT content
    VARCHAR message_type
    JSONB metadata
    TIMESTAMP created_at
  }
  webhooks {
    UUID id PK
    VARCHAR event_type
    JSONB payload
    BOOLEAN processed
    TIMESTAMP created_at
    TIMESTAMP processed_at
  }
  tokens {
    UUID id PK
    UUID user_id FK
    VARCHAR token_type
    TEXT token_value
    TIMESTAMP expires_at
    TIMESTAMP created_at
    TIMESTAMP revoked_at
  }
  users ||--o{ conversations : "tiene"
  conversations ||--o{ messages : "tiene"
  users ||--o{ tokens : "tiene"
```

---

## Descripción rápida
- users: usuarios registrados (login, WhatsApp, etc)
- conversations: historial de conversaciones por usuario
- messages: mensajes individuales
- webhooks: eventos externos recibidos
- tokens: autenticación y sesiones

Relaciones principales:
- users → conversations → messages
- users → tokens
