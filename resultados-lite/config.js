// Único archivo que hay que editar si cambias de proyecto Supabase.
// La clave "publishable" es pública por diseño (la misma que ya viaja en el sitio principal):
// solo puede ejecutar la función de resultados públicos, no puede leer tablas ni escribir.
window.RESULTADOS_CONFIG = {
  SUPABASE_URL: 'https://lnkewtnvhvbyzxymbzmn.supabase.co',
  SUPABASE_KEY: 'sb_publishable_RU6eTSC81E2Fg5ZIMr87FQ_r_AU7KkX',
  REFRESH_SECONDS: 30,
  // Si solo hay un evento publicado, se abre directamente sin pedir que lo elijan.
  AUTO_SELECT_SINGLE_EVENT: true,
};
