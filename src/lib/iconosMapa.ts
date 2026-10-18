// src/lib/iconosMapa.ts
//
// Marcadores del mapa hechos con HTML + SVG (L.divIcon), sin imágenes externas:
//   - iconoDeComercio(): pin con el color y el ícono del rubro.
//   - ICONO_GPS: punto azul con halo, como el de los navegadores GPS.
// Los estilos están en src/index.css (clases .ng-pin y .ng-gps).

import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import L from 'leaflet';
import type { LucideIcon } from 'lucide-react';
import type { VisualRubro } from '@/lib/iconosRubro';

// ─── De componente de lucide-react a texto SVG ─────────────────────────────
// Leaflet necesita el HTML del marcador como texto. Los íconos de lucide-react
// son componentes que devuelven un <svg> con <path> adentro, así que se pueden
// convertir a texto recorriendo ese árbol, sin cargar react-dom/server (que
// sumaría unos 70 KB a la app). Si algún día lucide cambia y esto falla, el
// marcador muestra un punto blanco en lugar de romper el mapa.

const escapar = (texto: string) =>
  texto.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// strokeWidth → stroke-width, className → class; viewBox y xmlns quedan igual.
const nombreDeAtributo = (prop: string) =>
  prop === 'className'
    ? 'class'
    : /^(stroke|fill|clip)[A-Z]/.test(prop)
      ? prop.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`)
      : prop;

type Props = Record<string, unknown> & { children?: ReactNode };
type ComponenteRenderizable = { render?: (props: Props, ref: null) => ReactNode };

function aTexto(nodo: ReactNode, profundidad = 0): string {
  if (profundidad > 12) throw new Error('Ícono demasiado anidado');
  if (nodo === null || nodo === undefined || typeof nodo === 'boolean') return '';
  if (typeof nodo === 'string' || typeof nodo === 'number') return escapar(String(nodo));
  if (Array.isArray(nodo)) return nodo.map((hijo) => aTexto(hijo, profundidad + 1)).join('');
  if (!isValidElement(nodo)) return '';

  const { type, props } = nodo as ReactElement<Props>;
  if (typeof type === 'string') {
    const atributos = Object.entries(props)
      .filter(([clave, valor]) => clave !== 'children' && (typeof valor === 'string' || typeof valor === 'number'))
      .map(([clave, valor]) => ` ${nombreDeAtributo(clave)}="${escapar(String(valor))}"`)
      .join('');
    return `<${type}${atributos}>${aTexto(props.children, profundidad + 1)}</${type}>`;
  }

  // Componentes: lucide usa forwardRef (objeto con .render); por las dudas
  // también se aceptan componentes función sin hooks.
  const render =
    typeof type === 'function'
      ? (type as (props: Props) => ReactNode)
      : (type as ComponenteRenderizable).render;
  if (typeof render !== 'function') throw new Error('Tipo de componente no soportado');
  return aTexto(render(props, null), profundidad + 1);
}

const SVG_RESERVA =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#fff"/></svg>';

export function svgDeIcono(Icono: LucideIcon, opciones: { size: number; color: string; strokeWidth: number }): string {
  try {
    const svg = aTexto(createElement(Icono, { ...opciones, 'aria-hidden': 'true', focusable: 'false' }));
    if (!svg.startsWith('<svg')) throw new Error('El ícono no devolvió un <svg>');
    return svg;
  } catch (error) {
    console.warn('No se pudo dibujar el ícono del marcador:', error);
    return SVG_RESERVA;
  }
}

// ─── Pin de comercio ───────────────────────────────────────────────────────
// Forma de gota de 36×46 px con borde blanco; la punta queda en (18, 45).
const FORMA_PIN =
  'M18 1.5C9.4 1.5 2.5 8.4 2.5 17c0 11.2 13.3 24.6 14.6 25.9a1.3 1.3 0 0 0 1.8 0C20.2 41.6 33.5 28.2 33.5 17 33.5 8.4 26.6 1.5 18 1.5Z';

const iconosCreados = new Map<string, L.DivIcon>();

/** Marcador de un comercio según su rubro. Se crea una sola vez por rubro. */
export function iconoDeComercio(visual: VisualRubro): L.DivIcon {
  const clave = `${visual.clave}|${visual.color}`;
  let icono = iconosCreados.get(clave);
  if (!icono) {
    const svgIcono = svgDeIcono(visual.Icono, { size: 18, color: '#ffffff', strokeWidth: 2.25 });
    icono = L.divIcon({
      className: 'ng-pin',
      html:
        `<svg class="ng-pin__forma" xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46" aria-hidden="true">` +
        `<path d="${FORMA_PIN}" fill="${visual.color}" stroke="#ffffff" stroke-width="2"/></svg>` +
        `<span class="ng-pin__icono">${svgIcono}</span>`,
      iconSize: [36, 46],
      iconAnchor: [18, 45],
      popupAnchor: [0, -40],
    });
    iconosCreados.set(clave, icono);
  }
  return icono;
}

// ─── Ubicación del usuario (estilo GPS) ───────────────────────────────────
// El rumbo (hacia dónde va el usuario) se muestra u oculta desde el mapa
// cambiando la clase ng-gps--con-rumbo y la variable CSS --ng-rumbo, así el
// ícono no se vuelve a crear en cada actualización y el halo no se corta.
export const ICONO_GPS = L.divIcon({
  className: 'ng-gps',
  html:
    '<span class="ng-gps__rumbo" aria-hidden="true"></span>' +
    '<span class="ng-gps__halo" aria-hidden="true"></span>' +
    '<span class="ng-gps__punto"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -14],
});
