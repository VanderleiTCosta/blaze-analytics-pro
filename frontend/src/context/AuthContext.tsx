import React, { createContext, useState, useContext } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';

interface AuthContextData {
  signed: boolean;
  user: object | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // CORREÇÃO 2: Inicializa o estado lendo diretamente do storage (Lazy Initialization)
  // Isso evita o uso de useEffect para carregar dados síncronos, corrigindo o erro de renderização em cascata.
  const [user, setUser] = useState<object | null>(() => {
    const storagedToken = localStorage.getItem('@BlazeAuth:token');
    const storagedUser = localStorage.getItem('@BlazeAuth:user');

    if (storagedToken && storagedUser) {
      api.defaults.headers.common['Authorization'] = `Bearer ${storagedToken}`;
      return JSON.parse(storagedUser);
    }
    return null;
  });

  // Como o storage é síncrono, não precisamos começar com loading true
  const [loading, setLoading] = useState(false);

  async function login(email: string, password: string) {
    try {
      setLoading(true);
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      const { token, user: userData } = response.data;

      localStorage.setItem('@BlazeAuth:token', token);
      
      // Garante que temos um objeto de usuário para salvar
      const userToSave = userData || { email };
      localStorage.setItem('@BlazeAuth:user', JSON.stringify(userToSave));

      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userToSave);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('@BlazeAuth:token');
    localStorage.removeItem('@BlazeAuth:user');
  }

  return (
    <AuthContext.Provider value={{ signed: !!user, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// CORREÇÃO 3: Desabilita o aviso do ESLint para exportação de hook junto com componente
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  return context;
}