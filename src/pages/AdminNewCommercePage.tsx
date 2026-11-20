import React, { useState, useEffect, useRef } from 'react';
import { normalizarTexto } from '@/lib/filtrosComercios';
import { supabase } from '@/lib/supabase';
import { Rubro } from '@/types/database.types';
import { slugLimpio } from '@/lib/rutasQr';
import { TARIFAS_PLANES } from '@/lib/planes';
import {
  ArrowLeft,
  Save,
  Building,
  User,
  Search,
  ChevronDown,
  Check,
  FileSignature,
  Wrench,
  Siren,
  Home,
  Rocket,
} from 'lucide-react';
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

const PLAN_NEGOCIO_ID = '5b1d9010-2332-47c2-bea8-9413dfcbc6b8';

interface PlanDb {
  id: string;
  nombre: string;
  precio_mensual: number | string;
  precio_anual: number | string;
}

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

const MINIMO_CLAVE = 8;
const DIAS_GRACIA = 5;

export const AdminNewCommercePage: React.FC = () => {
  const [tipoAlta, setTipoAlta] = useState<'comercio' | 'oficio'>('comercio');

  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [planesDb, setPlanesDb] = useState<PlanDb[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRubros, setLoadingRubros] = useState(true);
  const [error, setError] = useState('');

  // Estados para el buscador desplegable de rubros (Comercio)
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
    es_emprendimiento: false,
  });

  // Campos específicos para Oficio
  const [oficioData, setOficioData] = useState({
    oficio_rubro: '',
    matricula: '',
    zona_cobertura: 'Nogoyá y alrededores',
    horario_texto: 'Lunes a Sábado de 8:00 a 20:00 hs',
    a_domicilio: true,
    urgencias_24hs: false,
  });

  // Ficha de alta como contrato
  const [documento, setDocumento] = useState('');
  const [medio, setMedio] = useState<MedioDeAlta>('presencial');
  const [aceptado, setAceptado] = useState(false);
  const [comprobante, setComprobante] = useState<DatosAlta | null>(null);
  const [oficioCreadoOk, setOficioCreadoOk] = useState<{ nombre: string; email: string; slug: string } | null>(null);
  const vencimiento = primerVencimiento();

  useEffect(() => {
    supabase
      .from('planes')
      .select('id, nombre, precio_mensual, precio_anual')
      .eq('estado', true)
      .then(({ data }) => {
        if (data) setPlanesDb(data as PlanDb[]);
      });
  }, []);

  const planActivo = (() => {
    const tipo = formData.es_emprendimiento ? 'emprendimiento' : 'negocio';
    const fallback = TARIFAS_PLANES[tipo];

    const planEncontrado = formData.es_emprendimiento
      ? planesDb.find((p) => p.nombre.toLowerCase().includes('emprendimiento'))
      : planesDb.find((p) => p.id === PLAN_NEGOCIO_ID) ??
        planesDb.find(
          (p) =>
            p.nombre.toLowerCase().includes('comercio') ||
            p.nombre.toLowerCase().includes('negocio')
        );

    return {
      id: planEncontrado?.id ?? PLAN_NEGOCIO_ID,
      nombre:
        planEncontrado?.nombre ??
        (formData.es_emprendimiento ? 'Emprendimientos' : 'Comercios y Negocios'),
      precio: planEncontrado
        ? Math.round(Number(planEncontrado.precio_mensual))
        : fallback.mensual,
      precioAnual: planEncontrado
        ? Math.round(Number(planEncontrado.precio_anual))
        : fallback.anual,
    };
  })();

  useEffect(() => {
    let mounted = true;
    const cargarRubros = async () => {
      try {
        const { data, error: rubrosError } = await supabase
          .from('rubros')
          .select('*')
          .eq('estado', true)
          .order('orden', { ascending: true });

        if (rubrosError) throw rubrosError;
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
        if (mounted) setLoadingRubros(false);
      }
    };

    void cargarRubros();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMostrarDropdownRubros(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const rubrosFiltrados = rubros.filter((r) =>
    normalizarTexto(r.nombre).includes(normalizarTexto(busquedaRubro.trim()))
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const session = sessionData.session;
      if (!session?.access_token) {
        throw new Error('Tu sesión no es válida. Volvé a iniciar sesión.');
      }

      const email = formData.email.trim().toLowerCase();
      const nombreComerciante = formData.nombreComerciante.trim();
      const nombreEntidad = formData.nombreComercio.trim();

      if (!email || !nombreComerciante || !nombreEntidad) {
        throw new Error('Completá todos los campos obligatorios.');
      }

      if (formData.password.length < MINIMO_CLAVE) {
        throw new Error(`La contraseña debe tener al menos ${MINIMO_CLAVE} caracteres.`);
      }

      if (tipoAlta === 'oficio') {
        if (!oficioData.oficio_rubro.trim()) {
          throw new Error('Indicá el rubro del oficio (ej. Electricista, Gasista, Plomero).');
        }

        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email,
          password: formData.password,
          options: {
            data: { nombre: nombreComerciante, rol: 'comerciante' },
          },
        });

        if (signUpErr) throw signUpErr;

        const nuevoUserId = signUpData.user?.id ?? null;
        const slugGenerado = `${slugLimpio(nombreEntidad)}-${Math.floor(100 + Math.random() * 900)}`;

        const { error: oficioErr } = await supabase.from('oficios').insert({
          propietario_id: nuevoUserId,
          email_contacto: email,
          nombre: nombreEntidad,
          slug: slugGenerado,
          oficio_rubro: oficioData.oficio_rubro.trim(),
          descripcion_corta: formData.descripcion_corta.trim(),
          whatsapp: formData.whatsapp.trim(),
          matricula: oficioData.matricula.trim() || null,
          zona_cobertura: oficioData.zona_cobertura.trim() || 'Nogoyá',
          horario_texto: oficioData.horario_texto.trim() || null,
          a_domicilio: oficioData.a_domicilio,
          urgencias_24hs: oficioData.urgencias_24hs,
          aprobado: true,
          habilitado_admin: true,
        });

        if (oficioErr) throw oficioErr;

        setOficioCreadoOk({
          nombre: nombreEntidad,
          email,
          slug: slugGenerado,
        });
        window.scrollTo({ top: 0 });
        return;
      }

      // FLUJO COMERCIO / EMPRENDIMIENTO
      if (!formData.rubro_id) {
        throw new Error('Elegí un rubro de la lista (escribí y tocá una opción).');
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
            plan_id: planActivo.id,
            proximo_vencimiento: fechaVencimiento,
            comercio: {
              nombre: nombreEntidad,
              rubro_id: formData.rubro_id,
              descripcion_corta: formData.descripcion_corta.trim(),
              direccion: formData.direccion.trim(),
              whatsapp: formData.whatsapp.trim(),
              email_comercial: email,
              latitud: formData.latitud,
              longitud: formData.longitud,
              es_emprendimiento: formData.es_emprendimiento,
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

      const comercioIdCreado = typeof data?.comercioId === 'string' ? data.comercioId : '';

      // Asegurar la bandera es_emprendimiento y el plan_id correcto en DB por si la Edge Function no los mapeó
      if (comercioIdCreado) {
        if (formData.es_emprendimiento) {
          await supabase
            .from('comercios')
            .update({ es_emprendimiento: true })
            .eq('id', comercioIdCreado);
        }

        if (planActivo.id !== PLAN_NEGOCIO_ID) {
          await supabase
            .from('suscripciones')
            .update({ plan_id: planActivo.id })
            .eq('comercio_id', comercioIdCreado);
        }
      }

      const rubro = rubros.find((r) => r.id === formData.rubro_id);
      setComprobante({
        comercioId: comercioIdCreado,
        fecha: new Date(),
        titular: nombreComerciante,
        documento: documento.trim() || undefined,
        comercio: nombreEntidad,
        rubro: rubro?.nombre,
        direccion: formData.direccion.trim(),
        whatsapp: formData.whatsapp.trim() || undefined,
        email,
        plan: planActivo.nombre,
        precioMensual: planActivo.precio,
        primerVencimiento: fechaVencimiento,
        diasGracia: DIAS_GRACIA,
        medio,
      });
      window.scrollTo({ top: 0 });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Ocurrió un error inesperado.';

      setError(`Error al dar de alta: ${message}`);
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

  if (oficioCreadoOk) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-3xl border border-emerald-200 dark:border-emerald-800 shadow-sm space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <Check className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white">
            ¡Prestador de Oficio creado con éxito!
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            <strong>{oficioCreadoOk.nombre}</strong> ya está publicado en la sección <strong>Oficios</strong> y puede ingresar a su panel desde <strong>/login</strong> con el correo <strong>{oficioCreadoOk.email}</strong>.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              to={`/oficio/${oficioCreadoOk.slug}`}
              target="_blank"
              className="px-4 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold"
            >
              Ver Ficha Pública
            </Link>
            <button
              type="button"
              onClick={() => setOficioCreadoOk(null)}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold"
            >
              Cargar otro
            </button>
            <Link
              to="/admin"
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-bold"
            >
              Volver al Admin
            </Link>
          </div>
        </div>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {tipoAlta === 'comercio' ? (
              <>
                <Building className="w-5 h-5 text-brand-600" />
                Dar de Alta Nuevo Comercio / Emprendimiento
              </>
            ) : (
              <>
                <Wrench className="w-5 h-5 text-amber-600" />
                Dar de Alta Nuevo Oficio / Servicio
              </>
            )}
          </h2>

          {/* SELECTOR DE TIPO DE ALTA */}
          <div className="inline-flex p-1 bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                setTipoAlta('comercio');
                setError('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                tipoAlta === 'comercio'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <Building className="w-3.5 h-3.5" /> Comercio
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoAlta('oficio');
                setError('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                tipoAlta === 'oficio'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" /> Oficio
            </button>
          </div>
        </div>

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
              Datos de Acceso al Panel (/login)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Nombre y Apellido del Titular *
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
                  Email de acceso *
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
                  Contraseña Inicial (mínimo {MINIMO_CLAVE} caracteres) *
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

          {tipoAlta === 'comercio' ? (
            <>
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <Building className="w-4 h-4" />
                  Ficha del Comercio / Emprendimiento
                </h3>

                {/* OPCIÓN EMPRENDIMIENTO */}
                <label
                  className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition ${
                    formData.es_emprendimiento
                      ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400 dark:border-purple-700'
                      : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-purple-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.es_emprendimiento}
                    onChange={(e) =>
                      setFormData({ ...formData, es_emprendimiento: e.target.checked })
                    }
                    className="mt-0.5 w-4 h-4 accent-purple-600 shrink-0"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-extrabold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                      <Rocket className="w-4 h-4 text-purple-600" />
                      Marcar como Emprendimiento
                    </span>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400">
                      Aparecerá en el mapa general junto a los comercios y además tendrá presencia destacada en la pestaña exclusiva de <strong>Emprendedores</strong> (Tarifa Emprendimiento: $8.000/mes · $80.000/año).
                    </p>
                  </div>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Nombre del Comercio o Emprendimiento *
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
                        placeholder={loadingRubros ? 'Cargando rubros...' : 'Escribí para buscar rubro...'}
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
                      Dirección o Zona (Nogoyá) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: San Martín 123 o Envíos en Nogoyá"
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
                      Ubicación en el mapa
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Hacé clic en el mapa para marcar la ubicación del local o punto de retiro/zona.
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
                      <label className="block text-xs font-semibold mb-1">Latitud</label>
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
                      <label className="block text-xs font-semibold mb-1">Longitud</label>
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
                </div>
              </div>

              {/* CONTRATO */}
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
                    {planActivo.nombre} · {textoPrecio(planActivo.precio)}
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-gray-600 dark:text-gray-400">
                    {condicionesDelAlta({ precioMensual: planActivo.precio, primerVencimiento: vencimiento, diasGracia: DIAS_GRACIA, medio }).map((c) => (
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
                {loading ? 'Guardando...' : 'Crear y emitir comprobante'}
              </button>
            </>
          ) : (
            /* FORMULARIO DE OFICIO */
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <Wrench className="w-4 h-4 text-amber-600" />
                Ficha del Prestador de Oficio
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Nombre Comercial o del Prestador *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Electricidad Gómez"
                    value={formData.nombreComercio}
                    onChange={(e) =>
                      setFormData({ ...formData, nombreComercio: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Rubro / Oficio *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Electricista / Gasista / Plomero / Fletes"
                    value={oficioData.oficio_rubro}
                    onChange={(e) =>
                      setOficioData({ ...oficioData, oficio_rubro: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1">
                    Descripción Corta *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Instalaciones domiciliarias, tableros y urgencias en Nogoyá."
                    value={formData.descripcion_corta}
                    onChange={(e) =>
                      setFormData({ ...formData, descripcion_corta: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="3435123456"
                    value={formData.whatsapp}
                    onChange={(e) =>
                      setFormData({ ...formData, whatsapp: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Matrícula (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Mat. N° 1234"
                    value={oficioData.matricula}
                    onChange={(e) =>
                      setOficioData({ ...oficioData, matricula: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Zona de cobertura
                  </label>
                  <input
                    type="text"
                    value={oficioData.zona_cobertura}
                    onChange={(e) =>
                      setOficioData({ ...oficioData, zona_cobertura: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Horario habitual
                  </label>
                  <input
                    type="text"
                    value={oficioData.horario_texto}
                    onChange={(e) =>
                      setOficioData({ ...oficioData, horario_texto: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-700"
                  />
                </div>

                <div className="flex items-center gap-6 md:col-span-2 pt-2">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={oficioData.a_domicilio}
                      onChange={(e) =>
                        setOficioData({ ...oficioData, a_domicilio: e.target.checked })
                      }
                      className="w-4 h-4 accent-amber-600"
                    />
                    <Home className="w-4 h-4 text-amber-600" /> Trabaja a domicilio
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-rose-600">
                    <input
                      type="checkbox"
                      checked={oficioData.urgencias_24hs}
                      onChange={(e) =>
                        setOficioData({ ...oficioData, urgencias_24hs: e.target.checked })
                      }
                      className="w-4 h-4 accent-rose-600"
                    />
                    <Siren className="w-4 h-4" /> Atiende Urgencias 24hs
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Creando oficio...' : 'Crear Usuario y Publicar Oficio'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};