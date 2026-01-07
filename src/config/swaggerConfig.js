/**
 * Configuración de Swagger/OpenAPI 3.0
 * Define la estructura de la API REST del bot de irrigación
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bot de Irrigación - API REST',
      version: '1.0.0',
      description: 'API completa para gestionar clientes, mensajes, scraping y auditoría del bot de WhatsApp',
      contact: {
        name: 'Bot Irrigación Support',
        url: 'http://localhost:3000'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Desarrollo local'
      },
      {
        url: 'https://api.bot-irrigacion.com',
        description: 'Producción'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido en /api/auth/login'
        }
      },
      schemas: {
        Cliente: {
          type: 'object',
          properties: {
            telefono: { type: 'string', description: 'Número de teléfono WhatsApp (clave primaria)' },
            nombre_whatsapp: { type: 'string', description: 'Nombre de perfil de WhatsApp' },
            nombre_asignado: { type: 'string', nullable: true, description: 'Nombre asignado por operador' },
            foto_perfil: { type: 'string', nullable: true, description: 'URL de foto de perfil WhatsApp' },
            padron: { type: 'string', nullable: true, description: 'DNI/Padrón del cliente' },
            estado_deuda: { type: 'string', enum: ['pagado', 'moroso', 'desconocido'], nullable: true },
            bot_activo: { type: 'boolean', description: 'Si el bot está activo para este cliente' },
            ultima_interaccion: { type: 'string', format: 'date-time' },
            fecha_registro: { type: 'string', format: 'date-time' }
          }
        },
        Mensaje: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'ID único del mensaje' },
            cliente_telefono: { type: 'string', description: 'Teléfono del cliente' },
            tipo: { type: 'string', enum: ['texto', 'imagen', 'archivo', 'audio'], description: 'Tipo de mensaje' },
            cuerpo: { type: 'string', description: 'Contenido del mensaje' },
            url_archivo: { type: 'string', nullable: true, description: 'URL si es archivo/imagen' },
            emisor: { type: 'string', enum: ['bot', 'usuario', 'operador'] },
            fecha: { type: 'string', format: 'date-time' },
            leido: { type: 'boolean', description: 'Si fue leído por el operador' }
          }
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            usuario: { type: 'string', description: 'Email del usuario que hizo el cambio' },
            accion: { type: 'string', enum: ['INSERT', 'UPDATE', 'DELETE'] },
            tabla: { type: 'string', description: 'Tabla afectada' },
            id_registro: { type: 'string', description: 'Clave primaria del registro' },
            valores_anteriores: { type: 'object', nullable: true },
            valores_nuevos: { type: 'object' },
            ip_address: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        Backup: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'Nombre del archivo de backup' },
            size: { type: 'integer', description: 'Tamaño en bytes' },
            sizeInMB: { type: 'number', description: 'Tamaño en MB' },
            date: { type: 'string', format: 'date-time' }
          }
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded', 'down'] },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number', description: 'Segundos que el servidor lleva activo' },
            checkDuration: { type: 'integer', description: 'Millisegundos que tardó el chequeo' },
            checks: { type: 'object' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', description: 'Mensaje de error' },
            message: { type: 'string' }
          }
        }
      }
    },
    tags: [
      { name: 'Autenticación', description: 'Login y autenticación de operadores' },
      { name: 'Clientes', description: 'Gestión de clientes y su información' },
      { name: 'Mensajes', description: 'Mensajes entre bot y clientes' },
      { name: 'Scraping', description: 'Web scraping para obtener deuda' },
      { name: 'Backups', description: 'Backup automático de BD a AWS S3' },
      { name: 'Auditoría', description: 'Log de cambios en la BD' },
      { name: 'Health', description: 'Estado y salud del sistema' }
    ]
  },
  apis: [
    './src/routes/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
