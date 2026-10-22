import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/database.types';
import { borrarCachePanel, mismoUsuario } from '@/lib/datosPanel';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Id del usuario cuyo perfil ya se pidió (o se está pidiendo)
  const perfilPedido = useRef<string | null>(null);

  useEffect(() => {
    // Supabase avisa "SIGNED_IN" cada vez que la pestaña vuelve a estar
    // visible (GoTrueClient._recoverAndRefresh) y "TOKEN_REFRESHED" cada hora,
    // siempre con un objeto `user` nuevo aunque sea la misma persona. Antes eso
    // cambiaba `user` y los paneles (que dependen de él) volvían a cargar todo
    // desde cero, pisando lo que se estaba editando. Ahora `user` solo cambia
    // si cambia la persona, y el perfil se pide una vez por usuario.
    const aplicarSesion = (session: Session | null) => {
      const nuevo = session?.user ?? null;
      setUser((anterior) => (mismoUsuario(anterior, nuevo) ? anterior : nuevo));
      if (!nuevo) {
        perfilPedido.current = null;
        setProfile(null);
        setLoading(false);
        return;
      }
      if (perfilPedido.current === nuevo.id) return;
      perfilPedido.current = nuevo.id;
      fetchProfile(nuevo.id);
    };

    supabase.auth.getSession().then(({ data: { session } }) => aplicarSesion(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => aplicarSesion(session));

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error al cargar perfil:', err);
      // Que se pueda reintentar en el próximo aviso de sesión
      if (perfilPedido.current === userId) perfilPedido.current = null;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    borrarCachePanel();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};