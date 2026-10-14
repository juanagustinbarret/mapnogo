CREATE OR REPLACE FUNCTION public.es_comercio_publico(comercio_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_aprobado BOOLEAN;
  v_habilitado BOOLEAN;
  v_estado_sub subscription_status;
BEGIN
  SELECT c.aprobado, c.habilitado_admin, s.estado
  INTO v_aprobado, v_habilitado, v_estado_sub
  FROM public.comercios c
  LEFT JOIN public.suscripciones s ON s.comercio_id = c.id
  WHERE c.id = comercio_uuid;

  RETURN (
    COALESCE(v_aprobado, false) = true AND
    COALESCE(v_habilitado, false) = true AND
    COALESCE(v_estado_sub, 'pendiente') IN ('activa')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promociones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos_suscripcion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rubros visibles públicamente" ON public.rubros FOR SELECT USING (true);

CREATE POLICY "Comercios públicos visibles" ON public.comercios FOR SELECT USING (
  public.es_comercio_publico(id) OR
  propietario_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin')
);

CREATE POLICY "Comerciante edita su comercio" ON public.comercios FOR UPDATE USING (
  propietario_id = auth.uid()
);

CREATE POLICY "Admin gestiona comercios" ON public.comercios FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin')
);