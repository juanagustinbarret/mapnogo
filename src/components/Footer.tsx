import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { CONTACTO, whatsappLegible } from '@/lib/contacto';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-8">
      <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400 space-y-2">
        <div className="flex items-center justify-center gap-1 font-semibold text-gray-900 dark:text-white">
          <MapPin className="w-4 h-4 text-brand-500" /> NOGOMAP - Nogoyá — Entre Ríos
        </div>
        <nav aria-label="Información legal y contacto" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
          <Link to="/terminos" className="hover:text-brand-600 hover:underline">Términos y condiciones</Link>
          <span aria-hidden="true">·</span>
          <Link to="/privacidad" className="hover:text-brand-600 hover:underline">Privacidad</Link>
          <span aria-hidden="true">·</span>
          {CONTACTO.emailSoporte ? (
            <a href={`mailto:${CONTACTO.emailSoporte}`} className="hover:text-brand-600 hover:underline">{CONTACTO.emailSoporte}</a>
          ) : (
            <a href={`https://wa.me/${CONTACTO.whatsappSoporte}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 hover:underline">
              Soporte: WhatsApp {whatsappLegible()}
            </a>
          )}
        </nav>
        <p>© {new Date().getFullYear()} NOGOMAP. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
};
