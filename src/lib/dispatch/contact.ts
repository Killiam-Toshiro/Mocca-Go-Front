export { telHref } from '@/lib/kitchen/board';

/** Enlace de WhatsApp del cliente: igual que el del back, el E.164 sin el «+». */
export function whatsappHref(phone: string): string | null {
  if (!/^\+[0-9]{8,15}$/.test(phone.replace(/[ ()-]/g, ''))) return null;
  return `https://wa.me/${phone.replace(/[^0-9]/g, '')}`;
}
