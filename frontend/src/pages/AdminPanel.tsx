import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Trash2, Edit, Plus, Save, Shield, Lock, Users, CalendarCheck } from 'lucide-react';
import { AxiosError } from 'axios';

interface UserData {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  expiration_date: string | null; // Novo campo
}

interface ApiError {
  message: string;
}

const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'profile'>('users');
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ id: 0, name: '', email: '', password: '', role: 'user' as 'admin' | 'user' });
  const [profilePassword, setProfilePassword] = useState({ current: '', new: '', confirm: '' });

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (err) {
      console.error("Erro ao buscar usuários:", err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (activeTab === 'users') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchUsers().then(() => { if (!isMounted) console.log('Dismounted'); });
    }
    return () => { isMounted = false; };
  }, [activeTab, fetchUsers]);

  // Função para formatar data
  const formatDate = (dateString: string | null) => {
    if (!dateString) return <span className="text-rose-500 font-bold">Expirado/Inativo</span>;
    const date = new Date(dateString);
    const now = new Date();
    const isExpired = now > date;
    
    return (
      <span className={isExpired ? 'text-rose-500 font-bold' : 'text-emerald-400 font-bold'}>
        {date.toLocaleDateString()} {isExpired && '(EXP)'}
      </span>
    );
  };

  // ✅ Função para Renovar Assinatura
  const handleRenewUser = async (id: number) => {
    if (!window.confirm('Confirmar renovação de 30 dias para este usuário?')) return;
    try {
      await api.post(`/admin/users/${id}/renew`, { days: 30 });
      await fetchUsers(); // Atualiza a lista na hora
      alert('Assinatura renovada com sucesso!');
    } catch (error) {
      const err = error as AxiosError<ApiError>;
      alert(err.response?.data?.message || 'Erro ao renovar');
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && formData.id) {
        await api.put(`/admin/users/${formData.id}`, formData);
      } else {
        await api.post('/admin/users', formData);
      }
      setFormData({ id: 0, name: '', email: '', password: '', role: 'user' });
      setIsEditing(false);
      await fetchUsers();
      alert('Operação realizada com sucesso!');
    } catch (error) {
      const err = error as AxiosError<ApiError>;
      alert(err.response?.data?.message || 'Erro ao salvar usuário');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja deletar este usuário?')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      await fetchUsers();
    } catch (error) {
      const err = error as AxiosError<ApiError>;
      alert(err.response?.data?.message || 'Erro ao deletar');
    }
  };

  const handleUpdateOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profilePassword.new !== profilePassword.confirm) return alert('Novas senhas não conferem');
    try {
      await api.put('/auth/me/password', {
        currentPassword: profilePassword.current,
        newPassword: profilePassword.new
      });
      alert('Sua senha foi atualizada!');
      setProfilePassword({ current: '', new: '', confirm: '' });
    } catch (error) {
      const err = error as AxiosError<ApiError>;
      alert(err.response?.data?.message || 'Erro ao mudar senha');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
              Painel Administrativo
            </h1>
            <p className="text-slate-400 mt-1">Gestão SaaS e Controle de Acesso</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-lg flex items-center gap-2 font-bold transition-colors ${activeTab === 'users' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              <Users size={18} /> Usuários
            </button>
            <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 rounded-lg flex items-center gap-2 font-bold transition-colors ${activeTab === 'profile' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              <Lock size={18} /> Segurança
            </button>
          </div>
        </header>

        {activeTab === 'users' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 h-fit">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                {isEditing ? <Edit size={20} className="text-yellow-500"/> : <Plus size={20} className="text-emerald-500"/>}
                {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <form onSubmit={handleSaveUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nome</label>
                  <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Email</label>
                  <input type="email" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">{isEditing ? 'Nova Senha (opcional)' : 'Senha'}</label>
                  <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required={!isEditing} placeholder={isEditing ? "******" : "Senha forte"} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Função</label>
                  <select className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}>
                    <option value="user">Usuário Comum</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  {isEditing && (
                    <button type="button" onClick={() => { setIsEditing(false); setFormData({ id: 0, name: '', email: '', password: '', role: 'user' }); }} className="flex-1 bg-slate-800 text-slate-300 py-3 rounded-lg font-bold hover:bg-slate-700 transition-colors">Cancelar</button>
                  )}
                  <button type="submit" className="flex-1 bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"><Save size={18} /> Salvar</button>
                </div>
              </form>
            </div>

            <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-xl font-bold">Gerenciamento de Assinaturas</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-bold text-left">
                    <tr>
                      <th className="p-4">Cliente</th>
                      <th className="p-4">Vencimento</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold">{u.name}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </td>
                        <td className="p-4 text-sm">{formatDate(u.expiration_date)}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-700/50 text-slate-400'}`}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 flex justify-end gap-2">
                          <button onClick={() => handleRenewUser(u.id)} className="p-2 bg-emerald-900/30 hover:bg-emerald-600/50 text-emerald-400 rounded transition-colors" title="Renovar +30 Dias">
                            <CalendarCheck size={18} />
                          </button>
                          <button onClick={() => { setIsEditing(true); setFormData({ ...u, password: '' }); }} className="p-2 hover:bg-slate-700 rounded text-yellow-500" title="Editar">
                            <Edit size={18} />
                          </button>
                          <button onClick={() => handleDeleteUser(u.id)} className="p-2 hover:bg-rose-900/30 rounded text-rose-500" title="Excluir" disabled={u.id === (user && 'id' in user ? user.id : undefined)}>
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto bg-slate-900 p-8 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Shield className="text-emerald-500" /> Segurança</h2>
            <form onSubmit={handleUpdateOwnPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Senha Atual</label>
                <input type="password" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none" value={profilePassword.current} onChange={e => setProfilePassword({ ...profilePassword, current: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nova Senha</label>
                <input type="password" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none" value={profilePassword.new} onChange={e => setProfilePassword({ ...profilePassword, new: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Confirmar</label>
                <input type="password" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none" value={profilePassword.confirm} onChange={e => setProfilePassword({ ...profilePassword, confirm: e.target.value })} required />
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition-colors mt-4">Atualizar Senha</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;