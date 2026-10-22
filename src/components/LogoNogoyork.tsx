// src/components/LogoNogoyork.tsx
import React from 'react';

interface LogoNogoyorkProps {
  className?: string;
}

export const LogoNogoyork: React.FC<LogoNogoyorkProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 32 32" className={className} role="img" aria-hidden="true" focusable="false">
    {/* Fondo verde oscuro con esquinas redondeadas */}
    <rect width="32" height="32" rx="7" fill="#15803d" />
    
    {/* Ojos del sapito (Sombra y contorno de la cabeza) */}
    <circle cx="9" cy="11.5" r="4.5" fill="#4ade80" />
    <circle cx="23" cy="11.5" r="4.5" fill="#4ade80" />
    
    {/* Cara y mejillas */}
    <ellipse cx="16" cy="16.5" rx="10" ry="7" fill="#4ade80" />
    <circle cx="8" cy="16.5" r="1.3" fill="#22c55e" />
    <circle cx="24" cy="16.5" r="1.3" fill="#22c55e" />

    {/* Ojos (Parte blanca y pupilas oscuras) */}
    <circle cx="9" cy="11.5" r="3" fill="#fff" />
    <circle cx="23" cy="11.5" r="3" fill="#fff" />
    <circle cx="9.2" cy="11.8" r="1.5" fill="#052e16" />
    <circle cx="22.8" cy="11.8" r="1.5" fill="#052e16" />

    {/* Sonrisa alegre */}
    <path d="M12.5 16.2 Q16 19 19.5 16.2" fill="none" stroke="#064e3b" strokeWidth="1" strokeLinecap="round" />

    {/* Manitos en el mapa */}
    {/* Mano izquierda */}
    <ellipse cx="10" cy="20.5" rx="2.2" ry="1.2" fill="#4ade80" />
    <line x1="9.3" y1="20" x2="9.3" y2="21.5" stroke="#22c55e" strokeWidth="0.5" />
    <line x1="10" y1="19.5" x2="10" y2="21.5" stroke="#22c55e" strokeWidth="0.5" />
    <line x1="10.7" y1="20" x2="10.7" y2="21.5" stroke="#22c55e" strokeWidth="0.5" />

    {/* Mano derecha */}
    <ellipse cx="22" cy="20.5" rx="2.2" ry="1.2" fill="#4ade80" />
    <line x1="21.3" y1="20" x2="21.3" y2="21.5" stroke="#22c55e" strokeWidth="0.5" />
    <line x1="22" y1="19.5" x2="22" y2="21.5" stroke="#22c55e" strokeWidth="0.5" />
    <line x1="22.7" y1="20" x2="22.7" y2="21.5" stroke="#22c55e" strokeWidth="0.5" />

    {/* MAPA PLEGADO (Beige/Crema con tres secciones) */}
    {/* Panel izquierdo */}
    <polygon points="5,22 12,19.5 12,28.5 5,26.5" fill="#fef9c3" />
    {/* Panel central */}
    <polygon points="12,19.5 21,21.5 21,29.5 12,28.5" fill="#fef08a" />
    {/* Panel derecho */}
    <polygon points="21,21.5 27,19.5 27,27 21,29.5" fill="#fde047" />

    {/* Ruta de viaje en puntos (Naranja) */}
    <path d="M 6.5 24 Q 14 22 21 21" fill="none" stroke="#f97316" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="1.5,1.5" />

    {/* Pin de localización rojo */}
    {/* Globo del pin */}
    <path d="M 23.5 20.5 C 22.2 19 23 17.5 24.5 17.5 C 26 17.5 26.8 19 25.5 20.5 L 24.5 22 Z" fill="#ef4444" />
    {/* Orificio blanco del pin */}
    <circle cx="24.5" cy="18.8" r="0.8" fill="#fff" />
  </svg>
);