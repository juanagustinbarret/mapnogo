import { responderAlertas } from '../src/lib/alertasSmn';

export const config = { runtime: 'edge' };

export default function handler(): Promise<Response> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  return responderAlertas({ url, anonKey });
}