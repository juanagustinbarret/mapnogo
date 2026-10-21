// src/lib/contacto.ts
//
// Datos de contacto y de quién responde por NOGOYORK. Se muestran en el pie de
// página, en Términos y en Privacidad. COMPLETAR antes de publicar:
//  - emailSoporte: el mail de soporte cuando esté creado (si queda vacío se
//    muestra solo el WhatsApp).
//  - responsables / cuit / domicilio: quién responde legalmente por el sitio
//    y por la base de datos (Ley 25.326). Si quedan vacíos, el texto dice
//    "los administradores de NOGOYORK". La normativa de comercio electrónico
//    (Res. 270/2020) pide mostrar nombre, CUIT, domicilio y email del
//    proveedor: completarlos cuanto antes.
//  - horarioAtencion: si la atención es solo por WhatsApp o email, tiene que
//    ser de al menos 8 horas los días hábiles (Disposición 954/2025).

export const CONTACTO = {
  emailSoporte: '',
  whatsappSoporte: '5493435451818', // el mismo que ya usa el panel del comercio
  responsables: '',
  cuit: '',
  domicilio: '',
  horarioAtencion: 'de lunes a viernes de 9 a 17 h',
  ciudad: 'Nogoyá, Entre Ríos, Argentina',
  sitio: 'https://mapnogo.vercel.app',
};

export const ACTUALIZACION_LEGALES = '20/10/2026';

/** Cómo contactarnos, en una frase: email (si hay) y WhatsApp. */
export const textoContacto = () =>
  CONTACTO.emailSoporte ? `${CONTACTO.emailSoporte} o por WhatsApp al ${whatsappLegible()}` : `WhatsApp al ${whatsappLegible()}`;

/** "+54 9 343 545-1818" para mostrar el WhatsApp de soporte. */
export function whatsappLegible(numero: string = CONTACTO.whatsappSoporte): string {
  const m = /^549(\d{3})(\d{3})(\d{4})$/.exec(numero);
  return m ? `+54 9 ${m[1]} ${m[2]}-${m[3]}` : numero;
}

export const nombreResponsable = () => CONTACTO.responsables || 'los administradores de NOGOYORK';
