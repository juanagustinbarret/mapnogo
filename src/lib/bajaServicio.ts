// src/lib/bajaServicio.ts
//
// "Botón de baja de servicio" y "Botón de arrepentimiento" (Disposición
// 954/2025, complementada por la 3/2026). Sin registro previo: el comercio
// completa nombre y contacto, recibe un código en el momento y manda el
// pedido por WhatsApp o email al soporte. El código sirve de constancia.

import { hoyArgentina } from './fechasArgentina';

export type TipoSolicitud = 'baja' | 'arrepentimiento';

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para dictarlo sin errores

/** Código de constancia: "BAJA-20261020-K7Q2" o "ARR-20261020-K7Q2". */
export function codigoDeSolicitud(tipo: TipoSolicitud, ahora: Date = new Date()): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const sufijo = Array.from(bytes, (b) => LETRAS[b % LETRAS.length]).join('');
  return `${tipo === 'baja' ? 'BAJA' : 'ARR'}-${hoyArgentina(ahora).replace(/-/g, '')}-${sufijo}`;
}

export interface DatosSolicitud {
  tipo: TipoSolicitud;
  codigo: string;
  comercio: string;
  contacto: string;
  comentario?: string;
}

export function mensajeSolicitud({ tipo, codigo, comercio, contacto, comentario }: DatosSolicitud): string {
  const titulo = tipo === 'baja' ? 'BOTÓN DE BAJA DE SERVICIO' : 'BOTÓN DE ARREPENTIMIENTO';
  const pedido =
    tipo === 'baja'
      ? 'Pido la baja de la suscripción de mi comercio en NOGOYORK.'
      : 'Me arrepiento de la contratación de la suscripción de mi comercio en NOGOYORK (art. 34 Ley 24.240 y art. 1110 CCyC).';
  return [
    `${titulo} - NOGOYORK`,
    '',
    pedido,
    `Comercio: ${comercio.trim()}`,
    `Contacto: ${contacto.trim()}`,
    comentario?.trim() ? `Comentario: ${comentario.trim()}` : '',
    '',
    `Código de constancia: ${codigo}`,
  ]
    .filter((linea, i, todas) => linea !== '' || (todas[i - 1] ?? '') !== '')
    .join('\n');
}
