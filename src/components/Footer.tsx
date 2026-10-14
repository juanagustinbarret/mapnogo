import React from 'react';
import { MapPin } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-8">
      <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center justify-center gap-1 mb-2 font-semibold text-gray-900 dark:text-white">
          <MapPin className="w-4 h-4 text-brand-500" /> Nogoyá Cerca — Entre Ríos
        </div>
        <p>© {new Date().getFullYear()} Nogoyá Cerca. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
};