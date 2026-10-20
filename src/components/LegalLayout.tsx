import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Mail, MessageCircle } from 'lucide-react';
import { ACTUALIZACION_LEGALES, CONTACTO, whatsappLegible } from '@/lib/contacto';

export interface SeccionLegal {
  id: string;
  titulo: string;
  contenido: React.ReactNode;
}

// Estructura común de Términos y Privacidad: título, índice y secciones.
export const LegalLayout: React.FC<{ titulo: string; intro: React.ReactNode; secciones: SeccionLegal[] }> = ({
  titulo,
  intro,
  secciones,
}) => {
  // Links como /terminos#suscripciones: ir a esa sección al entrar
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView(), 50);
    return () => clearTimeout(t);
  }, [hash]);

  return (
  <article className="max-w-3xl mx-auto px-4 py-8 space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
    <Link to="/" className="inline-flex items-center gap-1.5 text-brand-600 font-bold text-xs hover:underline">
      <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Volver al mapa
    </Link>
    <header className="space-y-2">
      <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{titulo}</h1>
      <p className="text-xs text-gray-500">Última actualización: {ACTUALIZACION_LEGALES}</p>
      <div className="space-y-2">{intro}</div>
    </header>

    <nav aria-label="Contenido" className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
      <p className="font-bold text-gray-900 dark:text-white text-xs mb-2">Contenido</p>
      <ol className="list-decimal pl-5 space-y-1 text-xs">
        {secciones.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="text-brand-600 hover:underline">
              {s.titulo}
            </a>
          </li>
        ))}
      </ol>
    </nav>

    {secciones.map((s, i) => (
      <section key={s.id} id={s.id} className="space-y-2 scroll-mt-20">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          {i + 1}. {s.titulo}
        </h2>
        {s.contenido}
      </section>
    ))}

    <footer className="border-t dark:border-gray-700 pt-4 space-y-2 text-xs">
      <p className="font-bold text-gray-900 dark:text-white">¿Dudas o pedidos?</p>
      <div className="flex flex-wrap gap-2">
        {CONTACTO.emailSoporte && (
          <a href={`mailto:${CONTACTO.emailSoporte}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 font-bold">
            <Mail className="w-4 h-4" aria-hidden="true" /> {CONTACTO.emailSoporte}
          </a>
        )}
        <a
          href={`https://wa.me/${CONTACTO.whatsappSoporte}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 font-bold"
        >
          <MessageCircle className="w-4 h-4" aria-hidden="true" /> WhatsApp {whatsappLegible()}
        </a>
      </div>
      <p>
        <Link to="/terminos" className="text-brand-600 hover:underline">Términos y condiciones</Link> ·{' '}
        <Link to="/privacidad" className="text-brand-600 hover:underline">Política de privacidad</Link>
      </p>
    </footer>
  </article>
  );
};

export const P: React.FC<{ children: React.ReactNode }> = ({ children }) => <p>{children}</p>;
export const Lista: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="list-disc pl-5 space-y-1">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);
