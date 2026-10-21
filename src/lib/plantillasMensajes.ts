// src/lib/plantillasMensajes.ts
//
// Plantillas de los mensajes de WhatsApp que el admin manda desde el panel:
//   - recordatorio_pago:      comercio con suscripción (importe y vencimiento)
//   - invitacion_suscripcion: comercio sin suscripción cargada (sin importe)
//   - metricas:               resumen de visitas y consultas de un período
//
// Variables con una única sintaxis: {nombre_comercio}, {importe}, ...
// (la vieja [IMPORTE] se convierte sola al leer plantillas guardadas).
// Todo es puro: no envía nada ni toca la base.

export type TipoPlantilla = 'recordatorio_pago' | 'invitacion_suscripcion' | 'metricas';

export interface DefinicionVariable {
  clave: string;
  etiqueta: string;
  ejemplo: string;
}

export const VARIABLES: Record<string, DefinicionVariable> = {
  nombre_comercio: { clave: 'nombre_comercio', etiqueta: 'Nombre del comercio', ejemplo: 'Pizzería Don Pepe' },
  importe: { clave: 'importe', etiqueta: 'Importe', ejemplo: '$ 12.000' },
  fecha_vencimiento: { clave: 'fecha_vencimiento', etiqueta: 'Fecha de vencimiento', ejemplo: '10/11/2026' },
  plan: { clave: 'plan', etiqueta: 'Plan', ejemplo: 'Plan Estándar Comercio' },
  periodo: { clave: 'periodo', etiqueta: 'Período', ejemplo: 'del 12/10/2026 al 18/10/2026' },
  resumen_metricas: {
    clave: 'resumen_metricas',
    etiqueta: 'Resumen de métricas',
    ejemplo: '👀 *1.234* visitas a tu ficha (▲ 12 %)\n💬 *56* consultas por WhatsApp (▼ 3 %)\n📍 *78* pedidos de "Cómo llegar" (= igual)',
  },
  visitas: { clave: 'visitas', etiqueta: 'Visitas', ejemplo: '1.234' },
  consultas_whatsapp: { clave: 'consultas_whatsapp', etiqueta: 'Consultas por WhatsApp', ejemplo: '56' },
  como_llegar: { clave: 'como_llegar', etiqueta: '"Cómo llegar"', ejemplo: '78' },
  link_panel: { clave: 'link_panel', etiqueta: 'Link al panel', ejemplo: 'https://mapnogo.vercel.app/panel' },
};

/** Variables que tienen sentido en cada tipo de mensaje (son los chips del editor). */
export const VARIABLES_POR_TIPO: Record<TipoPlantilla, string[]> = {
  recordatorio_pago: ['nombre_comercio', 'importe', 'fecha_vencimiento', 'plan', 'link_panel'],
  invitacion_suscripcion: ['nombre_comercio', 'link_panel'],
  metricas: ['nombre_comercio', 'periodo', 'resumen_metricas', 'visitas', 'consultas_whatsapp', 'como_llegar', 'link_panel'],
};

export const TITULOS_PLANTILLAS: Record<TipoPlantilla, string> = {
  recordatorio_pago: 'Recordatorio de pago',
  invitacion_suscripcion: 'Comercio sin suscripción',
  metricas: 'Métricas',
};

export const PLANTILLAS_PREDETERMINADAS: Record<TipoPlantilla, string> = {
  recordatorio_pago:
    '¡Hola {nombre_comercio}! 👋 Te escribimos de NOGOYORK.\n' +
    'Te recordamos que tu suscripción de {importe} vence el {fecha_vencimiento}.\n' +
    'Cuando hagas el pago, avisanos por acá así lo registramos.\n' +
    '¡Gracias por ser parte de NOGOYORK! 🙌',
  invitacion_suscripcion:
    '¡Hola {nombre_comercio}! 👋 Te escribimos de NOGOYORK.\n' +
    'Vimos que tu comercio todavía no tiene una suscripción activa. ' +
    'Si querés que te sigan encontrando en el mapa y publicar tus ofertas, escribinos por acá y te contamos cómo activarla. ' +
    '¡Gracias! 🙌',
  metricas:
    '¡Hola {nombre_comercio}! 📊 Estos son tus números en NOGOYORK {periodo}:\n\n' +
    '{resumen_metricas}\n\n' +
    'Mirá el detalle en tu panel: {link_panel}\n' +
    '¡Gracias por ser parte de NOGOYORK! 🙌',
};

const PATRON_VARIABLE = /\{([a-z_]+)\}/g;
// Largo prudente: el texto va dentro de un link wa.me
export const LARGO_MAXIMO = 1500;

/** Convierte la sintaxis vieja ([IMPORTE], [NOMBRE DEL COMERCIO]...) a la nueva. */
export function convertirSintaxisVieja(texto: string): string {
  return texto
    .split('[NOMBRE DEL COMERCIO]').join('{nombre_comercio}')
    .split('[IMPORTE]').join('{importe}')
    .split('[FECHA DE VENCIMIENTO]').join('{fecha_vencimiento}')
    .split('[VENCIMIENTO]').join('{fecha_vencimiento}')
    .split('[PERIODO]').join('{periodo}');
}

/** Variables {x} que aparecen en el texto, sin repetir. */
export function variablesEnTexto(texto: string): string[] {
  return [...new Set([...texto.matchAll(PATRON_VARIABLE)].map((m) => m[1]))];
}

/**
 * Reemplaza las variables que tienen dato. Las que no tienen dato quedan
 * escritas tal cual ({importe}) y se devuelven en `faltantes`, para que el
 * editor las marque.
 */
export function completarPlantilla(
  texto: string,
  valores: Partial<Record<string, string | null | undefined>>,
): { texto: string; faltantes: string[] } {
  const faltantes = new Set<string>();
  const resultado = texto.replace(PATRON_VARIABLE, (completo, clave: string) => {
    const valor = valores[clave];
    if (valor === undefined || valor === null || String(valor).trim() === '') {
      if (VARIABLES[clave]) faltantes.add(clave);
      return completo;
    }
    return String(valor);
  });
  return { texto: resultado, faltantes: [...faltantes] };
}

/** Variables conocidas que siguen sin resolver en un texto final (bloquean el envío). */
export function variablesSinResolver(texto: string): string[] {
  return variablesEnTexto(texto).filter((clave) => VARIABLES[clave]);
}

/**
 * Quita una variable sin dato del texto, junto con la preposición que la
 * acompaña ("de {importe}" → ""). Sirve para la variante "sin importe".
 */
export function quitarVariable(texto: string, clave: string): string {
  return texto
    .replace(new RegExp(`\\s*(de|por|el|del)\\s+\\{${clave}\\}`, 'g'), '')
    .replace(new RegExp(`\\{${clave}\\}`, 'g'), '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,;:!?])/g, '$1');
}

/**
 * Validación de una plantilla general antes de guardarla. Los errores impiden
 * guardar; las advertencias solo se muestran.
 */
export function validarPlantilla(texto: string, tipo: TipoPlantilla): { errores: string[]; advertencias: string[] } {
  const errores: string[] = [];
  const advertencias: string[] = [];
  if (!texto.trim()) errores.push('El mensaje no puede estar vacío.');
  if (texto.length > LARGO_MAXIMO) errores.push(`El mensaje es muy largo (${texto.length} de ${LARGO_MAXIMO} caracteres).`);
  const desconocidas = variablesEnTexto(texto).filter((v) => !VARIABLES_POR_TIPO[tipo].includes(v));
  if (desconocidas.length) {
    errores.push(`Variables que no existen para este mensaje: ${desconocidas.map((v) => `{${v}}`).join(', ')}.`);
  }
  const viejas = texto.match(/\[[A-ZÁÉÍÓÚÑ ]+\]/g);
  if (viejas) errores.push(`Usá la sintaxis nueva con llaves en lugar de ${[...new Set(viejas)].join(', ')}.`);
  const abiertas = (texto.match(/\{/g) ?? []).length;
  const cerradas = (texto.match(/\}/g) ?? []).length;
  if (abiertas !== cerradas) errores.push('Hay una llave { } sin cerrar.');
  if (!texto.includes('{nombre_comercio}')) {
    advertencias.push('Conviene incluir {nombre_comercio} para que el mensaje sea personal.');
  }
  if (tipo === 'recordatorio_pago' && !texto.includes('{fecha_vencimiento}')) {
    advertencias.push('El recordatorio no dice cuándo vence: considerá agregar {fecha_vencimiento}.');
  }
  if (tipo === 'metricas' && !texto.includes('{resumen_metricas}') && !texto.includes('{visitas}')) {
    advertencias.push('El mensaje de métricas no incluye ningún número.');
  }
  return { errores, advertencias };
}

// ─── Armado del recordatorio para un comercio ───────────────────────────

export interface DatosRecordatorio {
  nombre: string;
  whatsappValido: boolean;
  suscripcion?: {
    precio_acordado?: number | null;
    proximo_vencimiento?: string | null;
    plan?: string | null;
  } | null;
}

export type ResultadoRecordatorio =
  | { ok: false; motivo: 'sin_whatsapp'; mensajeError: string }
  | {
      ok: true;
      tipo: 'recordatorio_pago' | 'invitacion_suscripcion';
      texto: string;
      faltantes: string[];
      /** Valores conocidos, para los chips del editor */
      valores: Record<string, string | undefined>;
      aviso?: string;
    };

const formatoImporte = (n: number) =>
  `$ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)}`;
const formatoFecha = (fecha: string) => fecha.slice(0, 10).split('-').reverse().join('/');

/**
 * Decide qué mensaje corresponde y lo arma. Casos:
 *  - sin WhatsApp válido → error (no se puede enviar nada)
 *  - sin suscripción     → invitación a activarla (sin importe)
 *  - suscripción sin importe o sin fecha → recordatorio con esas variables
 *    marcadas para completar a mano (o quitar) en el editor
 *  - suscripción completa → recordatorio listo
 */
export function armarRecordatorio(
  datos: DatosRecordatorio,
  plantillas: Record<TipoPlantilla, string>,
  extras: { linkPanel?: string } = {},
): ResultadoRecordatorio {
  if (!datos.whatsappValido) {
    return {
      ok: false,
      motivo: 'sin_whatsapp',
      mensajeError: `"${datos.nombre}" no tiene un número de WhatsApp válido cargado. Cargalo en la edición del comercio para poder escribirle.`,
    };
  }

  const sub = datos.suscripcion;
  if (!sub) {
    const valores = { nombre_comercio: datos.nombre, link_panel: extras.linkPanel };
    const { texto, faltantes } = completarPlantilla(plantillas.invitacion_suscripcion, valores);
    return {
      ok: true,
      tipo: 'invitacion_suscripcion',
      texto,
      faltantes,
      valores,
      aviso: 'Este comercio no tiene una suscripción cargada: se arma una invitación a activarla, sin importe.',
    };
  }

  const importe = sub.precio_acordado && Number(sub.precio_acordado) > 0 ? formatoImporte(Number(sub.precio_acordado)) : undefined;
  const valores = {
    nombre_comercio: datos.nombre,
    importe,
    fecha_vencimiento: sub.proximo_vencimiento ? formatoFecha(sub.proximo_vencimiento) : undefined,
    plan: sub.plan ?? undefined,
    link_panel: extras.linkPanel,
  };
  const { texto, faltantes } = completarPlantilla(plantillas.recordatorio_pago, valores);
  const avisos: string[] = [];
  if (!importe) avisos.push('la suscripción no tiene importe cargado');
  if (!sub.proximo_vencimiento) avisos.push('la suscripción no tiene fecha de vencimiento');
  return {
    ok: true,
    tipo: 'recordatorio_pago',
    texto,
    faltantes,
    valores,
    aviso: avisos.length ? `Atención: ${avisos.join(' y ')}. Completalo abajo o quitalo del mensaje.` : undefined,
  };
}

/** Plantillas guardadas (JSON de configuracion_sistema) → las tres plantillas en uso. */
export function leerPlantillasGuardadas(valor: unknown): Record<TipoPlantilla, string> {
  const guardadas = (valor && typeof valor === 'object' ? valor : {}) as Partial<Record<string, string>>;
  const elegir = (tipo: TipoPlantilla) => {
    const texto = guardadas[tipo];
    return typeof texto === 'string' && texto.trim() ? convertirSintaxisVieja(texto) : PLANTILLAS_PREDETERMINADAS[tipo];
  };
  return {
    recordatorio_pago: elegir('recordatorio_pago'),
    invitacion_suscripcion: elegir('invitacion_suscripcion'),
    metricas: elegir('metricas'),
  };
}
