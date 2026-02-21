# AMADS Backend

API REST para AMADS - Sistema de Gestión de Llantas.

## Requisitos

- Node.js 18+
- MySQL 8+
- npm o yarn

## Instalación

```bash
# Clonar el repositorio
git clone <url-del-repositorio>
cd AMADS-backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de MySQL y JWT_SECRET
```

## Configuración

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

| Variable    | Descripción                    | Ejemplo                          |
|-------------|--------------------------------|----------------------------------|
| PORT        | Puerto del servidor            | 4000                             |
| NODE_ENV    | Entorno (development/production)| development                     |
| JWT_SECRET  | Clave secreta para JWT         | tu_clave_secreta_muy_segura      |
| DB_HOST     | Host de MySQL                  | localhost                        |
| DB_PORT     | Puerto de MySQL                | 3306                             |
| DB_USER     | Usuario de MySQL               | root                             |
| DB_PASSWORD | Contraseña de MySQL            | tu_password                      |
| DB_NAME     | Nombre de la base de datos     | amads_db                         |

## Scripts

```bash
# Desarrollo (con recarga automática)
npm run dev

# Compilar TypeScript
npm run build

# Producción
npm start

# Crear usuario administrador inicial
npm run seed

# Actualizar permisos en la base de datos
npm run seed:permisos
```

## API Endpoints

### Autenticación (`/api/auth`)

| Método | Ruta             | Descripción                         |
|--------|------------------|-------------------------------------|
| POST   | /login           | Iniciar sesión                      |
| GET    | /me              | Obtener usuario actual (requiere token) |
| PUT    | /perfil          | Actualizar perfil (nombre, apellido) |
| POST   | /registro-cliente| Registro de clientes (sin token)    |

### Usuarios (`/api/usuarios`)

Gestión de usuarios del sistema.

### Productos (`/api/productos`)

Catálogo de productos/llantas.

| Método | Ruta      | Descripción                    |
|--------|-----------|--------------------------------|
| POST   | /entrada  | Registrar entrada de inventario |
| POST   | /salida   | Registrar salida de inventario |
| POST   | /danados  | Reportar productos dañados     |

### Catálogo público (`/api/public`) - Sin autenticación

| Método | Ruta        | Descripción          |
|--------|-------------|----------------------|
| GET    | /productos  | Listar productos     |
| GET    | /categorias | Listar categorías    |
| GET    | /tipos      | Listar tipos         |
| GET    | /marcas     | Listar marcas        |

### Marcas (`/api/marcas`)

Gestión de marcas.

### Proveedores (`/api/proveedores`)

Gestión de proveedores.

### Roles (`/api`)

Gestión de roles y permisos.

### Health Check

| Método | Ruta         | Descripción      |
|--------|--------------|------------------|
| GET    | /api/health  | Estado del API   |

## Autenticación

Las rutas protegidas requieren el header:

```
Authorization: Bearer <token>
```

El token se obtiene mediante `POST /api/auth/login` con `email` y `password`.

## Estructura del proyecto

```
src/
├── config/       # Configuración (DB, etc.)
├── middleware/   # Middlewares (auth, etc.)
├── routes/       # Rutas de la API
├── scripts/      # Scripts de utilidad (seed)
├── types/        # Definiciones TypeScript
└── index.ts      # Punto de entrada
```

## Tecnologías

- **Express** - Framework web
- **TypeScript** - Tipado estático
- **MySQL2** - Cliente MySQL
- **JWT** - Autenticación
- **bcryptjs** - Hash de contraseñas
- **express-validator** - Validación de datos

## Licencia

Proyecto privado - AMADS.
