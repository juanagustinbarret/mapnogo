// src/lib/delivery.ts
//
// Horarios de delivery: validación y "¿está activo ahora?". Funciones puras,
// siempre en hora de Argentina (America/Argentina/Buenos_Aires), sin depender
// de la zona horaria del celular ni del servidor.
//
// Reglas:
//  - dia_semana: 0 = Lunes … 6 = Domingo (igual que horarios_atencion).
//  - Cada rango es [inicio, fin): el INICIO ES INCLUSIVO y el FIN EXCLUSIVO.
//    Un rango 12:00–15:00 está activo a las 12:00 y a las 14:59, y ya no a
//    las 15:00.
//  - Si fin <= inicio, el rango cruza la medianoche y pertenece al día en que
//    empieza: el del lunes 20:00–02:00 sigue activo el martes a las 00:30.
//  - 24 hs se guarda como 00:00–24:00.

const ZONA = 'America/Argentina/Buenos_Aires';
const DIA = 1440;

export interface RangoDelivery {
  dia_semana: number;
  hora_inicio: string; // 'HH:MM' o 'HH:MM:SS' (como devuelve Postgres)
  hora_fin: string;
}

export interface MomentoArgentina {
  dia: number; // 0 = Lunes … 6 = Domingo
  minutos: number; // 0 … 1439
}

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const INDICE_DIA: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Día de la semana y minuto del día en Argentina para un instante. */
export function momentoArgentina(fecha: Date = new Date()): MomentoArgentina {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return { dia: INDICE_DIA[valor('weekday')], minutos: Number(valor('hour')) * 60 + Number(valor('minute')) };
}

const PATRON_HORA = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

/** 'HH:MM' → minutos. '24:00' solo vale como fin (= 1440). */
export function aMinutos(hora: string): number {
  if (/^24:00(:00)?$/.test(hora)) return DIA;
  const m = PATRON_HORA.exec(hora);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** minutos → 'HH:MM' (1440 o más se muestra como la hora del día siguiente). */
export function aHora(minutos: number): string {
  const m = ((minutos % DIA) + DIA) % DIA;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export const es24Horas = (r: Pick<RangoDelivery, 'hora_inicio' | 'hora_fin'>) =>
  aMinutos(r.hora_inicio) === 0 && aMinutos(r.hora_fin) === DIA;

/** Intervalo [inicio, fin) en minutos desde el inicio del día del rango. */
function intervalo(r: Pick<RangoDelivery, 'hora_inicio' | 'hora_fin'>): [number, number] {
  const inicio = aMinutos(r.hora_inicio);
  let fin = aMinutos(r.hora_fin);
  if (fin <= inicio) fin += DIA; // cruza la medianoche
  return [inicio, fin];
}

/** Todos los intervalos de la semana en minutos desde el lunes 00:00 (con vuelta de domingo a lunes). */
function intervalosSemana(rangos: RangoDelivery[]): Array<[number, number]> {
  const lista: Array<[number, number]> = [];
  for (const r of rangos) {
    const [i, f] = intervalo(r);
    if (Number.isNaN(i) || Number.isNaN(f)) continue;
    const base = r.dia_semana * DIA;
    lista.push([base + i, base + f]);
    // Copias de la semana anterior y siguiente: un rango del domingo que cruza
    // la medianoche sigue el lunes, y el domingo a la noche puede encadenar
    // con el lunes a la madrugada.
    lista.push([base + i - 7 * DIA, base + f - 7 * DIA]);
    lista.push([base + i + 7 * DIA, base + f + 7 * DIA]);
  }
  return lista;
}

export type EstadoDelivery =
  | { estado: 'sin_delivery' }
  | { estado: 'activo'; hasta: string | null } // hasta = null → 24 hs sin corte
  | { estado: 'mas_tarde'; desde: string } // empieza más tarde ese mismo día
  | { estado: 'inactivo' };

/** Estado del delivery en un momento (día y minuto en Argentina). */
export function estadoDeliveryEn(rangos: RangoDelivery[], momento: MomentoArgentina): EstadoDelivery {
  if (!rangos.length) return { estado: 'sin_delivery' };
  const ahora = momento.dia * DIA + momento.minutos;
  const lista = intervalosSemana(rangos);

  const activos = lista.filter(([i, f]) => i <= ahora && ahora < f);
  if (activos.length) {
    // Encadenar rangos pegados o superpuestos (ej. 20:00–24:00 + 00:00–02:00)
    let fin = Math.max(...activos.map(([, f]) => f));
    for (let vuelta = 0; vuelta < 30; vuelta++) {
      const siguiente = lista.filter(([i, f]) => i <= fin && f > fin);
      if (!siguiente.length) break;
      fin = Math.max(...siguiente.map(([, f]) => f));
      if (fin - ahora >= 7 * DIA) return { estado: 'activo', hasta: null };
    }
    return { estado: 'activo', hasta: aHora(fin) };
  }

  const finDelDia = (momento.dia + 1) * DIA;
  const proximos = lista.filter(([i]) => i > ahora && i < finDelDia).map(([i]) => i);
  if (proximos.length) return { estado: 'mas_tarde', desde: aHora(Math.min(...proximos)) };
  return { estado: 'inactivo' };
}

/** Estado del delivery en un instante real (por defecto, ahora). */
export const estadoDelivery = (rangos: RangoDelivery[], fecha: Date = new Date()) =>
  estadoDeliveryEn(rangos, momentoArgentina(fecha));

/** Texto de la etiqueta de la tarjeta, o null si no corresponde mostrar nada. */
export function textoEstadoDelivery(estado: EstadoDelivery): string | null {
  switch (estado.estado) {
    case 'activo':
      return estado.hasta ? `Delivery activo hasta las ${estado.hasta}` : 'Delivery activo las 24 hs';
    case 'mas_tarde':
      return `Delivery desde las ${estado.desde}`;
    default:
      return null;
  }
}

// ─── Validación del formulario ──────────────────────────────────────────

export interface ErrorRango {
  indice: number;
  mensaje: string;
}

/** Valida los rangos de UN día. Devuelve un error por rango con problemas. */
export function validarRangosDelDia(rangos: Array<Pick<RangoDelivery, 'hora_inicio' | 'hora_fin'>>): ErrorRango[] {
  const errores: ErrorRango[] = [];
  rangos.forEach((r, indice) => {
    const okInicio = PATRON_HORA.test(r.hora_inicio);
    const okFin = PATRON_HORA.test(r.hora_fin) || /^24:00(:00)?$/.test(r.hora_fin);
    if (!okInicio || !okFin) {
      errores.push({ indice, mensaje: 'Usá el formato HH:MM (por ejemplo 20:30).' });
    } else if (aMinutos(r.hora_inicio) === aMinutos(r.hora_fin)) {
      errores.push({ indice, mensaje: 'La hora de inicio y la de fin no pueden ser iguales (para todo el día usá "24 hs").' });
    }
  });
  if (errores.length) return errores;

  const intervalos = rangos.map(intervalo);
  for (let a = 0; a < intervalos.length; a++) {
    for (let b = a + 1; b < intervalos.length; b++) {
      const [ia, fa] = intervalos[a];
      const [ib, fb] = intervalos[b];
      if (ia < fb && ib < fa) {
        errores.push({ indice: b, mensaje: `Se superpone con el rango ${rangos[a].hora_inicio.slice(0, 5)}–${rangos[a].hora_fin.slice(0, 5)}.` });
      }
    }
  }
  return errores;
}

interface TurnoLocal {
  dia_semana: number;
  hora_apertura: string;
  hora_cierre: string;
  activo?: boolean;
}

/**
 * ¿El rango de delivery queda (aunque sea en parte) fuera del horario de
 * atención del local? Solo es un aviso: se permite igual.
 */
export function fueraDelHorarioDelLocal(rango: RangoDelivery, turnos: TurnoLocal[]): boolean {
  const locales = intervalosSemana(
    turnos
      .filter((t) => t.activo !== false)
      .map((t) => ({ dia_semana: Number(t.dia_semana), hora_inicio: t.hora_apertura, hora_fin: t.hora_cierre })),
  );
  const [desde, hasta] = intervalosSemana([rango])[0];
  // Recorre minuto a minuto (como mucho 1440): simple y exacto
  for (let m = desde; m < hasta; m++) {
    if (!locales.some(([i, f]) => i <= m && m < f)) return true;
  }
  return false;
}
