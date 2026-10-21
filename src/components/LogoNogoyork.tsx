import React from 'react';

export const LogoNogoyork: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 32 32" className={className} role="img" aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="7" fill="#15803d" />
    <circle cx="10" cy="10" r="5" fill="#4ade80" />
    <circle cx="22" cy="10" r="5" fill="#4ade80" />
    <ellipse cx="16" cy="16" rx="11" ry="7.5" fill="#4ade80" />
    <circle cx="10" cy="9.5" r="3" fill="#fff" />
    <circle cx="22" cy="9.5" r="3" fill="#fff" />
    <circle cx="10.6" cy="9.8" r="1.5" fill="#052e16" />
    <circle cx="21.4" cy="9.8" r="1.5" fill="#052e16" />
    {/* Fondo del mapa destacado en verde/rojo */}
    <path d="M5 22 L12 20.5 L20 22 L27 20.5 L27 28 L20 29.5 L12 28 L5 29.5 Z" fill="#ef4444" />
    <path d="M12 20.5 L20 22 L20 29.5 L12 28 Z" fill="#dc2626" />
  </svg>
);