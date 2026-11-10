import { redirectIfAuthenticated } from '@/lib/server/guards';

/** `/login` y `/registro`: solo para quien no tiene una sesión válida. */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await redirectIfAuthenticated();
  return children;
}
