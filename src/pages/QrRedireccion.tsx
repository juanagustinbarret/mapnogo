import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { destinoQrFicha, destinoQrResenas } from '@/lib/rutasQr';

/**
 * Ruta estable de los QR impresos: /n/{slug}/resenas → ficha en #resenas.
 * Si cambia la estructura de la web, se cambia el destino acá y los QR ya
 * impresos siguen funcionando. No borrar esta ruta.
 */
export const QrResenasRedireccion: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  return <Navigate to={slug ? destinoQrResenas(slug) : '/'} replace />;
};

/** /n/{slug} → ficha del comercio (por si alguien recorta el link). */
export const QrFichaRedireccion: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  return <Navigate to={slug ? destinoQrFicha(slug) : '/'} replace />;
};
