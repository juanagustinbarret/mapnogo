// src/services/linksRecuperacion.ts
//
// Crea el link de recuperación de contraseña de un comercio. Antes este
// código estaba copiado en el panel de admin y en la página de Solicitudes.
// La validación del token y el cambio de contraseña están en la base
// (función admin_cambiar_password_comercio) y no se tocan desde acá.

import { supabase } from '@/lib/supabase';
import { MINUTOS_VALIDEZ_LINK, generarToken, linkDeRecuperacion, patronEmailExacto } from '@/lib/linksRecuperacion';

export interface ComercioDestino {
  id: string;
  nombre?: string | null;
  email_comercial?: string | null;
  whatsapp?: string | null;
}

/**
 * Comercio por email, sin importar mayúsculas: los pedidos se guardan en
 * minúsculas, pero un email editado desde el panel puede tener mayúsculas.
 */
export async function buscarComercioPorEmail(email: string): Promise<ComercioDestino | null> {
  const { data, error } = await supabase
    .from('comercios')
    .select('id, nombre, email_comercial, whatsapp')
    .ilike('email_comercial', patronEmailExacto(email))
    .limit(2);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  if (data.length > 1) throw new Error(`Hay más de un comercio con el email ${email}. Corregilo en el panel antes de mandar el link.`);
  return data[0] as ComercioDestino;
}

/** Crea el token (vale 15 minutos) y devuelve el link para mandar. */
export async function crearLinkRecuperacion(comercioId: string): Promise<string> {
  const token = generarToken();
  const { error } = await supabase.from('tokens_recuperacion_password').insert({
    comercio_id: comercioId,
    token,
    // La base puede fijar el vencimiento con su propio reloj (ver supabase/propuestas/20261020_revision_tokens_recuperacion.sql, 2.c)
    expira_en: new Date(Date.now() + MINUTOS_VALIDEZ_LINK * 60_000).toISOString(),
  });
  if (error) throw new Error(`No se pudo generar el link: ${error.message}`);
  return linkDeRecuperacion(window.location.origin, token);
}
