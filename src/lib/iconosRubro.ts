// src/lib/iconosRubro.ts
//
// Decide qué ícono y qué color le corresponde a cada rubro (bares, pizzerías,
// tiendas de ropa, etc.). Lo usan los marcadores del mapa, los filtros y las
// tarjetas del listado, así todo el sitio muestra el mismo ícono por rubro.
//
// Cómo se elige el ícono de un rubro:
//   1. Si la columna `rubros.icono` tiene un nombre de ícono conocido y
//      específico (por ejemplo "Pill" o "Shirt"), se usa ese.
//   2. Si no (ícono genérico como "Store", vacío o desconocido), se busca una
//      palabra clave en el nombre o el slug del rubro ("Pizzerías" → pizza).
//   3. Si nada coincide, se usa el ícono genérico de comercio.
//
// Para cambiar el ícono de un rubro alcanza con poner en `rubros.icono` alguno
// de los nombres de la lista ICONOS de abajo. Para sumar un ícono nuevo hay que
// importarlo de lucide-react y agregarlo a esa lista (se importan uno por uno
// a propósito: importar todos los íconos de lucide agrandaría mucho la app).

import {
  Accessibility,
  Activity,
  Apple,
  Armchair,
  Axe,
  Baby,
  Bath,
  BedDouble,
  Beef,
  Beer,
  Bike,
  Bone,
  BookOpen,
  Brain,
  Briefcase,
  Bug,
  CakeSlice,
  Calculator,
  Camera,
  Candy,
  Car,
  CarTaxiFront,
  Carrot,
  ChefHat,
  Coffee,
  Cog,
  Cookie,
  CookingPot,
  Croissant,
  CupSoda,
  Dog,
  DoorOpen,
  Droplets,
  Drumstick,
  Dumbbell,
  Ear,
  FileText,
  Fish,
  Flame,
  FlaskConical,
  Flower,
  Flower2,
  Footprints,
  Fuel,
  Gauge,
  Gem,
  Gift,
  Glasses,
  Goal,
  GraduationCap,
  Grape,
  Ham,
  Hammer,
  Hand,
  HandCoins,
  HardHat,
  HeartPulse,
  Home,
  Hop,
  IceCreamCone,
  Key,
  Lamp,
  Landmark,
  Languages,
  Laptop,
  Leaf,
  Lightbulb,
  Milk,
  Music,
  Package,
  PaintBucket,
  Paintbrush,
  Palette,
  PartyPopper,
  PawPrint,
  Pill,
  Pizza,
  Plane,
  Plug,
  Printer,
  Receipt,
  Ruler,
  Salad,
  Sandwich,
  Scale,
  Scissors,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Smile,
  Snowflake,
  Sofa,
  Soup,
  Sparkles,
  SprayCan,
  Sprout,
  Stethoscope,
  Store,
  Tent,
  Ticket,
  Tractor,
  TreePine,
  Trophy,
  Truck,
  Tv,
  UtensilsCrossed,
  Warehouse,
  Watch,
  Wheat,
  Wifi,
  Wine,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Rubro } from '@/types/database.types';

export interface VisualRubro {
  /** Nombre del ícono en la lista (sirve también como clave de caché). */
  clave: string;
  Icono: LucideIcon;
  /** Color de fondo del marcador. Todos tienen buen contraste con blanco. */
  color: string;
}

// Íconos disponibles para los rubros, con su color. Los colores están
// agrupados por familia: comidas en naranjas y rojos, salud en verdes y
// celestes, ropa y belleza en violetas y rosas, oficios en grises, etc.
const ICONOS: Record<string, { Icono: LucideIcon; color: string }> = {
  Store: { Icono: Store, color: '#15803d' },
  // Comidas y bebidas
  Pizza: { Icono: Pizza, color: '#dc2626' },
  UtensilsCrossed: { Icono: UtensilsCrossed, color: '#ea580c' },
  Sandwich: { Icono: Sandwich, color: '#c2410c' },
  Beef: { Icono: Beef, color: '#b91c1c' },
  Drumstick: { Icono: Drumstick, color: '#d97706' },
  Fish: { Icono: Fish, color: '#0284c7' },
  Croissant: { Icono: Croissant, color: '#b45309' },
  CakeSlice: { Icono: CakeSlice, color: '#db2777' },
  IceCreamCone: { Icono: IceCreamCone, color: '#c026d3' },
  Cookie: { Icono: Cookie, color: '#be123c' },
  Coffee: { Icono: Coffee, color: '#92400e' },
  Beer: { Icono: Beer, color: '#a16207' },
  Wine: { Icono: Wine, color: '#9f1239' },
  Apple: { Icono: Apple, color: '#16a34a' },
  Milk: { Icono: Milk, color: '#0369a1' },
  Wheat: { Icono: Wheat, color: '#854d0e' },
  // Almacenes y supermercados
  ShoppingBag: { Icono: ShoppingBag, color: '#0d9488' },
  ShoppingCart: { Icono: ShoppingCart, color: '#2563eb' },
  // Salud
  Pill: { Icono: Pill, color: '#059669' },
  Stethoscope: { Icono: Stethoscope, color: '#0891b2' },
  Glasses: { Icono: Glasses, color: '#475569' },
  // Ropa, calzado y belleza
  Shirt: { Icono: Shirt, color: '#9333ea' },
  Footprints: { Icono: Footprints, color: '#7c3aed' },
  Gem: { Icono: Gem, color: '#6d28d9' },
  Sparkles: { Icono: Sparkles, color: '#e11d48' },
  Scissors: { Icono: Scissors, color: '#be185d' },
  // Hogar, oficios y construcción
  Wrench: { Icono: Wrench, color: '#57534e' },
  Hammer: { Icono: Hammer, color: '#44403c' },
  Zap: { Icono: Zap, color: '#4f46e5' },
  Sofa: { Icono: Sofa, color: '#7e22ce' },
  Gift: { Icono: Gift, color: '#a21caf' },
  Flower2: { Icono: Flower2, color: '#15803d' },
  PawPrint: { Icono: PawPrint, color: '#4d7c0f' },
  // Vehículos
  Car: { Icono: Car, color: '#334155' },
  Fuel: { Icono: Fuel, color: '#9a3412' },
  Bike: { Icono: Bike, color: '#0f766e' },
  Truck: { Icono: Truck, color: '#475569' },
  // Tecnología, papelería y servicios
  Smartphone: { Icono: Smartphone, color: '#4338ca' },
  BookOpen: { Icono: BookOpen, color: '#1d4ed8' },
  Printer: { Icono: Printer, color: '#3730a3' },
  Camera: { Icono: Camera, color: '#52525b' },
  Briefcase: { Icono: Briefcase, color: '#374151' },
  Landmark: { Icono: Landmark, color: '#1e3a8a' },
  Home: { Icono: Home, color: '#0e7490' },
  Dumbbell: { Icono: Dumbbell, color: '#0369a1' },
  BedDouble: { Icono: BedDouble, color: '#7e22ce' },
  // Rubros de Argentina (catálogo del 18/10)
  Candy: { Icono: Candy, color: '#db2777' },
  Ham: { Icono: Ham, color: '#be123c' },
  Carrot: { Icono: Carrot, color: '#ea580c' },
  ChefHat: { Icono: ChefHat, color: '#c2410c' },
  Leaf: { Icono: Leaf, color: '#15803d' },
  Grape: { Icono: Grape, color: '#7e22ce' },
  CupSoda: { Icono: CupSoda, color: '#0369a1' },
  Warehouse: { Icono: Warehouse, color: '#475569' },
  CookingPot: { Icono: CookingPot, color: '#b45309' },
  Flame: { Icono: Flame, color: '#dc2626' },
  Soup: { Icono: Soup, color: '#c2410c' },
  Salad: { Icono: Salad, color: '#16a34a' },
  HeartPulse: { Icono: HeartPulse, color: '#dc2626' },
  Smile: { Icono: Smile, color: '#0891b2' },
  Activity: { Icono: Activity, color: '#0d9488' },
  Brain: { Icono: Brain, color: '#9333ea' },
  Ear: { Icono: Ear, color: '#0e7490' },
  FlaskConical: { Icono: FlaskConical, color: '#4f46e5' },
  Accessibility: { Icono: Accessibility, color: '#2563eb' },
  Armchair: { Icono: Armchair, color: '#78716c' },
  Hand: { Icono: Hand, color: '#db2777' },
  Flower: { Icono: Flower, color: '#a21caf' },
  Paintbrush: { Icono: Paintbrush, color: '#7c3aed' },
  Baby: { Icono: Baby, color: '#ec4899' },
  HardHat: { Icono: HardHat, color: '#a16207' },
  Watch: { Icono: Watch, color: '#6d28d9' },
  Ruler: { Icono: Ruler, color: '#475569' },
  PaintBucket: { Icono: PaintBucket, color: '#2563eb' },
  Bath: { Icono: Bath, color: '#0891b2' },
  Lightbulb: { Icono: Lightbulb, color: '#a16207' },
  DoorOpen: { Icono: DoorOpen, color: '#78716c' },
  Axe: { Icono: Axe, color: '#92400e' },
  Lamp: { Icono: Lamp, color: '#b45309' },
  Key: { Icono: Key, color: '#57534e' },
  Sprout: { Icono: Sprout, color: '#16a34a' },
  TreePine: { Icono: TreePine, color: '#166534' },
  Snowflake: { Icono: Snowflake, color: '#0284c7' },
  Bug: { Icono: Bug, color: '#65a30d' },
  SprayCan: { Icono: SprayCan, color: '#0d9488' },
  Tv: { Icono: Tv, color: '#4338ca' },
  Cog: { Icono: Cog, color: '#475569' },
  Laptop: { Icono: Laptop, color: '#4338ca' },
  Wifi: { Icono: Wifi, color: '#2563eb' },
  Gauge: { Icono: Gauge, color: '#334155' },
  Droplets: { Icono: Droplets, color: '#0284c7' },
  Plug: { Icono: Plug, color: '#a16207' },
  Scale: { Icono: Scale, color: '#1e3a8a' },
  Calculator: { Icono: Calculator, color: '#0f766e' },
  FileText: { Icono: FileText, color: '#475569' },
  ShieldCheck: { Icono: ShieldCheck, color: '#1d4ed8' },
  HandCoins: { Icono: HandCoins, color: '#15803d' },
  CarTaxiFront: { Icono: CarTaxiFront, color: '#a16207' },
  Package: { Icono: Package, color: '#b45309' },
  Ticket: { Icono: Ticket, color: '#be123c' },
  Receipt: { Icono: Receipt, color: '#0f766e' },
  PartyPopper: { Icono: PartyPopper, color: '#db2777' },
  GraduationCap: { Icono: GraduationCap, color: '#1d4ed8' },
  Languages: { Icono: Languages, color: '#0e7490' },
  Music: { Icono: Music, color: '#9333ea' },
  Trophy: { Icono: Trophy, color: '#a16207' },
  Goal: { Icono: Goal, color: '#16a34a' },
  Bone: { Icono: Bone, color: '#92400e' },
  Dog: { Icono: Dog, color: '#b45309' },
  Palette: { Icono: Palette, color: '#c026d3' },
  Tractor: { Icono: Tractor, color: '#15803d' },
  Hop: { Icono: Hop, color: '#a16207' },
  Tent: { Icono: Tent, color: '#166534' },
  Plane: { Icono: Plane, color: '#0284c7' },
};

// Nombres viejos o alternativos que se pueden encontrar en la columna `icono`.
const ALIAS: Record<string, string> = {
  MoreHorizontal: 'Store',
  Ellipsis: 'Store',
  Utensils: 'UtensilsCrossed',
  IceCream: 'IceCreamCone',
  IceCream2: 'IceCreamCone',
  Hotel: 'BedDouble',
  House: 'Home',
  Cake: 'CakeSlice',
};

// Íconos demasiado generales: si el rubro tiene uno de estos, primero se
// intenta adivinar uno mejor por el nombre. "Utensils" está acá porque en los
// datos iniciales se usó para Panaderías, que queda mejor con un croissant.
const GENERICOS = new Set(['Store', 'MoreHorizontal', 'Ellipsis', 'Utensils', 'MapPin', 'Building', 'Building2', 'Tag']);

// Palabras clave → ícono. Se revisan en orden y gana la primera que coincide,
// así que las más específicas van primero (por ejemplo "café" antes que "bar",
// para que "Cafeterías y bares" quede con la taza). El texto se compara en
// minúsculas y sin tildes.
const PALABRAS_CLAVE: Array<[RegExp, string]> = [
  [/pizz/, 'Pizza'],
  [/helad/, 'IceCreamCone'],
  [/\bcafe/, 'Coffee'],
  [/cervec|\bbar(es)?\b|\bpubs?\b|resto ?bar|boliche/, 'Beer'],
  [/vinot|\bvinos?\b|bebida|licor/, 'Wine'],
  [/panad|panific|factura/, 'Croissant'],
  [/pastel|confit|reposter|\btortas?\b|bomboner|chocolat/, 'CakeSlice'],
  [/golosin|candy/, 'Cookie'],
  [/pollo|polleri/, 'Drumstick'],
  [/pescad|marisc/, 'Fish'],
  [/carnic|\bcarnes?\b|frigorif|fiambr|parrill|asador/, 'Beef'],
  [/sandw|lomit|hamburg|comida rapida|fast ?food/, 'Sandwich'],
  [/rotis|restaur|\bresto\b|comida|cocina|bodegon|pastas|vianda|delivery|empanad/, 'UtensilsCrossed'],
  [/verdul|fruter|\bfrutas?\b|verdura/, 'Apple'],
  [/lacteo|queser/, 'Milk'],
  [/dietetic|cereal|agro|semilla|granja/, 'Wheat'],
  [/super|autoserv|hipermerc|mayorist/, 'ShoppingCart'],
  [/almac|despens|kiosc|minimerc|provedur|proveedur/, 'ShoppingBag'],
  [/farmac|drogue/, 'Pill'],
  [/optica/, 'Glasses'],
  [/salud|medic|consultor|clinica|odont|dentist|kinesi|enfermer|laborator|psicolog|nutricion/, 'Stethoscope'],
  [/peluq|barber|estilist/, 'Scissors'],
  [/estetic|belleza|perfum|cosmet|\bspa\b|manicur|\bunas\b/, 'Sparkles'],
  [/joyer|reloj|bijou|alhaj/, 'Gem'],
  [/calzad|zapat/, 'Footprints'],
  [/ropa|indument|\bmoda\b|boutique|lenceri|vestimenta|textil|uniforme|sastrer|merceri|lavander|tintorer/, 'Shirt'],
  [/ferret|bulon|pinturer/, 'Wrench'],
  [/corralon|construc|materiales|sanitari|abertura|herreri|carpinter|vidrier/, 'Hammer'],
  [/celular|telefon|tecnolog|electronic|informat|computac|gamer/, 'Smartphone'],
  [/electric|electrodomest|iluminac/, 'Zap'],
  [/combustib|estacion de servicio|\bnafta|\bgnc\b/, 'Fuel'],
  [/taller|mecanic|gomeri|repuesto|lubric|automot|\bautos?\b|concesion|chaperi|neumatic|remis|\btaxis?\b/, 'Car'],
  [/bicicl|\bmotos?\b|ciclism/, 'Bike'],
  [/flete|transport|mudanz|logistic|distribuid|encomiend/, 'Truck'],
  [/fotocop|librer|papeler|\blibros?\b/, 'BookOpen'],
  [/imprent|grafic|serigraf|sublimac/, 'Printer'],
  [/\bfoto/, 'Camera'],
  [/veterin|mascot|forraj|pet ?shop|acuario/, 'PawPrint'],
  [/vivero|florer|\bflores\b|jardin|plantas/, 'Flower2'],
  [/gimnas|\bgym\b|deport|fitness|crossfit|natacion|pilates|\byoga\b/, 'Dumbbell'],
  [/hotel|hosped|alojam|cabana|hostel|camping/, 'BedDouble'],
  [/regal|juguet|bazar|cotillon/, 'Gift'],
  [/mueble|decorac|colchon|\bhogar\b|blanqueri/, 'Sofa'],
  [/inmobil|bienes raices|propiedades/, 'Home'],
  [/banco|financ|prestamo|casa de cambio/, 'Landmark'],
  [/contad|contable|abogad|escriban|estudio|asesor|seguro|gestor|consultora/, 'Briefcase'],
];

const POR_DEFECTO: VisualRubro = { clave: 'Store', ...ICONOS.Store };

// Índice que acepta "ShoppingBag", "shopping-bag", "shoppingbag", etc.
const clavePlana = (nombre: string) => nombre.toLowerCase().replace(/[^a-z0-9]/g, '');
const INDICE = new Map<string, string>();
for (const nombre of Object.keys(ICONOS)) INDICE.set(clavePlana(nombre), nombre);
const INDICE_ALIAS = new Map<string, string>();
for (const [alias, destino] of Object.entries(ALIAS)) INDICE_ALIAS.set(clavePlana(alias), destino);
const GENERICOS_PLANOS = new Set([...GENERICOS].map(clavePlana));

const sinTildes = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const visualDe = (clave: string): VisualRubro => ({ clave, ...ICONOS[clave] });

/** Devuelve el ícono configurado en la columna `icono`, si es uno conocido. */
function iconoConfigurado(icono: string | null | undefined): { clave: string; generico: boolean } | null {
  if (!icono) return null;
  const plano = clavePlana(icono);
  const clave = INDICE.get(plano) ?? INDICE_ALIAS.get(plano);
  if (!clave) return null;
  return { clave, generico: GENERICOS_PLANOS.has(plano) };
}

/** Busca un ícono por palabras clave en un texto libre (nombre o slug del rubro). */
export function iconoPorPalabrasClave(texto: string): string | null {
  const normalizado = sinTildes(texto).replace(/[-_]+/g, ' ');
  for (const [patron, clave] of PALABRAS_CLAVE) {
    if (patron.test(normalizado)) return clave;
  }
  return null;
}

const cache = new Map<string, VisualRubro>();

/** Ícono y color para un rubro. Si el comercio no tiene rubro, usa el genérico. */
export function visualDeRubro(rubro?: Pick<Rubro, 'nombre' | 'slug' | 'icono'> | null): VisualRubro {
  if (!rubro) return POR_DEFECTO;

  const claveCache = `${rubro.icono ?? ''}|${rubro.nombre ?? ''}|${rubro.slug ?? ''}`;
  const enCache = cache.get(claveCache);
  if (enCache) return enCache;

  const configurado = iconoConfigurado(rubro.icono);
  let resultado: VisualRubro;
  if (configurado && !configurado.generico) {
    resultado = visualDe(configurado.clave);
  } else {
    const porNombre = iconoPorPalabrasClave(`${rubro.nombre ?? ''} ${rubro.slug ?? ''}`);
    if (porNombre) resultado = visualDe(porNombre);
    else if (configurado) resultado = visualDe(configurado.clave);
    else resultado = POR_DEFECTO;
  }

  cache.set(claveCache, resultado);
  return resultado;
}

/** Nombres válidos para la columna `rubros.icono` (útil para un futuro ABM de rubros). */
export const NOMBRES_DE_ICONOS = Object.keys(ICONOS);
