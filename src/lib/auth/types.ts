import type { Role } from './roles';

/** Lo único que el navegador sabe de la persona: nunca incluye el token. */
export interface SessionUser {
  id: string;
  username: string;
  role: Role;
}

/** Estado de la sesión visto desde el servidor. */
export type SessionResult =
  | { status: 'ok'; user: SessionUser; expiresAt: number | null }
  | { status: 'none' } // no hay cookie
  | { status: 'expired' } // hay cookie pero el back responde 401
  | { status: 'error' }; // el back no responde o contesta algo inesperado
