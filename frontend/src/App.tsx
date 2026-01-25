import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminPanel from './pages/AdminPanel';
import { AuthProvider, useAuth } from './context/AuthContext';

// CORREÇÃO: Define a interface do usuário para evitar 'any'
interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

// Componente para proteger rotas privadas
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { signed, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-slate-950 text-white">Carregando...</div>;
  }

  return signed ? <>{children}</> : <Navigate to="/" replace />;
};

// Componente Exclusivo para Admin
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { signed, loading, user } = useAuth();

  if (loading) return <div>Carregando...</div>;

  // CORREÇÃO: Type assertion seguro
  const currentUser = user as User | null;

  // Verifica se está logado E se é admin
  if (signed && currentUser?.role === 'admin') {
    return <>{children}</>;
  }

  // Se não for admin, manda pro dashboard normal ou login
  return signed ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />

          {/* ROTA ADMIN PROTEGIDA */}
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            } 
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;