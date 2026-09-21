# Fase 3: base de datos de RoboScore

Esta fase prepara la estructura del proyecto Supabase ya creado. PostgreSQL es el motor que guarda los datos. SQL es el lenguaje con el que definimos tablas, relaciones y restricciones.

El proyecto activo está en `/Users/gregorihernandezvanegas/Desktop/robotics-scoring`. No hay cambios visuales en esta fase.

## Archivos completos

- `supabase/migrations/202609140001_foundation.sql`: SQL completo, ejecutar una vez.
- `supabase/verify-phase-3.sql`: comprobación de solo lectura, se puede repetir.

Una migración es un archivo SQL fechado que registra un cambio de estructura. Conservaremos este archivo sin modificarlo después de aplicarlo. Las fases siguientes añadirán nuevas migraciones; no se debe borrar y reconstruir la base de datos.

## Qué creamos

| Tabla | Para qué sirve | Relación con el Excel |
|---|---|---|
| events | Fecha, ciudad, organizador, inscripción y estado del evento | El libro de Medellín es una fuente para un evento; no se crean eventos reales todavía |
| event_categories | Categorías de cada evento | A, B, C y D; no se supone que sean Mini Sumo |
| event_challenges | Retos de cada categoría | CATA tiene cuatro retos; CATB, CATC y CATD tienen tres |
| judge_assignments | Asignaciones de usuarios a evento y categoría | El campo Caller no se importa como juez sin confirmar su significado |
| teams | Equipo, institución, robot y entrenador | TEAM y COLEGIO |
| participants | Información privada de participantes | INTEGRANTE 1 e INTEGRANTE 2 |
| team_members | Une participantes con equipos | Permite uno o varios integrantes sin columnas fijas |

No se importa el archivo ni se publican nombres de participantes. CATC utiliza nombres de personas en TEAM mediante fórmulas: al importar, tendremos que distinguir identidad privada del nombre público del equipo.

### Relaciones

Un evento tiene categorías; cada categoría tiene retos y equipos. Un equipo puede tener varios participantes mediante team_members. Un juez puede tener asignaciones en varias categorías. Las claves compuestas impiden relacionar una categoría de un evento con equipos, retos o asignaciones de otro.

Los UUID son identificadores únicos generados automáticamente. Las foreign keys son referencias que impiden apuntar a registros inexistentes. Los índices aceleran búsquedas; también hay índices únicos para evitar duplicados de categorías, asignaciones y miembros.

Las fechas usan timestamptz, que representa instantes con zona horaria. La interfaz posterior mostrará la hora de Colombia. created_at guarda la creación y un trigger actualiza updated_at al modificar una fila.

## Alcance y decisiones pendientes

Seguimos una fase a la vez. profiles y el ENUM de roles pertenecen a fase 4. Las referencias a usuarios apuntan por ahora a auth.users.id; profiles tendrá ese mismo identificador. En la migración de fase 4 se añadirán referencias a profiles para conservar las relaciones solicitadas.

Antes de habilitar asignaciones se deberá verificar que el usuario sea un JUDGE activo y que el asignador pueda administrar ese evento. Los límites max_teams son configuración en esta fase: el control de cupos ante inscripciones simultáneas se implementará en una operación transaccional posterior. La validación Zod de emails, URLs y formularios llegará con esos formularios.

No implementamos puntuaciones todavía. CATA!H4 y CATC!H4 usan las bases 170, 150 y 130 menos segundos según el intento, con cero para intento cero. CATEGORIA C!H4 usa 170, 90 y 130 menos minutos convertidos a segundos más segundos, condicionado por RETO; CATEGORIA D!G4 usa 170, 150 y 130. Además, las hojas antiguas pueden puntuar intento cero si RETO es verdadero. Esto requiere conciliar la versión vigente antes de automatizarla. No se introduce un límite a cero, desempate ni máximo de intentos no confirmado.

## Seguridad desde el primer día

RLS significa seguridad por fila: PostgreSQL decide cuáles registros puede leer o cambiar cada usuario. La migración activa RLS y revoca permisos de las tablas a PUBLIC, anon y authenticated. No crea policies que concedan acceso aún, porque los roles de negocio no existen. Es un estado cerrado deliberado, no un sistema de permisos por rol terminado.

Aunque events.public sea true, nadie puede leerlo desde la aplicación en esta fase. Las políticas y los permisos se habilitarán progresivamente con los módulos correspondientes y se revisarán en fase 15. El SQL Editor ejecutado como postgres conserva acceso administrativo. Nunca se debe usar una clave Secret en el navegador para saltarse esta protección.

ON DELETE RESTRICT bloquea eliminar registros referenciados para conservar relaciones. CASCADE borraría también los registros dependientes; SET NULL conservaría esos registros, quitando la referencia. En esta fase usamos RESTRICT para evitar pérdidas encadenadas. Usuarios, participantes y asignaciones se desactivarán; los eventos se cancelarán. Las restricciones no sustituyen la auditoría, que se añadirá en su fase.

## Cómo ejecutar

1. Entra a https://supabase.com/dashboard y abre el proyecto con URL `https://lnkewtnvhvbyzxymbzmn.supabase.co`.
2. Abre **SQL Editor → New query**.
3. Abre `supabase/migrations/202609140001_foundation.sql` y copia TODO su contenido, desde BEGIN hasta COMMIT, incluidos los comentarios si quieres.
4. Pégalo en la consulta y pulsa **Run**. Si aparece un error, detente y comparte el mensaje sin credenciales. No borres tablas para reintentar.
5. Cuando termine correctamente, abre una consulta nueva, pega todo `supabase/verify-phase-3.sql` y pulsa **Run**.
6. Deben aparecer siete filas: table_exists, rls_enabled, access_locked y timestamps_enabled en true, y policies_count en 0.
7. Abre **Table Editor** y actualiza su lista. Las siete tablas deben estar vacías.

No debes ejecutar comandos de terminal, introducir contraseñas ni instalar dependencias para aplicar esta fase.

## Errores comunes

- `type ... already exists` o `relation ... already exists`: no repitas el SQL ni borres objetos. Puede estar aplicado o haber una estructura previa. Ejecuta la verificación y comparte el resultado para decidir una migración compatible.
- `permission denied`: usa SQL Editor del proyecto con el rol postgres. No ejecutes este archivo con la clave pública de la aplicación.
- Error de sintaxis: comprueba que copiaste el archivo completo, sin las marcas de un bloque Markdown.
- La aplicación recibe permiso denegado o no muestra datos: es esperado por ahora, ya que no hay policies ni módulos conectados.
- No ves las tablas: confirma el proyecto y esquema public y actualiza Table Editor.

## Validación realizada

El SQL se prueba en PostgreSQL local mediante PGlite, con auth.users y los roles anon/authenticated simulados. Se comprueban relaciones, duplicados, fechas, timestamps, borrado protegido y denegación de acceso. Esto no ejecuta la migración en tu Supabase ni valida aún los permisos SUPER_ADMIN/ADMIN/JUDGE.

La fase queda aplicada cuando ejecutes ambos archivos y confirmes el resultado. Después continuaremos con fase 4: profiles y roles.

Referencias: https://supabase.com/docs/guides/database/postgres/row-level-security y https://supabase.com/docs/guides/auth/managing-user-data
