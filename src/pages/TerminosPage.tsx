import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLayout, Lista, P, type SeccionLegal } from '@/components/LegalLayout';
import { CONTACTO, nombreResponsable, textoContacto } from '@/lib/contacto';

// Revisado el 20/10/2026 contra: Ley 24.240 de Defensa del Consumidor;
// Código Civil y Comercial (arts. 984 a 989 y 1092 a 1122); Disposición
// 377/2026 (cláusulas abusivas, reemplaza el anexo de la Res. 53/2003);
// Disposición 954/2025 y Disposición 3/2026 (botones de baja y de
// arrepentimiento); Res. 270/2020 y 271/2020 (información y contratos de
// adhesión en comercio electrónico); Ley 25.326 de Datos Personales.
// No es asesoramiento legal: conviene que lo revise un abogado.

const enlace = 'text-brand-600 hover:underline';

const datosDelProveedor = () =>
  [
    nombreResponsable(),
    CONTACTO.cuit && `CUIT ${CONTACTO.cuit}`,
    CONTACTO.domicilio ? `${CONTACTO.domicilio}, ${CONTACTO.ciudad}` : CONTACTO.ciudad,
  ]
    .filter(Boolean)
    .join(' · ');

const SECCIONES: SeccionLegal[] = [
  {
    id: 'proveedor',
    titulo: 'Quiénes somos',
    contenido: (
      <>
        <P>
          NOGOYORK es un directorio y mapa de comercios y servicios de Nogoyá y la zona. Muestra datos de contacto, horarios,
          delivery, ofertas, novedades, eventos, la farmacia de turno, teléfonos útiles y el clima. NOGOYORK no vende
          productos ni presta los servicios de los comercios: los da a conocer y facilita el contacto directo con ellos (por
          ejemplo, por WhatsApp).
        </P>
        <P>
          <b>Responsable:</b> {datosDelProveedor()}. <b>Contacto:</b> {textoContacto()}. <b>Atención de consultas y
          reclamos:</b> {CONTACTO.horarioAtencion}.
        </P>
      </>
    ),
  },
  {
    id: 'alcance',
    titulo: 'A quién se aplican',
    contenido: (
      <>
        <P>
          <b>Vecinos y visitantes.</b> Usar el mapa es gratis y no requiere cuenta. Navegar el sitio <b>no</b> implica
          aceptar ningún contrato. Si publicás una reseña o un reporte, se aplican las reglas de la sección 3, que se
          muestran junto al formulario antes de enviarlo.
        </P>
        <P>
          <b>Comercios.</b> La suscripción es un contrato que se acepta en forma expresa al darse de alta (por escrito, por
          WhatsApp o en el panel), después de haber podido leer estas condiciones. Este texto es el modelo de ese contrato:
          podés guardarlo o imprimirlo cuando quieras.
        </P>
        <P>
          Los datos personales se tratan según la <Link to="/privacidad" className={enlace}>Política de privacidad</Link>.
        </P>
      </>
    ),
  },
  {
    id: 'resenas',
    titulo: 'Reseñas y reportes',
    contenido: (
      <>
        <P>
          Las reseñas son la opinión de quien las escribe. <b>Las reseñas negativas están permitidas</b> y nadie (ni NOGOYORK
          ni el comercio) puede pedirte que no las hagas o sancionarte por hacerlas. Solo se ocultan o borran las que:
        </P>
        <Lista
          items={[
            'son falsas o no corresponden a una experiencia real con ese comercio;',
            'insultan, discriminan o amenazan;',
            'publican datos personales de otras personas (teléfonos, direcciones, fotos);',
            'son publicidad o spam.',
          ]}
        />
        <P>
          Los comercios no pueden borrar reseñas: pueden pedir que se revise una que crean que no cumple estas reglas.
          También vamos a bloquear a quien use programas automáticos para copiar el contenido, sobrecargar el sitio o
          vulnerar su seguridad.
        </P>
      </>
    ),
  },
  {
    id: 'comercios',
    titulo: 'Comercios: información que publican',
    contenido: (
      <>
        <P>Cada comercio con cuenta se compromete a:</P>
        <Lista
          items={[
            'que sus datos (dirección, ubicación, horarios, delivery, precios, ofertas, fotos) sean verdaderos y estén actualizados;',
            'tener derecho a usar las imágenes y marcas que publica;',
            'cumplir las promociones que anuncia y las normas de defensa del consumidor (Ley 24.240) con sus propios clientes;',
            'cuidar su contraseña y avisarnos si cree que alguien entró a su cuenta.',
          ]}
        />
        <P>
          Si una publicación es engañosa o incumple la ley, podemos pedir que se corrija y, si no se corrige, pausarla. Si
          el incumplimiento es grave o se repite, podemos suspender la cuenta, avisando antes y explicando el motivo.
        </P>
      </>
    ),
  },
  {
    id: 'suscripciones',
    titulo: 'Suscripciones, precio y baja',
    contenido: (
      <>
        <Lista
          items={[
            <>
              <b>Precio y plan.</b> Se informan antes de contratar, en pesos y con el importe final, y figuran en el panel
              del comercio junto con la fecha de vencimiento.
            </>,
            <>
              <b>Cambios de precio o de condiciones.</b> Se avisan por WhatsApp o email con al menos 30 días de
              anticipación y nunca se aplican a un período ya pagado. Si no estás de acuerdo, podés dar de baja la
              suscripción sin costo antes de que el cambio empiece a regir.
            </>,
            <>
              <b>Falta de pago.</b> Si una suscripción vence sin pago, te avisamos y, si no se regulariza, la ficha deja de
              mostrarse en el mapa hasta que se pague. No se borran tus datos por eso.
            </>,
            <>
              <b>Baja.</b> Podés darla de baja cuando quieras, sin costo, sin preaviso y sin explicar por qué, desde el{' '}
              <Link to="/baja" className={enlace}>Botón de baja de servicio</Link> o por los mismos medios por los que
              contrataste. Te damos un código de baja en el momento. La baja rige al terminar el período ya pagado y no se
              cobra nada más.
            </>,
            <>
              <b>Arrepentimiento.</b> Si contrataste a distancia (por WhatsApp, por teléfono o por internet), tenés 10
              días corridos para arrepentirte sin costo ni explicación, cuando corresponda según el art. 34 de la Ley
              24.240 y el art. 1110 del Código Civil y Comercial. Podés hacerlo desde el{' '}
              <Link to="/baja" className={enlace}>Botón de arrepentimiento</Link>.
            </>,
            <>
              <b>Si NOGOYORK deja de prestar el servicio</b> sin que haya un incumplimiento tuyo, te avisamos con al menos 30
              días de anticipación y te devolvemos la parte proporcional del período pagado que no se use.
            </>,
            <>
              <b>Comprobantes.</b> Cada pago se registra y podés pedir el comprobante o la factura por los medios de
              contacto.
            </>,
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
        <P>Hacemos lo posible para que la información sea correcta. Tené en cuenta que:</P>
        <Lista
          items={[
            'los datos de cada comercio (horarios, delivery, precios, ofertas) los carga el propio comercio; ante una duda, confirmá directamente con él;',
            'los indicadores "Abierto ahora" y "Delivery activo" se calculan con los horarios cargados y pueden no reflejar cierres imprevistos o feriados;',
            'el clima proviene de MET Norway y los avisos de tormenta o viento son automáticos: no son alertas oficiales. Para alertas oficiales consultá al Servicio Meteorológico Nacional;',
            'los teléfonos de emergencia y la farmacia de turno son informativos. En una emergencia, si un número no responde, llamá al 911 o al 107;',
            'la ubicación de los comercios y eventos la marca quien los carga y el mapa usa OpenStreetMap: puede haber diferencias con la realidad.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'responsabilidad',
    titulo: 'Responsabilidad',
    contenido: (
      <P>
        NOGOYORK responde por el servicio que presta (el directorio, el mapa y el panel de los comercios) según la ley. No es
        parte de las compras, pedidos ni contrataciones entre vecinos y comercios: por la calidad, el precio, la entrega o
        la garantía de lo que ofrece cada comercio responde ese comercio. Nada de estos términos excluye ni limita los
        derechos que te dan la Ley de Defensa del Consumidor y el Código Civil y Comercial.
      </P>
    ),
  },
  {
    id: 'propiedad',
    titulo: 'Propiedad intelectual',
    contenido: (
      <P>
        La marca NOGOYORK, el logo, el diseño y el código del sitio pertenecen a sus responsables. Los textos, fotos y
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
        Si actualizamos estos términos, cambiamos la fecha de arriba. Los cambios solo rigen hacia adelante. Para los
        comercios con suscripción, se aplica lo dicho en la sección 5: aviso con 30 días de anticipación y baja sin costo
        si no están de acuerdo.
      </P>
    ),
  },
  {
    id: 'reclamos',
    titulo: 'Reclamos, ley aplicable y tribunales',
    contenido: (
      <>
        <P>
          Para cualquier consulta o reclamo escribinos a {textoContacto()} ({CONTACTO.horarioAtencion}). Te respondemos con
          un número de reclamo.
        </P>
        <P>
          También podés reclamar ante la oficina de Defensa del Consumidor de tu municipio o de la provincia de Entre
          Ríos, o en la Ventanilla Única Federal de Defensa del Consumidor del gobierno nacional.
        </P>
        <P>
          Estos términos se rigen por las leyes de la República Argentina. Si sos consumidor, es competente el tribunal de
          tu domicilio.
        </P>
      </>
    ),
  },
];

export const TerminosPage: React.FC = () => (
  <LegalLayout
    titulo="Términos y condiciones"
    intro={
      <P>
        Estas son las reglas para usar NOGOYORK como vecino y las condiciones de la suscripción para comercios (contrato
        de adhesión, Ley 24.240). Están escritas para que se entiendan.
      </P>
    }
    secciones={SECCIONES}
  />
);
