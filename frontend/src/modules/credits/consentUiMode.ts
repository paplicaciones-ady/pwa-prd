/**
 * Dónde aparece el pad de firma al pulsar la autorización de datos.
 *
 * - 'modal':  el check abre un modal con la política + pad + confirmar.
 * - 'inline': el pad se despliega dentro del cuerpo, bajo la nota de
 *             autorización, como acordeón.
 *
 * Se cambia aquí a propósito, sin persistencia ni feature flag: las dos
 * variantes quedan implementadas y tipadas, y esta constante decide cuál se
 * muestra. Al ya estar definida una, la otra se puede borrar junto con su rama
 * en CreditStudyPage.
 */
export type ConsentUiMode = 'modal' | 'inline';

export const CONSENT_UI_MODE: ConsentUiMode = 'modal';
