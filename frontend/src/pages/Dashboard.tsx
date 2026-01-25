import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Flame, LogOut, TrendingUp, Activity, ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardData {
  history: {
    id: number;
    result: string; // 'vermelho', 'preto', 'branco'
    number: number;
    created_at: string;
  }[];
  stats: {
    redCount: number;
    blackCount: number;
    whiteCount: number;
    redPercentage: number;
    blackPercentage: number;
    whitePercentage: number;
  };
  analysis: {
    prediction: {
      suggestion: 'red' | 'black' | 'white' | 'wait';
      confidence: number;
      reason: string;
      strategies: { name: string; active: boolean }[];
    };
    lastUpdate: string;
  };
}

interface User {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { logout, user } = useAuth();
  
  const currentUser = user as User | null;

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await api.get<DashboardData>('/api/history');
      setData(response.data);
    } catch (err) {
      console.error('Erro API:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchData().then(() => { if (!isMounted) return; });
    const interval = setInterval(fetchData, 3000); // Atualiza a cada 3s
    return () => { 
      isMounted = false;
      clearInterval(interval); 
    };
  }, [fetchData]);

  const getColorClass = (result: string) => {
    if (result === 'vermelho') return 'bg-rose-600 text-white border-rose-800';
    if (result === 'preto') return 'bg-slate-800 text-white border-slate-700';
    return 'bg-white text-slate-900 border-slate-300';
  };

  const getSuggestionText = (sug: string) => {
    if (sug === 'red') return 'VERMELHO';
    if (sug === 'black') return 'PRETO';
    if (sug === 'white') return 'BRANCO';
    return 'AGUARDE';
  };

  const getSuggestionStyles = (sug: string) => {
    if (sug === 'red') return { border: 'border-rose-600', text: 'text-rose-500', shadow: 'shadow-rose-900/50' };
    if (sug === 'black') return { border: 'border-slate-500', text: 'text-white', shadow: 'shadow-slate-900/50' };
    return { border: 'border-slate-800', text: 'text-slate-500', shadow: 'shadow-none' };
  };

  const suggestionStyle = data ? getSuggestionStyles(data.analysis.prediction.suggestion) : { border: '', text: '', shadow: '' };

  if (!data) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white"><Activity className="w-10 h-10 animate-spin mb-4 text-emerald-500" /><p>Conectando ao Blaze Analytics...</p></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-rose-500/30">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-800 px-6 py-4 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-rose-600 blur-lg rounded-full opacity-50"
            />
            <Flame className="text-rose-500 w-8 h-8 relative z-10" fill="currentColor" />
          </div>
          <span className="font-black text-2xl tracking-tighter hidden sm:inline bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            BLAZE ANALYTICS <span className="text-rose-500">PRO</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-200">{currentUser?.name || 'Usuário'}</p>
            <div className="flex items-center justify-end gap-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Online</p>
            </div>
          </div>
          <button 
            onClick={logout} 
            className="p-3 bg-slate-800 hover:bg-rose-950 hover:text-rose-500 rounded-xl transition-all border border-slate-700 hover:border-rose-900 group"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
        
        {/* Histórico Live */}
        <section className="bg-slate-900 rounded-3xl p-1 border border-slate-800/50 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-24 h-full bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none" />
          <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none" />
          
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50 bg-slate-900/50">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-500" /> Histórico em Tempo Real
            </h2>
            <div className="flex items-center gap-3">
              <AnimatePresence>
                {isRefreshing && (
                  <motion.span 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] text-rose-400 font-bold flex items-center gap-1"
                  >
                    <Activity className="w-3 h-3 animate-spin" /> SYNC
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto p-4 no-scrollbar items-center justify-end">
            {/* INVERSÃO DA LISTA: slice().reverse() transforma [Novo, Velho] em [Velho, Novo] para desenhar da esquerda p/ direita */}
            {data.history.slice().reverse().map((item, i) => (
              <motion.div 
                key={`${item.id}-${i}`}
                initial={{ scale: 0, x: 20 }} // Anima vindo da direita
                animate={{ scale: 1, x: 0 }}
                className={`
                  flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center 
                  font-black text-sm shadow-lg border-b-4 
                  ${getColorClass(item.result)}
                  ${i === data.history.length - 1 ? 'ring-4 ring-rose-500/20 scale-110 z-20' : 'opacity-80 hover:opacity-100'}
                `}
              >
                {item.result === 'branco' ? <div className="w-3 h-3 bg-slate-900 rounded-full"/> : item.number}
              </motion.div>
            ))}
          </div>
        </section>

        {/* Grid Principal - IA e Dados */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* SINAL DA IA */}
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-[2.5rem] p-8 border border-slate-700 shadow-2xl relative overflow-hidden">
            <div className="relative z-10 h-full flex flex-col justify-between">
              
              {/* Header do Card */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full animate-ping ${data.analysis.prediction.suggestion === 'wait' ? 'bg-yellow-500' : 'bg-emerald-500'}`} />
                    <h3 className="text-slate-200 font-black text-xl tracking-tight">STATUS DA IA</h3>
                  </div>
                  <p className="text-sm text-slate-400 font-medium">{data.analysis.prediction.reason}</p>
                </div>
                <div className="bg-slate-950/50 backdrop-blur px-4 py-2 rounded-xl border border-slate-700 flex flex-col items-end">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Confiança</span>
                  <span className={`text-xl font-black ${data.analysis.prediction.confidence > 80 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                    {Math.round(data.analysis.prediction.confidence)}%
                  </span>
                </div>
              </div>
              
              {/* Corpo do Card (Bola e Estratégia) */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-10">
                
                {/* Bola Gigante com a Sugestão */}
                <div className="relative">
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className={`absolute inset-0 rounded-full blur-2xl ${data.analysis.prediction.suggestion === 'wait' ? 'bg-transparent' : 'bg-current'} ${suggestionStyle.text}`}
                  />
                  <div className={`
                    w-48 h-48 rounded-full border-8 flex flex-col items-center justify-center relative bg-slate-900 shadow-2xl transition-all duration-500
                    ${suggestionStyle.border} ${suggestionStyle.shadow}
                  `}>
                    <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-black mb-2">Entrada</span>
                    <span className={`text-3xl font-black uppercase tracking-tighter ${suggestionStyle.text}`}>
                      {getSuggestionText(data.analysis.prediction.suggestion)}
                    </span>
                    {data.analysis.prediction.suggestion !== 'wait' && (
                      <div className="mt-2 px-2 py-1 bg-white/5 rounded text-[9px] text-slate-400 uppercase font-bold flex items-center gap-1">
                        <ShieldCheck size={10} /> Proteção Branco
                      </div>
                    )}
                  </div>
                </div>

                {/* Lista de Estratégias */}
                <div className="flex-1 w-full space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Gestão Recomendada</h4>
                  <div className="space-y-3">
                    {data.analysis.prediction.strategies.length > 0 ? (
                      data.analysis.prediction.strategies.map((s, i) => (
                        <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${s.active ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-slate-800/30 border-slate-700 opacity-50'}`}>
                          <span className={`text-sm font-bold ${s.active ? 'text-emerald-400' : 'text-slate-500'}`}>{s.name}</span>
                          <div className={`w-3 h-3 rounded-full ${s.active ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`} />
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-slate-600 text-sm py-4 italic border border-dashed border-slate-800 rounded-xl">
                        Aguardando formação de padrão...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ESTATÍSTICAS */}
          <div className="bg-slate-900 rounded-[2rem] p-6 border border-slate-800 shadow-xl flex flex-col justify-between">
            <h3 className="text-slate-400 font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-rose-500" /> Tendência (100x)
            </h3>
            
            <div className="space-y-6">
              {[
                { label: 'Vermelhos', count: data.stats.redCount, pct: data.stats.redPercentage, color: 'bg-rose-600' },
                { label: 'Pretos', count: data.stats.blackCount, pct: data.stats.blackPercentage, color: 'bg-slate-400' },
                { label: 'Brancos', count: data.stats.whiteCount, pct: data.stats.whitePercentage, color: 'bg-white' }
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs text-slate-400 font-bold">{stat.label}</span>
                    <span className="text-xl font-black text-white">{stat.count}</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.pct}%` }}
                      transition={{ duration: 1 }}
                      className={`${stat.color} h-full`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-6 border-t border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <AlertCircle className="w-4 h-4" />
                    <span>Dados baseados nas últimas 100 rodadas.</span>
                </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;