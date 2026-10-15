import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/database.types';

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
  // Evita recargar el perfil si el usuario no cambió (por ejemplo, al refrescar el token)
  const perfilCargadoPara = useRef<string | null>(null);

  useEffect(() => {
    let activo = true;

    const cargarPerfil = async (userId: string) => {
      // Mientras se carga el perfil, la app sigue "cargando": así la ruta
      // protegida no redirige antes de saber el rol (carrera del login).
      setLoading(true);
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!activo) return;
      if (error) console.error('Error al cargar perfil:', error);
      setProfile(data ?? null);
      perfilCargadoPara.current = userId;
      setLoading(false);
    };

    // onAuthStateChange emite INITIAL_SESSION al suscribirse, así que no hace
    // falta llamar además a getSession().
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nuevoUsuario = session?.user ?? null;
      setUser(nuevoUsuario);

      if (!nuevoUsuario) {
        perfilCargadoPara.current = null;
        setProfile(null);
        setLoading(false);
        return;
      }

      if (perfilCargadoPara.current !== nuevoUsuario.id) {
        // Se difiere para no llamar a Supabase dentro del callback de auth
        setLoading(true);
        setTimeout(() => void cargarPerfil(nuevoUsuario.id), 0);
      }
    });

    return () => {
      activo = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
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
