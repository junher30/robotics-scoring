# Fase 6 — Inicio de sesión

Proyecto activo: `/Users/gregorihernandezvanegas/Desktop/robotics-scoring`.

## Prueba con tu cuenta

1. Abre http://localhost:3000/login con la aplicación en ejecución.
2. Escribe `josegre301@gmail.com` y la contraseña que asignaste al usuario en Supabase. No compartas la contraseña en el chat.
3. Pulsa **Iniciar sesión**. Debe abrir `/cuenta` mostrando tu correo, **Superadministrador** y **Activa**.
4. Recarga la página: debe conservar la sesión.
5. Pulsa **Cerrar sesión**. Debe regresar al formulario. Al abrir `/cuenta` de nuevo, debe pedir iniciar sesión.

Si el servidor está apagado, abre una terminal en el proyecto activo y ejecuta `npm run dev`.

## Implementación

Formulario adaptable, validación en servidor, mostrar/ocultar contraseña, estados de espera, errores accesibles y cierre de sesión. Supabase Auth verifica credenciales; `profiles` aporta el rol y el estado activo. El rol nunca se toma del formulario. La ruta `/cuenta` verifica usuario y perfil en el servidor en cada solicitud.

Las cookies de autenticación son HttpOnly, SameSite=Lax y Secure en producción. Sin Recordarme son cookies de sesión; algunos navegadores pueden restaurarlas al restaurar pestañas. Con Recordarme duran hasta 30 días y se renuevan con la sesión, sujetas a las políticas de Supabase. Cierra sesión al terminar en dispositivos compartidos.

No se guarda la contraseña en nuestras tablas ni se necesita una clave secreta. El registro público sigue cerrado. La recuperación de contraseña y los paneles de administración/jueces no pertenecen a esta fase; el formulario ofrece indicaciones para contactar al organizador.

## Verificaciones realizadas

- Compilación de producción y TypeScript: correctos.
- ESLint de los archivos de autenticación: correcto.
- Navegador: 320, 375, 768 y 1440 píxeles sin desbordamiento horizontal; revisión visual móvil y escritorio.
- Campos vacíos: errores de validación; control mostrar/ocultar contraseña correcto.
- Acceso anónimo a `/cuenta`: redirige al login.

Pendiente de comprobación por el titular: inicio real con su contraseña, visualización del rol, persistencia y cierre de sesión autenticado. No se usaron sus credenciales en pruebas automatizadas.

No vuelvas a ejecutar las migraciones anteriores para esta fase. Los paneles y permisos de negocio se continuarán en las siguientes fases.
