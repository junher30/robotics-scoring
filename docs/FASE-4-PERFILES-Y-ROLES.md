# Fase 4: perfiles y roles

## Qué estamos haciendo

Supabase Auth guarda las cuentas y contraseñas. La tabla profiles guarda los datos de RoboScore y su rol. Ambos usan el mismo UUID, que identifica de manera única a una cuenta. Nunca guardamos contraseñas en profiles.

La fase 4 crea el ENUM user_role (lista de valores permitidos): SUPER_ADMIN, ADMIN y JUDGE. Estos valores no conceden todavía acceso a eventos, equipos ni puntuaciones: esas tablas conservan su protección de fase 3 hasta desarrollar sus políticas.

## Archivos completos

En /Users/gregorihernandezvanegas/Desktop/robotics-scoring:

- supabase/migrations/202609160001_profiles_roles.sql: nueva migración completa.
- supabase/verify-phase-4.sql: consulta de verificación completa.

No reemplaces ni vuelvas a ejecutar la migración de fase 3. Una migración aplicada forma parte del historial; las correcciones se hacen en nuevos archivos.

## Qué guarda profiles

id, first_name, last_name, email, role, phone, avatar_url, active, created_at y updated_at.

Los nombres pueden quedar vacíos si la cuenta todavía no tiene datos personales. Los usuarios existentes reciben un perfil. Cada nueva cuenta recibe automáticamente un perfil JUDGE inactivo. No se asume que registrarse concede permiso para calificar.

## Cómo funcionan los triggers

Un trigger ejecuta una función automáticamente cuando cambia una tabla. Al insertar un usuario en auth.users se crea profiles. Al cambiar su email en Auth se sincroniza el correo del perfil. updated_at se actualiza al modificar el perfil.

La función de creación toma únicamente nombres de los metadatos. Ignora role y active, porque los metadatos de usuario no son una fuente segura de permisos. Ni escribir SUPER_ADMIN en los metadatos ni cambiar el correo permite obtener permisos administrativos.

Las funciones internas usan SECURITY DEFINER, lo que permite que el trigger escriba con permisos de su propietario. Por eso están en roboscore_private, con search_path vacío, nombres de tablas completos y permisos limitados. No añadas roboscore_private a los esquemas expuestos de Data API.

## Policies explicadas antes de ejecutarlas

1. profiles_read_self: un usuario autenticado puede leer únicamente su propio perfil. Si está inactivo puede leerlo para recibir un mensaje de cuenta desactivada; esto no lo autoriza a entrar a los paneles.
2. profiles_read_super_admin: un SUPER_ADMIN activo puede leer todos los perfiles. Su rol se consulta en la base de datos, no en un valor aportado por el navegador. Al desactivarlo pierde esa lectura ampliada, aunque tenga un token vigente.

No hay policies ni permisos de escritura para el cliente. JUDGE, ADMIN y SUPER_ADMIN no pueden actualizar directamente profiles desde el navegador. Los cambios administrativos se incorporarán en su fase con funciones de servidor, autorización y auditoría. Las cuentas anónimas no pueden leer perfiles.

El propietario del proyecto en SQL Editor sigue teniendo acceso administrativo, como corresponde. Esta fase no crea ni promueve un SUPER_ADMIN. Lo haremos de forma explícita al preparar la primera cuenta; nunca por registro público ni por metadatos.

Las referencias de eventos, asignaciones y participantes se amplían a profiles sin borrar datos. ON DELETE RESTRICT conserva las referencias y exige desactivar cuentas en lugar de borrar registros de identidad.

## Cómo ejecutarlo

1. Abre tu proyecto en https://supabase.com/dashboard.
2. SQL Editor → New query.
3. Copia todo 202609160001_profiles_roles.sql, pégalo y pulsa Run una sola vez.
4. Si Supabase pregunta por RLS, el archivo incluye ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY explícitamente; mantén RLS habilitado.
5. Resultado esperado: Success. No rows returned.
6. Abre otra consulta y ejecuta verify-phase-4.sql.
7. Deben aparecer nueve filas con passed=true.
8. Table Editor mostrará profiles. Puede estar vacía si aún no creaste cuentas en Authentication.

No necesitas comandos de terminal ni claves Secret. Esta fase no cambia la interfaz ni añade login.

## Errores comunes

- user_role ya existe: no repitas la creación ni borres objetos. Ejecuta la verificación y comparte el resultado.
- profiles o alguna función ya existe: detente; puede haber una implementación previa que debemos revisar.
- events o roboscore_set_updated_at no existe: comprueba que estás en el mismo proyecto donde ejecutaste fase 3.
- profiles vacía: es normal si auth.users no contiene cuentas; tu usuario del dashboard Supabase no es automáticamente usuario de RoboScore.
- Permission denied desde la web: no desactives RLS; los módulos protegidos se conectarán en las fases siguientes.

## Comprobación

El SQL se prueba localmente con PostgreSQL PGlite y una representación de auth.users y auth.uid. Se comprueban backfill, triggers, sincronización del email, lectura por rol, rechazo de cambios de rol y metadatos falsificados. No equivale a ejecutarlo en tu Supabase. La fase termina después de que confirmes las nueve filas correctas.

Fuentes: https://supabase.com/docs/guides/auth/managing-user-data y https://supabase.com/docs/guides/database/postgres/row-level-security
