// src/components/AdminOficiosManager.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Oficio } from '@/types/database.types';
import { slugLimpio } from '@/lib/rutasQr';
import {
  Wrench,
  Plus,
  Search,
  Siren,
  CheckCircle2,
  XCircle,
  Edit3,
  Trash2,
  Save,
  X,
  Home,
  Award,
  Phone,
  ExternalLink,
  MapPin,
} from 'lucide-react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface OficioConUbicacion extends Oficio {
  latitud?: number | null;
  longitud?: number | null;
  email_contacto?: string | null;
}

const NOGOYA_LAT = -32.3939;
const NOGOYA_LNG = -59.7881;

const SelectorMapaOficio: React.FC<{
  latitud: number;
  longitud: number;
  onSeleccionar: (lat: number, lng: number) => void;
}> = ({ latitud, longitud, onSeleccionar }) => {
  const EventosMapa = () => {
    useMapEvents({
      click(e) {
        onSeleccionar(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  };

  const ActualizarCentro = () => {
    const mapa = useMap();
    useEffect(() => {
      mapa.setView([latitud, longitud], mapa.getZoom());
    }, [mapa, latitud, longitud]);
    return null;
  };

  return (
    <MapContainer
      center={[latitud, longitud]}
      zoom={15}
      scrollWheelZoom
      style={{ height: '240px', width: '100%', zIndex: 0 }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <EventosMapa />
      <ActualizarCentro />
      <CircleMarker
        center={[latitud, longitud]}
        radius={9}
        pathOptions={{
          color: '#ffffff',
          weight: 3,
          fillColor: '#d97706',
          fillOpacity: 1,
        }}
      />
    </MapContainer>
  );
};

export const AdminOficiosManager: React.FC = () => {
  const [oficios, setOficios] = useState<OficioConUbicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Campos del formulario
  const [nombre, setNombre] = useState('');
  const [oficioRubro, setOficioRubro] = useState('');
  const [matricula, setMatricula] = useState('');
  const [descripcionCorta, setDescripcionCorta] = useState('');
  const [descripcionCompleta, setDescripcionCompleta] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [telefono, setTelefono] = useState('');
  const [emailContacto, setEmailContacto] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [zonaCobertura, setZonaCobertura] = useState('Nogoyá y zona');
  const [horarioTexto, setHorarioTexto] = useState('Lunes a Sábado');
  const [fotoUrl, setFotoUrl] = useState('');
  const [galeriaTexto, setGaleriaTexto] = useState('');
  const [serviciosTexto, setServiciosTexto] = useState('');
  const [mediosPagoTexto, setMediosPagoTexto] = useState('Efectivo\nTransferencia');
  const [aDomicilio, setADomicilio] = useState(true);
  const [urgencias24hs, setUrgencias24hs] = useState(false);
  const [activo, setActivo] = useState(true);

  // Ubicación en mapa (opcional)
  const [usarMapa, setUsarMapa] = useState(false);
  const [latitud, setLatitud] = useState<number>(NOGOYA_LAT);
  const [longitud, setLongitud] = useState<number>(NOGOYA_LNG);

  const cargarOficios = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('oficios')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOficios(data as OficioConUbicacion[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void cargarOficios();
  }, []);

  const abrirNuevo = () => {
    setEditandoId(null);
    setNombre('');
    setOficioRubro('');
    setMatricula('');
    setDescripcionCorta('');
    setDescripcionCompleta('');
    setWhatsapp('');
    setTelefono('');
    setEmailContacto('');
    setInstagram('');
    setFacebook('');
    setZonaCobertura('Nogoyá y zona');
    setHorarioTexto('Lunes a Sábado');
    setFotoUrl('');
    setGaleriaTexto('');
    setServiciosTexto('');
    setMediosPagoTexto('Efectivo\nTransferencia');
    setADomicilio(true);
    setUrgencias24hs(false);
    setActivo(true);
    setUsarMapa(false);
    setLatitud(NOGOYA_LAT);
    setLongitud(NOGOYA_LNG);
    setModalAbierto(true);
  };

  const abrirEditar = (ofi: OficioConUbicacion) => {
    setEditandoId(ofi.id);
    setNombre(ofi.nombre || '');
    setOficioRubro(ofi.oficio_rubro || '');
    setMatricula(ofi.matricula || '');
    setDescripcionCorta(ofi.descripcion_corta || '');
    setDescripcionCompleta(ofi.descripcion_completa || '');
    setWhatsapp(ofi.whatsapp || '');
    setTelefono(ofi.telefono || '');
    setEmailContacto(ofi.email_contacto || '');
    setInstagram(ofi.instagram || '');
    setFacebook(ofi.facebook || '');
    setZonaCobertura(ofi.zona_cobertura || 'Nogoyá y zona');
    setHorarioTexto(ofi.horario_texto || 'Lunes a Sábado');
    setFotoUrl(ofi.foto_url || '');
    setGaleriaTexto((ofi.galeria_urls || []).join('\n'));
    setServiciosTexto((ofi.servicios || []).join('\n'));
    setMediosPagoTexto((ofi.medios_pago || ['Efectivo', 'Transferencia']).join('\n'));
    setADomicilio(Boolean(ofi.a_domicilio));
    setUrgencias24hs(Boolean(ofi.urgencias_24hs));
    setActivo(Boolean(ofi.aprobado && ofi.habilitado_admin));

    const tieneCoords =
      typeof ofi.latitud === 'number' &&
      typeof ofi.longitud === 'number' &&
      Number.isFinite(ofi.latitud) &&
      Number.isFinite(ofi.longitud);

    setUsarMapa(tieneCoords);
    setLatitud(tieneCoords ? (ofi.latitud as number) : NOGOYA_LAT);
    setLongitud(tieneCoords ? (ofi.longitud as number) : NOGOYA_LNG);
    setModalAbierto(true);
  };

  const limpiarLineas = (texto: string) =>
    texto
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !oficioRubro.trim() || !whatsapp.trim()) {
      alert('Completá al menos Nombre, Rubro/Oficio y WhatsApp.');
      return;
    }

    setGuardando(true);

    const payload: Record<string, any> = {
      nombre: nombre.trim(),
      oficio_rubro: oficioRubro.trim(),
      matricula: matricula.trim() || null,
      descripcion_corta:
        descripcionCorta.trim() ||
        `Servicio de ${oficioRubro.trim()} en ${zonaCobertura.trim() || 'Nogoyá'}.`,
      descripcion_completa: descripcionCompleta.trim() || null,
      whatsapp: whatsapp.trim(),
      telefono: telefono.trim() || null,
      email_contacto: emailContacto.trim().toLowerCase() || null,
      instagram: instagram.trim() || null,
      facebook: facebook.trim() || null,
      zona_cobertura: zonaCobertura.trim() || 'Nogoyá y zona',
      horario_texto: horarioTexto.trim() || 'Lunes a Sábado',
      foto_url: fotoUrl.trim() || null,
      galeria_urls: limpiarLineas(galeriaTexto),
      servicios: limpiarLineas(serviciosTexto),
      medios_pago: limpiarLineas(mediosPagoTexto),
      a_domicilio: aDomicilio,
      urgencias_24hs: urgencias24hs,
      aprobado: activo,
      habilitado_admin: activo,
      latitud: usarMapa ? Number(latitud) : null,
      longitud: usarMapa ? Number(longitud) : null,
      updated_at: new Date().toISOString(),
    };

    if (!editandoId) {
      payload.slug = `${slugLimpio(nombre) || 'oficio'}-${Date.now().toString().slice(-4)}`;
    }

    const { error } = editandoId
      ? await supabase.from('oficios').update(payload).eq('id', editandoId)
      : await supabase.from('oficios').insert(payload);

    setGuardando(false);

    if (error) {
      alert('Error al guardar el oficio: ' + error.message);
      return;
    }

    setModalAbierto(false);
    void cargarOficios();
  };

  const toggleEstado = async (ofi: OficioConUbicacion, campo: 'urgencias_24hs' | 'activo') => {
    if (campo === 'urgencias_24hs') {
      const nuevo = !ofi.urgencias_24hs;
      const { error } = await supabase
        .from('oficios')
        .update({ urgencias_24hs: nuevo })
        .eq('id', ofi.id);
      if (!error) {
        setOficios((prev) =>
          prev.map((item) => (item.id === ofi.id ? { ...item, urgencias_24hs: nuevo } : item))
        );
      }
    } else {
      const nuevo = !(ofi.aprobado && ofi.habilitado_admin);
      const { error } = await supabase
        .from('oficios')
        .update({ aprobado: nuevo, habilitado_admin: nuevo })
        .eq('id', ofi.id);
      if (!error) {
        setOficios((prev) =>
          prev.map((item) =>
            item.id === ofi.id ? { ...item, aprobado: nuevo, habilitado_admin: nuevo } : item
          )
        );
      }
    }
  };

  const handleEliminar = async (ofi: OficioConUbicacion) => {
    if (!confirm(`¿Eliminar definitivamente el oficio "${ofi.nombre}"?`)) return;
    const { error } = await supabase.from('oficios').delete().eq('id', ofi.id);
    if (!error) {
      setOficios((prev) => prev.filter((item) => item.id !== ofi.id));
    } else {
      alert('No se pudo eliminar: ' + error.message);
    }
  };

  const filtrados = oficios.filter((o) => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return true;
    return (
      o.nombre.toLowerCase().includes(q) ||
      o.oficio_rubro.toLowerCase().includes(q) ||
      (o.whatsapp || '').includes(q) ||
      (o.zona_cobertura || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-4 sm:p-6 space-y-5">
      {/* CABECERA */}
      <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-600" />
            Todos los Oficios y Servicios ({oficios.length})
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Creá y editá prestadores directamente sin necesidad de crearles usuario ni contraseña.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar oficio, rubro o teléfono..."
              className="w-full pl-9 pr-3.5 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>

          <button
            type="button"
            onClick={abrirNuevo}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" /> Nuevo Oficio
          </button>
        </div>
      </div>

      {/* LISTADO */}
      {loading ? (
        <div className="p-10 text-center text-xs text-gray-500 font-semibold">Cargando oficios...</div>
      ) : filtrados.length === 0 ? (
        <div className="p-10 text-center text-xs text-gray-500">
          No hay oficios cargados todavía. Tocá <strong>"Nuevo Oficio"</strong> para crear el primero.
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((ofi) => {
            const visible = Boolean(ofi.aprobado && ofi.habilitado_admin);
            return (
              <div
                key={ofi.id}
                className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold uppercase">
                      {ofi.oficio_rubro}
                    </span>
                    {ofi.urgencias_24hs && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-extrabold inline-flex items-center gap-1">
                        <Siren className="w-3 h-3" /> 24hs
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        visible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {visible ? 'Visible' : 'Oculto'}
                    </span>
                  </div>

                  <h3 className="font-bold text-gray-900 dark:text-white">{ofi.nombre}</h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" /> {ofi.whatsapp}
                    </span>
                    {ofi.zona_cobertura && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-600" /> {ofi.zona_cobertura}
                      </span>
                    )}
                    {ofi.matricula && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                        <Award className="w-3.5 h-3.5" /> Mat. {ofi.matricula}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void toggleEstado(ofi, 'activo')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                      visible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {visible ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Visible
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" /> Oculto
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void toggleEstado(ofi, 'urgencias_24hs')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                      ofi.urgencias_24hs
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                    }`}
                  >
                    <Siren className="w-4 h-4" /> 24hs
                  </button>

                  <button
                    type="button"
                    onClick={() => abrirEditar(ofi)}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" /> Editar
                  </button>

                  <Link
                    to={`/oficio/${ofi.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-xl text-xs font-bold border dark:border-gray-700 inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4" /> Ver
                  </Link>

                  <button
                    type="button"
                    onClick={() => void handleEliminar(ofi)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-red-600 border border-red-200 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR OFICIO */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[94dvh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between gap-3 border-b dark:border-gray-700 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-amber-600" />
                  {editandoId ? `Editar Oficio: ${nombre}` : 'Nuevo Oficio (Sin usuario ni contraseña)'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Administrado directamente por el equipo de NOGOYORK.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardar} className="space-y-5 text-xs">
              {/* DATOS PRINCIPALES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Nombre o Marca *</label>
                  <input
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Electricidad Gómez"
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Rubro / Oficio *</label>
                  <input
                    required
                    value={oficioRubro}
                    onChange={(e) => setOficioRubro(e.target.value)}
                    placeholder="Ej: Electricista, Gasista, Plomero, Flete"
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">WhatsApp *</label>
                  <input
                    required
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="3435123456"
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Teléfono llamadas (Opcional)</label>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="3435..."
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Matrícula (Opcional)</label>
                  <input
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    placeholder="Ej: Mat. N° 1234"
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Email de contacto (Opcional)</label>
                  <input
                    type="email"
                    value={emailContacto}
                    onChange={(e) => setEmailContacto(e.target.value)}
                    placeholder="prestador@mail.com"
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Descripción corta (se ve en las tarjetas)</label>
                  <input
                    value={descripcionCorta}
                    onChange={(e) => setDescripcionCorta(e.target.value)}
                    placeholder="Ej: Instalaciones eléctricas domiciliarias, tableros y urgencias."
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Descripción completa</label>
                  <textarea
                    rows={3}
                    value={descripcionCompleta}
                    onChange={(e) => setDescripcionCompleta(e.target.value)}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>
              </div>

              {/* UBICACIÓN Y COBERTURA */}
              <div className="border-t dark:border-gray-700 pt-4 space-y-3">
                <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-600" /> Zona de cobertura y ubicación
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">Zona de cobertura</label>
                    <input
                      value={zonaCobertura}
                      onChange={(e) => setZonaCobertura(e.target.value)}
                      placeholder="Nogoyá y zona"
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Horario de atención</label>
                    <input
                      value={horarioTexto}
                      onChange={(e) => setHorarioTexto(e.target.value)}
                      placeholder="Lunes a Sábado"
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={usarMapa}
                    onChange={(e) => setUsarMapa(e.target.checked)}
                    className="w-4 h-4 accent-amber-600"
                  />
                  Marcar punto fijo en el mapa (taller, estudio o base)
                </label>

                {usarMapa && (
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                      <SelectorMapaOficio
                        latitud={latitud}
                        longitud={longitud}
                        onSeleccionar={(lat, lng) => {
                          setLatitud(lat);
                          setLongitud(lng);
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">Latitud</label>
                        <input
                          type="number"
                          step="any"
                          value={latitud}
                          onChange={(e) => setLatitud(Number(e.target.value))}
                          className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-gray-900 dark:border-gray-700"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Longitud</label>
                        <input
                          type="number"
                          step="any"
                          value={longitud}
                          onChange={(e) => setLongitud(Number(e.target.value))}
                          className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-gray-900 dark:border-gray-700"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* REDES, FOTOS Y SERVICIOS */}
              <div className="border-t dark:border-gray-700 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Instagram (Opcional)</label>
                  <input
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="@usuario"
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Facebook (Opcional)</label>
                  <input
                    value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">URL Foto de Perfil / Logo (Opcional)</label>
                  <input
                    value={fotoUrl}
                    onChange={(e) => setFotoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Servicios que realiza (uno por línea)</label>
                  <textarea
                    rows={3}
                    value={serviciosTexto}
                    onChange={(e) => setServiciosTexto(e.target.value)}
                    placeholder={'Instalación de aires\nReparaciones'}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Medios de pago (uno por línea)</label>
                  <textarea
                    rows={3}
                    value={mediosPagoTexto}
                    onChange={(e) => setMediosPagoTexto(e.target.value)}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">URLs Galería de trabajos (una por línea)</label>
                  <textarea
                    rows={2}
                    value={galeriaTexto}
                    onChange={(e) => setGaleriaTexto(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>
              </div>

              {/* OPCIONES DE ESTADO */}
              <div className="border-t dark:border-gray-700 pt-4 flex flex-wrap gap-5 font-bold">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aDomicilio}
                    onChange={(e) => setADomicilio(e.target.checked)}
                    className="w-4 h-4 accent-amber-600"
                  />
                  <Home className="w-4 h-4 text-amber-600" /> Trabaja a domicilio
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-rose-600">
                  <input
                    type="checkbox"
                    checked={urgencias24hs}
                    onChange={(e) => setUrgencias24hs(e.target.checked)}
                    className="w-4 h-4 accent-rose-600"
                  />
                  <Siren className="w-4 h-4" /> Guardia Urgencias 24hs
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-emerald-600">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  Aprobado y visible en la app
                </label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 border-t dark:border-gray-700 pt-4">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2.5 border rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {guardando ? 'Guardando...' : 'Guardar Oficio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};