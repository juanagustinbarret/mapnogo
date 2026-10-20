import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout, Lista, P, type SeccionLegal } from '@/components/LegalLayout';
import { CONTACTO, nombreResponsable, whatsappLegible } from '@/lib/contacto';

const contacto = () =>
  CONTACTO.emailSoporte ? `${CONTACTO.emailSoporte} o por WhatsApp al ${whatsappLegible()}` : `WhatsApp al ${whatsappLegible()}`;

const SECCIONES: SeccionLegal[] = [
  {
    id: 'servicio',
    titulo: 'Qué es NOGOMAP',
    contenido: (
      <P>
        NOGOMAP es un directorio y mapa de comercios y servicios de Nogoyá y la zona. Muestra datos de contacto, horarios,
        delivery, ofertas, novedades, eventos, la farmacia de turno, teléfonos útiles y el clima. NOGOMAP no vende
        productos ni presta los servicios de los comercios: solo los da a conocer y facilita el contacto directo (por
        ejemplo, por WhatsApp).
      </P>
    ),
  },
  {
    id: 'aceptacion',
    titulo: 'Aceptación',
    contenido: (
      <P>
        Al usar el sitio aceptás estos términos y la <Link to="/privacidad" className="text-brand-600 hover:underline">Política de privacidad</Link>. Si no estás de acuerdo, no uses el sitio. Los comercios que contratan una suscripción
        los aceptan además al darse de alta.
      </P>
    ),
  },
  {
    id: 'vecinos',
    titulo: 'Uso por parte de los vecinos',
    contenido: (
      <>
        <P>El uso del mapa es gratuito y no necesita cuenta. Al usarlo te comprometés a no:</P>
        <Lista
          items={[
            'publicar reseñas o reportes falsos, ofensivos, discriminatorios, con datos personales de terceros o con publicidad;',
            'hacerte pasar por otra persona o por un comercio;',
            'usar programas automáticos para copiar el contenido, sobrecargar el sitio o vulnerar su seguridad.',
          ]}
        />
        <P>
          Podemos ocultar o borrar reseñas y reportes que no cumplan estas reglas, y bloquear a quien abuse del servicio.
        </P>
      </>
    ),
  },
  {
    id: 'comercios',
    titulo: 'Comercios: cuenta y responsabilidad por la información',
    contenido: (
      <>
        <P>Cada comercio con cuenta es responsable de:</P>
        <Lista
          items={[
            'que sus datos (dirección, horarios, delivery, precios, ofertas, fotos) sean verdaderos y estén actualizados;',
            'tener derecho a usar las imágenes y marcas que publica;',
            'cumplir las promociones que anuncia y las normas de defensa del consumidor (Ley 24.240);',
            'cuidar su contraseña y avisarnos si cree que alguien entró a su cuenta.',
          ]}
        />
        <P>
          NOGOMAP puede revisar, corregir, pausar o quitar publicaciones engañosas o que incumplan la ley, y suspender la
          cuenta en casos graves.
        </P>
      </>
    ),
  },
  {
    id: 'suscripciones',
    titulo: 'Suscripciones, pagos y baja',
    contenido: (
      <>
        <Lista
          items={[
            'El precio, el plan y la fecha de vencimiento se acuerdan con cada comercio y figuran en su panel. Los precios pueden actualizarse avisando con al menos 30 días de anticipación.',
            'Si una suscripción vence sin pago, la ficha puede dejar de mostrarse en el mapa hasta regularizarla.',
            `El comercio puede pedir la baja cuando quiera, sin costo, escribiendo a ${contacto()}. La baja se hace efectiva al terminar el período ya pagado; no se cobran períodos siguientes.`,
            'Los pagos se registran como comprobante interno. Si necesitás factura, pedila por los mismos medios de contacto.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'informacion',
    titulo: 'Información de terceros y de referencia',
    contenido: (
      <>
        <P>Hacemos lo posible para que la información sea correcta, pero tené en cuenta que:</P>
        <Lista
          items={[
            'los datos de cada comercio (horarios, delivery, precios, ofertas) los carga el propio comercio; ante una duda, confirmá directamente con él;',
            'los indicadores "Abierto ahora" y "Delivery activo" se calculan con los horarios cargados y pueden no reflejar cierres imprevistos o feriados;',
            'el clima proviene de MET Norway y los avisos de tormenta o viento son automáticos: no son alertas oficiales. Para alertas oficiales consultá al Servicio Meteorológico Nacional;',
            'los teléfonos de emergencia y la farmacia de turno son informativos. En una emergencia, si un número no responde, llamá al 911 o al 107;',
            'el mapa usa OpenStreetMap y las ubicaciones pueden tener diferencias con la realidad.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'responsabilidad',
    titulo: 'Limitación de responsabilidad',
    contenido: (
      <P>
        NOGOMAP no es parte de las compras, pedidos ni contrataciones entre vecinos y comercios, y no responde por la
        calidad, el precio, la entrega o la garantía de lo que ofrecen. Tampoco responde por interrupciones del servicio
        por mantenimiento, fallas de proveedores o causas ajenas. Nada de esto limita los derechos que te da la Ley de
        Defensa del Consumidor.
      </P>
    ),
  },
  {
    id: 'propiedad',
    titulo: 'Propiedad intelectual',
    contenido: (
      <P>
        La marca NOGOMAP, el logo, el diseño y el código del sitio pertenecen a sus responsables. Los textos, fotos y
        marcas de cada comercio son de ese comercio. Los datos del mapa son © colaboradores de OpenStreetMap y los del
        clima, de MET Norway (licencia CC BY 4.0).
      </P>
    ),
  },
  {
    id: 'cambios',
    titulo: 'Cambios en estos términos',
    contenido: (
      <P>
        Podemos actualizar estos términos. La fecha de la última versión figura arriba. Si el cambio afecta a los
        comercios con suscripción, se lo avisamos con anticipación.
      </P>
    ),
  },
  {
    id: 'ley',
    titulo: 'Ley aplicable y contacto',
    contenido: (
      <P>
        Estos términos se rigen por las leyes de la República Argentina. Responsable del sitio: {nombreResponsable()}
        {CONTACTO.cuit && `, CUIT ${CONTACTO.cuit}`}
        {CONTACTO.domicilio && `, con domicilio en ${CONTACTO.domicilio}`}, {CONTACTO.ciudad}. Para cualquier consulta o
        reclamo escribinos a {contacto()}.
      </P>
    ),
  },
];

export const TerminosPage: React.FC = () => (
  <LegalLayout
    titulo="Términos y condiciones"
    intro={<P>Estas son las reglas para usar NOGOMAP, como vecino o como comercio. Están escritas para que se entiendan.</P>}
    secciones={SECCIONES}
  />
);
