import React from 'react';
import { LegalLayout, Lista, P, type SeccionLegal } from '@/components/LegalLayout';
import { CONTACTO, nombreResponsable, whatsappLegible } from '@/lib/contacto';

const contacto = () =>
  CONTACTO.emailSoporte ? `${CONTACTO.emailSoporte} o por WhatsApp al ${whatsappLegible()}` : `WhatsApp al ${whatsappLegible()}`;

const SECCIONES: SeccionLegal[] = [
  {
    id: 'responsable',
    titulo: 'Quién es responsable de tus datos',
    contenido: (
      <P>
        Responsables de la base de datos: {nombreResponsable()}
        {CONTACTO.cuit && ` (CUIT ${CONTACTO.cuit})`}
        {CONTACTO.domicilio && `, con domicilio en ${CONTACTO.domicilio}`}, {CONTACTO.ciudad}. Podés contactarnos por {contacto()}.
        Tratamos los datos según la Ley 25.326 de Protección de los Datos Personales.
      </P>
    ),
  },
  {
    id: 'datos',
    titulo: 'Qué datos usamos y para qué',
    contenido: (
      <>
        <P><b>Si visitás el mapa (sin cuenta):</b></P>
        <Lista
          items={[
            <><b>Tu ubicación</b>, solo si tocás "Usar mi ubicación": se usa en tu dispositivo para mostrar distancias y ordenar por cercanía. No la guardamos. Para mostrar el nombre de tu calle, las coordenadas se consultan a OpenStreetMap (Nominatim).</>,
            <><b>Un identificador anónimo</b> generado en tu navegador, junto con las visitas a fichas y los toques en "WhatsApp" y "Cómo llegar". Sirve para darle estadísticas a cada comercio sin contar dos veces a la misma persona. No incluye tu nombre ni tu teléfono.</>,
            <><b>Notificaciones de ofertas</b>, si las activás: guardamos la dirección técnica que da tu navegador para enviarlas. Se borra al desactivarlas.</>,
            <><b>Reseñas y reportes</b> que escribas: el nombre que pongas, la calificación y el texto. Las reseñas se muestran públicamente con ese nombre.</>,
            <><b>Preferencias</b> como el modo oscuro, guardadas solo en tu navegador.</>,
          ]}
        />
        <P><b>Si tenés un comercio con cuenta:</b></P>
        <Lista
          items={[
            'datos del comercio y de contacto (nombre, dirección, WhatsApp, email comercial, horarios, fotos, ofertas), que en su mayoría se publican en el mapa, excepto el email y los datos de cuenta;',
            'email y contraseña para entrar al panel (la contraseña se guarda cifrada por nuestro proveedor de autenticación; nadie de NOGOMAP puede verla);',
            'datos de la suscripción y de los pagos registrados, para administrar el servicio;',
            'las estadísticas de tu ficha.',
          ]}
        />
        <P>
          <b>Si pedís recuperar tu contraseña:</b> el email que ingreses, para que un administrador gestione el pedido.
        </P>
      </>
    ),
  },
  {
    id: 'terceros',
    titulo: 'Con quién se comparten',
    contenido: (
      <>
        <P>No vendemos ni cedemos tus datos. Para funcionar usamos estos proveedores, que los procesan por nuestra cuenta:</P>
        <Lista
          items={[
            'Supabase: base de datos y cuentas de usuario;',
            'el servicio de hosting del sitio (Vercel o Cloudflare);',
            'OpenStreetMap: el mapa y la búsqueda de direcciones (recibe tu dirección IP al cargar el mapa);',
            'Google Fonts: la tipografía (recibe tu dirección IP);',
            'MET Norway: el clima (lo consulta nuestro servidor, sin datos tuyos).',
          ]}
        />
        <P>
          Algunos de estos proveedores tienen servidores fuera de Argentina, por lo que los datos pueden alojarse en otros
          países, con medidas de seguridad acordes. Si tocás "WhatsApp" o "Cómo llegar", salís a WhatsApp o Google Maps y
          se aplican sus propias políticas.
        </P>
      </>
    ),
  },
  {
    id: 'conservacion',
    titulo: 'Cuánto tiempo los guardamos',
    contenido: (
      <Lista
        items={[
          'Estadísticas: mientras el comercio esté en NOGOMAP (se usan en forma agregada).',
          'Notificaciones: hasta que las desactives.',
          'Reseñas y reportes: hasta que se borren por pedido tuyo, del comercio o por moderación.',
          'Datos de comercios y pagos: mientras la cuenta esté activa y luego el tiempo que exijan las normas contables e impositivas.',
          'Pedidos de recuperación de contraseña: hasta que se resuelven y por un tiempo razonable de control.',
        ]}
      />
    ),
  },
  {
    id: 'derechos',
    titulo: 'Tus derechos',
    contenido: (
      <>
        <P>
          Podés pedir <b>acceso</b> a tus datos, su <b>rectificación</b>, <b>actualización</b> o <b>supresión</b>, y retirar tu
          consentimiento, escribiendo a {contacto()}. Respondemos los pedidos de acceso dentro de los 10 días corridos y los de
          rectificación o supresión dentro de los 5 días hábiles, como indica la ley. Para proteger tus datos podemos
          pedirte que acredites que sos el titular.
        </P>
        <p className="text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma
          gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo
          establecido en el artículo 14, inciso 3 de la Ley Nº 25.326. La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su
          carácter de Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que
          interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de
          protección de datos personales.
        </p>
      </>
    ),
  },
  {
    id: 'seguridad',
    titulo: 'Seguridad',
    contenido: (
      <P>
        Usamos conexiones cifradas (HTTPS), contraseñas cifradas y permisos para que cada comercio solo pueda ver y editar
        lo suyo. Ningún sistema es infalible: si detectamos un incidente que afecte tus datos, te lo vamos a informar.
      </P>
    ),
  },
  {
    id: 'menores',
    titulo: 'Menores de edad',
    contenido: (
      <P>
        Las cuentas de comercio son para mayores de 18 años. El mapa puede usarse sin cuenta; no pedimos ni guardamos
        datos para identificar a quien lo usa.
      </P>
    ),
  },
  {
    id: 'cambios',
    titulo: 'Cambios en esta política',
    contenido: <P>Si cambiamos esta política, actualizamos la fecha de arriba y, si el cambio es importante, lo avisamos en el sitio.</P>,
  },
];

export const PrivacidadPage: React.FC = () => (
  <LegalLayout
    titulo="Política de privacidad"
    intro={<P>Qué datos usa NOGOMAP, para qué, con quién se comparten y cómo podés pedir verlos, corregirlos o borrarlos.</P>}
    secciones={SECCIONES}
  />
);
