# Inicio con equipos y resultados reales

El inicio sustituye los datos de ejemplo por la consulta `roboscore_public_results()`. Incluye logo Robo Kids, tarjetas con nombre, institución y robot, totales, posiciones por categoría, estados, barras, búsqueda, filtros, paginación de 12 equipos y gráfico de hasta 8 equipos. No agrega inscripciones.

## Activación en Supabase

1. Si la integración de equipos aún está pendiente, ejecuta primero `supabase/migrations/202609210001_teams_scoring.sql` y `supabase/verify-teams-scoring.sql` (ocho resultados true).
2. Ejecuta `supabase/migrations/202609210002_public_results.sql`. Es repetible y no modifica equipos ni puntuaciones existentes.
3. Ejecuta `supabase/verify-public-results.sql`: deben aparecer cuatro resultados true.
4. En la aplicación abre Eventos → tu evento → Información. Marca **evento público** y guarda. El evento debe estar Activo o Finalizado; las categorías deben estar Activas o Cerradas.
5. Crea equipos y puntúalos desde administración. Abre la página principal. Puedes filtrar por evento y categoría y buscar nombre, institución o robot.

La consulta publica identificación del equipo (nombre, institución, robot, evento, categoría y estado), total, cantidad de retos calificados, posición y fecha de la última puntuación. No publica miembros, correos, teléfonos, responsables, notas ni historial. Los eventos privados, borradores y cancelados quedan fuera. Los equipos retirados se identifican como tales y no tienen posición.

No se cambia RLS ni se concede lectura directa de las tablas a visitantes. La función devuelve únicamente una proyección explícita de datos de los eventos públicos. No necesita clave secreta. No se ha ejecutado esta migración en el Supabase remoto desde esta tarea.

## Cómo leer el tablero

- Los puntos son la suma guardada en PostgreSQL; no se recalculan con otra fórmula en el inicio.
- Un guion significa sin calificar. Cero y negativos se conservan.
- Las posiciones y empates se calculan por categoría. Un total parcial puede cambiar cuando se califiquen más retos.
- Las barras de tarjetas usan 170 × número de retos como referencia. No representan porcentaje de retos completados.
- El gráfico requiere elegir una categoría, respeta la búsqueda y compara hasta 8 equipos activos por total. La longitud representa magnitud; los valores negativos muestran su signo y un color distinto.
- La guía tiene tres pasos seleccionables y animaciones breves. Respeta `prefers-reduced-motion` y no avanza automáticamente.

## Actualizaciones y errores

La página obtiene datos al abrir y consulta cada 15 segundos mientras está visible. Al volver a la pestaña consulta de nuevo. “Actualizar ahora” permite hacerlo manualmente. Solo hay una petición simultánea, con tiempo máximo de espera y respuestas sin caché.

Si falla la conexión, los últimos datos se conservan con un aviso de que pueden estar desactualizados. Si todavía no se recibieron datos, se muestra un error sin inventar equipos. Si la consulta funciona pero no hay eventos publicados, se muestra el estado vacío.

## Comprobaciones

`node tests/public-results.mjs` verifica publicación, ocultación, empates, valores cero/negativos, equipos retirados, cambios de puntuación y ausencia de datos privados. También se comprobó compilación de producción y ESLint. La revisión en navegador utilizó una copia temporal sin credenciales con 13 equipos ficticios y PostgreSQL local: filtros, segunda página, gráfico, actualización automática, guía y diseño móvil. No se importaron esos equipos al proyecto real.

El logo original se conserva sin modificar en `public/robokids-logo.jpg`, copiado del archivo enviado por el usuario.
