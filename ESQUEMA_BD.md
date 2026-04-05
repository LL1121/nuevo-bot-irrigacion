# Esquema Base de Datos - Bot Irrigación

Base de datos PostgreSQL dedicada al proyecto. El modelo actual está centrado en:

- `subdelegaciones`: zonas/centros operativos
- `clientes`: registros de contacto y estado conversacional
- `tickets`: derivaciones o pedidos para atención humana
- `horarios_atencion`: disponibilidad por día y subdelegación
- `mensajes`: historial de mensajes entrantes/salientes
- `notas_internas`: notas privadas de operadores
- `operadores`: usuarios del panel / login
- `audit_log`: auditoría de cambios

```mermaid
erDiagram
  subdelegaciones {
    SERIAL id PK
    TEXT nombre
    TEXT codigo
    TEXT display_phone_number
    TIMESTAMP created_at
    TIMESTAMP updated_at
  }

  clientes {
    VARCHAR telefono PK
    TEXT nombre_whatsapp
    TEXT nombre_asignado
    TEXT foto_perfil
    TEXT padron
    TEXT subdelegacion
    TEXT estado_conversacion
    TEXT estado_deuda
    TEXT last_titular
    TEXT last_ccpp
    INTEGER bot_activo
    TIMESTAMP ultima_interaccion
    TIMESTAMP fecha_registro
  }

  tickets {
    SERIAL id PK
    VARCHAR cliente_telefono FK
    INTEGER subdelegacion_id FK
    TEXT estado
    TEXT motivo
    TIMESTAMP created_at
    TIMESTAMP updated_at
    TIMESTAMP closed_at
  }

  horarios_atencion {
    SERIAL id PK
    INTEGER subdelegacion_id FK
    INTEGER dia_semana
    TEXT hora_inicio
    TEXT hora_fin
    INTEGER habilitado
    TEXT mensaje_fuera_horario
    TIMESTAMP created_at
    TIMESTAMP updated_at
  }

  mensajes {
    SERIAL id PK
    TEXT message_id
    VARCHAR cliente_telefono FK
    TEXT tipo
    TEXT cuerpo
    TEXT url_archivo
    TEXT emisor
    INTEGER leido
    TIMESTAMP fecha
  }

  notas_internas {
    SERIAL id PK
    VARCHAR cliente_telefono FK
    TEXT texto
    TEXT autor
    TIMESTAMP fecha
  }

  operadores {
    SERIAL id PK
    TEXT username
    TEXT email
    TEXT password_hash
    INTEGER subdelegacion_id
    TEXT role
    TIMESTAMP created_at
    TIMESTAMP updated_at
  }

  audit_log {
    SERIAL id PK
    TEXT usuario
    TEXT accion
    TEXT tabla
    TEXT id_registro
    TEXT valores_anteriores
    TEXT valores_nuevos
    TEXT ip_address
    TIMESTAMP timestamp
  }

  subdelegaciones ||--o{ tickets : "atiende"
  subdelegaciones ||--o{ horarios_atencion : "define"
  subdelegaciones ||--o{ operadores : "asigna"
  clientes ||--o{ tickets : "genera"
  clientes ||--o{ mensajes : "recibe"
  clientes ||--o{ notas_internas : "tiene"
```

## Resumen funcional

- `subdelegaciones`: identifica la zona operativa y el número asociado.
- `clientes`: guarda el teléfono, datos de padrón y estado actual de la conversación.
- `tickets`: registra derivaciones a operador y casos abiertos.
- `horarios_atencion`: controla si hay operadores disponibles por día.
- `mensajes`: historial de mensajes para el panel y trazabilidad.
- `notas_internas`: observaciones privadas del equipo.
- `operadores`: credenciales del panel, con posible asignación a subdelegación.
- `audit_log`: auditoría de acciones administrativas.

Relaciones principales:
- `clientes` → `mensajes`
- `clientes` → `tickets`
- `clientes` → `notas_internas`
- `subdelegaciones` → `operadores`
- `subdelegaciones` → `tickets`
- `subdelegaciones` → `horarios_atencion`
