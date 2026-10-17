// src/types/database.types.ts

export type Role = 'admin' | 'comerciante' | 'usuario';

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

export interface Promocion {
  id: string;
  comercio_id: string;
  titulo: string;
  descripcion: string;
  tipo?: 'promocion' | 'novedad'; // Distinción entre oferta o noticia general
  precio_anterior?: number | null;
  precio_promocional?: number | null;
  imagen_url?: string | null;
  fecha_inicio?: string; // Fecha desde la cual es válida
  fecha_fin?: string; // Para el filtro automático de vencimiento
  aprobada: boolean;
  creado_el?: string;
  comercio?: Comercio;
}

export interface Comercio {
  id: string;
  nombre: string;
  slug: string;
  descripcion_corta: string;
  descripcion_completa?: string;
  rubro_id: string;
  rubro?: Rubro;
  direccion: string;
  latitud: number;
  longitud: number;
  telefono?: string;
  whatsapp: string;
  email_comercial?: string;
  sitio_web?: string;
  instagram?: string;
  facebook?: string;
  logo_url?: string;
  galeria_urls: string[];
  servicios: string[];
  medios_pago: string[];
  aprobado: boolean;
  habilitado_admin: boolean;
  propietario_id: string;
  creado_el?: string;
  created_at: string;
  updated_at: string;
  distancia_km?: number; // Calculado dinámicamente según ubicación del usuario
  distanciaCalculada?: number; // Alias de compatibilidad
  estado_horario?: 'abierto' | 'cierra_pronto' | 'cerrado' | 'no_informado';
}

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

export interface Suscripcion {
  id: string;
  comercio_id: string;
  comercio?: Comercio;
  plan_id: string;
  precio_acordado: number;
  estado: 'activa' | 'pendiente' | 'vencida' | 'suspendida';
  fecha_alta: string;
  proximo_vencimiento: string;
  dias_gracia: number;
  suspension_manual: boolean;
}
