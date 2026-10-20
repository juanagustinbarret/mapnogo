// src/lib/comprobanteAlta.ts
//
// Ficha de alta de un comercio = contrato de suscripción (contrato de
// adhesión, Ley 24.240). Al darlo de alta se emite un comprobante ("ticket")
// con los datos, el precio, el primer vencimiento y las condiciones
// principales, para imprimir, guardar como PDF o mandar por WhatsApp.

import { CONTACTO, ACTUALIZACION_LEGALES, nombreResponsable, whatsappLegible } from './contacto';
import { formatCurrency } from './formatters';
import { formatearFecha, formatearFechaHora, hoyArgentina } from './fechasArgentina';

export type MedioDeAlta = 'presencial' | 'whatsapp' | 'telefono' | 'internet';

export const MEDIOS_DE_ALTA: Record<MedioDeAlta, string> = {
  presencial: 'En persona',
  whatsapp: 'Por WhatsApp',
  telefono: 'Por teléfono',
  internet: 'Por internet',
};

/** Contratar por WhatsApp, teléfono o internet es "a distancia": da derecho de arrepentimiento. */
export const esADistancia = (medio: MedioDeAlta) => medio !== 'presencial';

export interface DatosAlta {
  comercioId: string;
  fecha: Date;
  titular: string;
  documento?: string;
  comercio: string;
  rubro?: string;
  direccion: string;
  whatsapp?: string;
  email: string;
  plan?: string;
  precioMensual: number | null;
  primerVencimiento: string; // YYYY-MM-DD
  diasGracia: number;
  medio: MedioDeAlta;
}

/** N° de comprobante, siempre el mismo para un comercio: "ALTA-20261020-3F9A1C". */
export function numeroDeAlta(comercioId: string, fecha: Date): string {
  const codigo = comercioId.replace(/[^0-9a-f]/gi, '').slice(0, 6).toUpperCase() || 'SINID';
  return `ALTA-${hoyArgentina(fecha).replace(/-/g, '')}-${codigo}`;
}

/** Primer vencimiento: el día 10 del mes siguiente al alta (como hacía el formulario). */
export function primerVencimiento(hoy: string = hoyArgentina()): string {
  const [anio, mes] = hoy.split('-').map(Number);
  return mes === 12 ? `${anio + 1}-01-10` : `${anio}-${String(mes + 1).padStart(2, '0')}-10`;
}

export const textoPrecio = (precio: number | null) => (precio == null ? 'según el plan vigente' : `${formatCurrency(precio)} por mes (precio final)`);

/** Condiciones principales que el titular acepta (resumen de los Términos). */
export function condicionesDelAlta(d: Pick<DatosAlta, 'precioMensual' | 'primerVencimiento' | 'diasGracia' | 'medio'>): string[] {
  const lista = [
    `Precio: ${textoPrecio(d.precioMensual)}. Primer vencimiento: ${formatearFecha(d.primerVencimiento)}; después, cada mes.`,
    `Si una cuota vence sin pago, hay ${d.diasGracia} días de gracia; después la ficha puede dejar de mostrarse hasta regularizar. Los datos no se borran.`,
    'Los cambios de precio o de condiciones se avisan con al menos 30 días y nunca se aplican a un período ya pagado.',
    'Baja cuando quieras, sin costo ni preaviso, desde el Botón de baja de servicio (/baja) o por los mismos medios de contacto.',
  ];
  if (esADistancia(d.medio)) {
    lista.push('Como el alta fue a distancia, hay 10 días corridos para arrepentirse sin costo (art. 34 Ley 24.240 y art. 1110 CCyC).');
  }
  lista.push('El comercio es responsable de que la información que publica sea verdadera y esté actualizada.');
  return lista;
}

export function textoAceptacion(): string {
  return `El titular leyó y acepta los Términos y condiciones (versión ${ACTUALIZACION_LEGALES}) y la Política de privacidad de NOGOMAP.`;
}

export function datosDelProveedor(): string {
  return [nombreResponsable(), CONTACTO.cuit && `CUIT ${CONTACTO.cuit}`, CONTACTO.domicilio || CONTACTO.ciudad].filter(Boolean).join(' · ');
}

/** Texto del comprobante para mandar por WhatsApp o email. */
export function textoComprobante(d: DatosAlta): string {
  const lineas = [
    '*COMPROBANTE DE ALTA - NOGOMAP*',
    `N° ${numeroDeAlta(d.comercioId, d.fecha)} · ${formatearFechaHora(d.fecha.toISOString())}`,
    '',
    `Comercio: ${d.comercio}${d.rubro ? ` (${d.rubro})` : ''}`,
    `Dirección: ${d.direccion}`,
    `Titular: ${d.titular}${d.documento ? ` · ${d.documento}` : ''}`,
    `Usuario de acceso: ${d.email}`,
    d.whatsapp ? `WhatsApp: ${d.whatsapp}` : '',
    `Plan: ${d.plan ?? 'Suscripción mensual'} · ${textoPrecio(d.precioMensual)}`,
    `Alta: ${MEDIOS_DE_ALTA[d.medio]}`,
    '',
    '*Condiciones principales*',
    ...condicionesDelAlta(d).map((c) => `• ${c}`),
    '',
    textoAceptacion(),
    `Términos: ${CONTACTO.sitio}/terminos`,
    '',
    `Proveedor: ${datosDelProveedor()}`,
    `Consultas y reclamos: ${CONTACTO.emailSoporte ? `${CONTACTO.emailSoporte} · ` : ''}WhatsApp ${whatsappLegible()} (${CONTACTO.horarioAtencion})`,
  ];
  return lineas.filter((l, i, todas) => l !== '' || (todas[i - 1] ?? '') !== '').join('\n');
}
