-- =====================================================================
-- Rubros de comercios y servicios de Argentina (NOGOMAP, 18/10/2026)
-- =====================================================================
-- PROPUESTA: NO se ejecutó contra producción. Revisar y correr a mano en
-- Supabase → SQL Editor cuando estén de acuerdo.
--
-- Es SOLO ADITIVA:
--   * No borra, no renombra y no modifica los 10 rubros existentes (los
--     comercios que ya los usan siguen igual).
--   * ON CONFLICT DO NOTHING: si un nombre o slug ya existe, esa fila se
--     saltea (se puede correr más de una vez sin duplicar).
--   * `orden` desde 101 para que los existentes (1 a 10) sigan primero.
--
-- La categoría de cada rubro (para agruparlos en los filtros y
-- formularios) se define en src/lib/catalogoRubros.ts por su slug; la
-- tabla no necesita columnas nuevas.
-- Generado desde src/lib/catalogoRubros.ts: si se cambia el catálogo,
-- actualizar también este archivo (hay un test que lo verifica).

INSERT INTO public.rubros (nombre, slug, icono, estado, orden) VALUES
  -- Almacén y alimentos
  ('Autoservicios', 'autoservicios', 'ShoppingCart', true, 101),
  ('Kioscos y maxikioscos', 'kioscos', 'Candy', true, 102),
  ('Pollerías', 'pollerias', 'Drumstick', true, 103),
  ('Pescaderías', 'pescaderias', 'Fish', true, 104),
  ('Fiambrerías y queserías', 'fiambrerias', 'Ham', true, 105),
  ('Verdulerías y fruterías', 'verdulerias', 'Carrot', true, 106),
  ('Confiterías', 'confiterias', 'CakeSlice', true, 107),
  ('Fábricas de pastas', 'fabricas-de-pastas', 'ChefHat', true, 108),
  ('Dietéticas', 'dieteticas', 'Leaf', true, 109),
  ('Productos regionales', 'productos-regionales', 'Grape', true, 110),
  ('Vinotecas', 'vinotecas', 'Wine', true, 111),
  ('Distribuidoras de bebidas', 'distribuidoras-de-bebidas', 'CupSoda', true, 112),
  ('Mayoristas', 'mayoristas', 'Warehouse', true, 113),
  -- Gastronomía
  ('Pizzerías', 'pizzerias', 'Pizza', true, 114),
  ('Parrillas', 'parrillas', 'Flame', true, 115),
  ('Cervecerías', 'cervecerias', 'Beer', true, 116),
  ('Heladerías', 'heladerias', 'IceCreamCone', true, 117),
  ('Lomiterías y hamburgueserías', 'lomiterias', 'Sandwich', true, 118),
  ('Casas de empanadas', 'empanadas', 'Soup', true, 119),
  ('Viandas y comida para llevar', 'viandas', 'Salad', true, 120),
  ('Catering', 'catering', 'ChefHat', true, 121),
  -- Salud
  ('Ópticas', 'opticas', 'Glasses', true, 122),
  ('Consultorios médicos', 'consultorios-medicos', 'Stethoscope', true, 123),
  ('Clínicas y sanatorios', 'clinicas', 'HeartPulse', true, 124),
  ('Odontología', 'odontologia', 'Smile', true, 125),
  ('Kinesiología', 'kinesiologia', 'Activity', true, 126),
  ('Psicología', 'psicologia', 'Brain', true, 127),
  ('Nutricionistas', 'nutricionistas', 'Apple', true, 128),
  ('Fonoaudiología', 'fonoaudiologia', 'Ear', true, 129),
  ('Laboratorios de análisis clínicos', 'laboratorios', 'FlaskConical', true, 130),
  ('Ortopedias', 'ortopedias', 'Accessibility', true, 131),
  ('Geriátricos y residencias', 'geriatricos', 'Armchair', true, 132),
  -- Belleza y cuidado personal
  ('Peluquerías', 'peluquerias', 'Scissors', true, 133),
  ('Barberías', 'barberias', 'Scissors', true, 134),
  ('Centros de estética', 'centros-de-estetica', 'Sparkles', true, 135),
  ('Manicuría y uñas', 'manicuria', 'Hand', true, 136),
  ('Perfumerías', 'perfumerias', 'Sparkles', true, 137),
  ('Spa y masajes', 'spa-masajes', 'Flower', true, 138),
  ('Estudios de tatuajes', 'tatuajes', 'Paintbrush', true, 139),
  -- Ropa y accesorios
  ('Indumentaria infantil', 'indumentaria-infantil', 'Baby', true, 140),
  ('Ropa de trabajo', 'ropa-de-trabajo', 'HardHat', true, 141),
  ('Zapaterías', 'zapaterias', 'Footprints', true, 142),
  ('Lencerías', 'lencerias', 'Shirt', true, 143),
  ('Marroquinerías', 'marroquinerias', 'Briefcase', true, 144),
  ('Joyerías y relojerías', 'joyerias', 'Watch', true, 145),
  ('Bijouterie y accesorios', 'bijouterie', 'Gem', true, 146),
  ('Mercerías', 'mercerias', 'Ruler', true, 147),
  ('Arreglos de ropa y costura', 'arreglos-de-ropa', 'Scissors', true, 148),
  -- Hogar y construcción
  ('Corralones', 'corralones', 'HardHat', true, 149),
  ('Pinturerías', 'pinturerias', 'PaintBucket', true, 150),
  ('Sanitarios', 'sanitarios', 'Bath', true, 151),
  ('Casas de electricidad', 'casas-de-electricidad', 'Lightbulb', true, 152),
  ('Aberturas', 'aberturas', 'DoorOpen', true, 153),
  ('Vidrierías', 'vidrierias', 'Hammer', true, 154),
  ('Herrerías', 'herrerias', 'Hammer', true, 155),
  ('Carpinterías', 'carpinterias', 'Axe', true, 156),
  ('Mueblerías', 'mueblerias', 'Sofa', true, 157),
  ('Colchonerías', 'colchonerias', 'BedDouble', true, 158),
  ('Bazares', 'bazares', 'CookingPot', true, 159),
  ('Blanquerías', 'blanquerias', 'BedDouble', true, 160),
  ('Decoración', 'decoracion', 'Lamp', true, 161),
  ('Cerrajerías', 'cerrajerias', 'Key', true, 162),
  ('Viveros', 'viveros', 'Sprout', true, 163),
  ('Florerías', 'florerias', 'Flower2', true, 164),
  ('Gas envasado y garrafas', 'garrafas', 'Flame', true, 165),
  ('Leña y carbón', 'lena-y-carbon', 'TreePine', true, 166),
  -- Oficios y mantenimiento
  ('Electricistas', 'electricistas', 'Zap', true, 167),
  ('Plomeros y gasistas', 'plomeros-gasistas', 'Wrench', true, 168),
  ('Albañiles y construcción', 'albaniles', 'HardHat', true, 169),
  ('Pintores', 'pintores', 'Paintbrush', true, 170),
  ('Climatización y aire acondicionado', 'climatizacion', 'Snowflake', true, 171),
  ('Fumigación y control de plagas', 'fumigacion', 'Bug', true, 172),
  ('Limpieza', 'limpieza', 'SprayCan', true, 173),
  -- Tecnología y electro
  ('Electrodomésticos', 'electrodomesticos', 'Tv', true, 174),
  ('Celulares y accesorios', 'celulares', 'Smartphone', true, 175),
  ('Servicio técnico', 'servicio-tecnico', 'Cog', true, 176),
  ('Computación', 'computacion', 'Laptop', true, 177),
  ('Proveedores de internet', 'internet', 'Wifi', true, 178),
  -- Autos y motos
  ('Concesionarias', 'concesionarias', 'Car', true, 179),
  ('Repuestos del automotor', 'repuestos-automotor', 'Cog', true, 180),
  ('Gomerías', 'gomerias', 'Gauge', true, 181),
  ('Lubricentros', 'lubricentros', 'Droplets', true, 182),
  ('Talleres mecánicos', 'talleres-mecanicos', 'Wrench', true, 183),
  ('Chapa y pintura', 'chapa-y-pintura', 'PaintBucket', true, 184),
  ('Electricidad del automotor', 'electricidad-automotor', 'Plug', true, 185),
  ('Lavaderos de autos', 'lavaderos-de-autos', 'Droplets', true, 186),
  ('Estaciones de servicio', 'estaciones-de-servicio', 'Fuel', true, 187),
  ('Motos y repuestos', 'motos', 'Bike', true, 188),
  ('Bicicleterías', 'bicicleterias', 'Bike', true, 189),
  -- Servicios profesionales
  ('Estudios jurídicos', 'estudios-juridicos', 'Scale', true, 190),
  ('Estudios contables', 'estudios-contables', 'Calculator', true, 191),
  ('Escribanías', 'escribanias', 'FileText', true, 192),
  ('Inmobiliarias', 'inmobiliarias', 'Home', true, 193),
  ('Seguros', 'seguros', 'ShieldCheck', true, 194),
  ('Gestorías', 'gestorias', 'FileText', true, 195),
  ('Estudios de arquitectura', 'arquitectura', 'Ruler', true, 196),
  ('Financieras y préstamos', 'financieras', 'HandCoins', true, 197),
  -- Servicios
  ('Remiserías', 'remiserias', 'CarTaxiFront', true, 198),
  ('Fletes y mudanzas', 'fletes', 'Truck', true, 199),
  ('Correo y encomiendas', 'correo-encomiendas', 'Package', true, 200),
  ('Lavanderías y tintorerías', 'lavanderias', 'Shirt', true, 201),
  ('Imprentas y gráficas', 'imprentas', 'Printer', true, 202),
  ('Fotografía', 'fotografia', 'Camera', true, 203),
  ('Agencias de quiniela', 'quinielas', 'Ticket', true, 204),
  ('Centros de pago de servicios', 'centros-de-pago', 'Receipt', true, 205),
  ('Salones de eventos', 'salones-de-eventos', 'PartyPopper', true, 206),
  ('Alquiler para eventos', 'alquiler-para-eventos', 'PartyPopper', true, 207),
  ('Funerarias', 'funerarias', 'Flower', true, 208),
  -- Educación
  ('Jardines maternales', 'jardines-maternales', 'Baby', true, 209),
  ('Institutos y academias', 'academias', 'GraduationCap', true, 210),
  ('Apoyo escolar', 'apoyo-escolar', 'BookOpen', true, 211),
  ('Institutos de idiomas', 'idiomas', 'Languages', true, 212),
  ('Escuelas de manejo', 'escuelas-de-manejo', 'Car', true, 213),
  ('Música y danza', 'musica-y-danza', 'Music', true, 214),
  -- Deportes y recreación
  ('Gimnasios', 'gimnasios', 'Dumbbell', true, 215),
  ('Artículos deportivos', 'articulos-deportivos', 'Trophy', true, 216),
  ('Canchas y complejos deportivos', 'canchas', 'Goal', true, 217),
  ('Caza, pesca y camping', 'caza-pesca-camping', 'Fish', true, 218),
  -- Mascotas
  ('Veterinarias', 'veterinarias', 'PawPrint', true, 219),
  ('Pet shops', 'pet-shops', 'Bone', true, 220),
  ('Peluquerías caninas', 'peluquerias-caninas', 'Dog', true, 221),
  -- Regalos, librería y juguetes
  ('Regalerías', 'regalerias', 'Gift', true, 222),
  ('Jugueterías', 'jugueterias', 'Gift', true, 223),
  ('Librerías y papelerías', 'librerias', 'BookOpen', true, 224),
  ('Cotillones', 'cotillones', 'PartyPopper', true, 225),
  ('Artesanías', 'artesanias', 'Palette', true, 226),
  -- Campo y agro
  ('Acopios de cereales', 'acopios', 'Wheat', true, 227),
  ('Maquinaria agrícola', 'maquinaria-agricola', 'Tractor', true, 228),
  ('Agroinsumos', 'agroinsumos', 'Sprout', true, 229),
  ('Forrajerías', 'forrajerias', 'Wheat', true, 230),
  ('Agroveterinarias', 'agroveterinarias', 'PawPrint', true, 231),
  ('Consignatarias de hacienda', 'consignatarias', 'Beef', true, 232),
  ('Apicultura', 'apicultura', 'Hop', true, 233),
  -- Turismo y alojamiento
  ('Hoteles', 'hoteles', 'BedDouble', true, 234),
  ('Hospedajes y cabañas', 'hospedajes-cabanas', 'Home', true, 235),
  ('Campings', 'campings', 'Tent', true, 236),
  ('Agencias de viajes', 'agencias-de-viajes', 'Plane', true, 237)
ON CONFLICT DO NOTHING;

-- Verificación (debería dar 147: 10 existentes + 137 nuevos):
-- SELECT count(*) FROM public.rubros;
