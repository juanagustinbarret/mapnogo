// src/lib/linksRecuperacion.ts
//
// Textos y enlaces para mandarle a un comercio el link de recuperación de
// contraseña. Solo arma textos: crear el token está en
// src/services/linksRecuperacion.ts.
//
// Por qué los envíos son enlaces (<a href>) y no window.open: Safari del
// iPhone solo deja abrir otra app o copiar al portapapeles en el mismo
// instante del toque. Antes se esperaba a la base y después se abría
// WhatsApp o Gmail, y Safari lo bloqueaba.

import { normalizeWhatsAppNumber } from './whatsapp';

export const MINUTOS_VALIDEZ_LINK = 15;

/** Token de 24 bytes al azar (192 bits) en hexadecimal: 48 caracteres. */
export function generarToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function linkDeRecuperacion(origen: string, token: string): string {
  return `${origen.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
}

export function mensajeRecuperacion(link: string): string {
  return (
    'Hola!\n\n' +
    'Recibimos tu solicitud para restablecer la contraseña de tu comercio en NOGOYORK.\n\n' +
    `Entrá a este enlace seguro (válido por ${MINUTOS_VALIDEZ_LINK} minutos) y elegí una contraseña nueva:\n${link}\n\n` +
    'Si no lo pediste, ignorá este mensaje.\n\n' +
    'Saludos,\nEquipo NOGOYORK'
  );
}

const ASUNTO = 'Restablecer contraseña - NOGOYORK';

/** Redactar en Gmail web con todo cargado. */
export function urlGmail(email: string, link: string): string {
  return (
    `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}` +
    `&su=${encodeURIComponent(ASUNTO)}&body=${encodeURIComponent(mensajeRecuperacion(link))}`
  );
}

/** Cualquier app de correo del dispositivo (Mail del iPhone, Outlook...). */
export function urlMailto(email: string, link: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(ASUNTO)}&body=${encodeURIComponent(mensajeRecuperacion(link))}`;
}

/** WhatsApp al número del comercio; sin número válido, WhatsApp pide elegir el contacto. */
export function urlWhatsAppRecuperacion(whatsapp: string | null | undefined, link: string): string {
  const numero = normalizeWhatsAppNumber(whatsapp ?? '');
  // Número dudoso: se usa tal cual (como antes); WhatsApp avisa si no existe
  const destino = numero.isValid ? numero.normalized : (whatsapp ?? '').replace(/\D/g, '');
  return `https://wa.me/${destino}?text=${encodeURIComponent(mensajeRecuperacion(link))}`;
}

/**
 * Email para buscar el comercio sin importar mayúsculas: patrón de "ilike"
 * con los comodines escapados. Sin escapar, el guion bajo de
 * "juan_perez@x.com" funciona como comodín y podría encontrar OTRO comercio.
 */
export function patronEmailExacto(email: string): string {
  return email.trim().toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Hora (Argentina) en que vence un link creado ahora: "14:35". */
export function horaDeVencimiento(ahora: Date = new Date()): string {
  const vence = new Date(ahora.getTime() + MINUTOS_VALIDEZ_LINK * 60_000);
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(vence);
}
