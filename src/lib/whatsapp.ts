// Mantener en sincronía con supabase/functions/_shared/whatsapp.ts

/**
 * Normaliza un número telefónico al formato internacional de WhatsApp para Argentina (549...).
 * Números locales sin característica se asumen de Nogoyá (3435).
 */
export const normalizeWhatsAppNumber = (
  phone: string,
): { isValid: boolean; normalized: string; error?: string } => {
  if (!phone) {
    return { isValid: false, normalized: '', error: 'Sin número registrado' };
  }

  let clean = phone.replace(/\D/g, '');

  if (!clean) {
    return { isValid: false, normalized: '', error: 'Número inválido' };
  }

  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }

  if (clean.startsWith('549')) {
    // ya está en formato internacional
  } else if (clean.startsWith('54')) {
    clean = '549' + clean.substring(2);
  } else if (clean.startsWith('15')) {
    clean = '5493435' + clean.substring(2);
  } else if (clean.length === 10) {
    clean = '549' + clean;
  } else if (clean.length >= 6 && clean.length <= 8) {
    clean = '5493435' + clean;
  } else {
    clean = '549' + clean;
  }

  if (clean.length < 11 || clean.length > 14) {
    return { isValid: false, normalized: clean, error: 'Longitud de teléfono dudosa' };
  }

  return { isValid: true, normalized: clean };
};

/**
 * Genera la URL de WhatsApp. Si el número no es válido, devuelve null.
 */
export const buildWhatsAppUrl = (phone: string, textMessage?: string): string | null => {
  const { isValid, normalized } = normalizeWhatsAppNumber(phone);
  if (!isValid) return null;
  const texto = textMessage ? `?text=${encodeURIComponent(textMessage)}` : '';
  return `https://wa.me/${normalized}${texto}`;
};

const escaparRegex = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Reemplaza las variables entre corchetes de una plantilla, por ejemplo
 * [NOMBRE DEL COMERCIO], [IMPORTE], [PERIODO] y [FECHA DE VENCIMIENTO].
 */
export const compileTemplate = (
  template: string,
  data: {
    nombreComercio?: string;
    importe?: string;
    periodoFacturado?: string;
    vencimiento?: string;
  },
): string => {
  if (!template) return '';

  const variables: Record<string, string> = {
    'NOMBRE DEL COMERCIO': data.nombreComercio ?? '',
    IMPORTE: data.importe ?? '',
    PERIODO: data.periodoFacturado ?? '',
    'FECHA DE VENCIMIENTO': data.vencimiento ?? '',
    VENCIMIENTO: data.vencimiento ?? '',
  };

  return Object.entries(variables).reduce(
    (texto, [clave, valor]) => texto.replace(new RegExp(`\\[${escaparRegex(clave)}\\]`, 'g'), valor),
    template,
  );
};
