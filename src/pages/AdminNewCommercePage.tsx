import React, { useState, useEffect, useRef } from 'react';
import { normalizarTexto } from '@/lib/filtrosComercios';
import { supabase } from '@/lib/supabase';
import { Rubro } from '@/types/database.types';
import { ArrowLeft, Save, Building, User, Search, ChevronDown, Check, FileSignature } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ComprobanteAlta } from '@/components/ComprobanteAlta';
import {
  MEDIOS_DE_ALTA,
  condicionesDelAlta,
  primerVencimiento,
  textoAceptacion,
  textoPrecio,
  type DatosAlta,
  type MedioDeAlta,
} from '@/lib/comprobanteAlta';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const PLAN_ID = '5b1d9010-2332-47c2-bea8-9413dfcbc6b8';

interface SelectorMapaProps {
  latitud: number;
  longitud: number;
  onSeleccionar: (latitud: number, longitud: number) => void;
}

const SelectorMapa: React.FC<SelectorMapaProps> = ({
  latitud,
  longitud,
  onSeleccionar,
}) => {
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
      center={[-32.3939, -59.7881]}
      zoom={15}
      scrollWheelZoom
      style={{
        height: '350px',
        width: '100%',
        borderRadius: '12px',
        zIndex: 0,
      }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
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
          fillColor: '#2563eb',
          fillOpacity: 1,
        }}
      />
    </MapContainer>
  );
};

// La Edge Function admin-crear-comerciante exige 8 caracteres (antes el
// formulario pedía 6 y el error recién aparecía al enviar).
const MINIMO_CLAVE = 8;
const DIAS_GRACIA = 5; // valor por defecto de suscripciones.dias_gracia

export const AdminNewCommercePage: React.FC = () => {

  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRubros, setLoadingRubros] = useState(true);
  const [error, setError] = useState('');

  // Estados para el buscador desplegable de rubros
  const [busquedaRubro, setBusquedaRubro] = useState('');
  const [mostrarDropdownRubros, setMostrarDropdownRubros] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nombreComerciante: '',
    nombreComercio: '',
    rubro_id: '',
    descripcion_corta: '',
    direccion: '',
    whatsapp: '',
    latitud: -32.3939,
    longitud: -59.7881,
  });

  // Ficha de alta como contrato
  const [documento, setDocumento] = useState('');
  const [medio, setMedio] = useState<MedioDeAlta>('presencial');
  const [aceptado, setAceptado] = useState(false);
  const [plan, setPlan] = useState<{ nombre: string; precio: number } | null>(null);
  const [comprobante, setComprobante] = useState<DatosAlta | null>(null);
  const vencimiento = primerVencimiento();

  // Precio del plan para mostrarlo antes de contratar (la Edge Function usa el mismo)
  useEffect(() => {
    supabase
      .from('planes')
      .select('nombre, precio_mensual')
      .eq('id', PLAN_ID)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPlan({ nombre: data.nombre, precio: Number(data.precio_mensual) });
      });
  }, []);

  useEffect(() => {
    let mounted = true;

    const cargarRubros = async () => {
      try {
        const { data, error: rubrosError } = await supabase
          .from('rubros')
          .select('*')
          .eq('estado', true)
          .order('orden', { ascending: true });

        if (rubrosError) {
          throw rubrosError;
        }

        if (!mounted) return;

        const listaRubros = data ?? [];
        setRubros(listaRubros);

        if (listaRubros.length > 0) {
          setFormData((prev) => ({
            ...prev,
            rubro_id: prev.rubro_id || listaRubros[0].id,
          }));
          setBusquedaRubro(listaRubros[0].nombre);
        }
      } catch (err) {
        if (mounted) {
          setError(
            `No se pudieron cargar los rubros: ${
              err instanceof Error ? err.message : 'Error desconocido'
            }`
          );
        }
      } finally {
        if (mounted) {
          setLoadingRubros(false);
        }
      }
    };

    void cargarRubros();

    return () => {
      mounted = false;
    };
  }, []);

  // Cerrar el desplegable de rubros si se hace clic fuera del componente
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMostrarDropdownRubros(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sin importar tildes ni mayúsculas ("panaderia" encuentra Panadería)
  const rubrosFiltrados = rubros.filter((r) =>
    normalizarTexto(r.nombre).includes(normalizarTexto(busquedaRubro.trim()))
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const session = sessionData.session;

      if (!session?.access_token) {
        throw new Error('Tu sesión no es válida. Volvé a iniciar sesión.');
      }

      if (!formData.rubro_id) {
        throw new Error('Elegí un rubro de la lista (escribí y tocá una opción).');
      }

      const email = formData.email.trim().toLowerCase();
      const nombreComerciante = formData.nombreComerciante.trim();
      const nombreComercio = formData.nombreComercio.trim();

      if (!email || !nombreComerciante || !nombreComercio) {
        throw new Error('Completá todos los campos obligatorios.');
      }

      if (formData.password.length < MINIMO_CLAVE) {
        throw new Error(`La contraseña debe tener al menos ${MINIMO_CLAVE} caracteres.`);
      }

      if (!aceptado) {
        throw new Error('Falta la aceptación de los Términos y condiciones por parte del titular.');
      }

      const fechaVencimiento = vencimiento;

      const { data, error: functionError } =
        await supabase.functions.invoke('admin-crear-comerciante', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: {
            email,
            password: formData.password,
            profile_name: nombreComerciante,
            plan_id: PLAN_ID,
            proximo_vencimiento: fechaVencimiento,
            comercio: {
              nombre: nombreComercio,
              rubro_id: formData.rubro_id,
              descripcion_corta: formData.descripcion_corta.trim(),
              direccion: formData.direccion.trim(),
              whatsapp: formData.whatsapp.trim(),
              email_comercial: email,
              latitud: formData.latitud,
              longitud: formData.longitud,
            },
          },
        });

      if (functionError) {
        const responseError =
          data && typeof data.error === 'string' ? data.error : null;

        throw new Error(
          responseError ||
            functionError.message ||
            'No se pudo crear el comercio.'
        );
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const rubro = rubros.find((r) => r.id === formData.rubro_id);
      setComprobante({
        comercioId: typeof data?.comercioId === 'string' ? data.comercioId : '',
        fecha: new Date(),
        titular: nombreComerciante,
        documento: documento.trim() || undefined,
        comercio: nombreComercio,
        rubro: rubro?.nombre,
        direccion: formData.direccion.trim(),
        whatsapp: formData.whatsapp.trim() || undefined,
        email,
        plan: plan?.nombre,
        precioMensual: plan?.precio ?? null,
        primerVencimiento: fechaVencimiento,
        diasGracia: DIAS_GRACIA,
        medio,
      });
      window.scrollTo({ top: 0 });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Ocurrió un error inesperado.';

      setError(`Error al crear el comercio: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  if (comprobante) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <ComprobanteAlta datos={comprobante} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al panel de administración
      </Link>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Building className="w-5 h-5 text-brand-600" />
          Dar de Alta Nuevo Comercio
        </h2>

        {error && (
          <div
            role="alert"
            className="p-3 bg-red-100 dark:bg-red-950/40 border border-red-200 text-red-700 text-xs rounded-xl font-semibold"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border-b dark:border-gray-700 pb-4 space-y-4">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <User className="w-4 h-4" />
              Datos de Acceso
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Nombre Propietario *
                </label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={formData.nombreComerciante}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nombreComerciante: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">
                  Contraseña Inicial *
                </label>
                <input
                  type="password"
                  required
                  minLength={MINIMO_CLAVE}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <Building className="w-4 h-4" />
              Ficha del Comercio
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Nombre del Comercio *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombreComercio}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nombreComercio: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>

              {/* BUSCADOR DESPLEGABLE DE RUBROS */}
              <div className="relative" ref={dropdownRef}>
                <label className="block text-xs font-semibold mb-1">
                  Rubro (Buscador) *
                </label>

                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder={loadingRubros ? "Cargando rubros..." : "Escribí para buscar rubro..."}
                    value={busquedaRubro}
                    onChange={(e) => {
                      const texto = e.target.value;
                      setBusquedaRubro(texto);
                      setMostrarDropdownRubros(true);
                      const exacto = rubros.find((r) => normalizarTexto(r.nombre) === normalizarTexto(texto.trim()));
                      setFormData((prev) => ({ ...prev, rubro_id: exacto ? exacto.id : '' }));
                    }}
                    onFocus={() => setMostrarDropdownRubros(true)}
                    className="w-full pl-9 pr-8 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
                </div>

                {mostrarDropdownRubros && (
                  <div className="absolute z-30 w-full mt-1.5 max-h-56 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl divide-y divide-gray-100 dark:divide-gray-800">
                    {rubrosFiltrados.length === 0 ? (
                      <div className="p-3 text-xs text-gray-500 text-center font-medium">
                        No se encontraron rubros coincidentes
                      </div>
                    ) : (
                      rubrosFiltrados.map((rubro) => (
                        <button
                          key={rubro.id}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, rubro_id: rubro.id });
                            setBusquedaRubro(rubro.nombre);
                            setMostrarDropdownRubros(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between hover:bg-brand-50 dark:hover:bg-gray-800 transition ${
                            formData.rubro_id === rubro.id ? 'font-bold text-brand-600 bg-brand-50/50 dark:bg-gray-800/80' : 'text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          <span>{rubro.nombre}</span>
                          {formData.rubro_id === rubro.id && <Check className="w-4 h-4 text-brand-600 shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">
                  Descripción Corta *
                </label>
                <input
                  type="text"
                  required
                  value={formData.descripcion_corta}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      descripcion_corta: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Dirección (Nogoyá) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.direccion}
                  onChange={(e) =>
                    setFormData({ ...formData, direccion: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  WhatsApp (Opcional)
                </label>
                <input
                  type="tel"
                  placeholder="3435123456"
                  value={formData.whatsapp}
                  onChange={(e) =>
                    setFormData({ ...formData, whatsapp: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
            </div>

            {/* UBICACIÓN DEL COMERCIO */}
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Ubicación del comercio en el mapa
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Hacé clic en el mapa para marcar la ubicación exacta del local.
                  También podés modificar las coordenadas manualmente.
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <SelectorMapa
                  latitud={formData.latitud}
                  longitud={formData.longitud}
                  onSeleccionar={(latitud, longitud) =>
                    setFormData((prev) => ({
                      ...prev,
                      latitud,
                      longitud,
                    }))
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Latitud
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.latitud}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        latitud: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Longitud
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.longitud}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        longitud: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Coordenadas seleccionadas: {formData.latitud.toFixed(6)},{' '}
                {formData.longitud.toFixed(6)}
              </p>
            </div>
          </div>

          {/* CONTRATO: condiciones que acepta el titular (Ley 24.240, contrato de adhesión) */}
          <div className="border-t dark:border-gray-700 pt-4 space-y-4">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <FileSignature className="w-4 h-4" />
              Contrato de suscripción
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="alta-documento" className="block text-xs font-semibold mb-1">
                  DNI o CUIT del titular (para el comprobante)
                </label>
                <input
                  id="alta-documento"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej: DNI 30.123.456"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div>
                <label htmlFor="alta-medio" className="block text-xs font-semibold mb-1">
                  ¿Cómo se hizo el alta? *
                </label>
                <select
                  id="alta-medio"
                  value={medio}
                  onChange={(e) => setMedio(e.target.value as MedioDeAlta)}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                >
                  {Object.entries(MEDIOS_DE_ALTA).map(([valor, texto]) => (
                    <option key={valor} value={valor}>
                      {texto}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs space-y-2">
              <p className="font-bold text-gray-900 dark:text-white">
                {plan?.nombre ?? 'Suscripción mensual'} · {textoPrecio(plan?.precio ?? null)}
              </p>
              <ul className="list-disc pl-4 space-y-1 text-gray-600 dark:text-gray-400">
                {condicionesDelAlta({ precioMensual: plan?.precio ?? null, primerVencimiento: vencimiento, diasGracia: DIAS_GRACIA, medio }).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>

            <label className="flex items-start gap-2.5 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                required
                checked={aceptado}
                onChange={(e) => setAceptado(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-brand-600"
              />
              <span>
                {textoAceptacion()} (
                <Link to="/terminos" target="_blank" className="text-brand-600 hover:underline">Términos</Link>
                {' · '}
                <Link to="/privacidad" target="_blank" className="text-brand-600 hover:underline">Privacidad</Link>)
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || loadingRubros || rubros.length === 0 || !aceptado}
            className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Crear comercio y emitir comprobante'}
          </button>
        </form>
      </div>
    </div>
  );
};
