/**
 * Origen del API para toda la app. Vive aparte porque lo consumen dos capas
 * independientes: el cliente HTTP (axios) y la sonda de salud, que debe usar
 * `fetch` crudo para no pasar por interceptores ni por cookies de sesión.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? '/api';

/**
 * Timeout por defecto de axios. Es una red de contención, no el detector
 * principal: Kong ya corta en connect 5s / read 10s, así que un valor por
 * encima de 10s solo dispara cuando el gateway no responde en absoluto
 * (Kong caído, proxy del host caído, túnel caído) — que es exactamente cuando
 * antes el spinner quedaba girando indefinidamente.
 *
 * No limita los uploads de logo (6MB en Kong) más de lo que ya los limita el
 * gateway. Se puede sobrescribir por request con `timeout` en la config.
 */
export const REQUEST_TIMEOUT_MS = 20_000;
