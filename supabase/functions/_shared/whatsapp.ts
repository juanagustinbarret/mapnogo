// Copia mínima de src/lib/whatsapp.ts para las Edge Functions (Deno no
// puede importar el código del frontend). Mantener ambas en sincronía.

export const normalizarWhatsApp = (telefono: string): string | null => {
  let limpio = (telefono ?? '').replace(/\D/g, '');
  if (!limpio) return null;
  if (limpio.startsWith('0')) limpio = limpio.substring(1);

  if (limpio.startsWith('549')) {
    // ya está en formato internacional
  } else if (limpio.startsWith('54')) {
    limpio = '549' + limpio.substring(2);
  } else if (limpio.startsWith('15')) {
    limpio = '5493435' + limpio.substring(2);
  } else if (limpio.length === 10) {
    limpio = '549' + limpio;
  } else if (limpio.length >= 6 && limpio.length <= 8) {
    limpio = '5493435' + limpio;
  } else {
    limpio = '549' + limpio;
  }

  return limpio.length >= 11 && limpio.length <= 14 ? limpio : null;
};

const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const compilarPlantilla = (plantilla: string, datos: Record<string, string>): string =>
  Object.entries(datos).reduce(
    (texto, [clave, valor]) => texto.replace(new RegExp(`\\[${escapar(clave)}\\]`, 'g'), valor),
    plantilla ?? '',
  );
