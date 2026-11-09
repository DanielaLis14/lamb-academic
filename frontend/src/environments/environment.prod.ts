/**
 * Configuracion de produccion (ng build --configuration production reemplaza environment.ts por este archivo).
 * Los dominios .example son marcadores: reemplazarlos por los del despliegue real antes de publicar.
 * Sin secretos: el cliente lamb-frontend es publico (PKCE) y no tiene clave.
 */
export const environment = {
  apiBaseUrl: 'https://api.lamb-academic.example',
  keycloak: {
    issuer: 'https://auth.lamb-academic.example/realms/lamb-academic',
    clientId: 'lamb-frontend',
    redirectUri: 'https://lamb-academic.example/auth/callback',
    postLogoutRedirectUri: 'https://lamb-academic.example/',
  },
};
