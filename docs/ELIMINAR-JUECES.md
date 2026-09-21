# Eliminar jueces

## Activar

En Supabase → SQL Editor, ejecuta `supabase/migrations/202609210003_delete_judges.sql`. Requiere la fase 11 de usuarios y es repetible. Después ejecuta `supabase/verify-delete-judges.sql`: las cuatro filas deben mostrar true.

## Usar

1. Abre Administración → Jueces → Ver cuenta.
2. Al final de la ficha, pulsa **Eliminar juez…**.
3. Revisa el nombre, marca la confirmación y pulsa **Confirmar eliminación**. Cancelar no cambia la cuenta.
4. Regresarás al listado con un aviso de éxito y el juez ya no aparecerá.

Se trata de eliminación lógica: bloquea el acceso de la aplicación, oculta el juez en los listados y desactiva sus asignaciones. Conserva la identidad, puntuaciones e historial; registra fecha y administrador que lo eliminó. No elimina la cuenta de Supabase Auth ni libera el correo para otra invitación. Si solo necesitas suspender temporalmente a alguien, usa **Acceso a RoboScore → Desactivado**, que se puede revertir desde la ficha.

Un administrador puede eliminar únicamente a sus jueces. El superadministrador puede eliminar cualquier juez. Nadie puede usar esta función para eliminar su propia cuenta ni administradores. La base de datos verifica permisos y versión aunque se manipule el formulario. La edición antigua no permite reactivar ni cambiar el rol de un juez eliminado.

Pruebas: `node tests/delete-judges.mjs`. Esta tarea implementa la opción; no elimina ningún juez real ni ejecuta la migración en Supabase remoto.
