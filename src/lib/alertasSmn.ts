// src/lib/alertasSmn.ts
//
// Alertas meteorológicas oficiales del SMN para Nogoyá.
//
// El SMN corta con 429 si se le piden muchos XML seguidos, así que nadie los
// pide en cada visita: la Edge Function alertas-smn (cron cada 10 minutos) los
// baja despacio y guarda en Supabase los que tocan a Nogoyá. /api/alertas lee
// de ahí y filtra por vigencia. La lectura del CAP está en
// supabase/functions/_shared/capSmn.ts.

import { vigentes, type AlertaSmn } from '../../supabase/functions/_shared/capSmn';

export { HORAS_PROXIMAS_ALERTAS, filtrarAlertas, type AlertaSmn, type NivelAlerta } from '../../supabase/functions/_shared/capSmn';

export const URL_ALERTAS_SMN = 'https://www.smn.gob.ar/alertas';
export const ENDPOINT_ALERTAS = '/api/alertas';
// Si el cron no actualizó en este tiempo, las alertas guardadas no son confiables
export const MINUTOS_MAXIMOS_SIN_CRON = 30;

export interface RespuestaAlertas {
  alertas: AlertaSmn[];
  consultado: string; // ISO: última vuelta del cron
  completo: boolean; // el cron leyó todos los XML del SMN
}

const HORA_AR = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DIA_AR = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short', day: 'numeric' });
const FECHA_AR = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

/** "hoy 15:00 a 20:59", "hoy 21:00 a vie 23 02:59" (hora argentina). */
export function textoVigencia(alerta: Pick<AlertaSmn, 'inicio' | 'fin'>, ahora: Date = new Date()): string {
  const hoy = FECHA_AR.format(ahora);
  const inicio = new Date(alerta.inicio);
  const fin = new Date(alerta.fin);
  const dia = (d: Date) => (FECHA_AR.format(d) === hoy ? 'hoy' : DIA_AR.format(d));
  const mismoDia = FECHA_AR.format(inicio) === FECHA_AR.format(fin);
  return `${dia(inicio)} ${HORA_AR.format(inicio)} a ${mismoDia ? '' : `${dia(fin)} `}${HORA_AR.format(fin)}`;
}

/**
 * Lo que hace la función /api/alertas: lee de Supabase lo que guardó el cron
 * y devuelve las alertas de Nogoyá vigentes o próximas. Responde 502 (nunca
 * "sin alertas") si el cron no está al día, o si su última vuelta quedó
 * incompleta y no hay ninguna alerta para mostrar.
 */
export async function responderAlertas(
  supabase: { url?: string; anonKey?: string },
  pedirFetch: typeof fetch = fetch,
  ahora: Date = new Date(),
): Promise<Response> {
  const cabeceras = { 'Content-Type': 'application/json; charset=utf-8' };
  try {
    if (!supabase.url || !supabase.anonKey) throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
    const leer = async (ruta: string) => {
      const r = await pedirFetch(`${supabase.url}/rest/v1/${ruta}`, {
        headers: { apikey: supabase.anonKey!, Authorization: `Bearer ${supabase.anonKey}` },
      });
      if (!r.ok) throw new Error(`Supabase respondió ${r.status} (${ruta.split('?')[0]})`);
      return r.json();
    };
    const [estados, filas] = await Promise.all([
      leer('alertas_smn_estado?select=actualizado_at,completo&id=eq.1') as Promise<{ actualizado_at: string; completo: boolean }[]>,
      leer('alertas_smn_xml?select=alerta&en_nogoya=eq.true') as Promise<{ alerta: AlertaSmn | null }[]>,
    ]);
    const estado = estados?.[0];
    if (!estado || ahora.getTime() - Date.parse(estado.actualizado_at) > MINUTOS_MAXIMOS_SIN_CRON * 60_000) {
      throw new Error('El cron de alertas del SMN no está al día');
    }
    const alertas = vigentes(filas.map((f) => f.alerta).filter((a): a is AlertaSmn => !!a), ahora);
    if (!estado.completo && alertas.length === 0) throw new Error('La última lectura del SMN quedó incompleta');
    const cuerpo: RespuestaAlertas = { alertas, consultado: estado.actualizado_at, completo: estado.completo };
    return new Response(JSON.stringify(cuerpo), {
      headers: { ...cabeceras, 'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('[alertas]', error);
    return new Response(JSON.stringify({ error: 'No se pudieron consultar las alertas del SMN' }), {
      status: 502,
      headers: { ...cabeceras, 'Cache-Control': 'no-store' },
    });
  }
}
