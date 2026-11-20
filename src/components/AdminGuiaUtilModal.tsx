import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabase';
import { CartelQrModal } from '@/components/CartelQrModal';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Phone,
  MapPin,
  ShieldAlert,
  Loader2,
  Save,
  CheckCircle2,
  Search,
  RotateCcw,
  Clock,
  MessageCircle,
  ImagePlus,
  Images,
  QrCode,
} from 'lucide-react';

interface GuiaItem {
  id: string;
  nombre: string;
  categoria: string;
  telefono: string;
  whatsapp?: string | null;
  direccion: string;
  descripcion?: string | null;
  fotos?: string[] | null;
  urgencia: boolean;
  es_24hs?: boolean;
  horarios?: string | null;
  orden: number;
  latitud?: number | null;
  longitud?: number | null;
}

interface AdminGuiaUtilModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NOGOYA_CENTER: [number, number] = [-32.3935, -59.7892];
const STORAGE_BUCKET = 'comercios';
const MAX_FOTOS = 5;

const toSlug = (texto: string) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'guia-util';

export const CATEGORIAS_GUIA_UTIL = [
  'Emergencias',
  'Hospitales y Sanatorios',
  'Clínicas y Consultorios',
  'Salud',
  'Trámites y Municipio',
  'Transporte',
  'Iglesias y Culto',
] as const;

export const AdminGuiaUtilModal: React.FC<AdminGuiaUtilModalProps> = ({ isOpen, onClose }) => {
  const [items, setItems] = useState<GuiaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingFotos, setUploadingFotos] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [qrItem, setQrItem] = useState<GuiaItem | null>(null);

  // Estado del formulario
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState<string>('Emergencias');
  const [telefono, setTelefono] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [direccion, setDireccion] = useState('');
  const [horarios, setHorarios] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [es24hs, setEs24hs] = useState(false);
  const [urgencia, setUrgencia] = useState(false);
  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Refs de Leaflet para el mini-mapa arrastrable
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    } else {
      setQrItem(null);
    }
  }, [isOpen]);

  // Inicializar mapa Leaflet cuando abre el modal
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const initialLat = latitud ?? NOGOYA_CENTER[0];
      const initialLng = longitud ?? NOGOYA_CENTER[1];

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 15,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: 'custom-guia-picker-pin',
        html: `<div style="width:30px;height:30px;border-radius:9999px;background:#0284c7;border:3px solid #ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;">📍</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([initialLat, initialLng], {
        draggable: true,
        icon: pinIcon,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setLatitud(Number(pos.lat.toFixed(6)));
        setLongitud(Number(pos.lng.toFixed(6)));
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        setLatitud(Number(e.latlng.lat.toFixed(6)));
        setLongitud(Number(e.latlng.lng.toFixed(6)));
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      map.invalidateSize();
    }, 120);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    const target: [number, number] =
      latitud !== null && longitud !== null ? [latitud, longitud] : NOGOYA_CENTER;
    markerRef.current.setLatLng(target);
    mapInstanceRef.current.setView(target, latitud !== null ? 16 : 15);
  }, [latitud, longitud]);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('guia_util')
      .select('*')
      .order('urgencia', { ascending: false })
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true });

    if (!error && data) {
      setItems(data);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setEditId(null);
    setNombre('');
    setCategoria('Emergencias');
    setTelefono('');
    setWhatsapp('');
    setDireccion('');
    setHorarios('');
    setDescripcion('');
    setFotos([]);
    setEs24hs(false);
    setUrgencia(false);
    setLatitud(null);
    setLongitud(null);
  };

  const handleEdit = (item: GuiaItem) => {
    setEditId(item.id);
    setNombre(item.nombre);
    setCategoria(item.categoria);
    setTelefono(item.telefono);
    setWhatsapp(item.whatsapp || '');
    setDireccion(item.direccion);
    setHorarios(item.horarios || '');
    setDescripcion(item.descripcion || '');
    setFotos(Array.isArray(item.fotos) ? item.fotos.slice(0, MAX_FOTOS) : []);
    setEs24hs(Boolean(item.es_24hs));
    setUrgencia(item.urgencia);
    setLatitud(item.latitud ?? null);
    setLongitud(item.longitud ?? null);
  };

  const handleToggle24hs = (checked: boolean) => {
    setEs24hs(checked);
    if (checked && !horarios.trim()) {
      setHorarios('Atención las 24 hs');
    } else if (!checked && horarios === 'Atención las 24 hs') {
      setHorarios('');
    }
  };

  const handleSubirFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const disponibles = MAX_FOTOS - fotos.length;
    if (disponibles <= 0) {
      alert(`Ya cargaste el máximo de ${MAX_FOTOS} fotos.`);
      return;
    }

    const seleccionadas = Array.from(files).slice(0, disponibles);
    setUploadingFotos(true);

    try {
      const nuevasUrls: string[] = [];

      for (const file of seleccionadas) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `guia-util/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(fileName);

        if (publicData?.publicUrl) {
          nuevasUrls.push(publicData.publicUrl);
        }
      }

      setFotos((prev) => [...prev, ...nuevasUrls].slice(0, MAX_FOTOS));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al subir imágenes';
      alert('No se pudieron subir las fotos: ' + msg);
    } finally {
      setUploadingFotos(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleQuitarFoto = (index: number) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUbicarDireccion = async () => {
    const queryTexto = direccion.trim() || nombre.trim();
    if (!queryTexto) return;

    setGeocoding(true);
    try {
      const q = encodeURIComponent(`${queryTexto}, Nogoyá, Entre Ríos, Argentina`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`);
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        const lat = Number(parseFloat(results[0].lat).toFixed(6));
        const lon = Number(parseFloat(results[0].lon).toFixed(6));
        setLatitud(lat);
        setLongitud(lon);
      } else {
        alert('No se encontró esa calle exacta. Hacé clic o arrastrá el pin en el mapa.');
      }
    } catch {
      alert('No se pudo buscar la dirección. Mové el pin manualmente en el mapa.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    setSaving(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        categoria,
        telefono: telefono.trim(),
        whatsapp: whatsapp.trim() || null,
        direccion: direccion.trim() || 'Nogoyá, Entre Ríos',
        horarios: horarios.trim() || (es24hs ? 'Atención las 24 hs' : null),
        descripcion: descripcion.trim() || null,
        fotos: fotos.slice(0, MAX_FOTOS),
        es_24hs: es24hs,
        urgencia,
        latitud,
        longitud,
      };

      if (editId) {
        const { error } = await supabase.from('guia_util').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('guia_util').insert([payload]);
        if (error) throw error;
      }

      resetForm();
      await fetchItems();
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Verifica la tabla guia_util';
      alert('Error al guardar: ' + mensaje);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, itemNombre: string) => {
    if (!window.confirm(`¿Eliminar "${itemNombre}" de la Guía Útil?`)) return;

    try {
      const { error } = await supabase.from('guia_util').delete().eq('id', id);
      if (error) throw error;
      await fetchItems();
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error desconocido';
      alert('Error al eliminar: ' + mensaje);
    }
  };

  const getBadgeColor = (item: GuiaItem) => {
    if (item.urgencia || item.categoria === 'Emergencias') {
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
    }
    if (
      item.categoria === 'Hospitales y Sanatorios' ||
      item.categoria === 'Clínicas y Consultorios' ||
      item.categoria === 'Salud'
    ) {
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    }
    if (item.categoria === 'Iglesias y Culto') {
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    }
    return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white dark:bg-gray-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* HEADER */}
          <div className="bg-gradient-to-r from-sky-600 to-blue-700 p-5 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg">Administrar Guía Útil de Nogoyá</h3>
                <p className="text-xs text-sky-100">Emergencias, hospitales, clínicas, sanatorios, iglesias y dependencias</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* CONTENIDO */}
          <div className="p-5 overflow-y-auto flex-1 space-y-6">
            {/* FORMULARIO ALTA / EDICIÓN */}
            <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-900/60 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-1.5">
                  {editId ? <><Edit2 className="w-4 h-4 text-sky-600" /> Editando Registro</> : <><Plus className="w-4 h-4 text-sky-600" /> Agregar Nuevo Contacto Útil</>}
                </h4>
                {editId && (
                  <button type="button" onClick={resetForm} className="text-xs text-gray-500 hover:underline">
                    Cancelar edición
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Hospital San Blas..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Categoría *</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    {CATEGORIAS_GUIA_UTIL.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Teléfono Llamadas</label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej: 100 / 03435-421234"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">WhatsApp (opcional)</label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="Ej: 3435457576"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Dirección / Referencia</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      placeholder="Ej: 25 de Mayo 1070"
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleUbicarDireccion}
                      disabled={geocoding}
                      className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold inline-flex items-center gap-1 shrink-0 transition"
                      title="Centrar pin en esta dirección"
                    >
                      {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5 text-sky-600" />}
                      Ubicar
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Horarios de Atención</label>
                  <input
                    type="text"
                    value={horarios}
                    onChange={(e) => setHorarios(e.target.value)}
                    placeholder="Ej: Lun a Vie 8:00 a 13:00 / Misas Dom 10 y 20 hs"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* DESCRIPCIÓN DE LA FICHA */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                  Descripción / Información de la ficha (opcional)
                </label>
                <textarea
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej: Guardia médica las 24 hs, consultorios externos, internación, turnos por WhatsApp..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none"
                />
              </div>

              {/* GALERÍA DE HASTA 5 FOTOS */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1.5">
                    <Images className="w-3.5 h-3.5 text-sky-600" />
                    Fotos del lugar ({fotos.length}/{MAX_FOTOS})
                  </label>

                  {fotos.length < MAX_FOTOS && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleSubirFotos}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={uploadingFotos}
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-sky-100 hover:bg-sky-200 dark:bg-sky-900/40 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-xs font-bold inline-flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        {uploadingFotos ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo...
                          </>
                        ) : (
                          <>
                            <ImagePlus className="w-3.5 h-3.5" /> Subir Fotos
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>

                {fotos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                    {fotos.map((url, idx) => (
                      <div
                        key={`${url}-${idx}`}
                        className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                      >
                        <img
                          src={url}
                          alt={`Foto ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuitarFoto(idx)}
                          className="absolute top-1 right-1 p-1 rounded-lg bg-red-600 text-white opacity-90 hover:opacity-100 shadow transition"
                          title="Quitar foto"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {idx === 0 && (
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-bold">
                            Principal
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <input
                      type="checkbox"
                      checked={es24hs}
                      onChange={(e) => handleToggle24hs(e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    🕒 Atiende 24 hs
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-rose-600 dark:text-rose-400">
                    <input
                      type="checkbox"
                      checked={urgencia}
                      onChange={(e) => setUrgencia(e.target.checked)}
                      className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                    />
                    🚨 Es Urgencia
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={saving || uploadingFotos}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editId ? 'Actualizar' : 'Agregar'}
                </button>
              </div>

              {/* MAPA INTERACTIVO ARRASTRABLE */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-bold text-gray-500 uppercase">
                    Ubicación exacta (hacé clic en el mapa o arrastrá el pin 📍)
                  </span>
                  <div className="flex items-center gap-3 text-[11px]">
                    {latitud !== null && longitud !== null ? (
                      <>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {latitud}, {longitud}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setLatitud(null);
                            setLongitud(null);
                          }}
                          className="text-red-500 hover:underline font-bold inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Quitar pin
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-400 italic">Sin pin fijado aún</span>
                    )}
                  </div>
                </div>

                <div
                  ref={mapContainerRef}
                  className="w-full h-56 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 z-0"
                />
              </div>
            </form>

            {/* LISTADO DE ITEMS */}
            <div>
              <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-3">
                Registros Cargados ({items.length})
              </h4>

              {loading ? (
                <div className="py-8 flex justify-center text-sky-600">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  No hay elementos cargados en la Guía Útil.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getBadgeColor(item)}`}>
                            {item.categoria}
                          </span>
                          {item.es_24hs && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold">
                              24 HS
                            </span>
                          )}
                          {item.urgencia && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-extrabold">
                              URGENCIA
                            </span>
                          )}
                          {Array.isArray(item.fotos) && item.fotos.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 text-[10px] font-bold inline-flex items-center gap-0.5">
                              <Images className="w-2.5 h-2.5" /> {item.fotos.length} foto{item.fotos.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {item.latitud && item.longitud && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-bold inline-flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Con Pin
                            </span>
                          )}
                        </div>
                        <h5 className="font-bold text-sm text-gray-900 dark:text-white truncate">{item.nombre}</h5>
                        <div className="text-xs text-gray-500 flex items-center gap-3 flex-wrap">
                          {item.telefono && (
                            <span className="flex items-center gap-1 font-bold text-gray-700 dark:text-gray-300">
                              <Phone className="w-3 h-3 text-sky-600" /> {item.telefono}
                            </span>
                          )}
                          {item.whatsapp && (
                            <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                              <MessageCircle className="w-3 h-3" /> {item.whatsapp}
                            </span>
                          )}
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-gray-400 shrink-0" /> {item.direccion}
                          </span>
                        </div>
                        {item.horarios && (
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-600 shrink-0" /> {item.horarios}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setQrItem(item)}
                          className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-xl transition"
                          title="Generar Cartel QR"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.nombre)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {qrItem && (
        <CartelQrModal
          isOpen={Boolean(qrItem)}
          onClose={() => setQrItem(null)}
          nombre={qrItem.nombre}
          slug={toSlug(qrItem.nombre)}
          subtitulo={`Guía Útil · ${qrItem.categoria}`}
          urlFicha={`${window.location.origin}/?guia=${encodeURIComponent(qrItem.id)}`}
          tituloModal="Cartel QR — Guía Útil"
        />
      )}
    </>
  );
};