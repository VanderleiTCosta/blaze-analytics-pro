import express, { Request, Response } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './database';
import { verifyToken, verifyAdmin, AuthRequest } from './middleware';

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'blaze_analytics_pro_secret_key_2024';

// --- Rotas de Autenticação ---

app.post('/auth/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;

    try {
        const [rows]: any = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ message: 'Usuário ou senha incorretos.' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor.' });
    }
});

// --- Rotas de Admin ---

app.post('/admin/create-user', verifyToken, verifyAdmin, async (req: Request, res: Response) => {
    const { username, password, role } = req.body;

    try {
        const password_hash = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
            [username, password_hash, role || 'user']
        );
        res.status(201).json({ message: 'Usuário criado com sucesso.' });
    } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Usuário já existe.' });
        }
        res.status(500).json({ message: 'Erro ao criar usuário.' });
    }
});

// --- Lógica da Blaze e Análise Avançada ---

interface BlazeResult {
    color: 'red' | 'black' | 'white';
    value: number;
    timestamp: string;
}

const generateMockHistory = (): BlazeResult[] => {
    const colors: ('red' | 'black' | 'white')[] = ['red', 'black', 'white'];
    const history: BlazeResult[] = [];
    for (let i = 0; i < 50; i++) {
        const rand = Math.random();
        let color: 'red' | 'black' | 'white';
        if (rand < 0.05) color = 'white';
        else if (rand < 0.525) color = 'red';
        else color = 'black';

        history.push({
            color,
            value: color === 'white' ? 0 : Math.floor(Math.random() * 14) + 1,
            timestamp: new Date(Date.now() - i * 30000).toISOString()
        });
    }
    return history;
};

const analyzePatterns = (history: BlazeResult[]) => {
    const lastResults = history.slice(0, 10).map(h => h.color);
    
    // Estatísticas básicas
    const stats = {
        redCount: history.filter(h => h.color === 'red').length,
        blackCount: history.filter(h => h.color === 'black').length,
        whiteCount: history.filter(h => h.color === 'white').length,
        maxStreak: 0,
        streakColor: ''
    };

    // Cálculo de sequência atual
    let currentStreak = 1;
    let tempMaxStreak = 1;
    let tempStreakColor = history[0].color;

    for (let i = 1; i < history.length; i++) {
        if (history[i].color === history[i-1].color) {
            currentStreak++;
        } else {
            if (currentStreak > tempMaxStreak) {
                tempMaxStreak = currentStreak;
                tempStreakColor = history[i-1].color;
            }
            currentStreak = 1;
        }
    }
    stats.maxStreak = tempMaxStreak;
    stats.streakColor = tempStreakColor;

    // Lógica de Estratégias (Exemplos Reais)
    const strategies = [
        { name: 'Quebra de Tendência', active: false },
        { name: 'Repetição de Cor', active: false },
        { name: 'Proteção no Branco', active: true }
    ];

    let suggestion: 'red' | 'black' | 'white' | 'wait' = 'wait';
    let confidence = 0;
    let reason = 'Aguardando padrão ideal...';

    // Exemplo: Se os últimos 3 forem iguais, sugere quebra
    if (lastResults[0] === lastResults[1] && lastResults[1] === lastResults[2]) {
        suggestion = lastResults[0] === 'red' ? 'black' : 'red';
        confidence = 85;
        reason = `Detectada sequência de 3 ${lastResults[0] === 'red' ? 'Vermelhos' : 'Pretos'}. Sugerindo quebra.`;
        strategies[0].active = true;
    } 
    // Exemplo: Alternância (Xadrez)
    else if (lastResults[0] !== lastResults[1] && lastResults[1] !== lastResults[2] && lastResults[2] !== lastResults[3]) {
        suggestion = lastResults[0] === 'red' ? 'black' : 'red';
        confidence = 78;
        reason = 'Padrão de alternância detectado (Xadrez).';
        strategies[1].active = true;
    }
    else {
        // Sugestão padrão baseada em probabilidade simples se nada for detectado
        suggestion = stats.redCount > stats.blackCount ? 'black' : 'red';
        confidence = 65;
        reason = 'Análise baseada em volume de cores recente.';
    }

    return {
        stats,
        prediction: { suggestion, confidence, reason, strategies },
        lastUpdate: new Date().toISOString()
    };
};

app.get('/api/history', verifyToken, (req: Request, res: Response) => {
    const history = generateMockHistory();
    const analysis = analyzePatterns(history);
    res.json({ history, analysis });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
