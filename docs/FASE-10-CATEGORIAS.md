# Fase 10 — Categorías por evento

## Qué construimos

Cada evento tiene ahora dos pestañas: **Información** y **Categorías**. Desde Categorías puedes crear, editar, ordenar y cerrar categorías como Mini Sumo, Seguidor de Línea o Innovación. El listado permite filtrar por estado y muestra páginas de 20 categorías.

El formulario incluye nombre, descripción, máximo de equipos opcional, orden de presentación y estado. Los números de orden menores aparecen primero; si coinciden, se ordenan por nombre. Los estados son **Borrador**, **Activa** y **Cerrada**. Cerrar conserva los datos y puedes volver a activar la categoría.

No se permiten nombres repetidos dentro del mismo evento, aunque cambien mayúsculas o espacios al principio o al final. Dos eventos diferentes sí pueden tener categorías con el mismo nombre. Los errores del formulario conservan lo que escribiste; se detectan cambios simultáneos para no sobrescribir otra sesión.

Esta fase configura las categorías. La capacidad es una configuración, no un contador de equipos ni un control de inscripciones. La carga de equipos, los retos y la puntuación se implementarán en sus fases. El cambio de estado todavía no controla un flujo de puntuación.

## Políticas, explicadas antes de ejecutarlas

- **categories_admin_read:** un ADMIN activo puede consultar categorías de eventos creados por él. Un SUPER_ADMIN activo puede consultar las de todos los eventos.
- **categories_admin_create:** esas mismas cuentas pueden crear categorías dentro de los eventos que administran.
- **categories_admin_update:** esas mismas cuentas pueden modificar nombre, descripción, capacidad, orden y estado dentro de los eventos que administran.

Se consulta el rol actual de profiles mediante las funciones privadas instaladas en la fase 9. RLS permanece habilitado y también se comprueba el acceso al evento padre. No se conceden permisos para cambiar el UUID de la categoría, trasladarla a otro evento, alterar sus timestamps ni borrarla permanentemente. Visitantes, jueces y cuentas inactivas no obtienen acceso mediante estas políticas. Las páginas y acciones verifican la sesión administrativa antes de consultar o guardar.

## Activar en Supabase

Requisito: haber aplicado el SQL de gestión de eventos de la fase 9. No vuelvas a ejecutar el SQL inicial de tablas o enums.

1. Abre tu proyecto de Supabase → **SQL Editor** → **New query**.
2. Copia todo el archivo `supabase/migrations/202609200003_category_management.sql` del proyecto activo y pulsa **Run**.
3. Debe aparecer **Success. No rows returned**. El script es repetible y conserva las categorías existentes.
4. En otra consulta, ejecuta `supabase/verify-phase-10.sql`.
5. Deben aparecer **ocho comprobaciones con true**.
6. Abre [Eventos](http://localhost:3000/admin/eventos), inicia sesión y abre tu evento. Entra en **Categorías**.

El SQL se ha probado con PostgreSQL local. No se ha ejecutado remotamente en tu Supabase desde esta tarea.

## Prueba con tu cuenta

1. Entra en **Eventos → tu evento → Categorías → Nueva categoría**.
2. Escribe **Mini Sumo**, capacidad **24**, orden **1** y estado **Activa**.
3. Pulsa **Crear categoría**. Debe abrirse su ficha y aparecer la confirmación.
4. Cambia la descripción o el orden y pulsa **Guardar cambios**.
5. Vuelve a Categorías y comprueba la tarjeta. Prueba el filtro por estado.
6. Para cerrarla, abre su ficha, selecciona **Cerrada** y guarda. La categoría se conserva; puedes reactivarla desde el mismo formulario.
7. Intenta crear otra llamada **mini sumo** en ese evento: debe indicar que el nombre ya existe.

Si abres la misma categoría en dos pestañas y guardas un cambio en la primera, la segunda debe pedir recargar antes de sobrescribirla. Copia cualquier texto pendiente antes de recargar.

## Archivos y código completo

Proyecto activo: `/Users/gregorihernandezvanegas/Desktop/robotics-scoring`.

Los archivos ya están implementados; no necesitas pegarlos manualmente. `docs/FASE-10-CODIGO.md` contiene una copia completa de los archivos nuevos y modificados de esta fase, incluidos el SQL y las pruebas.

- `app/admin/eventos/event-navigation.tsx` y su CSS: navegación entre Información y Categorías.
- `app/admin/eventos/[id]/page.tsx`: integra la navegación en la ficha del evento.
- `app/admin/eventos/[id]/categorias/`: listado, creación, edición, formulario, acciones, estilos y estados de error.
- `lib/categories/`: validación, conversión de datos y lectura autorizada.
- `supabase/migrations/202609200003_category_management.sql`: permisos administrativos de categorías.
- `supabase/verify-phase-10.sql`: ocho comprobaciones de configuración.
- `tests/category-actions.test.cjs` y `tests/category-permissions.mjs`: pruebas locales. Las fixtures de pruebas nunca se ejecutan en Supabase.

## Comandos

Desde el proyecto activo, inicia la aplicación si no está corriendo:

```sh
npm run dev
```

Verificaciones reproducibles:

```sh
npm run build -- --webpack
npx eslint app/admin/eventos lib/categories
node --test tests/category-actions.test.cjs
node tests/category-permissions.mjs
```

## Si aparece un error

- **No pudimos consultar o guardar:** revisa la conexión, que tu cuenta esté activa y los ocho resultados del SQL de verificación. Un fallo de consulta se muestra como error, no como una lista vacía.
- **Falta roboscore_private o una función administrativa al ejecutar SQL:** falta aplicar el SQL de eventos de la fase 9; no es necesario recrear las tablas.
- **Categoría o evento no disponible:** el enlace es inválido, no existe o tu cuenta no tiene acceso. No se revela información de eventos ajenos.
- **Nombre duplicado:** usa otro nombre dentro de ese evento.
- **Cambió en otra sesión:** copia los datos pendientes, recarga y vuelve a editar.
- **No se pudo confirmar la operación:** reintenta con el mismo formulario. La creación conserva el UUID para evitar otra copia si la primera petición llegó a guardarse.

## Evidencia y pendiente

Pasaron la compilación de producción y ESLint. Pasaron 18 pruebas de validación y acciones, además de 16 comprobaciones de permisos y restricciones en PostgreSQL local con PGlite. El SQL se aplicó dos veces en esa base de prueba y las ocho comprobaciones de la fase devolvieron true.

Se verificaron aislamiento entre administradores, acceso del superadmin, denegación para jueces/inactivos/visitantes, campos inmutables, nombres duplicados, cambio de estado, orden y conflictos entre versiones.

En una copia aislada con datos ficticios se probó en el navegador: formulario vacío, creación, edición, cierre, listado y nombre duplicado. La interfaz se revisó en escritorio y a 375 y 320 píxeles sin desbordamiento horizontal. No se crearon categorías de prueba en tu Supabase.

Para cerrar la fase falta aplicar el SQL remoto y comprobar una categoría con tu sesión real. No se ha iniciado la fase 11.
