// Registra el cargador que permite correr los tests con node:test sin
// dependencias extra: resuelve el alias "@/..." y reemplaza Supabase por un doble.
import { register } from 'node:module';

register('./cargador.mjs', import.meta.url);
