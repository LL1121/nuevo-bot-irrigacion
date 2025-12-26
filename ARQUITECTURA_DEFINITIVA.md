# 🚀 Arquitectura Definitiva - Bot Irrigación

## 📋 Cambios Implementados

### 1. Base de Datos Simplificada
- ✅ Tabla `usuarios` con solo: telefono, dni, last_update
- ✅ userService.js para getDni() y saveDni()
- ✅ Script de setup: `npm run setup-new-db`

### 2. Scraping en Tiempo Real
- ✅ scraperService.js con Puppeteer
- ✅ Navegación robusta con selectores por texto
- ✅ Descarga automática de PDF del boleto
- ✅ Limpieza automática de archivos temporales

### 3. Servicios WhatsApp Actualizados
- ✅ uploadMedia() - Subir archivos a WhatsApp
- ✅ sendDocument() - Enviar PDFs
- ✅ sendButtonReply() - Botones de respuesta rápida (máx 3)

### 4. Flujo del Bot Actualizado

#### Menú Principal
1. 📍 Ubicación y Horarios
2. 📋 Empadronamiento
3. **💰 Consultar Deuda** (NUEVO)
4. 👤 Hablar con Operador

#### Flujo "Consultar Deuda"

**Si el usuario YA tiene DNI vinculado:**
```
Bot: "🔍 Buscando deuda para el DNI vinculado 12345678..."
     ⏳ Por favor espera, esto puede tardar unos segundos.
     
Bot: "💰 Deuda Total: $15,450.00"
     📄 A continuación te enviaremos el boleto de pago.
     
Bot: [Envía PDF del boleto]

Bot: "¿Desea consultar otro número?"
     [Botón: 🔄 Consultar otro DNI]
```

**Si el usuario NO tiene DNI vinculado:**
```
Bot: "📝 Para consultar tu deuda, por favor ingresa tu DNI o CUIT
      (sin puntos ni guiones).
      
      Ejemplo: 12345678
      
      Este número quedará vinculado a tu WhatsApp para futuras consultas."

Usuario: "12345678"

Bot: "✅ DNI 12345678 vinculado correctamente a tu WhatsApp.
      🔍 Buscando tu deuda..."

Bot: "💰 Deuda Total: $15,450.00"
     [PDF del boleto]
     
Bot: "¿Desea consultar otro número?"
     [Botón: 🔄 Consultar otro DNI]
```

**Si hace clic en "🔄 Consultar otro DNI":**
```
Bot: "📝 Entendido. Por favor escribí el nuevo DNI o CUIT a consultar
      (sin puntos ni guiones)."

Usuario: "87654321"

Bot: "✅ DNI 87654321 vinculado correctamente..."
     [Continúa el flujo normal]
```

## 🛠️ Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar .env
cp .env.example .env
# Editar DB_HOST, DB_USER, DB_PASSWORD, DB_NAME

# 3. Crear base de datos
npm run setup-new-db

# 4. Iniciar bot
npm start
```

## 📦 Nuevas Dependencias

```json
{
  "puppeteer": "^23.0.0",
  "form-data": "^4.0.0"
}
```

## 🗂️ Estructura de Archivos

```
src/
├── services/
│   ├── userService.js          # getDni(), saveDni()
│   ├── scraperService.js       # obtenerDeudaYBoleto()
│   └── whatsappService.js      # uploadMedia(), sendDocument(), sendButtonReply()
├── controllers/
│   └── webhookController.js    # Lógica actualizada
└── database/
    └── setupNew.js             # Script de creación de BD

database/
└── schema.sql                  # Tabla usuarios

temp/                           # Carpeta para PDFs (se crea automáticamente)
```

## 🧪 Testing

### 1. Enviar mensaje "Hola" al bot
- Debe mostrar menú con "💰 Consultar Deuda"

### 2. Seleccionar "Consultar Deuda"
- Si es primera vez: Solicita DNI
- Si ya tiene DNI: Ejecuta scraper directamente

### 3. Ingresar DNI válido
- Debe vincular y ejecutar scraper
- Debe enviar: Monto + PDF + Botón

### 4. Hacer clic en "🔄 Consultar otro DNI"
- Debe solicitar nuevo DNI
- Debe actualizar vinculación

## 🔧 Configuración de Puppeteer

El scraper usa selectores robustos por texto:
```javascript
// Buscar botón por contenido, no por clase CSS
const buttons = Array.from(document.querySelectorAll('button'));
const searchButton = buttons.find(btn => 
  btn.textContent.includes('Buscar servicios asociados')
);
```

Esto evita problemas con clases CSS dinámicas.

## 📝 Notas Importantes

1. **PDFs temporales**: Se eliminan automáticamente después de enviar
2. **Limpieza automática**: Archivos >1 hora se borran cada hora
3. **Validación de DNI**: 7-11 dígitos numéricos
4. **Botón único**: Solo 1 botón para simplicidad
5. **Estado global**: `btn_cambiar_dni` funciona desde cualquier estado

## 🐛 Troubleshooting

### Error: "No se encontró el botón de búsqueda"
- El sitio web cambió su estructura
- Revisar selectores en scraperService.js

### Error: "PDF no descargado"
- Verificar permisos en carpeta temp/
- El sitio puede no tener boleto disponible

### Error: "Cannot connect to MySQL"
- Verificar credenciales en .env
- Ejecutar: `npm run setup-new-db`

## 🚀 Próximos Pasos

- [ ] Implementar caché de consultas (evitar scraping repetido)
- [ ] Agregar opción "Ver último boleto consultado"
- [ ] Notificar al usuario cuando cambie su deuda
- [ ] Dashboard de métricas de scraping

---

**Arquitectura implementada por GitHub Copilot** ✨
