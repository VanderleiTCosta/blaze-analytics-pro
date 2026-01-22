import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Flame, LogOut, TrendingUp, Activity, ShieldCheck, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BlazeResult {
    color: 'red' | 'black' | 'white';
    value: number;
    timestamp: string;
}

interface Strategy {
    name: string;
    active: boolean;
}

interface Analysis {
    stats: {
        redCount: number;
        blackCount: number;
        whiteCount: number;
        maxStreak: number;
        streakColor: string;
    };
    prediction: {
        suggestion: 'red' | 'black' | 'white' | 'wait';
        confidence: number;
        reason: string;
        strategies: Strategy[];
    };
    lastUpdate: string;
}

const Dashboard: React.FC = () => {
    const [history, setHistory] = useState<BlazeResult[]>([]);
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { logout, user } = useAuth();

    const fetchData = async () => {
        setIsRefreshing(true);
        try {
            const response = await api.get('/api/history');
            setHistory(response.data.history);
            setAnalysis(response.data.analysis);
        } catch (err) {
            console.error('Erro ao buscar dados', err);
        } finally {
            setTimeout(() => setIsRefreshing(false), 1000);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    const getColorClass = (color: string) => {
        if (color === 'red') return 'bg-rose-600';
        if (color === 'black') return 'bg-slate-800';
        return 'bg-white text-black';
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans">
            {/* Header */}
            <header className="bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <motion.div 
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                    >
                        <Flame className="text-rose-600 w-7 h-7" />
                    </motion.div>
                    <span className="font-black text-xl tracking-tighter hidden sm:inline">BLAZE ANALYTICS <span className="text-rose-600">PRO</span></span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold">{user?.username}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">{user?.role}</p>
                    </div>
                    <button onClick={logout} className="p-2.5 bg-slate-800 hover:bg-rose-600/20 hover:text-rose-500 rounded-xl transition-all border border-slate-700">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
                {/* Histórico Horizontal */}
                <section className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Histórico em Tempo Real
                        </h2>
                        <div className="flex items-center gap-3">
                            <AnimatePresence mode="wait">
                                {isRefreshing && (
                                    <motion.span 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="text-[10px] text-slate-500 italic"
                                    >
                                        Atualizando...
                                    </motion.span>
                                )}
                            </AnimatePresence>
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-2 font-bold">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> LIVE
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                        {history.map((item, i) => (
                            <motion.div 
                                key={i}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: i * 0.02 }}
                                className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-xl border-b-4 border-black/20 ${getColorClass(item.color)}`}
                            >
                                {item.color === 'white' ? '14x' : item.value}
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Grid Principal */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Card de Sinal (Destaque) */}
                    <div className="lg:col-span-2 bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Activity className="w-32 h-32" />
                        </div>
                        
                        <div className="relative z-10 h-full flex flex-col">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-slate-400 font-bold text-lg">Próxima Entrada</h3>
                                    <p className="text-xs text-slate-500 mt-1">{analysis?.prediction.reason}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1.5 rounded-xl border border-slate-700 font-black tracking-tighter">AI ENGINE V2.5</span>
                                    <span className="text-[10px] text-slate-600">Ref: {analysis?.lastUpdate ? new Date(analysis.lastUpdate).toLocaleTimeString() : '--:--'}</span>
                                </div>
                            </div>
                            
                            <div className="flex-1 flex flex-col md:flex-row items-center justify-around gap-8">
                                <div className="relative">
                                    <motion.div 
                                        animate={{ 
                                            boxShadow: analysis?.prediction.suggestion === 'red' 
                                                ? ["0 0 20px rgba(225,29,72,0.2)", "0 0 60px rgba(225,29,72,0.4)", "0 0 20px rgba(225,29,72,0.2)"]
                                                : ["0 0 20px rgba(30,41,59,0.2)", "0 0 60px rgba(30,41,59,0.4)", "0 0 20px rgba(30,41,59,0.2)"]
                                        }}
                                        transition={{ repeat: Infinity, duration: 3 }}
                                        className={`w-56 h-56 rounded-full border-8 flex flex-col items-center justify-center transition-colors duration-500 ${analysis?.prediction.suggestion === 'red' ? 'border-rose-600' : analysis?.prediction.suggestion === 'black' ? 'border-slate-700' : 'border-slate-800'}`}
                                    >
                                        <span className="text-xs uppercase tracking-[0.3em] text-slate-500 font-black mb-1">Sinal</span>
                                        <span className={`text-3xl font-black uppercase tracking-tighter ${analysis?.prediction.suggestion === 'red' ? 'text-rose-600' : 'text-white'}`}>
                                            {analysis?.prediction.suggestion === 'red' ? 'Vermelho' : analysis?.prediction.suggestion === 'black' ? 'Preto' : 'Aguardar'}
                                        </span>
                                        <div className="mt-4 flex items-center gap-1 text-emerald-500">
                                            <ShieldCheck className="w-4 h-4" />
                                            <span className="text-[10px] font-bold uppercase">Proteção no Branco</span>
                                        </div>
                                    </motion.div>
                                </div>

                                <div className="text-center md:text-left space-y-4">
                                    <div>
                                        <div className="text-6xl font-black text-emerald-500 tracking-tighter">{analysis?.prediction.confidence}%</div>
                                        <div className="text-xs text-slate-500 uppercase font-black tracking-widest mt-1">Assertividade Estimada</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                        {analysis?.prediction.strategies.map((s, i) => (
                                            <span key={i} className={`text-[10px] px-3 py-1.5 rounded-lg font-bold border ${s.active ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                                                {s.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card de Padrões e Stats */}
                    <div className="space-y-8">
                        <div className="bg-slate-900 rounded-[2rem] p-6 border border-slate-800 shadow-xl">
                            <h3 className="text-slate-400 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-rose-600" /> Tendência Global
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <span className="text-xs text-slate-500 font-bold">Vermelho</span>
                                    <span className="text-sm font-black text-rose-500">{Math.round((analysis?.stats.redCount || 0) * 2)}%</span>
                                </div>
                                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(analysis?.stats.redCount || 0) * 2}%` }}
                                        className="bg-rose-600 h-full"
                                    />
                                </div>
                                <div className="flex justify-between items-end">
                                    <span className="text-xs text-slate-500 font-bold">Preto</span>
                                    <span className="text-sm font-black text-slate-300">{Math.round((analysis?.stats.blackCount || 0) * 2)}%</span>
                                </div>
                                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(analysis?.stats.blackCount || 0) * 2}%` }}
                                        className="bg-slate-400 h-full"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900 rounded-[2rem] p-6 border border-slate-800 shadow-xl">
                            <h3 className="text-slate-400 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-emerald-500" /> Alerta de Sequência
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${getColorClass(analysis?.stats.streakColor || 'red')}`}>
                                    {analysis?.stats.streakColor === 'red' ? 'V' : 'P'}
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-white">{analysis?.stats.maxStreak}x Seguidos</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Maior sequência detectada</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Vermelhos', value: analysis?.stats.redCount, color: 'text-rose-600' },
                        { label: 'Pretos', value: analysis?.stats.blackCount, color: 'text-slate-400' },
                        { label: 'Brancos', value: analysis?.stats.whiteCount, color: 'text-white' },
                        { label: 'Sinais Enviados', value: '1,248', color: 'text-emerald-500' }
                    ].map((stat, i) => (
                        <motion.div 
                            key={i}
                            whileHover={{ y: -5 }}
                            className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 text-center"
                        >
                            <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">{stat.label}</div>
                            <div className={`text-3xl font-black ${stat.color}`}>{stat.value}</div>
                        </motion.div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
