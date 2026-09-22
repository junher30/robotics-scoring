# RoboScore — Documento técnico para exposición

Este documento explica, en tus palabras y con lo que realmente hay en el código, qué se construyó, con qué tecnologías, por qué se eligió cada una, y cómo quedó desplegado. Está pensado para que lo estudies antes de exponer, no para leerlo en voz alta.

---

## 1. Qué es RoboScore

Una aplicación web para organizar competencias de robótica escolar (marca "Robo Kids"): permite a organizadores crear eventos y categorías, registrar equipos, invitar jueces, capturar puntuaciones por reto, y muestra al público un tablero de resultados en vivo.

No es un sitio estático ni un CMS: es una aplicación con backend propio, base de datos relacional, autenticación con roles, y reglas de negocio (fórmulas de puntuación, permisos, límites de equipos) que corren del lado del servidor.

---

## 2. Stack tecnológico (qué se usó y por qué)

| Capa | Tecnología | Versión | Por qué esta y no otra |
|---|---|---|---|
| Framework web | **Next.js** (App Router) | 16.3.5 | Permite escribir frontend y backend en el mismo proyecto: páginas en React que se renderizan en el servidor, y "Server Actions" que actúan como el backend, sin tener que levantar un servidor Express/API separado. |
| Lenguaje | **TypeScript** | 5.x | JavaScript con tipos. Atrapa errores (nombres de campos mal escritos, tipos incorrectos) en tiempo de compilación, antes de que lleguen a producción. |
| Librería de UI | **React** | 19.2.8 | Es la base sobre la que corre Next.js; componentes reutilizables, estado en el cliente (formularios, filtros de la tabla de resultados, etc.). |
| Base de datos | **PostgreSQL**, gestionado por **Supabase** | — | Postgres es una base de datos relacional robusta con soporte real de transacciones, restricciones (`CHECK`, `UNIQUE`, llaves foráneas) y funciones almacenadas. Supabase evita tener que administrar el servidor de base de datos, backups, TLS, etc. a mano. |
| Autenticación | **Supabase Auth** (GoTrue) | — | Maneja contraseñas, tokens, sesiones y el flujo de invitación por correo, sin que el código del proyecto tenga que guardar ni procesar contraseñas nunca. |
| Validación de datos | **Zod** | 4.x | Define "esquemas" (forma esperada de un dato) una sola vez y los usa tanto para validar formularios como para tipar TypeScript automáticamente. |
| Estilos | **Tailwind CSS** | 4.x (parcial) + CSS Modules | Tailwind para utilidades rápidas; CSS Modules (`*.module.css`) para estilos específicos de cada pantalla, sin que se mezclen entre componentes. |
| Pruebas | **Node.js test scripts** + **PGlite** | — | `PGlite` es Postgres compilado a WebAssembly: permite correr una base de datos Postgres real *en memoria*, aplicar las migraciones SQL de verdad, y probar los permisos (RLS) sin tocar la base de datos real ni pagar por infraestructura de pruebas. |
| Servidor web (producción) | **OpenLiteSpeed** | — | Recibe el tráfico HTTP/HTTPS público y lo reenvía (proxy inverso) hacia la aplicación Node.js. |
| Gestor de procesos | **PM2** | — | Mantiene el proceso de Node.js vivo, lo reinicia si falla o si el servidor reinicia, y lo pone a arrancar solo al encender el VPS. |
| Certificados TLS | **Let's Encrypt / Certbot** | — | Certificado HTTPS gratuito, con renovación automática programada. |
| Control de versiones | **Git + GitHub** | — | Historial de cambios, y el VPS trae el código con `git pull` en vez de subir archivos a mano. |

---

## 3. Por qué Node.js específicamente

Next.js **está construido sobre Node.js** — no es una elección independiente, es un requisito: Next.js necesita un entorno de ejecución de JavaScript en el servidor para:

- Renderizar componentes de React del lado del servidor (Server Components).
- Ejecutar las Server Actions (las funciones que reciben los formularios y hablan con Supabase).
- Servir las rutas de API (`/api/resultados`).

La ventaja práctica: **un solo lenguaje (TypeScript/JavaScript) en todo el proyecto** — frontend, backend, scripts de prueba. No hay que cambiar de cabeza entre, por ejemplo, PHP en el servidor y JavaScript en el navegador.

---

## 4. "Otros lenguajes de comunicación" que sí se usan

Aunque el lenguaje de programación principal es TypeScript, el proyecto usa varios **lenguajes y protocolos de comunicación** distintos, cada uno donde corresponde:

| Lenguaje / protocolo | Dónde se usa |
|---|---|
| **SQL** (y **PL/pgSQL** para funciones) | Todas las migraciones (`supabase/migrations/*.sql`). Las reglas de negocio más sensibles (quién puede invitar a quién, cómo se calculan los puntos, quién puede editar un equipo) están escritas como **funciones de Postgres** (`SECURITY DEFINER`), no en TypeScript. |
| **HTTP / HTTPS** | Protocolo de transporte entre el navegador, OpenLiteSpeed y la app de Node. HTTPS específicamente usa **TLS** (el certificado de Let's Encrypt). |
| **JSON** | Formato en el que viajan los datos entre el navegador y el servidor (formularios, respuestas de `/api/resultados`, respuestas de Supabase). |
| **JWT** (JSON Web Token) | Formato del token de sesión que emite Supabase Auth; así el servidor sabe quién eres sin tener que consultar la contraseña en cada petición. |
| **Bash** (shell script) | Comandos de despliegue en el VPS: `npm install`, `npm run build`, configuración de `certbot`, `pm2`, `systemctl`. |
| **Markdown** | Toda la documentación del proyecto (`docs/*.md`, este mismo archivo). |

---

## 5. Arquitectura: ¿monolito, servicios o microservicios?

**Punto importante para la exposición: esto NO es una arquitectura de microservicios.** Si te preguntan, la respuesta correcta y honesta es:

> "Es un monolito modular (Next.js) que consume una plataforma de backend-as-a-service (Supabase). Supabase, internamente, sí está compuesta de varios servicios independientes, pero el proyecto los consume como una sola pieza."

### 5.1 La aplicación (lo que tú construiste)

Un solo proyecto Next.js, con estas piezas dentro:

- **Server Components**: páginas que se generan en el servidor y llegan ya renderizadas (más rápido, mejor SEO).
- **Server Actions**: funciones marcadas con `'use server'` que actúan como "endpoints" sin necesidad de definir rutas de API a mano (ej. `app/admin/usuarios/actions.ts`, `app/admin/eventos/[id]/puntuaciones/actions.ts`).
- **Una sola ruta de API real**: `app/api/resultados/route.ts`, usada por el tablero público para refrescar resultados cada 15 segundos (`fetch` desde el cliente).
- **Middleware/Proxy** (`proxy.ts`, antes llamado `middleware.ts` en versiones anteriores de Next.js): intercepta cada petición a rutas protegidas para renovar la sesión de Supabase antes de que la página se procese.

### 5.2 Supabase (los servicios que sí existen, pero no los construiste tú)

Supabase por dentro sí es una composición de servicios (esto es lo que puedes mencionar si preguntan por "microservicios"):

| Servicio de Supabase | Para qué lo usa el proyecto |
|---|---|
| **PostgreSQL** | Toda la base de datos: perfiles, eventos, categorías, equipos, puntuaciones. |
| **GoTrue (Auth)** | Login, invitaciones por correo, tokens de sesión. |
| **PostgREST** | Es lo que permite llamar a las funciones de Postgres (`client.rpc('nombre_funcion', ...)`) y hacer `SELECT` simples desde el cliente de Supabase, vía HTTP, sin escribir una API REST a mano. |

El proyecto **no usa** Supabase Storage (archivos) ni Supabase Realtime (websockets) — el "tiempo real" del tablero de resultados es en realidad **polling** (el navegador pregunta cada 15 segundos), no una conexión persistente.

### 5.3 Diagrama simple para explicar en la exposición

```
[Navegador] 
    │  HTTPS
    ▼
[OpenLiteSpeed]  ← certificado Let's Encrypt, puerto 443/80
    │  proxy inverso → 127.0.0.1:3000
    ▼
[Next.js / Node.js]  ← administrado por PM2
    │  llamadas HTTP (supabase-js)
    ▼
[Supabase] = PostgreSQL + Auth (GoTrue) + PostgREST
```

---

## 6. Seguridad y roles

Tres roles, guardados en la tabla `profiles` (columna `role`, tipo enumerado `user_role`):

| Rol | Puede hacer |
|---|---|
| `SUPER_ADMIN` | Todo: invitar administradores y jueces, gestionar cualquier evento. |
| `ADMIN` | Solo invita jueces, y solo ve/gestiona los eventos que él mismo creó y los jueces que él invitó. |
| `JUDGE` | Solo ve las categorías que le asignaron, y solo puede capturar puntuaciones ahí — no ve el panel de administración. |

### Cómo se aplican esos permisos (doble capa)

1. **En el código** (`lib/auth/authorization.ts`, `lib/users/access.ts`): antes de mostrar una página o ejecutar una acción, se verifica sesión y rol.
2. **En la base de datos** (RLS — *Row Level Security* de Postgres): aunque alguien lograra saltarse la capa anterior, Postgres **no permite** que una fila se lea o modifique si no cumple la política. Ejemplo real del proyecto (`roboscore_private.can_manage_event`): una función que verifica "¿esta persona administra este evento?" y se usa como condición en cada política de acceso a `teams`, `team_scores`, etc.

Esto es importante para la exposición: **la seguridad no depende solo de que el frontend "no muestre" el botón** — está reforzada en la base de datos, que es la última línea de defensa.

### El patrón "todo pasa por una función", no por INSERT/UPDATE directo

El cliente (navegador) **nunca** hace `INSERT`/`UPDATE` directo sobre tablas como `profiles`, `teams` o `team_scores`. Todo pasa por funciones de Postgres (`SECURITY DEFINER`) que:
- Validan los datos.
- Verifican permisos otra vez, dentro de la base de datos.
- Registran quién hizo el cambio y cuándo.

Ejemplos reales: `roboscore_prepare_user_invitation`, `roboscore_save_team`, `roboscore_save_score`, `roboscore_update_managed_user`.

### Resultados públicos, sin exponer de más

La página de inicio (`/`) es pública — no requiere login. Para eso existe una función especial, `roboscore_public_results()`, que:
- Es la única función a la que el rol `anon` (visitante sin cuenta) tiene permiso de ejecutar.
- Devuelve **solo** lo necesario (nombre de equipo, institución, puntos, posición) de eventos marcados explícitamente como `public = true`.
- Nunca expone notas de los jueces, contactos, ni eventos privados.

---

## 7. Base de datos: migraciones

Cada cambio de esquema es un archivo SQL versionado y fechado en `supabase/migrations/`, pensado para poder ejecutarse más de una vez sin romper nada (usan `CREATE OR REPLACE`, `IF NOT EXISTS`, etc.):

1. `202609160001_profiles_roles.sql` — tabla de perfiles y roles.
2. `202609200001_admin_dashboard.sql` — vistas/funciones para el panel de administración.
3. `202609200002_event_management.sql` — tabla de eventos y sus permisos.
4. `202609200003_category_management.sql` — categorías dentro de un evento.
5. `202609200004_user_management.sql` — invitaciones de usuarios (jueces/administradores).
6. `202609210001_teams_scoring.sql` — equipos, retos, reglas de puntuación, tabla de puntuaciones.
7. `202609210002_public_results.sql` — función de resultados públicos.
8. `202609210003_delete_judges.sql` — eliminación de cuentas de jueces.
9. `202609210004_judge_scoring.sql` — asignación de jueces a categorías y su vista de calificación.

Cada fase tiene, además, un script `verify-*.sql` que corre una serie de comprobaciones (`SELECT ... AS passed`) para confirmar que la migración quedó bien aplicada.

---

## 8. Pruebas automatizadas

No se usa Jest ni Vitest. Los tests son scripts de Node.js normales (`tests/*.mjs`, `*.test.cjs`) que:

1. Levantan una base de datos **Postgres real, mediante `PGlite`** (Postgres compilado a WebAssembly, corre en memoria, no necesita instalar Postgres ni conectarse a internet).
2. Aplican las migraciones SQL reales del proyecto sobre esa base en memoria.
3. Simulan usuarios con distintos roles cambiando el `ROLE` de Postgres y una variable de sesión (`request.jwt.claim.sub`) que imita lo que Supabase inyecta normalmente.
4. Usan `assert` de Node para comprobar que las reglas de negocio y de permisos se cumplen (ej. "un ADMIN no puede invitar a otro ADMIN", "un juez no puede calificar una categoría que no le asignaron").

Ventaja de este enfoque: se prueban las políticas de seguridad **reales** de Postgres (RLS), no una simulación aparte que se podría desincronizar del código real.

---

## 9. El despliegue: la historia completa (para explicar "cómo fue el tema del VPS")

Esta parte vale la pena contarla en la exposición porque muestra proceso de decisión, no solo el resultado final.

### 9.1 Primer intento: hosting compartido (HostGator, cPanel)

Se intentó desplegar en un plan de hosting compartido tradicional, usando una herramienta de cPanel llamada "Application Manager" (basada en Phusion Passenger) que promete correr apps de Node.js sin acceso root.

**Por qué no funcionó bien:**
- El hosting compartido está pensado principalmente para PHP/MySQL (WordPress, etc.), no para procesos de Node.js persistentes.
- La herramienta de gestión de la app tuvo errores de configuración no relacionados con el proyecto (un error de validación de un parámetro de "Ruby" al guardar, por ejemplo).
- No había acceso SSH real habilitado en el plan, así que no se podía ejecutar `npm install` / `npm run build` manualmente cuando la herramienta gráfica fallaba.

**Conclusión:** el hosting compartido con panel de control (cPanel) le da al usuario una capa de abstracción diseñada para sitios simples; para una app con Server Actions y conexión a base de datos, esa capa se vuelve una limitación, no una ayuda.

### 9.2 Segundo intento (y el que funcionó): VPS con acceso root

Se contrató un **VPS (Virtual Private Server)** en Hostinger, con Ubuntu 24.04 y una imagen preconfigurada de **OpenLiteSpeed + Node.js**.

La diferencia clave de un VPS frente al hosting compartido: **acceso root por SSH** — control total del sistema operativo, sin depender de que un panel gráfico exponga la opción correcta.

### 9.3 Pasos reales del despliegue en el VPS

1. **Conexión SSH** como `root` (`ssh root@<ip>`).
2. **Clonar el repositorio** directo desde GitHub (`git clone -b Develop ...`) — no se subieron archivos a mano por FTP.
3. **Variables de entorno**: un archivo `.env.production` con las claves de Supabase y la URL del sitio (Next.js lo carga automáticamente, tanto al compilar como al arrancar).
4. **Compilar**: `npm install` (descarga dependencias) y `npm run build` (Next.js genera la versión optimizada de producción).
5. **Primer intento de arranque — fallido**: se intentó usar el sistema "appserver" propio de OpenLiteSpeed, que administra el proceso de Node automáticamente. Con un solo listener (HTTP) funcionaba, pero al activar HTTPS en paralelo, el manejo interno de OpenLiteSpeed del proceso de Node se volvía inestable (respuestas que nunca llegaban, uso alto de CPU).
6. **Solución aplicada — proceso propio con PM2**:
   - Se creó un pequeño archivo `app.js` que arranca Next.js mediante su API programática (`next({dev:false})`) y escucha en `127.0.0.1:3000`.
   - **PM2** mantiene ese proceso vivo de forma independiente (reinicio automático si falla, arranque automático si el VPS se reinicia).
   - Se reconfiguró OpenLiteSpeed para actuar como **proxy inverso simple** (`extprocessor` tipo `proxy`) hacia `127.0.0.1:3000`, en vez de intentar controlar el proceso de Node él mismo. Este patrón es mucho más estable porque separa claramente dos responsabilidades: PM2 cuida el proceso, OpenLiteSpeed solo reenvía tráfico.
7. **DNS**: el dominio (`gregorioprojects.com`) está registrado en HostGator, así que el cambio de DNS se hizo ahí — un registro tipo `A` apuntando a la IP pública del VPS. El dominio y el VPS pueden estar en proveedores distintos sin ningún problema, mientras el registro DNS apunte correctamente.
8. **Certificado HTTPS**: `certbot` (Let's Encrypt), usando el método `--webroot` (deja un archivo de verificación temporal que el propio servidor sirve, y Let's Encrypt lo revisa por HTTP para confirmar que el dominio es tuyo). Certbot programó su propia renovación automática.
9. **Actualizar el certificado en OpenLiteSpeed**: se editó el listener HTTPS (`Defaultssl`) para apuntar sus `keyFile`/`certFile` a los archivos reales emitidos por Let's Encrypt, en vez del certificado de ejemplo que traía la imagen del VPS.

### 9.4 Cómo se actualiza el sitio después de un cambio de código

```bash
cd /usr/local/lsws/roboscore
git pull origin Develop
npm run build
pm2 restart roboscore
```

No hay integración continua (CI/CD) automática todavía — el despliegue es manual pero reproducible con esos 4 comandos.

---

## 10. Preguntas típicas que te pueden hacer (y cómo responderlas)

**¿Por qué Supabase y no una base de datos propia?**
Supabase da Postgres administrado + autenticación + una capa HTTP para llamar funciones, sin tener que construir y mantener un servidor de autenticación desde cero. El proyecto igual conserva control total de la lógica de negocio porque esa lógica vive en funciones de Postgres, no en una caja negra de Supabase.

**¿Dónde está el "backend"?**
No hay un servidor backend separado en el sentido tradicional (no hay un Express/NestJS aparte). El backend son: (a) las Server Actions de Next.js, y (b) las funciones de Postgres en Supabase. Next.js corre en el mismo proceso de Node tanto el frontend (renderizado) como esta lógica de servidor.

**¿Por qué no usar microservicios?**
El proyecto es de un tamaño donde microservicios agregarían complejidad de infraestructura (orquestación, comunicación entre servicios, más servidores) sin un beneficio real todavía. Un monolito modular + BaaS es la elección correcta para esta escala.

**¿Qué pasa si el VPS se reinicia?**
PM2 tiene registrado el proceso como servicio de `systemd` (`pm2 startup`), así que la app arranca sola. Certbot renueva el certificado solo. No se requiere intervención manual para un reinicio normal.

**¿Cómo se prueba que los permisos (RLS) funcionan de verdad?**
Con los tests de `tests/*.mjs`, que aplican las migraciones reales sobre una base Postgres en memoria (PGlite) y verifican, como si fueran distintos usuarios, qué pueden y qué no pueden hacer.
