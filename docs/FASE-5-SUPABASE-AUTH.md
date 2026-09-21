# Fase 5: Supabase Auth y primera cuenta SUPER_ADMIN

Supabase Auth guarda las cuentas y sus contraseñas de forma segura. profiles añade el rol y estado de RoboScore. Esta fase configura Auth y prepara una cuenta; el formulario de login es fase 6 y la protección de rutas, fase 7.

## 1. Configurar el acceso

En tu proyecto Supabase abre Authentication y busca Sign In / Providers (el nombre de la sección puede variar):

- Email: habilitado.
- Allow new users to sign up: deshabilitado. Las cuentas las crearán los administradores.
- Allow anonymous sign-ins: deshabilitado.
- Confirm email: habilitado.

Guarda los cambios. Deshabilitar el registro público no impide crear usuarios mediante las herramientas administrativas. No desactives la confirmación global para solucionar errores de una cuenta.

## 2. Dirección de la aplicación

En Authentication → URL Configuration:

- Site URL: http://localhost:3000
- Para esta fase no hacen falta redirecciones adicionales.

Guarda. Cuando implementemos invitaciones y recuperación, registraremos las rutas exactas que existan. No añadimos rutas ficticias ni comodines de producción. La URL de Supabase (.supabase.co) no se coloca como Site URL: aquí va la dirección de RoboScore.

## 3. Crear TU primera cuenta

Authentication → Users → Add user → Create new user.

Usa josegre301@gmail.com, el correo que elegiste, y escribe una contraseña única, preferiblemente generada y guardada en tu gestor. No la compartas en el chat ni la escribas en un archivo SQL. Para esta cuenta inicial que tú creas desde el panel administrativo, marca Auto Confirm User si está disponible. Esto confirma la cuenta por decisión tuya como propietario, no mediante un enlace enviado por correo; utilízalo solo para tu cuenta cuyo correo ya verificaste.

No elijas Invite user todavía: aún no existe una página para aceptar invitaciones y crear contraseña en RoboScore. Si la cuenta ya existe, no la dupliques; revisa su estado y usa esa misma cuenta.

Al crearla, la fase 4 genera un perfil JUDGE con active=false. Eso es correcto. Los roles se asignan después y no deben ponerse en user_metadata.

Copia el UUID del usuario en Authentication > Users. Es el identificador largo con guiones. Comprueba el correo mostrado junto a él. Tu cuenta del dashboard de Supabase no se convierte automáticamente en cuenta de RoboScore.

## 4. Convertir esa cuenta en el primer SUPER_ADMIN

Archivo completo: supabase/admin/create-first-super-admin.sql, dentro del proyecto del Escritorio.

Cópialo en SQL Editor → New query. El correo ya está configurado. Cambia únicamente el UUID de esta línea:

    target_id uuid := '00000000-0000-0000-0000-000000000000';
    expected_email text := 'josegre301@gmail.com';

Sustituye el UUID dentro de las comillas; conserva el correo configurado. Mantén las comillas y el punto y coma. Comprueba que el UUID pertenece a tu correo. Ejecuta como postgres.

El archivo comprueba la correspondencia UUID/correo, confirmación del correo, bloqueo de Auth y existencia del perfil. Solo convierte una cuenta si no existe otro SUPER_ADMIN. Bloquea operaciones simultáneas para evitar que dos ejecuciones creen dos primeros administradores. Repetirlo para el mismo SUPER_ADMIN activo no cambia nada; no permite reactivar uno deshabilitado ni crear un segundo. No instala una función accesible desde el navegador.

## 5. Verificar

En una consulta nueva ejecuta supabase/verify-phase-5.sql.

Debe aparecer exactamente una fila con tu correo, role=SUPER_ADMIN, active=true, email_confirmed=true, regular_account=true y auth_not_banned=true.

La consulta verifica la cuenta, no prueba todavía el formulario de login. Además, confirma visualmente los ajustes del paso 1. El propietario puede ver los ajustes en el Dashboard; nuestra clave pública no permite cambiarlos.

## Errores comunes

- No existe esa cuenta: comprueba el proyecto y UUID en Authentication > Users.
- UUID y correo no corresponden: revisa ambos valores; no cambies la comprobación del SQL.
- Correo no confirmado: revisa la cuenta en Auth. No basta con actualizar profiles.email.
- Ya existe otro SUPER_ADMIN: ejecuta la verificación. No quites esta protección ni borres perfiles.
- Falta profiles: revisa las nueve comprobaciones de fase 4.
- Consulta devuelve cero filas: aún no se ha asignado el rol de SUPER_ADMIN.
- Cambiar el Site URL no cambia la página: es normal, configura destinos de Auth; no modifica el diseño.

No hay comandos de terminal ni dependencias que instalar en esta fase. No importamos el Excel, no enviamos invitaciones y no creamos login todavía. Conserva el SQL de preparación fuera de la carpeta de migraciones automáticas.

Fuentes oficiales:
https://supabase.com/docs/guides/auth/general-configuration
https://supabase.com/docs/guides/auth/redirect-urls
https://supabase.com/docs/guides/auth/users
