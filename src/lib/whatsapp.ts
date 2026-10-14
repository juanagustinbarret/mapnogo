/**
 * Normaliza un número telefónico al formato internacional de WhatsApp para Argentina (+54 9 ...)
 */
export const normalizeWhatsAppNumber = (phone: string): { isValid: boolean; normalized: string; error?: string } => {
  if (!phone) {
    return { isValid: false, normalized: '', error: 'Sin número registrado' };
  }

  // Eliminar espacios, guiones, paréntesis y símbolos no numéricos
  let clean = phone.replace(/\D/g, '');

  if (!clean) {
    return { isValid: false, normalized: '', error: 'Número inválido' };
  }

  // Si empieza con 0 (ej: 03435123456), quitar el 0
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }

  // Si empieza con 549 (ej: 5493435123456)
  if (clean.startsWith('549')) {
    // Correcto
  } else if (clean.startsWith('54')) {
    // Si empieza con 54 sin el 9 de celular, insertar el 9 después de 54
    clean = '549' + clean.substring(2);
  } else if (clean.startsWith('15')) {
    // Si empieza con 15 local de Nogoyá, prefijar con característico 3435 sin 15
    clean = '5493435' + clean.substring(2);
  } else if (clean.length === 10) {
    // Caso estándar celular argentino de 10 dígitos (ej: 3435123456)
    clean = '549' + clean;
  } else if (clean.length === 6, 7, 8) {
    // Caso número fijo o local sin característica de área -> Asumir característica de Nogoyá (3435)
    clean = '5493435' + clean;
  } else {
    // Intentar anteponer 549 por defecto
    clean = '549' + clean;
  }

  // Validar longitud final típica (549 + 10 dígitos = 13 dígitos)
  if (clean.length < 11 || clean.length > 14) {
    return { isValid: false, normalized: clean, error: 'Longitud de teléfono dudosa' };
  }

  return { isValid: true, normalized: clean };
};

/**
 * Genera la URL codificada lista para abrir en WhatsApp Web o App
 */
export const buildWhatsAppUrl = (phone: string, textMessage: string): string => {
  const encodedText = encodeURIComponent(textMessage);
  return `https://wa.me/${phone}?text=${encodedText}`;
};

/**
 * Reemplaza variables dinámicas en la plantilla de mensaje
 */
export const compileTemplate = (
  template: string,
  data: {
    nombreComercio: string;
    importe: string;
    periodoFacturado: string;
    vencimiento: string;
  }
): string => {
  return template
    .replace(/[NOMBRE DEL COMERCIO]/g, data.nombreComercio)
    .replace(/[IMPORTE]/g, data.importe)
    .replace(/[PERIODO]/g, data.periodoFacturado)
    .replace(/[FECHA DE VENCIMIENTO]/g, data.vencimiento);
};