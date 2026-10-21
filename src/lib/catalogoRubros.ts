// src/lib/catalogoRubros.ts
//
// Catálogo de rubros de NOGOYORK agrupado en categorías, pensado para el
// comercio y los servicios de una ciudad del interior como Nogoyá.
//
// - La tabla `rubros` de la base es plana (nombre, slug, icono, estado,
//   orden): la categoría de cada rubro se resuelve acá, por su slug. Así no
//   hace falta cambiar la estructura de la tabla.
// - Los rubros marcados `existente` ya estaban en la base y NO se tocan
//   (mismo nombre y slug). Los demás se agregan con
//   supabase/propuestas/20261018_rubros_argentina.sql (solo INSERT, sin
//   borrar ni renombrar).
// - Nombres en plural, como los que ya había ("Panaderías", "Farmacias").
// - `icono` es un nombre de la lista ICONOS de src/lib/iconosRubro.ts.

export interface RubroCatalogo {
  nombre: string;
  slug: string;
  icono: string;
  existente?: boolean;
}

export interface CategoriaRubros {
  categoria: string;
  rubros: RubroCatalogo[];
}

export const CATALOGO_RUBROS: CategoriaRubros[] = [
  {
    categoria: 'Almacén y alimentos',
    rubros: [
      { nombre: 'Almacenes y despensas', slug: 'almacenes-despensas', icono: 'ShoppingBag', existente: true },
      { nombre: 'Supermercados', slug: 'supermercados', icono: 'ShoppingCart', existente: true },
      { nombre: 'Autoservicios', slug: 'autoservicios', icono: 'ShoppingCart' },
      { nombre: 'Kioscos y maxikioscos', slug: 'kioscos', icono: 'Candy' },
      { nombre: 'Carnicerías', slug: 'carnicerias', icono: 'Beef', existente: true },
      { nombre: 'Pollerías', slug: 'pollerias', icono: 'Drumstick' },
      { nombre: 'Pescaderías', slug: 'pescaderias', icono: 'Fish' },
      { nombre: 'Fiambrerías y queserías', slug: 'fiambrerias', icono: 'Ham' },
      { nombre: 'Verdulerías y fruterías', slug: 'verdulerias', icono: 'Carrot' },
      { nombre: 'Panaderías', slug: 'panaderias', icono: 'Croissant', existente: true },
      { nombre: 'Confiterías', slug: 'confiterias', icono: 'CakeSlice' },
      { nombre: 'Fábricas de pastas', slug: 'fabricas-de-pastas', icono: 'ChefHat' },
      { nombre: 'Dietéticas', slug: 'dieteticas', icono: 'Leaf' },
      { nombre: 'Productos regionales', slug: 'productos-regionales', icono: 'Grape' },
      { nombre: 'Vinotecas', slug: 'vinotecas', icono: 'Wine' },
      { nombre: 'Distribuidoras de bebidas', slug: 'distribuidoras-de-bebidas', icono: 'CupSoda' },
      { nombre: 'Mayoristas', slug: 'mayoristas', icono: 'Warehouse' },
    ],
  },
  {
    categoria: 'Gastronomía',
    rubros: [
      { nombre: 'Rotiserías y restaurantes', slug: 'rotiserias-restaurantes', icono: 'UtensilsCrossed', existente: true },
      { nombre: 'Cafeterías y bares', slug: 'cafeterias-bares', icono: 'Coffee', existente: true },
      { nombre: 'Pizzerías', slug: 'pizzerias', icono: 'Pizza' },
      { nombre: 'Parrillas', slug: 'parrillas', icono: 'Flame' },
      { nombre: 'Cervecerías', slug: 'cervecerias', icono: 'Beer' },
      { nombre: 'Heladerías', slug: 'heladerias', icono: 'IceCreamCone' },
      { nombre: 'Lomiterías y hamburgueserías', slug: 'lomiterias', icono: 'Sandwich' },
      { nombre: 'Casas de empanadas', slug: 'empanadas', icono: 'Soup' },
      { nombre: 'Viandas y comida para llevar', slug: 'viandas', icono: 'Salad' },
      { nombre: 'Catering', slug: 'catering', icono: 'ChefHat' },
    ],
  },
  {
    categoria: 'Salud',
    rubros: [
      { nombre: 'Farmacias', slug: 'farmacias', icono: 'Pill', existente: true },
      { nombre: 'Ópticas', slug: 'opticas', icono: 'Glasses' },
      { nombre: 'Consultorios médicos', slug: 'consultorios-medicos', icono: 'Stethoscope' },
      { nombre: 'Clínicas y sanatorios', slug: 'clinicas', icono: 'HeartPulse' },
      { nombre: 'Odontología', slug: 'odontologia', icono: 'Smile' },
      { nombre: 'Kinesiología', slug: 'kinesiologia', icono: 'Activity' },
      { nombre: 'Psicología', slug: 'psicologia', icono: 'Brain' },
      { nombre: 'Nutricionistas', slug: 'nutricionistas', icono: 'Apple' },
      { nombre: 'Fonoaudiología', slug: 'fonoaudiologia', icono: 'Ear' },
      { nombre: 'Laboratorios de análisis clínicos', slug: 'laboratorios', icono: 'FlaskConical' },
      { nombre: 'Ortopedias', slug: 'ortopedias', icono: 'Accessibility' },
      { nombre: 'Geriátricos y residencias', slug: 'geriatricos', icono: 'Armchair' },
    ],
  },
  {
    categoria: 'Belleza y cuidado personal',
    rubros: [
      { nombre: 'Peluquerías', slug: 'peluquerias', icono: 'Scissors' },
      { nombre: 'Barberías', slug: 'barberias', icono: 'Scissors' },
      { nombre: 'Centros de estética', slug: 'centros-de-estetica', icono: 'Sparkles' },
      { nombre: 'Manicuría y uñas', slug: 'manicuria', icono: 'Hand' },
      { nombre: 'Perfumerías', slug: 'perfumerias', icono: 'Sparkles' },
      { nombre: 'Spa y masajes', slug: 'spa-masajes', icono: 'Flower' },
      { nombre: 'Estudios de tatuajes', slug: 'tatuajes', icono: 'Paintbrush' },
    ],
  },
  {
    categoria: 'Ropa y accesorios',
    rubros: [
      { nombre: 'Indumentaria', slug: 'indumentaria', icono: 'Shirt', existente: true },
      { nombre: 'Indumentaria infantil', slug: 'indumentaria-infantil', icono: 'Baby' },
      { nombre: 'Ropa de trabajo', slug: 'ropa-de-trabajo', icono: 'HardHat' },
      { nombre: 'Zapaterías', slug: 'zapaterias', icono: 'Footprints' },
      { nombre: 'Lencerías', slug: 'lencerias', icono: 'Shirt' },
      { nombre: 'Marroquinerías', slug: 'marroquinerias', icono: 'Briefcase' },
      { nombre: 'Joyerías y relojerías', slug: 'joyerias', icono: 'Watch' },
      { nombre: 'Bijouterie y accesorios', slug: 'bijouterie', icono: 'Gem' },
      { nombre: 'Mercerías', slug: 'mercerias', icono: 'Ruler' },
      { nombre: 'Arreglos de ropa y costura', slug: 'arreglos-de-ropa', icono: 'Scissors' },
    ],
  },
  {
    categoria: 'Hogar y construcción',
    rubros: [
      { nombre: 'Ferreterías', slug: 'ferreterias', icono: 'Wrench', existente: true },
      { nombre: 'Corralones', slug: 'corralones', icono: 'HardHat' },
      { nombre: 'Pinturerías', slug: 'pinturerias', icono: 'PaintBucket' },
      { nombre: 'Sanitarios', slug: 'sanitarios', icono: 'Bath' },
      { nombre: 'Casas de electricidad', slug: 'casas-de-electricidad', icono: 'Lightbulb' },
      { nombre: 'Aberturas', slug: 'aberturas', icono: 'DoorOpen' },
      { nombre: 'Vidrierías', slug: 'vidrierias', icono: 'Hammer' },
      { nombre: 'Herrerías', slug: 'herrerias', icono: 'Hammer' },
      { nombre: 'Carpinterías', slug: 'carpinterias', icono: 'Axe' },
      { nombre: 'Mueblerías', slug: 'mueblerias', icono: 'Sofa' },
      { nombre: 'Colchonerías', slug: 'colchonerias', icono: 'BedDouble' },
      { nombre: 'Bazares', slug: 'bazares', icono: 'CookingPot' },
      { nombre: 'Blanquerías', slug: 'blanquerias', icono: 'BedDouble' },
      { nombre: 'Decoración', slug: 'decoracion', icono: 'Lamp' },
      { nombre: 'Cerrajerías', slug: 'cerrajerias', icono: 'Key' },
      { nombre: 'Viveros', slug: 'viveros', icono: 'Sprout' },
      { nombre: 'Florerías', slug: 'florerias', icono: 'Flower2' },
      { nombre: 'Gas envasado y garrafas', slug: 'garrafas', icono: 'Flame' },
      { nombre: 'Leña y carbón', slug: 'lena-y-carbon', icono: 'TreePine' },
    ],
  },
  {
    categoria: 'Oficios y mantenimiento',
    rubros: [
      { nombre: 'Electricistas', slug: 'electricistas', icono: 'Zap' },
      { nombre: 'Plomeros y gasistas', slug: 'plomeros-gasistas', icono: 'Wrench' },
      { nombre: 'Albañiles y construcción', slug: 'albaniles', icono: 'HardHat' },
      { nombre: 'Pintores', slug: 'pintores', icono: 'Paintbrush' },
      { nombre: 'Climatización y aire acondicionado', slug: 'climatizacion', icono: 'Snowflake' },
      { nombre: 'Fumigación y control de plagas', slug: 'fumigacion', icono: 'Bug' },
      { nombre: 'Limpieza', slug: 'limpieza', icono: 'SprayCan' },
    ],
  },
  {
    categoria: 'Tecnología y electro',
    rubros: [
      { nombre: 'Electrodomésticos', slug: 'electrodomesticos', icono: 'Tv' },
      { nombre: 'Celulares y accesorios', slug: 'celulares', icono: 'Smartphone' },
      { nombre: 'Servicio técnico', slug: 'servicio-tecnico', icono: 'Cog' },
      { nombre: 'Computación', slug: 'computacion', icono: 'Laptop' },
      { nombre: 'Proveedores de internet', slug: 'internet', icono: 'Wifi' },
    ],
  },
  {
    categoria: 'Autos y motos',
    rubros: [
      { nombre: 'Concesionarias', slug: 'concesionarias', icono: 'Car' },
      { nombre: 'Repuestos del automotor', slug: 'repuestos-automotor', icono: 'Cog' },
      { nombre: 'Gomerías', slug: 'gomerias', icono: 'Gauge' },
      { nombre: 'Lubricentros', slug: 'lubricentros', icono: 'Droplets' },
      { nombre: 'Talleres mecánicos', slug: 'talleres-mecanicos', icono: 'Wrench' },
      { nombre: 'Chapa y pintura', slug: 'chapa-y-pintura', icono: 'PaintBucket' },
      { nombre: 'Electricidad del automotor', slug: 'electricidad-automotor', icono: 'Plug' },
      { nombre: 'Lavaderos de autos', slug: 'lavaderos-de-autos', icono: 'Droplets' },
      { nombre: 'Estaciones de servicio', slug: 'estaciones-de-servicio', icono: 'Fuel' },
      { nombre: 'Motos y repuestos', slug: 'motos', icono: 'Bike' },
      { nombre: 'Bicicleterías', slug: 'bicicleterias', icono: 'Bike' },
    ],
  },
  {
    categoria: 'Servicios profesionales',
    rubros: [
      { nombre: 'Estudios jurídicos', slug: 'estudios-juridicos', icono: 'Scale' },
      { nombre: 'Estudios contables', slug: 'estudios-contables', icono: 'Calculator' },
      { nombre: 'Escribanías', slug: 'escribanias', icono: 'FileText' },
      { nombre: 'Inmobiliarias', slug: 'inmobiliarias', icono: 'Home' },
      { nombre: 'Seguros', slug: 'seguros', icono: 'ShieldCheck' },
      { nombre: 'Gestorías', slug: 'gestorias', icono: 'FileText' },
      { nombre: 'Estudios de arquitectura', slug: 'arquitectura', icono: 'Ruler' },
      { nombre: 'Financieras y préstamos', slug: 'financieras', icono: 'HandCoins' },
    ],
  },
  {
    categoria: 'Servicios',
    rubros: [
      { nombre: 'Remiserías', slug: 'remiserias', icono: 'CarTaxiFront' },
      { nombre: 'Fletes y mudanzas', slug: 'fletes', icono: 'Truck' },
      { nombre: 'Correo y encomiendas', slug: 'correo-encomiendas', icono: 'Package' },
      { nombre: 'Lavanderías y tintorerías', slug: 'lavanderias', icono: 'Shirt' },
      { nombre: 'Imprentas y gráficas', slug: 'imprentas', icono: 'Printer' },
      { nombre: 'Fotografía', slug: 'fotografia', icono: 'Camera' },
      { nombre: 'Agencias de quiniela', slug: 'quinielas', icono: 'Ticket' },
      { nombre: 'Centros de pago de servicios', slug: 'centros-de-pago', icono: 'Receipt' },
      { nombre: 'Salones de eventos', slug: 'salones-de-eventos', icono: 'PartyPopper' },
      { nombre: 'Alquiler para eventos', slug: 'alquiler-para-eventos', icono: 'PartyPopper' },
      { nombre: 'Funerarias', slug: 'funerarias', icono: 'Flower' },
    ],
  },
  {
    categoria: 'Educación',
    rubros: [
      { nombre: 'Jardines maternales', slug: 'jardines-maternales', icono: 'Baby' },
      { nombre: 'Institutos y academias', slug: 'academias', icono: 'GraduationCap' },
      { nombre: 'Apoyo escolar', slug: 'apoyo-escolar', icono: 'BookOpen' },
      { nombre: 'Institutos de idiomas', slug: 'idiomas', icono: 'Languages' },
      { nombre: 'Escuelas de manejo', slug: 'escuelas-de-manejo', icono: 'Car' },
      { nombre: 'Música y danza', slug: 'musica-y-danza', icono: 'Music' },
    ],
  },
  {
    categoria: 'Deportes y recreación',
    rubros: [
      { nombre: 'Gimnasios', slug: 'gimnasios', icono: 'Dumbbell' },
      { nombre: 'Artículos deportivos', slug: 'articulos-deportivos', icono: 'Trophy' },
      { nombre: 'Canchas y complejos deportivos', slug: 'canchas', icono: 'Goal' },
      { nombre: 'Caza, pesca y camping', slug: 'caza-pesca-camping', icono: 'Fish' },
    ],
  },
  {
    categoria: 'Mascotas',
    rubros: [
      { nombre: 'Veterinarias', slug: 'veterinarias', icono: 'PawPrint' },
      { nombre: 'Pet shops', slug: 'pet-shops', icono: 'Bone' },
      { nombre: 'Peluquerías caninas', slug: 'peluquerias-caninas', icono: 'Dog' },
    ],
  },
  {
    categoria: 'Regalos, librería y juguetes',
    rubros: [
      { nombre: 'Regalerías', slug: 'regalerias', icono: 'Gift' },
      { nombre: 'Jugueterías', slug: 'jugueterias', icono: 'Gift' },
      { nombre: 'Librerías y papelerías', slug: 'librerias', icono: 'BookOpen' },
      { nombre: 'Cotillones', slug: 'cotillones', icono: 'PartyPopper' },
      { nombre: 'Artesanías', slug: 'artesanias', icono: 'Palette' },
    ],
  },
  {
    categoria: 'Campo y agro',
    rubros: [
      { nombre: 'Acopios de cereales', slug: 'acopios', icono: 'Wheat' },
      { nombre: 'Maquinaria agrícola', slug: 'maquinaria-agricola', icono: 'Tractor' },
      { nombre: 'Agroinsumos', slug: 'agroinsumos', icono: 'Sprout' },
      { nombre: 'Forrajerías', slug: 'forrajerias', icono: 'Wheat' },
      { nombre: 'Agroveterinarias', slug: 'agroveterinarias', icono: 'PawPrint' },
      { nombre: 'Consignatarias de hacienda', slug: 'consignatarias', icono: 'Beef' },
      { nombre: 'Apicultura', slug: 'apicultura', icono: 'Hop' },
    ],
  },
  {
    categoria: 'Turismo y alojamiento',
    rubros: [
      { nombre: 'Hoteles', slug: 'hoteles', icono: 'BedDouble' },
      { nombre: 'Hospedajes y cabañas', slug: 'hospedajes-cabanas', icono: 'Home' },
      { nombre: 'Campings', slug: 'campings', icono: 'Tent' },
      { nombre: 'Agencias de viajes', slug: 'agencias-de-viajes', icono: 'Plane' },
    ],
  },
  {
    categoria: 'Otros',
    rubros: [{ nombre: 'Otros', slug: 'otros', icono: 'MoreHorizontal', existente: true }],
  },
];

export const CATEGORIA_OTROS = 'Otros';

const categoriaPorSlug = new Map<string, string>();
const ordenCategoria = new Map<string, number>();
CATALOGO_RUBROS.forEach(({ categoria, rubros }, i) => {
  ordenCategoria.set(categoria, i);
  rubros.forEach((r) => categoriaPorSlug.set(r.slug, categoria));
});

/** Categoría de un rubro de la base (los que no están en el catálogo van a "Otros"). */
export function categoriaDeRubro(rubro?: { slug?: string | null } | null): string {
  return (rubro?.slug && categoriaPorSlug.get(rubro.slug)) || CATEGORIA_OTROS;
}

/**
 * Agrupa rubros por categoría, en el orden del catálogo, para usar en
 * <optgroup> o listas. Dentro de cada grupo se respeta el orden recibido.
 */
export function agruparRubros<T extends { slug?: string | null }>(rubros: T[]): Array<{ categoria: string; rubros: T[] }> {
  const grupos = new Map<string, T[]>();
  for (const rubro of rubros) {
    const categoria = categoriaDeRubro(rubro);
    if (!grupos.has(categoria)) grupos.set(categoria, []);
    grupos.get(categoria)!.push(rubro);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => (ordenCategoria.get(a) ?? 999) - (ordenCategoria.get(b) ?? 999))
    .map(([categoria, lista]) => ({ categoria, rubros: lista }));
}

/** Todos los rubros del catálogo en una lista, con su categoría. */
export const RUBROS_DEL_CATALOGO = CATALOGO_RUBROS.flatMap(({ categoria, rubros }) =>
  rubros.map((r) => ({ ...r, categoria })),
);
