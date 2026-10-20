import React, { useEffect, useState } from 'react';

// El generador de QR (src/lib/vendor/qrcodegen.ts) se baja aparte, así no
// demora la primera pintada del panel. Si falla (por ejemplo, después de un
// deploy con el panel abierto), se avisa en el recuadro sin romper el panel.

type Modulo = typeof import('@/components/QrResenas');
type PropsQr = React.ComponentProps<Modulo['QrResenas']>;

let modulo: Promise<Modulo> | null = null;

/** Empieza a bajar el QR (se puede llamar antes de mostrarlo). */
export const precargarQrResenas = () => {
  modulo ??= import('@/components/QrResenas').catch((error) => {
    modulo = null;
    throw error;
  });
  return modulo;
};

export const QrResenasDiferido: React.FC<PropsQr> = (props) => {
  const [Qr, setQr] = useState<Modulo['QrResenas'] | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    precargarQrResenas()
      .then((m) => vivo && setQr(() => m.QrResenas))
      .catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
    };
  }, []);

  if (fallo) return <p className="text-xs text-gray-500 text-center py-6">No se pudo cargar el QR. Recargá la página.</p>;
  if (!Qr) return <div className="w-36 h-36 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" role="status" aria-label="Cargando QR" />;
  return <Qr {...props} />;
};
