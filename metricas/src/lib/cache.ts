// La última foto del panel que guardó esta pestaña (sessionStorage: se borra
// al cerrarla). Aparte del panel para que la puerta pueda borrarla sin cargarlo.
export const CACHE_KEY = 'usagePanelSnapshot_v1';

export const clearPanelCache = () => {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* nada que borrar */
  }
};
