import { createClient } from '@supabase/supabase-js';

const meta = import.meta as any;

const supabaseUrl = meta.env?.VITE_SUPABASE_URL || 'https://graipurciaipsoonmtqk.supabase.co';
const supabaseAnonKey = meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyYWlwdXJjaWFpcHNvb25tdHFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MjI3MzQsImV4cCI6MjEwNzM5ODczNH0.reHxsRdjboBzIP71BNwzaClzG0XxAARiECRI4t1_ZFs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});