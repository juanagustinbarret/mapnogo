// Doble de Supabase: registra las llamadas y responde lo que diga el test.
// Nunca se conecta a la base real.
export const llamadas = [];
export const respuestas = { upsert: { error: null }, delete: { error: null }, insert: { error: null }, rpc: { error: null } };
// Filas en memoria por tabla, para los conteos (select con count/head)
export const tablas = {};

function consultaDeConteo(tabla) {
  const filtros = [];
  const consulta = {
    eq(col, val) {
      filtros.push((f) => f[col] === val);
      return consulta;
    },
    gte(col, val) {
      filtros.push((f) => new Date(f[col]).getTime() >= new Date(val).getTime());
      return consulta;
    },
    lt(col, val) {
      filtros.push((f) => new Date(f[col]).getTime() < new Date(val).getTime());
      return consulta;
    },
    then(resolver, rechazar) {
      llamadas.push({ tabla, operacion: 'count', filtros: filtros.length });
      const count = (tablas[tabla] ?? []).filter((f) => filtros.every((ok) => ok(f))).length;
      return Promise.resolve({ count, error: null }).then(resolver, rechazar);
    },
  };
  return consulta;
}

export const supabase = {
  from(tabla) {
    return {
      upsert(fila, opciones) {
        llamadas.push({ tabla, operacion: 'upsert', fila, opciones });
        return Promise.resolve(respuestas.upsert);
      },
      insert(fila) {
        llamadas.push({ tabla, operacion: 'insert', fila });
        return Promise.resolve(respuestas.insert);
      },
      delete() {
        return {
          eq(columna, valor) {
            llamadas.push({ tabla, operacion: 'delete', columna, valor });
            return Promise.resolve(respuestas.delete);
          },
        };
      },
      select() {
        return consultaDeConteo(tabla);
      },
    };
  },
  rpc(nombre, parametros) {
    llamadas.push({ operacion: 'rpc', nombre, parametros });
    return Promise.resolve(respuestas.rpc);
  },
};

export function reiniciar() {
  llamadas.length = 0;
  respuestas.upsert = { error: null };
  respuestas.delete = { error: null };
  respuestas.insert = { error: null };
  respuestas.rpc = { error: null };
  for (const clave of Object.keys(tablas)) delete tablas[clave];
}
