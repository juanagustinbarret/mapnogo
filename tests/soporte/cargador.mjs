// Hooks de módulos de Node para los tests.
//  - "@/lib/supabase" o "./supabase" desde src/lib → doble de prueba
//    (nunca se conecta a la base real)
//  - "@/..."          → src/... (con extensión .ts)
//  - import.meta.env  → objeto vacío (en Vite lo completa el bundler)
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = new URL('../../', import.meta.url);

export async function resolve(especificador, contexto, siguiente) {
  const esSupabase =
    especificador === '@/lib/supabase' ||
    (especificador === './supabase' && contexto.parentURL?.includes('/src/lib/'));
  if (esSupabase) {
    return { url: new URL('tests/soporte/supabase-falso.mjs', raiz).href, shortCircuit: true };
  }
  if (especificador.startsWith('@/')) {
    const base = new URL(`src/${especificador.slice(2)}`, raiz);
    for (const extension of ['.ts', '.tsx', '/index.ts']) {
      const candidato = fileURLToPath(base) + extension;
      if (existsSync(candidato)) return { url: pathToFileURL(candidato).href, shortCircuit: true };
    }
  }
  return siguiente(especificador, contexto);
}

export async function load(url, contexto, siguiente) {
  const resultado = await siguiente(url, contexto);
  if (url.includes('/src/') && resultado.source) {
    const fuente = resultado.source.toString().replaceAll('import.meta.env', '(globalThis.__ENV__ ?? {})');
    return { ...resultado, source: fuente };
  }
  return resultado;
}
