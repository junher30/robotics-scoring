# Fase 8 — Dashboard administrativo

## Qué hacemos y para qué sirve

El panel `/admin` ahora muestra eventos, equipos, participantes activos y jueces activos asignados; eventos activos y próximos; y hasta cinco eventos en inscripción o activos que aún no terminan. No muestra cifras de demostración ni interpreta un fallo de conexión como cero.

SUPER_ADMIN ve el resumen global. ADMIN ve solo eventos cuyo `created_by` corresponde a su usuario. Los participantes se cuentan una sola vez aunque pertenezcan a varios equipos visibles. Los jueces también se cuentan una sola vez. Fechas en hora de Colombia. Las cifras se consultan al abrir o actualizar la página, no en tiempo real.

La gestión de eventos pertenece a la fase 9: el botón Crear evento está desactivado y explicado. Las tarjetas son indicadores, no enlaces a módulos aún inexistentes.

## Activar los datos en Supabase

1. Abre el proyecto Supabase que ya configuraste y entra a **SQL Editor → New query**.
2. Copia TODO el archivo `supabase/migrations/202609200001_admin_dashboard.sql` del proyecto activo en `/Users/gregorihernandezvanegas/Desktop/robotics-scoring`.
3. Pulsa **Run**. Debe mostrar `Success. No rows returned`. Este archivo se puede volver a ejecutar.
4. En otra consulta ejecuta TODO `supabase/verify-phase-8.sql`. Los cinco resultados deben mostrar `true`.
5. Abre http://localhost:3000/admin con tu sesión de superadministrador y pulsa Actualizar.

No ejecutes de nuevo las migraciones de las fases anteriores. No llames directamente a `admin_dashboard()` desde SQL Editor: allí no tienes la sesión del usuario de la app y debe denegar el acceso.

## Cómo funciona la seguridad

No añadimos políticas que abran las tablas. Siguen con RLS y sin lectura directa para el cliente. Creamos una función `admin_dashboard()` de solo lectura (RPC). Al ejecutarse con permisos de su creador (SECURITY DEFINER), puede consultar las tablas cerradas: por eso valida dentro de PostgreSQL el usuario de `auth.uid()`, el rol vigente y el estado activo antes de consultar. Su búsqueda de objetos está fijada con `search_path` vacío y todas las tablas están calificadas por esquema.

Solo `authenticated` puede ejecutarla; visitantes y permisos por defecto de PUBLIC quedan revocados. Un juez o cuenta inactiva recibe error aunque llame directamente a la API. No recibe identificadores ni datos personales de participantes, solo conteos. No acepta un ID de administrador enviado desde el navegador. No usa service_role.

## Archivos completos

Ya están creados en el proyecto activo:

- `app/admin/page.tsx`: comprueba acceso y carga el panel.
- `app/admin/components/dashboard.tsx`: interfaz del dashboard.
- `app/admin/dashboard.module.css`: diseño adaptable.
- `lib/dashboard/read.ts`: consulta al servidor y estados de error.
- `lib/dashboard/schema.ts`: valida la respuesta con Zod.
- `supabase/migrations/202609200001_admin_dashboard.sql`: consulta autorizada.
- `supabase/verify-phase-8.sql`: comprobaciones después de instalarla.

`docs/FASE-8-CODIGO.md` reúne el contenido completo de esos archivos.

## Comandos

Desde el proyecto activo:

```sh
npm run dev
```

Para verificar código:

```sh
npm run build -- --webpack
npx eslint app/admin lib/dashboard
node --test tests/auth-access.test.cjs
```

## Cómo comprobarlo

Con tu cuenta, abre `/admin`. Debes ver la navegación, cuatro tarjetas, agenda y resumen de actividad. Si todavía no hay datos, los contadores muestran cero y la agenda explica cómo aparecerán tus eventos. Si el SQL aún no se instaló, se muestra “Falta activar el resumen de datos” y guiones en vez de cifras.

Prueba a reducir el ancho de la ventana: las tarjetas pasan a dos columnas y la navegación se adapta arriba. Mi cuenta permite consultar la sesión y cerrarla también desde móvil.

## Errores posibles

- Falta activar el resumen: ejecutar solo la migración de esta fase y actualizar.
- No pudimos cargar el resumen: comprobar conexión, configuración y los cinco checks; volver a actualizar.
- Acceso administrativo requerido en SQL Editor: comportamiento esperado al invocar la función sin JWT; usa la aplicación para la prueba.
- Inicio de sesión solicitado: la sesión expiró o la cuenta no tiene acceso activo.

## Pruebas realizadas

Build, TypeScript y ESLint correctos. PostgreSQL local con esquema de las fases 3 y 4: migración repetible, superadmin global, separación de dos administradores, deduplicación de participantes/jueces, rechazo de jueces/inactivos/visitantes/sin sesión, revocación de superadmin al desactivarlo y tablas aún cerradas. Cancelados excluidos de agenda. Diseño revisado en navegador con datos ficticios aislados, estados vacío y error. No se insertaron datos de prueba en Supabase.

Pendiente: ejecutar el SQL en tu proyecto Supabase y comprobar los datos reales con tu sesión.
