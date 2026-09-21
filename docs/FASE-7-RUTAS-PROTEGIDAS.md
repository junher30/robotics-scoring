# Fase 7 — Rutas protegidas por rol

Proyecto activo: `/Users/gregorihernandezvanegas/Desktop/robotics-scoring`.

## Comportamiento

- SUPER_ADMIN y ADMIN entran a `/admin`.
- JUDGE entra a `/judge`.
- `/cuenta` admite cualquier cuenta activa y permite volver a su área.
- Sin una sesión válida o un perfil activo, las rutas privadas redirigen al login.
- Un rol incorrecto redirige a su propia área con un aviso de permisos.
- Tanto iniciar sesión como visitar `/login` con sesión válida llevan al área correspondiente.

La autorización se comprueba en el servidor mediante `requireAccess`, usando el usuario validado por Supabase Auth y el perfil consultado de la base de datos. No se confía en parámetros enviados por el navegador. El proxy renueva cookies en las rutas privadas; no sustituye la autorización.

Las nuevas páginas muestran el área y la cuenta autorizada. La gestión de eventos y la calificación siguen pendientes de las siguientes fases. No hay cambios de SQL ni ampliación de permisos de las tablas de negocio.

Cada futura página privada y cada operación sobre datos deberá llamar a `requireAccess` con el área correspondiente. Un layout no basta para proteger Server Actions ni endpoints. Las futuras operaciones requerirán además permisos por evento y políticas RLS apropiadas.

## Verificación

Compilación de producción y TypeScript correctos; ESLint de archivos modificados correcto. `node --test tests/auth-access.test.cjs`: 13 pruebas correctas, con Auth/perfiles simulados, cubriendo tres roles, rol desconocido, perfil inexistente, inactividad y errores del servicio. En navegador se comprobó que `/admin` y `/judge` sin sesión redirigen al login.

## Tu prueba

1. Abre http://localhost:3000/login e inicia sesión con tu cuenta existente.
2. Debes entrar a `/admin` y ver “Espacio de administración” y “Superadministrador”.
3. Abre http://localhost:3000/judge: debe devolverte a `/admin` con un aviso de permisos.
4. Cierra sesión; vuelve a abrir `/admin`: debe pedir iniciar sesión.

No es necesario ejecutar consultas SQL. Las pruebas automatizadas no usaron la contraseña ni iniciaron sesión en la cuenta real del usuario.
