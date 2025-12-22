# Bot de WhatsApp - Sistema de Irrigación

Bot de WhatsApp para gestión de riego usando WhatsApp Cloud API (Meta).

## 📋 Requisitos

- Node.js v16 o superior
- Cuenta de Meta Business
- WhatsApp Cloud API configurada

## 🚀 Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
Copiar `.env.example` a `.env` y completar con tus credenciales de Meta.

3. Inicializar la base de datos:
```bash
npm run setup-db
```

4. Iniciar el servidor:
```bash
npm start
```

## 📁 Estructura del Proyecto

```
bot-irrigacion/
├── src/
│   ├── index.js                    # Entry point
│   ├── routes/
│   │   └── webhookRoutes.js        # Definición de rutas
│   ├── controllers/
│   │   └── webhookController.js    # Lógica del webhook
│   ├── services/
│   │   └── whatsappService.js      # Servicios de WhatsApp API
│   └── database/
│       └── setup.js                # Configuración de SQLite
├── .env                            # Variables de entorno
├── .gitignore
├── package.json
└── README.md
```

## 🔧 Configuración de WhatsApp Cloud API

1. Crear una app en Meta for Developers
2. Configurar WhatsApp Cloud API
3. Obtener el Phone Number ID y Access Token
4. Configurar el webhook con la URL de tu servidor

## 📝 Variables de Entorno

- `PORT`: Puerto del servidor (default: 3000)
- `WEBHOOK_VERIFY_TOKEN`: Token para verificar el webhook
- `WHATSAPP_TOKEN`: Access Token de WhatsApp
- `WHATSAPP_PHONE_ID`: Phone Number ID de WhatsApp

## 📊 Base de Datos

El sistema usa SQLite con las siguientes tablas:

- **padrones**: Información de los titulares
- **deudas**: Registro de deudas por período
- **mensajes**: Log de mensajes enviados/recibidos
