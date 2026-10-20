import { supabase } from '@/lib/supabase';

export async function solicitarRecuperacionPassword(email: string): Promise<boolean> {
  const emailLimpio = email.trim().toLowerCase();

  if (!emailLimpio || !emailLimpio.includes('@')) {
    throw new Error('Ingresá un correo electrónico válido.');
  }

  // Verificar si ya existe una solicitud pendiente reciente para evitar spam
  const { data: existente } = await supabase
    .from('solicitudes_recuperacion')
    .select('id')
    .eq('email', emailLimpio)
    .eq('estado', 'pendiente')
    .maybeSingle();

  if (existente) {
    throw new Error('Ya tenés una solicitud pendiente. Los administradores la revisarán a la brevedad.');
  }

  const { error } = await supabase
    .from('solicitudes_recuperacion')
    .insert({
      email: emailLimpio,
      estado: 'pendiente'
    });

  if (error) {
    console.error('Error al solicitar recuperación:', error);
    throw new Error('No se pudo registrar la solicitud. Intentá de nuevo más tarde.');
  }

  return true;
}