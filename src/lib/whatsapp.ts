/**
 * Normaliza un número telefónico al formato internacional de WhatsApp para Argentina (+54 9 ...)
 */
export const normalizeWhatsAppNumber = (phone: string): { isValid: boolean; normalized: string; error?: string } => {
  if (!phone) {
    return { isValid: false, normalized: '', error: 'Sin número registrado' };
  }

  // Eliminar espacios, guiones y símbolos no numéricos
  let clean = phone.replace(/\D/g, '');

  if (!clean) {
    return { isValid: false, normalized: '', error: 'Número inválido' };
  }

  // Si empieza con 0 (ej: 03435123456), quitar el 0
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }

  // Si empieza con 549
  if (clean.startsWith('549')) {
    // Correcto
  } else if (clean.startsWith('54')) {
    clean = '549' + clean.substring(2);
  } else if (clean.startsWith('15')) {
    clean = '5493435' + clean.substring(2);
  } else if (clean.length === 10) {
    clean = '549' + clean;
  } else if (clean.length >= 6 && clean.length <= 8) {
    // Número local de Nogoyá sin característica
    clean = '5493435' + clean;
  } else {
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

// Las plantillas de mensajes (variables {nombre_comercio}, {importe}...) están
// en src/lib/plantillasMensajes.ts. La sintaxis vieja [IMPORTE] se eliminó.
