# Paquete de prompts para Orca

Estos prompts coordinan dos agentes en el mismo proyecto. Usa OpenAI como responsable técnico e integrador; usa Claude para la implementación de interfaz y experiencia de usuario. Ambos deben trabajar sobre el mismo repositorio Orca, acordar primero contratos y rutas, y evitar editar simultáneamente los mismos archivos. OpenAI revisa, integra y resuelve conflictos al final.

## Prompt 1 — OpenAI: arquitectura, autenticación, seguridad e integración

```text
Actúa como líder técnico de un sistema de reservas para un restaurante. Trabaja dentro del workspace/repositorio asignado por Orca. Puedes delegar análisis o tareas aisladas a subagentes si Orca lo permite, pero conserva una única arquitectura y revisa personalmente toda integración.

OBJETIVO
Construir un sistema funcional, ordenado, responsive y mantenible para reservas, mesas, pedidos/platos, cocina y despachos. Antes de cambiar nada, inspecciona el repositorio, sus instrucciones (AGENTS.md y equivalentes), el stack, archivos existentes, configuración, pruebas y los dos documentos de referencia entregados. No asumas que el repositorio está vacío. Conserva y adapta los ejemplos/códigos de los documentos cuando sean técnicamente válidos; registra qué reutilizaste y qué corregiste.

REQUISITOS FUNCIONALES DE REFERENCIA
- Roles: Administrador (control total: mesas, reservas, pedidos, despachos, usuarios); Mesero (mesas, reservas, pedidos y despachos); Cocina (cola de platos y estados); Despacho (gestión de entregas).
- Flujo: crear reservas con mesa/fecha/hora/personas; pedidos con uno o más platos; cocina actualiza cada plato a preparación/listo; despacho desde platos listos con estados en ruta/entregado.
- Dashboard: reservas del día, platos pendientes, despachos activos y mesas ocupadas; vista de 8 mesas y estados disponible/reservada/ocupada; catálogo inicial de 8 platos y datos demo si el entorno lo requiere.
- El administrador puede restablecer datos demo con confirmación y controles apropiados.
- Persistencia tras recargar; interfaz en español.

DECISIÓN DE ARQUITECTURA Y SEGURIDAD (OBLIGATORIO)
1. Decide según el stack y alcance encontrado si hace falta backend y base de datos. Para producción, no presentes `localStorage` como almacenamiento seguro ni como autoridad de permisos. Propón e implementa persistencia en servidor/base de datos con autenticación y autorización verificadas en servidor. Si no hay backend y el alcance disponible obliga a una demo local, documenta explícitamente que es solo demostración, limita los datos y no guardes credenciales ni secretos allí.
2. No guardes contraseñas, hashes de contraseñas, secretos OAuth, refresh tokens ni datos sensibles en `localStorage`. Un hash ejecutado en el navegador no protege un sistema cuyo cliente controla el usuario. Para sesiones, elige el mecanismo seguro compatible con la arquitectura (preferible cookie `HttpOnly`, `Secure`, `SameSite` con backend). Si la demo exige Web Storage, guarda solo estado mínimo no sensible y valida forma, versión y tamaño al leer; trata todo su contenido como entrada no confiable, maneja JSON corrupto y migraciones, y no lo uses para conceder permisos.
3. Contraseñas: si hay backend, usa una función de derivación para contraseñas apropiada y con sal (por ejemplo Argon2id; alternativa compatible documentada), límites/retardo contra fuerza bruta y mensajes que no revelen si una cuenta existe. Nunca uses cifrado reversible ni SHA simple como almacenamiento de contraseñas.
4. Control de acceso por rol: centraliza permisos y aplícalos en servidor para cada operación; además oculta/protege vistas en cliente por experiencia. No confíes en un rol proveniente de localStorage, query string o estado del navegador. Aplica mínimo privilegio.
5. Validación: valida en cliente para UX y vuelve a validar en servidor. Usa esquemas/types compartidos si el stack lo permite; valida fechas y zonas horarias, capacidad de mesa/personas, estados permitidos, IDs, cantidades y transiciones. Evita inyección, XSS (escape/renderizado seguro), CSRF si aplica, abuso de endpoints y asignaciones masivas. No insertes contenido de usuario con HTML sin sanitización.
6. Google Identity Services: inspecciona cualquier implementación real de `GoogleAuth.init()` en el repo/documentos antes de integrarla. Verifica que use GIS vigente, que el `CLIENT_ID` sea público y provenga de configuración, que el callback maneje errores, nonce/state según flujo y que se comprueben `aud`, `iss`, `exp` y firma. Un decode de JWT no valida autenticidad. La consulta del navegador a `tokeninfo` no debe presentarse como verificación suficiente para producción: valida el ID token en backend mediante biblioteca oficial/Google y vincula la identidad por `sub`; asigna roles en base de datos confiable, nunca por un email/rol controlado por el cliente. Si aún no existe backend, ofrece GIS solo como prototipo claramente rotulado, sin declarar segura la autorización. Configura orígenes permitidos y no inventes un Client ID. No solicites ni incluyas secretos reales.
7. Registra decisiones y limitaciones. Añade configuración de ejemplo sin secretos, `.gitignore`, y guía de configuración segura.

ESTRUCTURA Y CALIDAD
- Respeta el stack encontrado. Si no hay uno, propone una estructura modular simple antes de construir: separar UI, dominio/servicios, persistencia, validación, auth/permisos y estilos; no apiles toda la lógica en un solo archivo.
- Evita duplicación, estado global confuso y funciones gigantes. Define contratos entre módulos y tipos/estados explícitos. Añade manejo consistente de errores y estados vacíos/carga.
- No mantengas las cuentas demo `admin/admin123`, etc. como cuentas utilizables en producción. Si hacen falta para demostración, marca datos de demo, exige entorno de desarrollo y evita contraseñas compartidas predecibles.
- Antes de que Claude implemente UI, acuerda con él/Orca contratos de componentes, rutas/vistas, modelo de datos y permisos. Asigna archivos exclusivos para prevenir conflictos. Claude es responsable de UI; tú de arquitectura, auth, persistencia/backend, reglas del dominio e integración.

ENTREGABLES Y CIERRE
Implementa e integra el sistema, no te limites a una propuesta. Documenta estructura y arranque en README, variables requeridas, decisiones de almacenamiento/auth, matriz de roles/permisos, datos demo, y límites de seguridad. Inspecciona cambios con diff y ejecuta solo verificaciones pertinentes acordes al repo; informa resultados reales y fallos pendientes sin afirmar que una prueba pasó si no se ejecutó. Revisa `GoogleAuth.init()` específicamente e informa archivo/línea y hallazgos.

Al concluir, genera un ZIP del proyecto completo y necesario para ejecutarlo, excluyendo `.git`, dependencias pesadas regenerables, secretos, `.env` reales, cachés y artefactos temporales. Incluye `.env.example` si corresponde. Nombra el paquete `sistema-reservas-restaurante.zip`, confirma su ruta y enumera contenido excluido. Si el repo o el entorno impide crear una solución backend segura, entrega el alcance realmente implementado y describe con precisión qué queda como demo y qué falta para producción.
```

## Prompt 2 — Claude: interfaz responsive y experiencia de usuario

```text
Eres responsable de la interfaz y experiencia de usuario del sistema de reservas para restaurante en el workspace Orca compartido. Implementa, no te limites a sugerir. Puedes usar subagentes si están disponibles para tareas aisladas (por ejemplo revisión visual/accesibilidad), pero coordina antes los contratos con el agente OpenAI líder. No edites autenticación, almacenamiento, backend ni archivos que se hayan asignado a OpenAI sin acuerdo explícito. Trabaja en archivos/UI de tu propiedad y entrega commits/diff claros según el flujo Orca.

PRIMERO
Inspecciona el repo, AGENTS.md, stack, diseño existente y los documentos de referencia. Coordina con OpenAI el modelo de datos, roles, rutas y contratos UI antes de consumirlos. No inventes endpoints o funciones; acuerda stubs/contratos temporales si el backend todavía no está listo. Conserva el código de referencia útil, pero informa incompatibilidades.

DISEÑO
Crea una interfaz profesional para restaurante, con acabado cuidado inspirado en la claridad y pulido visual de iPhone/iOS (sin copiar marcas ni pantallas propietarias): jerarquía tipográfica clara, espacio generoso, tarjetas limpias, controles táctiles cómodos, estados visuales consistentes, iconografía coherente, foco visible y contraste accesible. Debe funcionar desde móvil hasta escritorio; en móvil usa navegación compacta y accesible, tablas convertidas en tarjetas/listas cuando convenga, formularios legibles y sin scroll horizontal. No sacrifiques claridad operativa por decoración. Interfaz en español.

VISTAS A IMPLEMENTAR
- Acceso y estado de sesión según contrato de auth acordado (sin credenciales hardcodeadas ni persistencia de credenciales en localStorage).
- Dashboard con reservas de hoy, platos pendientes, despachos activos y mesas ocupadas.
- Mesas (8 iniciales si el backend/demo las provee), estados disponible/reservada/ocupada y leyenda comprensible.
- Reservas: listado, búsqueda/filtros, creación y edición, validación de errores accesible.
- Pedidos y platos; estados por plato en cola/preparación/listo.
- Vista de cocina optimizada para lectura rápida y acciones táctiles.
- Despachos con estados preparado/en ruta/entregado según máquina de estados del backend.
- Usuarios y reinicio demo solo visibles al administrador; reinicio con confirmación explícita.
- Navegación y contenido adaptados por permisos entregados por el backend/contrato. El ocultamiento en UI es una ayuda UX, nunca la barrera de seguridad.

CALIDAD Y ACCESIBILIDAD
Usa componentes pequeños y reutilizables, estados de carga/vacío/error/éxito, etiquetas de formularios, mensajes asociados a campos, navegación teclado, semántica y contraste. Mantén un sistema de tokens CSS y evita estilos duplicados o una hoja monolítica. No uses `innerHTML` con datos de usuario. No guardes datos de negocio o permisos en `localStorage` desde tu capa; usa el servicio/repositorio acordado. Si el backend no está listo, utiliza fixtures claramente aislados y reemplazables, nunca afirmes que son persistencia segura.

COORDINACIÓN Y ENTREGA
Comparte con OpenAI contratos requeridos (props, endpoints/servicios, estados y permisos) pronto. Notifica archivos asignados y evita modificar sus archivos. Integra el backend cuando esté disponible; no cierres con mocks como si el producto estuviera terminado. Devuelve lista de vistas implementadas, decisiones de diseño, archivos cambiados, verificaciones visuales/funcionales realmente realizadas y bloqueos. Colabora en la revisión final del ZIP, pero OpenAI será responsable de crear y confirmar el `sistema-reservas-restaurante.zip` completo.
```

## Secuencia sugerida en Orca

1. Abrir ambos agentes en el mismo workspace y enviar el prompt correspondiente. OpenAI inicia inspección y publica arquitectura, contratos y asignación de archivos; Claude espera esos contratos mientras analiza UI.
2. Claude desarrolla UI en sus archivos asignados. OpenAI implementa modelo, persistencia, backend/auth y validación. Sincronizan cambios mediante el flujo de ramas/commits de Orca y resuelven contratos antes de integrar.
3. OpenAI integra y revisa permisos del lado servidor, persistencia, `GoogleAuth.init()`, manejo de errores y documentación. Claude revisa responsive, teclado, contraste y flujos principales.
4. Ejecutar verificaciones compatibles con el proyecto, reportar resultados y crear el ZIP final sin secretos. No incluir credenciales demo como si fueran seguras ni presentar el frontend local como seguro para producción.

## Notas derivadas de los documentos

- La estructura de referencia propone `index.html`, `css/styles.css` y `js/{storage,auth,modules,app}.js`, cuatro roles, datos demo, ocho mesas y ocho platos. Se debe adaptar al stack del repositorio y evitar que toda la lógica termine acoplada en `modules.js`.
- La guía explica GIS y el ID token, pero su propuesta de decodificar en cliente y consultar `tokeninfo` desde navegador no equivale a verificar la firma de forma confiable para producción. Un backend debe validar el token y establecer la sesión; el rol debe proceder de una fuente confiable.
- `localStorage` persiste y puede ser leído/modificado por quien controla el navegador o por scripts ejecutados en el origen. Validar su JSON reduce errores, pero no convierte su contenido en almacenamiento seguro ni permite confiar en permisos.
- “SIB” se interpreta como “ZIP” por el contexto. El archivo final debe contener el proyecto implementado; los prompts por sí solos no constituyen ese ZIP.
