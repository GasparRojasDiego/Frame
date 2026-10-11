// Marca de «cuenta en proceso de borrado».
//
// Tras borrar la cuenta en el servidor la app sigue viva unos segundos (muestra
// el resultado). Su ciclo de respaldo de 2 minutos, al no encontrar la fila,
// volvía a SUBIR todo el estado local y la cuenta «eliminada» resucitaba en la
// nube. Con esta marca, nada vuelve a escribir en la nube hasta recargar.
// Vive en su propio módulo para que la sincronización pueda leerla sin importar
// el resto de la gestión de cuentas.
let deletionInProgress = false;

export const markAccountDeletion = (): void => {
  deletionInProgress = true;
};

export const isAccountDeletionInProgress = (): boolean => deletionInProgress;
