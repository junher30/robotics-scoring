# Cómo califican los jueces

## Activar en Supabase

Requiere las fases de usuarios, equipos/puntuaciones y eliminación de jueces. Si están pendientes, ejecuta primero sus migraciones en ese orden: `202609200004_user_management.sql`, `202609210001_teams_scoring.sql`, `202609210003_delete_judges.sql`.

Ejecuta `supabase/migrations/202609210004_judge_scoring.sql` y luego `supabase/verify-judge-scoring.sql`. Deben aparecer cuatro filas con true. La migración es repetible. Si vuelves a ejecutar la migración anterior de equipos, ejecuta después esta para conservar los permisos de calificación de jueces.

## Organizador

1. Crea o activa el evento, sus categorías y equipos.
2. En Puntuaciones elige la regla del Excel y el número de retos de cada categoría.
3. Invita al juez y verifica que su cuenta esté activa.
4. En **Eventos → tu evento → Jueces asignados**, selecciona el juez y la categoría y pulsa **Asignar juez**.
5. Para retirar su permiso, pulsa **Retirar asignación**. Los resultados guardados se conservan.

El superadministrador puede asignar cualquier juez activo. Un administrador solo asigna sus propios jueces a eventos que gestiona. Puede retirar asignaciones de su evento. La asignación puede prepararse antes de activar el evento; la calificación exige evento y categoría activos.

## Juez

1. Inicia sesión: entrarás en `/judge` y verás **Mis categorías**.
2. Abre una categoría, busca el equipo y pulsa **Calificar**.
3. En cada reto escribe el número de intento y el tiempo total en segundos (hasta tres decimales; acepta coma). Revisa los puntos previstos y pulsa **Guardar puntuación**.
4. La confirmación indica que quedó guardado. Regresa a los equipos para ver el total.
5. Para corregir, abre el resultado, cambia los valores e introduce el motivo obligatorio. Si otra persona guardó antes, recarga el equipo para no sobrescribir su cambio.

Con la regla CATA–CATD, intento 0 y tiempo 0 registran un reto sin puntos. Las reglas antiguas usan además “Reto logrado”. Se preservan resultados negativos y la diferencia entre cero y sin calificar.

## Resultado oficial e historial

Hay un resultado oficial compartido por equipo y reto. No se promedian notas de varios jueces ni se elige automáticamente el mejor intento. Cada juez asignado puede guardar o corregir ese resultado. PostgreSQL calcula los puntos con la misma regla que administración y registra quién guardó, cuándo, el valor anterior y el nuevo. Administración puede consultar ese historial en la ficha de puntuación.

La clasificación administrativa y pública usa esos mismos registros. El inicio público consulta cada 15 segundos mientras está visible (requiere su migración y evento publicado).

## Acceso y pruebas

Los jueces solo consultan equipos de categorías asignadas. No reciben acceso directo a tablas ni a contactos de equipos. No pueden configurar reglas, asignarse categorías ni administrar usuarios. Retirar la asignación, desactivar/eliminar al juez o cerrar el evento/categoría impide guardar, incluso con un formulario abierto. Un equipo retirado tampoco se puede calificar.

Pruebas de base de datos: `node tests/judge-scoring.mjs` (16 comprobaciones). Se verifican permisos, fórmulas, correcciones, concurrencia por versión, historial, clasificación pública y revocación. En el navegador se verificó el recorrido categoría → equipo → guardar 161,725 puntos → corregir a 160, con un juez ficticio y PostgreSQL local. El formulario se revisó a 375 píxeles sin desbordamiento horizontal. La compilación de producción y ESLint pasaron. La migración no se ejecutó en Supabase remoto; los datos de prueba son locales y ficticios.
