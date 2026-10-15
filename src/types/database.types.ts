// Tipos escritos a mano a partir de supabase/migrations.
// Cuando tengan acceso a la base, conviene reemplazarlos por los generados:
//   npx supabase gen types typescript --project-id <id> > src/types/supabase.ts

export type Role = 'admin' | 'comerciante' | 'usuario';
export type EstadoSuscripcion = 'activa' | 'pendiente' | 'vencida' | 'suspendida';
export type EstadoPago = 'pagado' | 'pendiente' | 'vencido';
export type MetodoPago = 'transferencia' | 'efectivo' | 'mercado_pago' | 'otro';
export type EstadoRecordatorio = 'pendiente' | 'gestionado' | 'no_corresponde';
export type TipoInteraccion = 'visita' | 'whatsapp' | 'como_llegar';

export interface Profile {
  id: string;
  nombre: string;
  rol: Role;
  estado: 'activo' | 'suspendido';
  created_at: string;
}

export interface Rubro {
  id: string;
  nombre: string;
  slug: string;
  icono: string;
  estado: boolean;
  orden: number;
}

export interface Plan {
  id: string;
  nombre: string;
  precio_mensual: number;
  limite_promociones: number;
  estado: boolean;
}

export interface Suscripcion {
  id: string;
  comercio_id: string;
  plan_id: string;
  precio_acordado: number;
  estado: EstadoSuscripcion;
  fecha_alta: string;
  proximo_vencimiento: string;
  dias_gracia: number;
  suspension_manual: boolean;
  plan?: Plan | null;
}

export interface Comercio {
  id: string;
  nombre: string;
  slug: string;
  descripcion_corta: string;
  descripcion_completa?: string | null;
  rubro_id: string;
  rubro?: Rubro | null;
  direccion: string;
  latitud: number;
  longitud: number;
  telefono?: string | null;
  whatsapp: string;
  email_comercial?: string | null;
  sitio_web?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  logo_url?: string | null;
  galeria_urls?: string[] | null;
  servicios?: string[] | null;
  medios_pago?: string[] | null;
  google_place_id?: string | null;
  aprobado: boolean;
  habilitado_admin: boolean;
  propietario_id: string;
  eliminado_en?: string | null;
  created_at: string;
  updated_at?: string;
  suscripcion?: Suscripcion | null;
}

// Convención: dia_semana 0 = Lunes ... 6 = Domingo
export interface HorarioAtencion {
  id: string;
  comercio_id: string;
  dia_semana: number;
  turno: number;
  hora_apertura: string;
  hora_cierre: string;
  cruza_medianoche: boolean;
  activo: boolean;
}

export interface Promocion {
  id: string;
  comercio_id: string;
  titulo: string;
  descripcion: string;
  imagen_url?: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  condiciones?: string | null;
  precio_anterior?: number | null;
  precio_promocional?: number | null;
  aprobada: boolean;
  destacada: boolean;
  created_at: string;
  comercio?: Pick<Comercio, 'id' | 'nombre' | 'slug' | 'whatsapp'> | null;
}

export interface PeriodoSuscripcion {
  id: string;
  suscripcion_id: string;
  periodo_facturado: string;
  importe: number;
  vencimiento: string;
  estado_pago: EstadoPago;
  fecha_pago: string | null;
}

export interface Pago {
  id: string;
  periodo_suscripcion_id: string;
  importe: number;
  fecha_pago: string;
  metodo_pago: MetodoPago;
  referencia: string | null;
  comprobante_url: string | null;
  registrado_por: string;
  created_at: string;
}

export interface RecordatorioWhatsApp {
  id: string;
  comercio_id: string;
  suscripcion_id: string;
  periodo_facturado: string;
  estado: EstadoRecordatorio;
  fecha_gestion: string | null;
  gestionado_por: string | null;
  observaciones: string | null;
}

export interface PlantillasWhatsApp {
  proximo_vencimiento: string;
  pago_vencido: string;
}

export interface Metricas {
  visitas: number;
  whatsapp: number;
  comoLlegar: number;
}
