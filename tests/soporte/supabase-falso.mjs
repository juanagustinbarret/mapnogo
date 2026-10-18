// Doble de Supabase: registra las llamadas y responde lo que diga el test.
export const llamadas = [];
export const respuestas = { upsert: { error: null }, delete: { error: null } };

export const supabase = {
  from(tabla) {
    return {
      upsert(fila, opciones) {
        llamadas.push({ tabla, operacion: 'upsert', fila, opciones });
        return Promise.resolve(respuestas.upsert);
      },
      delete() {
        return {
          eq(columna, valor) {
            llamadas.push({ tabla, operacion: 'delete', columna, valor });
            return Promise.resolve(respuestas.delete);
          },
        };
      },
    };
  },
};

export function reiniciar() {
  llamadas.length = 0;
  respuestas.upsert = { error: null };
  respuestas.delete = { error: null };
}
