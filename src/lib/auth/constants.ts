/** Cookie legible por JS con la hora de vencimiento (epoch ms). Nunca contiene el token. */
export const SESSION_EXP_COOKIE = 'session_exp';

/** Cookie `httpOnly` con el token. En producción lleva el prefijo `__Host-`. */
export const SESSION_COOKIE = 'session';
export const SESSION_COOKIE_SECURE = '__Host-session';
