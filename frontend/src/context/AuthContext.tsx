import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../services/api';

export interface User {
  name: string;
  email: string;
  id?: string;
  role?: string;
}

interface AuthContextData {
  signed: boolean;
  user: User | null;
  loading: boolean;
  signIn: (userData: User, token: string) => void; // Agora aceita o token
  signOut: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStorageData = async () => {
      const storagedUser = localStorage.getItem('@BlazeAnalytics:user');
      const storagedToken = localStorage.getItem('@BlazeAnalytics:token');

      if (storagedUser && storagedToken) {
        api.defaults.headers.common['Authorization'] = `Bearer ${storagedToken}`;
        setUser(JSON.parse(storagedUser));
      }
      setLoading(false);
    };

    loadStorageData();
  }, []);

  // CORREÇÃO: Recebe 'token' como argumento e usa o valor real
  const signIn = useCallback((userData: User, token: string) => {
    setUser(userData);
    
    // Configura o Axios para usar este token em todas as próximas requisições
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    localStorage.setItem('@BlazeAnalytics:user', JSON.stringify(userData));
    localStorage.setItem('@BlazeAnalytics:token', token);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem('@BlazeAnalytics:user');
    localStorage.removeItem('@BlazeAnalytics:token');
    api.defaults.headers.common['Authorization'] = undefined;
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ signed: !!user, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}