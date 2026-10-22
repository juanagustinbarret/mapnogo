import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MerchantDashboardPage } from '@/pages/MerchantDashboardPage';
import { MerchantProfilePage } from '@/pages/MerchantProfilePage';
import { seccionDeRuta, type SeccionPanel } from '@/lib/datosPanel';

// Panel del comercio con sus dos secciones: "Dashboard" (/panel) y "Editar
// datos del local" (/panel/perfil). Antes eran dos rutas con dos componentes
// distintos: al pasar de una a otra se desmontaba la que se dejaba y, al
// volver, se pedía todo de nuevo con la pantalla de carga, perdiendo el
// scroll y lo que se estaba escribiendo.
//
// Ahora las dos rutas muestran ESTE componente (React no lo vuelve a montar
// al cambiar de ruta) y las secciones ya visitadas quedan montadas y ocultas.
// "Editar datos" se monta recién la primera vez que se abre.

export const PanelComercio: React.FC = () => {
  const { pathname } = useLocation();
  const seccion = seccionDeRuta(pathname);
  const [visitadas, setVisitadas] = useState<Set<SeccionPanel>>(() => new Set([seccion]));
  const scrollPorSeccion = useRef<Record<SeccionPanel, number>>({ inicio: 0, perfil: 0 });
  const actual = useRef(seccion);

  if (!visitadas.has(seccion)) setVisitadas(new Set([...visitadas, seccion]));

  // Recordar el scroll de la sección que se está viendo
  useEffect(() => {
    const guardar = () => {
      scrollPorSeccion.current[actual.current] = window.scrollY;
    };
    window.addEventListener('scroll', guardar, { passive: true });
    return () => window.removeEventListener('scroll', guardar);
  }, []);

  // Al cambiar de sección, volver al scroll que tenía la nueva
  useLayoutEffect(() => {
    if (actual.current === seccion) return;
    actual.current = seccion;
    window.scrollTo(0, scrollPorSeccion.current[seccion] ?? 0);
  }, [seccion]);

  return (
    <>
      {visitadas.has('inicio') && (
        <div hidden={seccion !== 'inicio'}>
          <MerchantDashboardPage />
        </div>
      )}
      {visitadas.has('perfil') && (
        <div hidden={seccion !== 'perfil'}>
          <MerchantProfilePage />
        </div>
      )}
    </>
  );
};
