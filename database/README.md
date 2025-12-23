# Configuración de Base de Datos MySQL

## Requisitos
- MySQL 5.7 o superior
- Node.js con npm

## Instalación

### 1. Crear la base de datos
Ejecuta el script SQL incluido:

```bash
mysql -u root -p < database/setup.sql
```

O desde MySQL Workbench/phpMyAdmin, importa el archivo `database/setup.sql`

### 2. Configurar variables de entorno
Edita el archivo `.env` y configura las credenciales de tu base de datos:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=irrigacion
```

### 3. Verificar conexión
Inicia el servidor y verifica la conexión en los logs:

```bash
npm start
```

Deberías ver:
```
✅ Conexión a MySQL establecida correctamente
```

## Estructura de la Base de Datos

### Tabla: `regantes`
- `id`: ID autoincremental
- `padron`: Número de padrón (único)
- `nombre`: Nombre del titular
- `telefono`: Teléfono de contacto
- `direccion`: Dirección
- `hectareas`: Superficie registrada
- `cultivo`: Tipo de cultivo
- `deuda`: Deuda pendiente
- `estado`: Estado del regante (Activo/Suspendido)
- `turno`: Último turno asignado

### Datos de Prueba
El script incluye 4 regantes de prueba:
- Padrón: `001` - Juan Pérez (con deuda)
- Padrón: `002` - María González (al día)
- Padrón: `003` - Carlos Rodríguez (con deuda)
- Padrón: `12345` - Ana López (al día)

## Uso en el Bot

Cuando un usuario ingresa su número de padrón, el bot:
1. Valida el formato (solo números)
2. Busca el padrón en la tabla `regantes`
3. Si existe: muestra los datos reales (nombre, deuda, estado)
4. Si no existe: pide reintentar

## Funciones Disponibles

### `reganteService.getReganteByPadron(padron)`
Busca un regante por número de padrón.

**Retorna:**
- Objeto con datos del regante si existe
- `null` si no existe

### `reganteService.actualizarDeuda(padron, nuevaDeuda)`
Actualiza la deuda de un regante.

**Retorna:**
- `true` si se actualizó correctamente
- `false` si no existe el padrón

## Troubleshooting

### Error: "ER_ACCESS_DENIED_ERROR"
Verifica usuario y contraseña en `.env`

### Error: "ER_BAD_DB_ERROR"
La base de datos no existe. Ejecuta el script SQL.

### Error: "ECONNREFUSED"
MySQL no está corriendo. Inicia el servicio:
```bash
# Windows
net start MySQL80

# Linux/Mac
sudo systemctl start mysql
```
