// src/components/GestionGaleriaComercio.tsx
import React, { useState, useRef } from 'react';
import { ImagePlus, Trash2, Link as LinkIcon, Info, Upload } from 'lucide-react';

interface Props {
  galeriaUrls: string[];
  onChange: (nuevasUrls: string[]) => void;
  maxFotos?: number;
}

// Función auxiliar para redimensionar y comprimir la imagen en el cliente
const comprimirImagen = (file: File, maxWidth = 1000, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Convierte a WebP liviano con calidad ajustada
        const dataUrl = canvas.toDataURL('image/webp', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export const GestionGaleriaComercio: React.FC<Props> = ({
  galeriaUrls = [],
  onChange,
  maxFotos = 6,
}) => {
  const [nuevaUrl, setNuevaUrl] = useState('');
  const [errorInput, setErrorInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Procesar y comprimir archivos seleccionados o arrastrados
  const procesarArchivos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (galeriaUrls.length >= maxFotos) {
      alert(`Podés subir hasta un máximo de ${maxFotos} fotos para la galería.`);
      return;
    }

    const fotosDisponibles = maxFotos - galeriaUrls.length;
    const archivosAProcesar = Array.from(files).slice(0, fotosDisponibles);

    // Validar tipo de archivo
    const sonTodasImagenes = archivosAProcesar.every((f) => f.type.startsWith('image/'));
    if (!sonTodasImagenes) {
      setErrorInput('Solo se permiten archivos de imagen (JPG, PNG, WEBP, etc.).');
      return;
    }

    setProcesando(true);
    setErrorInput('');

    try {
      // Comprimir imágenes en paralelo
      const imagenesComprimidas = await Promise.all(
        archivosAProcesar.map((file) => comprimirImagen(file))
      );

      onChange([...galeriaUrls, ...imagenesComprimidas]);
    } catch (err) {
      console.error('Error al procesar/comprimir imágenes:', err);
      setErrorInput('Ocurrió un error al procesar las imágenes. Intentá con archivos más livianos.');
    } finally {
      setProcesando(false);
    }
  };

  // Manejadores de Arrastrar y Soltar (Drag & Drop)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    void procesarArchivos(e.dataTransfer.files);
  };

  // Agregar por URL directa
  const handleAgregarUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const urlLimpia = nuevaUrl.trim();

    if (!urlLimpia) return;

    if (!urlLimpia.startsWith('http://') && !urlLimpia.startsWith('https://') && !/^data:image\/(jpeg|png|webp);base64,/.test(urlLimpia)) {
      setErrorInput('La URL debe comenzar con http:// o https://');
      return;
    }

    if (galeriaUrls.length >= maxFotos) {
      alert(`Podés subir hasta un máximo de ${maxFotos} fotos para la galería.`);
      return;
    }

    if (galeriaUrls.includes(urlLimpia)) {
      setErrorInput('Esta imagen ya está agregada en la galería.');
      return;
    }

    onChange([...galeriaUrls, urlLimpia]);
    setNuevaUrl('');
    setErrorInput('');
  };

  const handleEliminarFoto = (indexEliminar: number) => {
    const filtradas = galeriaUrls.filter((_, idx) => idx !== indexEliminar);
    onChange(filtradas);
  };

  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/80">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ImagePlus className="w-4 h-4 text-emerald-600" /> Galería de Fotos del Local
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Subí fotos desde tu dispositivo o pegá el enlace de la imagen.
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-gray-500 bg-gray-200 dark:bg-gray-800 px-2.5 py-1 rounded-lg">
          {galeriaUrls.length} / {maxFotos}
        </span>
      </div>

      {/* ÁREA DE ARRASTRAR / EXPLORADOR DE ARCHIVOS */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !procesando && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
            : 'border-gray-300 dark:border-gray-700 hover:border-emerald-500 bg-white dark:bg-gray-800'
        } ${procesando ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => void procesarArchivos(e.target.files)}
          className="hidden"
        />
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-full">
          <Upload className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
            {procesando ? (
              'Optimizando e insertando fotos...'
            ) : (
              <>
                Arrastrá y soltá tus imágenes acá, o <span className="text-emerald-600 underline">buscá en tu dispositivo</span>
              </>
            )}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Soporta JPG, PNG, WEBP (hasta {maxFotos} fotos)</p>
        </div>
      </div>

      {/* INGRESO MANUAL POR ENLACE / URL */}
      <form onSubmit={handleAgregarUrl} className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              placeholder="O pegá un enlace web: https://ejemplo.com/foto.jpg"
              value={nuevaUrl}
              onChange={(e) => {
                setNuevaUrl(e.target.value);
                if (errorInput) setErrorInput('');
              }}
              disabled={galeriaUrls.length >= maxFotos || procesando}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={!nuevaUrl.trim() || galeriaUrls.length >= maxFotos || procesando}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50 shrink-0"
          >
            Agregar Enlace
          </button>
        </div>
        {errorInput && <p className="text-[11px] font-semibold text-red-500">{errorInput}</p>}
      </form>

      {/* VISTA PREVIA DE FOTOS */}
      {galeriaUrls.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
          {galeriaUrls.map((url, idx) => (
            <div
              key={idx}
              className="relative group rounded-xl overflow-hidden aspect-video border border-gray-200 dark:border-gray-700 bg-black/10"
            >
              <img
                src={url}
                alt={`Vista previa ${idx + 1}`}
                className="w-full h-full object-cover transition group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://via.placeholder.com/300x200?text=Error+al+cargar+imagen';
                }}
              />
              <button
                type="button"
                onClick={() => handleEliminarFoto(idx)}
                className="absolute top-1.5 right-1.5 p-1.5 bg-red-600/90 text-white rounded-lg opacity-90 sm:opacity-0 group-hover:opacity-100 hover:bg-red-700 transition shadow-md"
                title="Eliminar foto"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 text-xs flex flex-col items-center gap-1">
          <Info className="w-4 h-4 text-emerald-600" />
          <span>No tenés fotos en la galería todavía. Las imágenes guardadas se mostrarán en tu ficha pública.</span>
        </div>
      )}
    </div>
  );
};