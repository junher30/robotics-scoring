# Fase 11 — Invitaciones y gestión de usuarios

## Qué construimos

Cada persona entra a RoboScore por invitación, nunca por auto-registro. Un SUPER_ADMIN invita administradores y jueces; un ADMIN solo invita jueces y solo ve a los que él mismo invitó. El flujo completo:

1. El organizador completa el formulario en `/admin/usuarios/nuevo` (o `/admin/jueces/nuevo`, `/admin/administradores?rol=ADMIN`): nombre, apellido, correo, teléfono opcional y rol.
2. El servidor reserva la invitación con `roboscore_prepare_user_invitation` (nombre, apellido, teléfono y rol quedan fijados ahí, no en el navegador) y llama a Supabase Auth Admin (`inviteUserByEmail`) con esa reserva como referencia.
3. La persona recibe el correo de Supabase con el enlace de `/auth/invitacion?token_hash=...` y pulsa **Aceptar invitación**.
4. Al aceptar, `auth.verifyOtp({type:'invite'})` confirma el enlace y crea la cuenta en Supabase Auth. El disparador `roboscore_auth_user_created` (fase 4, con la función reemplazada en esta fase) busca la reserva por correo e id de invitación y crea el perfil en `public.profiles` con el nombre, rol y responsable ya decididos por el organizador — nunca con datos que la persona invitada pueda escribir.
5. La persona elige su propia contraseña en `/cuenta/crear-clave` (`auth.updateUser({password})`). RoboScore nunca ve ni guarda esa contraseña: la gestiona Supabase Auth. Lo único que RoboScore guarda es el perfil (nombre, correo, teléfono, rol, responsable) y su estado de acceso (activo o desactivado).
6. Desde ahí entra a su área según su rol.

`/admin/usuarios`, `/admin/administradores` y `/admin/jueces` listan las cuentas con filtro por rol/estado y paginación de 20. La ficha de cada cuenta (`/admin/usuarios/[id]`) permite editar nombre, teléfono, rol y estado con control de concurrencia (versión por `updated_at`); el correo no se cambia desde ahí. Desactivar una cuenta bloquea su acceso sin borrar su historial. Un ADMIN no puede editarse a sí mismo ni tocar a un SUPER_ADMIN; solo el SUPER_ADMIN asigna el rol ADMIN.

## Qué falta para activarlo (esto es lo que conecta el flujo)

El código ya estaba completo, pero **la invitación no puede salir todavía** porque al servidor le faltan dos variables y a Supabase dos ajustes de panel. `lib/supabase/admin.ts` (`invitationConfig`) exige ambas variables y `inviteUser` se niega a intentarlo sin ellas ("Falta configurar el servicio de invitaciones en el servidor").

1. **`SUPABASE_SECRET_KEY`** (la *service role key*/*secret key* del proyecto: Supabase Dashboard → Project Settings → API → "Service role"/"Secret keys"). Solo se usa en el servidor, nunca se expone al navegador, y solo para `auth.admin.inviteUserByEmail`.
2. **`ROBOSCORE_SITE_URL`**: la URL pública del sitio, sin ruta ni barra final (por ejemplo `http://localhost:3000` en desarrollo o `https://tudominio.com` en producción). A partir de ahí se arma `${ROBOSCORE_SITE_URL}/auth/invitacion` como `redirectTo`.

Añade ambas a `.env.local` (o a las variables de entorno del despliegue) y reinicia `npm run dev`. Por seguridad no se generaron aquí: la secret key solo debe copiarse desde tu panel de Supabase a tu propio archivo.

3. **Supabase Dashboard → Authentication → URL Configuration**: agrega `http://localhost:3000/auth/invitacion` (y la URL de producción cuando exista) a "Redirect URLs". Sin esto Supabase puede rechazar el `redirectTo` que envía `inviteUserByEmail`.
4. **Supabase Dashboard → Authentication → Emails → Invite user**: reemplaza la plantilla por el contenido de `supabase/email-templates/invite-user.html` del proyecto. La plantilla por defecto de Supabase usa `{{ .ConfirmationURL }}`, que no coincide con el flujo de esta app (verificación por `token_hash` en `/auth/invitacion`); hay que usar `{{ .RedirectTo }}?token_hash={{ .TokenHash }}` como en ese archivo.

Con esos cuatro puntos resueltos, enviar una invitación desde `/admin/usuarios/nuevo` queda operativo de extremo a extremo.

## Activar el SQL en Supabase

1. Abre tu proyecto Supabase → SQL Editor → New query.
2. Copia todo `supabase/migrations/202609200004_user_management.sql` y pulsa Run. Espera `Success. No rows returned`.
3. Ejecuta `supabase/verify-phase-11.sql` en otra consulta. Los ocho checks deben mostrar `true`.

Repetible: no reenvía correos, no cambia cuentas existentes y no desactiva RLS.

## Seguridad, explicada antes de usarla

- El rol y el estado de una cuenta nueva **nunca** salen de `user_metadata` (que la persona invitada podría alterar): salen únicamente de la reserva en `roboscore_private.user_invitations`, creada por un ADMIN/SUPER_ADMIN activo antes de llamar a Auth, y verificada de nuevo (correo + id de invitación) cuando Auth crea la cuenta.
- `roboscore_prepare_user_invitation` normaliza el correo, bloquea invitaciones simultáneas al mismo correo, exige 60 segundos entre reintentos y un máximo de 20 invitaciones por hora por organizador, y evita que un ADMIN invite a otro ADMIN o SUPER_ADMIN.
- `roboscore_private.user_invitations` tiene RLS activo y **revoke total**: ni `anon` ni `authenticated` pueden leerla directamente; solo las funciones `SECURITY DEFINER` con `search_path` fijo la consultan.
- `profiles` sigue sin INSERT/UPDATE/DELETE directo desde el cliente; todo pasa por `roboscore_prepare_user_invitation`, el disparador de creación y `roboscore_update_managed_user`.
- Un ADMIN solo lee/edita a los jueces con `managed_by = su id`; la política `profiles_read_managed_judges` lo aplica en la base de datos, no solo en la interfaz.
- Nadie puede modificarse a sí mismo ni a un SUPER_ADMIN desde este módulo; solo un SUPER_ADMIN asigna el rol ADMIN.
- La contraseña nunca pasa por una tabla de RoboScore: la fija la propia persona en Supabase Auth (`auth.updateUser`), y `savePassword` exige sesión activa (`requireAccess`) antes de aceptar el cambio.

## Cómo probar (con la configuración anterior ya lista)

1. En `/admin/usuarios`, pulsa **Invitar usuario** (o **Invitar juez** desde `/admin/jueces`).
2. Completa el formulario con un correo real al que tengas acceso y envía. Debe aparecer "Invitación enviada".
3. Abre el correo y pulsa **Aceptar invitación**. Debes llegar a "Crea tu contraseña".
4. Elige una contraseña de al menos 12 caracteres; al guardar debes entrar a tu área (`/admin` o `/judge` según el rol).
5. Vuelve a `/admin/usuarios`: la cuenta debe aparecer activa con el rol asignado.
6. Abre su ficha, cambia el estado a Desactivado y guarda; la persona invitada no debe poder iniciar sesión hasta reactivarla.
7. Si eres ADMIN (no SUPER_ADMIN), confirma que solo ves a los jueces que tú invitaste y que no puedes invitar administradores.

Para comprobar los límites: reenvía la misma invitación antes de un minuto (debe pedir esperar) y vuelve a invitar el mismo correo ya confirmado (debe indicar que la cuenta ya existe).

## Archivos

- `app/auth/invitacion/`: página, formulario y acción para aceptar la invitación (`verifyOtp`).
- `app/cuenta/crear-clave/`: página, formulario y acción para fijar la contraseña (`auth.updateUser`).
- `app/admin/usuarios/`: listado, ficha, formulario y acciones de invitar/editar; `app/admin/jueces/` y `app/admin/administradores/` reutilizan el mismo módulo filtrado.
- `lib/users/`: validación (`schema.ts`, `password.ts`) y autorización (`access.ts`).
- `lib/supabase/admin.ts`: cliente de Auth Admin y configuración de invitaciones (`invitationConfig`, `invitationsReady`).
- `supabase/migrations/202609200004_user_management.sql` y `supabase/verify-phase-11.sql`: permisos, funciones y verificación.
- `supabase/email-templates/invite-user.html`: plantilla a copiar en el panel de Supabase.
- `tests/user-permissions.mjs`, `tests/user-actions.test.cjs`: pruebas.

## Comandos

```sh
npm run build -- --webpack
npx eslint app/admin/usuarios app/auth/invitacion app/cuenta/crear-clave lib/users lib/supabase/admin.ts
node --test tests/auth-access.test.cjs tests/user-actions.test.cjs
node tests/user-permissions.mjs
```

## Errores y qué hacer

- **"Falta configurar el servicio de invitaciones en el servidor"**: faltan `SUPABASE_SECRET_KEY` o `ROBOSCORE_SITE_URL` en el entorno del servidor.
- **El correo no llega**: revisa la plantilla "Invite user" en el panel y que el correo no esté ya registrado.
- **"El enlace venció o ya fue utilizado"**: la invitación expira a los 15 minutos o ya se usó; pide una nueva desde el listado.
- **"La cuenta no está habilitada"**: el perfil no quedó activo (revisa que la reserva siga vigente y que quien invitó siga activo).
- **"La cuenta cambió en otra sesión"**: recarga la ficha antes de reintentar el guardado.

## Evidencia

Pendiente de ejecutar contra el proyecto Supabase real: aplicar el SQL, configurar las dos variables de entorno y los dos ajustes del panel, y enviar una invitación real de extremo a extremo. Las pruebas automatizadas (`tests/user-permissions.mjs` sobre PostgreSQL en memoria, sin conexión a Supabase ni envío de correos) verifican la reserva de invitaciones, el disparador de creación de perfiles y la edición de cuentas gestionadas.
