CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('admin', 'comerciante', 'usuario');
CREATE TYPE subscription_status AS ENUM ('activa', 'pendiente', 'vencida', 'suspendida');
CREATE TYPE payment_status AS ENUM ('pagado', 'pendiente', 'vencido');
CREATE TYPE payment_method AS ENUM ('transferencia', 'efectivo', 'mercado_pago', 'otro');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  rol user_role NOT NULL DEFAULT 'comerciante',
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.rubros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icono TEXT NOT NULL DEFAULT 'Store',
  estado BOOLEAN NOT NULL DEFAULT true,
  orden INT NOT NULL DEFAULT 0
);

CREATE TABLE public.comercios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  descripcion_corta TEXT NOT NULL,
  descripcion_completa TEXT,
  rubro_id UUID NOT NULL REFERENCES public.rubros(id),
  direccion TEXT NOT NULL,
  latitud NUMERIC(10,8) NOT NULL,
  longitud NUMERIC(11,8) NOT NULL,
  telefono TEXT,
  whatsapp TEXT NOT NULL,
  email_comercial TEXT,
  sitio_web TEXT,
  instagram TEXT,
  facebook TEXT,
  logo_url TEXT,
  galeria_urls TEXT[] DEFAULT '{}',
  servicios TEXT[] DEFAULT '{}',
  medios_pago TEXT[] DEFAULT '{}',
  aprobado BOOLEAN NOT NULL DEFAULT false,
  habilitado_admin BOOLEAN NOT NULL DEFAULT true,
  propietario_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.horarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comercio_id UUID NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
  dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  turno INT NOT NULL DEFAULT 1 CHECK (turno IN (1, 2)),
  hora_apertura TIME NOT NULL,
  hora_cierre TIME NOT NULL,
  cruza_medianoche BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(comercio_id, dia_semana, turno)
);

CREATE TABLE public.promociones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comercio_id UUID NOT NULL REFERENCES public.comercios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  imagen_url TEXT,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ NOT NULL,
  condiciones TEXT,
  precio_anterior NUMERIC(12,2),
  precio_promocional NUMERIC(12,2),
  aprobada BOOLEAN NOT NULL DEFAULT true,
  destacada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.planes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  precio_mensual NUMERIC(12,2) NOT NULL DEFAULT 10000.00,
  limite_promociones INT NOT NULL DEFAULT 5,
  estado BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE public.suscripciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comercio_id UUID NOT NULL UNIQUE REFERENCES public.comercios(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.planes(id),
  precio_acordado NUMERIC(12,2) NOT NULL DEFAULT 10000.00,
  estado subscription_status NOT NULL DEFAULT 'pendiente',
  fecha_alta DATE NOT NULL DEFAULT CURRENT_DATE,
  proximo_vencimiento DATE NOT NULL,
  dias_gracia INT NOT NULL DEFAULT 5,
  suspension_manual BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE public.periodos_suscripcion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suscripcion_id UUID NOT NULL REFERENCES public.suscripciones(id) ON DELETE CASCADE,
  periodo_facturado VARCHAR(7) NOT NULL,
  importe NUMERIC(12,2) NOT NULL,
  vencimiento DATE NOT NULL,
  estado_pago payment_status NOT NULL DEFAULT 'pendiente',
  fecha_pago TIMESTAMPTZ,
  UNIQUE(suscripcion_id, periodo_facturado)
);

CREATE TABLE public.pagos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  periodo_suscripcion_id UUID NOT NULL REFERENCES public.periodos_suscripcion(id) ON DELETE CASCADE,
  importe NUMERIC(12,2) NOT NULL,
  fecha_pago TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metodo_pago payment_method NOT NULL DEFAULT 'transferencia',
  referencia TEXT,
  comprobante_url TEXT,
  registrado_por UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);