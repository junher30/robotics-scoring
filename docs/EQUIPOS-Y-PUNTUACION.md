# Equipos y puntuación administrativa

Implementación local terminada. Falta ejecutar la migración en el proyecto Supabase real. No se importaron nombres ni participantes del Excel y no se cambiaron datos remotos.

## Activar

1. En Supabase abre **SQL Editor → New query**.
2. Copia y ejecuta todo `supabase/migrations/202609210001_teams_scoring.sql`. Debe mostrar `Success. No rows returned`. Es repetible y requiere las fases 3, 4, 9 y 10 ya instaladas.
3. Ejecuta `supabase/verify-teams-scoring.sql` en otra consulta. Deben aparecer **ocho filas con true**.
4. Abre RoboScore e inicia sesión con tu administrador. Si tu servidor no está ejecutándose, abre una terminal en `/Users/gregorihernandezvanegas/Desktop/robotics-scoring` y ejecuta `npm run dev`.

Este módulo utiliza la sesión y las variables públicas de Supabase existentes. La clave secreta y SMTP solo son necesarios para las invitaciones de usuarios; consulta `docs/FASE-11-INVITACIONES.md`. Para activar esa fase, ejecuta `supabase/migrations/202609200004_user_management.sql` si sigue pendiente y después `supabase/verify-phase-11.sql`.

## Primera puntuación

1. Abre **Eventos**, entra en el evento y crea sus categorías.
2. En **Equipos → Crear equipo**, escribe nombre, institución y categoría. El nombre del robot es opcional. No hay inscripciones ni aprobación de solicitudes.
3. En **Puntuaciones**, selecciona la categoría, la fórmula y el número de retos. El Excel tiene 4 retos en CATA y 3 en CATB, CATC y CATD. Debes elegir la fórmula expresamente porque el libro contiene reglas distintas.
4. Activa el evento y la categoría antes de puntuar.
5. Pulsa **Puntuar**, introduce el intento y el tiempo total en segundos. Puedes escribir `8,275` o `8.275` (hasta tres decimales). Un minuto y cinco segundos son `65` segundos.
6. Guarda cada reto y vuelve a la clasificación. El total suma los retos guardados; “Parcial” indica que faltan resultados. **Actualizar resultados** recarga el tablero.
7. Para corregir un resultado, abre el reto, cambia sus valores y explica el motivo. El historial conserva el valor anterior y el nuevo. Una edición antigua no sobrescribe otra más reciente.

## Reglas del Excel

Fuente: `/Users/gregorihernandezvanegas/Downloads/Medellin - Puntuaciones 2026.xlsx`, fórmulas H4 de CATA, CATB, CATC, CATD y CATEGORIA C; G4 de CATEGORIA D.

| Regla | Intento 1 | Intento 2 | Intento 3 y posteriores | Sin puntos |
|---|---:|---:|---:|---|
| CATA–CATD | 170 − segundos | 150 − segundos | 130 − segundos | Intento 0 |
| CATEGORIA C antigua | 170 − segundos | 90 − segundos | 130 − segundos | Reto logrado = No |
| CATEGORIA D antigua | 170 − segundos | 150 − segundos | 130 − segundos | Reto logrado = No |

En las reglas antiguas, intento 0 con reto logrado también usa base 130. Se conservan puntuaciones negativas, igual que el Excel. En la regla moderna, para registrar un reto sin puntos introduce intento 0 y tiempo 0. Sin calificar se muestra “—”, que se distingue de un cero guardado.

Existe un resultado oficial por equipo y reto. El intento indica en cuál se logró el resultado; no se selecciona automáticamente el mejor de varios intentos. Los empates comparten posición, pues el Excel no define otro desempate. La clasificación es provisional mientras haya retos pendientes.

## Permisos y conservación

- SUPER_ADMIN gestiona todos los eventos; ADMIN solo los propios. Las funciones y RLS lo verifican en PostgreSQL.
- Los puntos los calcula la base de datos; no se acepta un total enviado por el navegador.
- La regla y la cantidad de retos se bloquean después de la primera puntuación, incluso si luego se retira ese equipo.
- Retirar un equipo lo excluye de la clasificación y conserva sus resultados. Puede reactivarse respetando los cupos. No se puede cambiar de categoría un equipo con puntuaciones.
- Eventos finalizados o cancelados bloquean modificaciones. Puntuar exige evento y categoría activos.
- La calificación desde administración se complementa con `docs/CALIFICACION-DE-JUECES.md` (asignaciones y formulario de jueces) y `docs/INICIO-Y-RESULTADOS.md` (tablero público). Cada módulo requiere su migración. No incluye importación de equipos desde Excel ni actualización por WebSocket.

## Validación realizada

Compilación de producción, validación de TypeScript y ESLint de los archivos nuevos. Pruebas PostgreSQL de permisos, cupos, duplicados, fórmulas, empates, concurrencia y correcciones. Las pruebas de validación comparan nueve resultados numéricos reales del libro sin copiar nombres de participantes.

Se probó en el navegador con datos ficticios y PostgreSQL local aislado: crear equipo, configurar cuatro retos, guardar 161,725 puntos, corregir a 160 y comprobar el historial y la clasificación. Se revisó también el formulario en pantalla móvil sin desbordamiento horizontal de la página. Esto no sustituye la activación y prueba en Supabase real.

```sh
node --test tests/scoring-validation.test.cjs
node tests/teams-scoring-permissions.mjs
npm run build -- --webpack
```
