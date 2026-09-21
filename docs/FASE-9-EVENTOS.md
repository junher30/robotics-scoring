# Fase 9 — Gestión de eventos

## Qué construimos

Listado de competencias con filtro por estado y páginas de 20 registros en `/admin/eventos`; creación en `/admin/eventos/nuevo`; edición en `/admin/eventos/[id]`. El dashboard tiene acceso al listado, botón Crear evento y enlaces a las competencias de su agenda.

El formulario incluye nombre, descripción, fechas del evento, lugar, ciudad, dirección, organizador, capacidad, estado, intención de publicación y URLs opcionales del logo y reglamento. Las fechas se introducen en hora de Colombia (UTC−5) y se guardan como instantes UTC.

El alcance acordado es crear competencias, organizar equipos y puntuarlos. No hay inscripciones. Los estados disponibles son Borrador, Activo, Finalizado y Cancelado. Este ajuste no requiere SQL adicional: los campos y el estado antiguos se conservan en PostgreSQL por compatibilidad, pero no aparecen en el formulario. Los eventos antiguos en REGISTRATION se muestran como Borrador y se normalizan al guardar; sus fechas de inscripción se dejan en NULL para que no restrinjan las fechas de la competencia.

El retiro se hace cambiando el estado a Cancelado. No hay borrado físico; conserva la información y permite reactivar el evento. Las categorías, equipos y asignaciones siguen en sus fases correspondientes. La ficha pública y la subida de archivos no están habilitadas: se guardan la intención de publicación y enlaces a archivos ya alojados.

## Activar en Supabase

1. Abre tu proyecto Supabase → SQL Editor → New query.
2. Copia todo `supabase/migrations/202609200002_event_management.sql` del proyecto activo y pulsa Run.
3. Espera `Success. No rows returned`.
4. Ejecuta `supabase/verify-phase-9.sql` en otra consulta. Los ocho checks deben mostrar `true`.
5. Abre http://localhost:3000/admin/eventos e inicia sesión si se solicita.

Ejecuta únicamente el SQL de esta fase. Es repetible, no vuelve a crear enums y no borra eventos.

## Políticas, explicadas antes de ejecutarlas

- **events_admin_read:** una cuenta activa ADMIN puede consultar eventos creados por ella. Una cuenta activa SUPER_ADMIN puede consultar todos.
- **events_admin_create:** ADMIN y SUPER_ADMIN activos pueden crear un evento, siempre con su propio usuario como creador. No permite suplantar a otro organizador.
- **events_admin_update:** ADMIN activo modifica sus eventos; SUPER_ADMIN activo modifica cualquiera. Se mantiene la comprobación al guardar.

`roboscore_private.is_event_admin()` consulta el rol y estado actuales de profiles. No confía en un rol enviado desde el formulario. La función interna tiene search_path fijo, y solo authenticated recibe ejecución.

RLS permanece habilitado. Se conceden INSERT y UPDATE únicamente en las columnas editables; no se concede modificar propietario, UUID, slug ni timestamps. No existe permiso de DELETE. Visitantes, jueces y cuentas inactivas no acceden a estos eventos mediante estas políticas; el acceso de jueces asignados se incorporará en su fase. La marca público no da acceso anónimo todavía. Las demás tablas conservan sus permisos.

Las páginas y acciones también llaman `requireAccess('admin')` antes de consultar o guardar. No se necesita service_role ni cambiar claves.

## Cómo probar

1. En Eventos, pulsa **Nuevo evento**.
2. Introduce un nombre y las fechas inicial/final. Puedes dejar los demás campos vacíos y el estado en Borrador.
3. Pulsa **Crear evento**: debe aparecer **Evento creado correctamente** y abrirse la ficha de edición.
4. Cambia ciudad u organizador y pulsa **Guardar cambios**. Debe aparecer **Cambios guardados**.
5. Vuelve al listado: debe aparecer el evento. Filtra por Borrador.
6. Para retirarlo, edita el estado a Cancelado y guarda. Sigue existiendo, y puedes volver a Borrador.
7. Vuelve al dashboard: el total de eventos incluye el nuevo registro. Para incluir un evento nuevo en la agenda, usa Activo y una fecha final que aún no haya pasado. Todos los estados se pueden consultar desde el listado de eventos.

Para comprobar validación, intenta guardar con fecha final anterior a la inicial: el error debe aparecer bajo el campo. No se permite capacidad cero o fraccionaria. Las URLs deben ser HTTP/HTTPS sin credenciales.

Para comprobar concurrencia, abre el mismo evento en dos pestañas. Guarda un cambio en la primera e intenta guardar en la segunda: deberá pedir recargar, conservando los valores que escribiste. Esto evita sobrescribir cambios recientes.

Un reintento del mismo formulario de creación conserva el UUID para no duplicar el registro. Abrir de nuevo Nuevo evento sí permite crear otra competencia, incluso con el mismo nombre. El slug es único, automático e inmutable.

## Archivos y código completo

Proyecto activo: `/Users/gregorihernandezvanegas/Desktop/robotics-scoring`.

Los archivos de esta fase ya están creados. `docs/FASE-9-CODIGO.md` contiene completos los archivos nuevos y modificados de la aplicación y el SQL. Carpetas principales:

- `app/admin/eventos/`: listado, formulario, acciones, creación, edición, página no disponible y estilos.
- `lib/events/`: validación, conversión de fechas y lectura autorizada.
- `app/admin/components/dashboard.tsx` y `app/admin/dashboard.module.css`: enlaces a la gestión de eventos.
- `supabase/migrations/202609200002_event_management.sql` y `supabase/verify-phase-9.sql`: permisos y verificación.
- `tests/event-validation.test.cjs`, `tests/event-actions.test.cjs`, `tests/event-permissions.mjs`: pruebas. La carpeta `tests/fixtures` es solo para PostgreSQL local; no se ejecuta en Supabase.

## Comandos

Para iniciar la aplicación desde el proyecto activo:

```sh
npm run dev
```

Comprobaciones reproducibles:

```sh
npm run build -- --webpack
npx eslint app/admin/eventos app/admin/components/dashboard.tsx lib/events
node --test tests/auth-access.test.cjs tests/event-validation.test.cjs tests/event-actions.test.cjs
node tests/event-permissions.mjs
```

La dependencia de desarrollo `@electric-sql/pglite` ejecuta PostgreSQL en memoria para las pruebas. No se usa en producción ni conecta con Supabase.

## Errores y qué hacer

- **No pudimos consultar/guardar**: ejecuta el SQL de esta fase, revisa los ocho checks, la conexión y que tu cuenta esté activa. Los errores no se presentan como una lista vacía.
- **Evento no disponible**: UUID inválido, registro inexistente o sin permisos; no se revela si pertenece a otra persona.
- **Cambió en otra sesión**: conserva una copia del texto que necesites, recarga y vuelve a editar.
- **No se pudo confirmar la operación**: reintenta con el mismo formulario; el UUID evita insertar otra copia si el primer intento llegó a guardarse.
- **No aparece en la agenda**: revisa el estado y la fecha final; borradores, finalizados y cancelados siguen en el listado, pero no en la agenda.

## Evidencia

Las pruebas cubren autorización, validación, acciones, compatibilidad con eventos antiguos y permisos PostgreSQL. La fase 9 original se verificó con su SQL instalado dos veces en la base local sin errores, incluyendo acceso entre administradores, superadmin, jueces, inactivos y anónimos; suplantación de creador, campos inmutables, fechas, cancelación, conflictos y reintentos.

Prueba de navegador con una copia aislada y almacenamiento ficticio: validación, crear, editar, cancelar, listar, filtrar sin resultados y conflicto entre dos pestañas; escritorio y móvil a 375 y 320 px sin desbordamiento horizontal. No se crearon eventos de prueba en tu Supabase.

Pendiente para cerrar la fase: activar el SQL en Supabase y comprobar un evento con tu sesión real. No se ha avanzado a categorías ni a otra fase.
