# Café Paris · Sistema de reservas

Aplicación web para la operación diaria de Café Paris: reservas, mesas, pedidos, cocina y despachos. Backend en Node.js/Express con SQLite y frontend vanilla modular, sin framework ni paso de compilación.

## Funcionalidades

- Autenticación por correo y contraseña, con sesión en cookie `HttpOnly`.
- Acceso opcional con Google Identity Services.
- Roles y permisos: `admin`, `mesero`, `cocina`, `despacho`.
- Panel de servicio con métricas del día.
- Gestión de mesas y reservas con validación de fechas, horarios y capacidad.
- Pedidos por mesa con catálogo de platos, cantidades y notas.
- Cola de cocina: en cola, preparando y listo.
- Despachos: pedidos listos, creación de despacho, seguimiento y entrega.
- Administración de usuarios, activación/desactivación y contraseñas temporales.
- Reinicio de datos demo con confirmación explícita (`RESTABLECER`).
- Diseño responsive, navegación por teclado y estados de carga/error.

## Requisitos

- Node.js 22.5 o superior. Probado con Node.js 24.
- npm.

## Instalación

```bash
npm install
cp .env.example .env
npm run seed:demo
npm start
```

La aplicación queda disponible en `http://127.0.0.1:3000` por defecto.

En Windows puedes copiar el archivo de entorno con:

```powershell
Copy-Item .env.example .env
```

## Configuración

Las variables se leen desde `.env`. Nunca incluyas el `.env` real en el repositorio ni en el ZIP.

| Variable | Descripción | Valor por defecto |
| --- | --- | --- |
| `NODE_ENV` | Entorno de ejecución | `development` |
| `HOST` | Interfaz de escucha | `127.0.0.1` |
| `PORT` | Puerto HTTP | `3000` |
| `APP_ORIGIN` | Origen público exacto para CSRF | `http://localhost:3000` |
| `DB_PATH` | Ruta del archivo SQLite | `./data/cafe-paris.sqlite` |
| `SESSION_HOURS` | Duración de la sesión | `8` |
| `COOKIE_SECURE` | Cookie solo por HTTPS | `false` en desarrollo |
| `RESTAURANT_TZ` | Zona horaria IANA | `America/Bogota` |
| `TRUST_PROXY` | Saltos de proxy confiables | `0` |
| `DEMO_MODE` | Activa datos y reinicio demo | `true` fuera de producción |
| `DEMO_ADMIN_EMAIL` | Correo del administrador demo | `admin@cafeparis.local` |
| `DEMO_ADMIN_PASSWORD` | Contraseña fija opcional para demo | aleatoria |
| `GOOGLE_CLIENT_ID` | Client ID público de Google | vacío |

### Modo demostración

Con `DEMO_MODE=true`, el primer arranque crea mesas, platos, usuarios demo y datos de ejemplo. Las contraseñas generadas se guardan en `.demo-credentials.txt`, archivo local ignorado por Git y excluido del ZIP.

También puedes definir `DEMO_ADMIN_PASSWORD` antes del primer arranque para usar una contraseña conocida que cumpla la política.

El botón **Restablecer datos demo** está disponible en la vista **Usuarios** para administradores. Reinicia mesas, platos, reservas, pedidos y despachos; conserva los usuarios.

### Producción

1. Configura `NODE_ENV=production`, `APP_ORIGIN` con el dominio HTTPS real y `COOKIE_SECURE=true`.
2. Desactiva `DEMO_MODE`.
3. Define `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` solo para el primer arranque, crea el administrador y elimina esas variables del entorno.
4. Sirve la aplicación detrás de HTTPS y, si aplica, configura `TRUST_PROXY`.

La contraseña debe cumplir la política del sistema: mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo.

### Google Identity Services

El acceso con Google es opcional. Si `GOOGLE_CLIENT_ID` está vacío, el botón se muestra deshabilitado con un aviso y el inicio por correo/contraseña sigue funcionando.

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crea un proyecto o selecciona uno.
2. Configura la pantalla de consentimiento OAuth con el nombre del restaurante y tu correo de soporte.
3. Crea una credencial **OAuth client ID** de tipo **Web application**.
4. En **Authorized JavaScript origins** agrega el origen exacto de la app:
   - Desarrollo: `http://localhost:3000` (o el `APP_ORIGIN` que uses).
   - Producción: `https://tu-dominio.com`.
   No se necesita **Authorized redirect URI** para el botón de Google Identity Services.
5. Copia el Client ID (termina en `.apps.googleusercontent.com`) en `GOOGLE_CLIENT_ID` dentro de `.env`.
6. Reinicia el servidor. El botón aparece en la pantalla de acceso cuando el Client ID es válido.

Seguridad del flujo:

- El backend valida la firma del ID token con `google-auth-library`, además de `aud`, `iss`, `exp`, `sub` y `email_verified`.
- El frontend solicita un nonce de un solo uso al servidor; el token debe incluirlo y el nonce se elimina tras usarlo. Esto reduce la reutilización de tokens.
- La identidad se vincula por `sub` de Google. Si el usuario aún no tiene `google_sub`, se vincula por correo verificado.
- No se crean cuentas automáticamente: el correo debe existir previamente como usuario activo y el rol siempre se toma de la base de datos.
- El Client ID es público; nunca configures un client secret en este proyecto.

## Scripts

```bash
npm start        # Inicia el servidor
npm run dev      # Servidor con recarga automática
npm run seed:demo # Crea datos demo si faltan
npm test         # Pruebas de integración de la API
npm run lint     # ESLint
npm run check    # Comprobación de sintaxis + lint
```

## Roles y permisos

| Rol | Acceso principal |
| --- | --- |
| `admin` | Todo, usuarios, reinicio demo y configuración operativa |
| `mesero` | Panel, mesas, reservas, pedidos, cocina (lectura) y despachos |
| `cocina` | Panel, mesas, pedidos, cola de cocina y cambios de estado de platos |
| `despacho` | Panel, mesas, pedidos, despachos y entregas |

La interfaz oculta acciones sin permiso, pero la autorización real se valida en cada endpoint del servidor.

## Seguridad

- Contraseñas con Argon2id y sal.
- Cookie de sesión `HttpOnly`, `SameSite=Strict` y `Secure` en HTTPS.
- Protección CSRF mediante validación de `Origin`/`Referer`.
- Rate limiting en inicio de sesión y Google.
- ID tokens de Google verificados en servidor, con nonce de un solo uso.
- Validación compartida cliente/servidor.
- Consultas SQL parametrizadas.
- CSP y cabeceras de seguridad con Helmet.
- Sesión y permisos en memoria del navegador; no se usa `localStorage`.
- Datos de negocio persistidos únicamente en SQLite del servidor.

## Estructura

```text
public/            Frontend: HTML, CSS, JavaScript y assets
shared/            Dominio y validaciones compartidas
src/
  auth/            Sesiones, contraseñas y Google
  db/              SQLite, migraciones y datos demo
  domain/          Lógica de negocio
  http/            Rutas y manejo de respuestas
  security/        CSRF y rate limiting
scripts/           Utilidades de comprobación y seed
tests/             Pruebas de integración
data/              Base SQLite local (no incluir en el ZIP)
```

## API

Todas las rutas usan el prefijo `/api`.

- `GET /health`
- `GET /auth/config`, `POST /auth/login`, `GET /auth/google/nonce`, `POST /auth/google`, `GET /auth/me`, `POST /auth/logout`
- `GET /dashboard`, `GET /tables`, `GET /dishes`
- `GET|POST /reservations`, `GET|PATCH /reservations/:id`, `POST /reservations/:id/cancel`, `POST /reservations/:id/complete`
- `GET|POST /orders`, `GET /orders/:id`, `POST /orders/:id/cancel`
- `GET /kitchen/queue`, `POST /kitchen/items/:id/start`, `POST /kitchen/items/:id/ready`
- `GET /dispatches/ready`, `GET|POST /dispatches`, `POST /dispatches/:id/deliver`
- `GET|POST /users`, `PATCH /users/:id`, `POST /users/:id/password`
- `POST /admin/demo/reset`

Las respuestas exitosas usan `{ "data": ... }`. Los errores usan `{ "error": { "code": "...", "message": "...", "fields": ... } }`.

## Pruebas

```bash
npm test
```

Las pruebas de integración usan una base SQLite temporal, modo demo y servidores efímeros. Cubren autenticación, CSRF, permisos por rol, reservas, pedidos, cocina, despachos, reinicio demo y el flujo de nonce de Google con el proveedor deshabilitado y habilitado.

También se verificó la interfaz con Chrome headless: login, panel, reservas, pedidos, cocina, despachos y usuarios.

## Datos y copias de seguridad

- La base de datos está en `data/` y está excluida de Git.
- Para respaldar, detén el servidor y copia el archivo SQLite junto con sus archivos `-wal` y `-shm` si existen.
- No copies `.env`, `.demo-credentials.txt` ni `data/` en el ZIP de entrega.

## Alcance y limitaciones

- Sistema para un restaurante; no es multi-sucursal.
- No envía correos ni notificaciones externas.
- Google no aprovisiona usuarios automáticamente.
- El reinicio demo solo funciona con `DEMO_MODE=true`.
- Las credenciales demo son solo para desarrollo/demostración.

## Entrega

El ZIP `sistema-reservas-restaurante.zip` debe excluir:

- `node_modules/`
- `data/`
- `.env`
- `.demo-credentials.txt`
- `.git/`
- `coverage/`, `tmp/`, `dist/`
- el propio ZIP

Para ejecutarlo en otro equipo:

```bash
npm install
cp .env.example .env
npm start
```
