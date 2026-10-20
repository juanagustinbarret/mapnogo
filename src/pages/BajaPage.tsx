import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail, MessageCircle } from 'lucide-react';
import { CONTACTO, textoContacto } from '@/lib/contacto';
import { codigoDeSolicitud, mensajeSolicitud, type TipoSolicitud } from '@/lib/bajaServicio';

const TEXTOS: Record<TipoSolicitud, { boton: string; explicacion: React.ReactNode }> = {
  baja: {
    boton: 'BOTÓN DE BAJA DE SERVICIO',
    explicacion: (
      <>
        Das de baja la suscripción de tu comercio, sin costo, sin preaviso y sin explicar por qué. Rige al terminar el
        período ya pagado y no se cobra nada más. Tus datos se borran o se conservan según la{' '}
        <Link to="/privacidad" className="text-brand-600 hover:underline">Política de privacidad</Link>.
      </>
    ),
  },
  arrepentimiento: {
    boton: 'BOTÓN DE ARREPENTIMIENTO',
    explicacion: (
      <>
        Si contrataste a distancia (por WhatsApp, por teléfono o por internet), tenés 10 días corridos desde que
        contrataste para arrepentirte sin costo ni explicación, cuando corresponda según el art. 34 de la Ley 24.240 y el
        art. 1110 del Código Civil y Comercial. Si ya pagaste, te devolvemos lo pagado.
      </>
    ),
  },
};

/**
 * Botón de baja y botón de arrepentimiento (Disposición 954/2025): sin
 * registro previo; el código de constancia se entrega en el momento.
 */
export const BajaPage: React.FC = () => {
  const [parametros] = useSearchParams();
  const [tipo, setTipo] = useState<TipoSolicitud>(parametros.get('tipo') === 'arrepentimiento' ? 'arrepentimiento' : 'baja');
  const [comercio, setComercio] = useState('');
  const [contacto, setContacto] = useState('');
  const [comentario, setComentario] = useState('');
  const [codigo, setCodigo] = useState('');

  const completo = comercio.trim().length > 1 && contacto.trim().length > 4;
  const mensaje = codigo ? mensajeSolicitud({ tipo, codigo, comercio, contacto, comentario }) : '';

  const generar = (e: React.FormEvent) => {
    e.preventDefault();
    if (completo) setCodigo(codigoDeSolicitud(tipo));
  };

  const cambiarTipo = (nuevo: TipoSolicitud) => {
    setTipo(nuevo);
    setCodigo('');
  };

  const campo =
    'w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-base sm:text-sm text-gray-900 dark:text-white';

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6 text-sm text-gray-700 dark:text-gray-300">
      <Link to="/" className="inline-flex items-center gap-1.5 text-brand-600 font-bold text-xs hover:underline">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Volver al mapa
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Baja o arrepentimiento</h1>
        <p>Para comercios con suscripción. No hace falta iniciar sesión.</p>
      </header>

      <div role="tablist" aria-label="Tipo de pedido" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(['baja', 'arrepentimiento'] as TipoSolicitud[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tipo === t}
            onClick={() => cambiarTipo(t)}
            className={`px-3 py-3 rounded-2xl text-xs font-black border transition ${
              tipo === t
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700'
            }`}
          >
            {TEXTOS[t].boton}
          </button>
        ))}
      </div>

      <p className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">{TEXTOS[tipo].explicacion}</p>

      {!codigo ? (
        <form onSubmit={generar} className="space-y-3">
          <div>
            <label htmlFor="baja-comercio" className="block text-xs font-bold mb-1">Nombre del comercio *</label>
            <input id="baja-comercio" required value={comercio} onChange={(e) => setComercio(e.target.value)} className={campo} />
          </div>
          <div>
            <label htmlFor="baja-contacto" className="block text-xs font-bold mb-1">Tu email o WhatsApp *</label>
            <input id="baja-contacto" required value={contacto} onChange={(e) => setContacto(e.target.value)} className={campo} placeholder="Para confirmarte el pedido" />
          </div>
          <div>
            <label htmlFor="baja-comentario" className="block text-xs font-bold mb-1">Comentario (opcional)</label>
            <textarea id="baja-comentario" value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} className={campo} />
          </div>
          <p className="text-[11px] text-gray-500">
            Usamos estos datos solo para identificar la suscripción y confirmarte el pedido. Podemos pedirte que confirmes
            que sos el titular, por seguridad (Disposición 3/2026).
          </p>
          <button
            type="submit"
            disabled={!completo}
            className="w-full py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black text-sm disabled:opacity-50"
          >
            Obtener código y enviar
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4 space-y-1">
            <p className="flex items-center gap-1.5 font-bold text-green-800 dark:text-green-300">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Tu código de constancia
            </p>
            <p className="text-2xl font-black tracking-wider text-gray-900 dark:text-white select-all">{codigo}</p>
            <p className="text-xs">Guardalo. Para que el pedido nos llegue, envialo con uno de estos botones:</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/${CONTACTO.whatsappSoporte}?text=${encodeURIComponent(mensaje)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[10rem] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" /> Enviar por WhatsApp
            </a>
            {CONTACTO.emailSoporte && (
              <a
                href={`mailto:${CONTACTO.emailSoporte}?subject=${encodeURIComponent(`${TEXTOS[tipo].boton} ${codigo}`)}&body=${encodeURIComponent(mensaje)}`}
                className="flex-1 min-w-[10rem] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-black text-sm"
              >
                <Mail className="w-4 h-4" aria-hidden="true" /> Enviar por email
              </a>
            )}
          </div>
          <pre className="whitespace-pre-wrap text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">{mensaje}</pre>
          <button type="button" onClick={() => setCodigo('')} className="text-xs font-bold text-brand-600 hover:underline">
            Corregir los datos
          </button>
        </div>
      )}

      <p className="text-xs text-gray-500">
        También podés pedirlo por {textoContacto()} ({CONTACTO.horarioAtencion}). Más información en los{' '}
        <Link to="/terminos#suscripciones" className="text-brand-600 hover:underline">Términos y condiciones</Link>.
      </p>
    </div>
  );
};
