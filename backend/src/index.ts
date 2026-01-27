import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// import { BlazeWatcher } from './services/blazeWatcher';
import { BlazeAI } from './services/ai';
import { BlazeScraper } from './services/blazeScraper';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'segredo_padrao_dev';

app.use(cors());
app.use(express.json());

// --- MIDDLEWARES ---

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Acesso negado.' });

  jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Token inválido.' });
    
    try {
      const [rows] = await pool.query('SELECT id, name, email, expiration_date, role FROM users WHERE id = ?', [user.id]);
      const dbUser = (rows as any[])[0];
      
      if (!dbUser) return res.status(403).json({ message: 'Usuário não encontrado.' });

      // Se for admin, passa direto
      if (dbUser.role === 'admin') {
        (req as any).user = dbUser;
        return next();
      }

      // Verificação de validade da conta
      if (dbUser.expiration_date) {
        const now = new Date();
        const expiration = new Date(dbUser.expiration_date);
        if (now > expiration) {
          return res.status(402).json({ message: '⛔ Assinatura expirada!', expired: true });
        }
      }

      (req as any).user = dbUser;
      next();
    } catch (error) { 
      return res.status(500).json({ message: 'Erro de validação.' }); 
    }
  });
};

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (user && user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Acesso restrito a administradores.' });
  }
};

// --- ROTAS PÚBLICAS ---

app.get('/api/health', (req, res) => res.json({ 
  status: 'ok',
  timestamp: new Date().toISOString(),
  scraper: blazeScraper.isActive() ? 'active' : 'inactive'
}));

app.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    const users = rows as any[];
    
    if (users.length === 0) return res.status(401).json({ message: 'Email ou senha inválidos' });
    
    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) return res.status(401).json({ message: 'Email ou senha inválidos' });
    
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    res.json({ 
      message: 'Login realizado', 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        expiration_date: user.expiration_date 
      } 
    });

  } catch (error) { 
    console.error(error);
    res.status(500).json({ message: 'Erro interno no servidor' }); 
  }
});

// --- ROTAS PROTEGIDAS (DASHBOARD) ---

app.put('/auth/me/password', authenticateToken, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = (req as any).user.id;
  
  try {
    const [rows] = await pool.execute('SELECT password FROM users WHERE id = ?', [userId]);
    const user = (rows as any[])[0];
    
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(400).json({ message: 'Senha atual incorreta' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    
    res.json({ message: 'Senha atualizada com sucesso' });
  } catch (error) { res.status(500).json({ message: 'Erro ao atualizar senha' }); }
});

app.get('/dashboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    
    const [blazeRows] = await pool.query(`
      SELECT 
        id, 
        color as result, 
        number, 
        created_at,
        TIMESTAMPDIFF(SECOND, created_at, NOW()) as seconds_ago
      FROM blaze_history 
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `);
    
    const history = blazeRows as any[];
    const total = history.length || 1;
    
    const stats = {
      whites: history.filter(h => h.result === 'branco').length,
      reds: history.filter(h => h.result === 'vermelho').length,
      blacks: history.filter(h => h.result === 'preto').length,
      total: history.length,
      lastUpdate: history[0]?.created_at || null
    };

    // Usar IA para análise
    const prediction = BlazeAI.analyze(history.map(h => ({
      id: h.id,
      result: h.result,
      number: h.number,
      created_at: h.created_at
    })));

    // Formatar predição para o frontend
    let predictionColor = 'aguardar';
    if (prediction.suggestion === 'red') predictionColor = 'vermelho';
    if (prediction.suggestion === 'black') predictionColor = 'preto';
    if (prediction.suggestion === 'white') predictionColor = 'branco';

    res.json({
      history, // Agora o índice 0 é o ID mais alto (o último que saiu)
      stats: {
        ...stats,
        whitePercentage: ((stats.whites / total) * 100),
        redPercentage: ((stats.reds / total) * 100),
        blackPercentage: ((stats.blacks / total) * 100),
      },
      prediction: {
        suggestion: predictionColor,
        confidence: prediction.confidence,
        reason: prediction.reason,
        strategies: prediction.strategies
      },
      scraperStatus: {
        active: blazeScraper.isActive(), // Note que removi o "blazeWatcher" antigo daqui se ainda estivesse referenciado
        lastScrape: history[0]?.seconds_ago ? `${history[0]?.seconds_ago} segundos atrás` : 'N/A'
      }
    });
  } catch (error) { 
    console.error(error); 
    res.status(500).json({ error: 'Erro ao carregar dashboard' }); 
  }
});

// --- ROTAS DO SCRAPER ---

app.get('/api/scraper/status', authenticateToken, (req: Request, res: Response) => {
  res.json({
    running: blazeScraper.isActive(),
    interval: '10 segundos',
    lastUpdate: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.post('/api/scraper/start', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await blazeScraper.start();
    res.json({ 
      success: true, 
      message: 'Scraper iniciado com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Erro ao iniciar scraper:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao iniciar scraper',
      error: error.message 
    });
  }
});

app.post('/api/scraper/stop', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await blazeScraper.stop();
    res.json({ 
      success: true, 
      message: 'Scraper parado com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Erro ao parar scraper:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao parar scraper',
      error: error.message 
    });
  }
});

app.get('/api/scraper/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const [rows] = await pool.query(
      'SELECT * FROM blaze_history ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    
    res.json({
      success: true,
      count: (rows as any[]).length,
      data: rows,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar histórico',
      error: error.message 
    });
  }
});

app.get('/api/scraper/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const period = req.query.period as 'today' | 'week' | 'month' || 'today';
    
    let query = '';
    const params: any[] = [];
    const today = new Date().toISOString().slice(0, 10);
    
    switch (period) {
      case 'today':
        query = `
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN color = 'branco' THEN 1 END) as whites,
            COUNT(CASE WHEN color = 'vermelho' THEN 1 END) as reds,
            COUNT(CASE WHEN color = 'preto' THEN 1 END) as blacks,
            DATE(created_at) as date
          FROM blaze_history 
          WHERE DATE(created_at) = ?
          GROUP BY DATE(created_at)
        `;
        params.push(today);
        break;
        
      case 'week':
        query = `
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN color = 'branco' THEN 1 END) as whites,
            COUNT(CASE WHEN color = 'vermelho' THEN 1 END) as reds,
            COUNT(CASE WHEN color = 'preto' THEN 1 END) as blacks,
            DATE(created_at) as date
          FROM blaze_history 
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `;
        break;
        
      case 'month':
        query = `
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN color = 'branco' THEN 1 END) as whites,
            COUNT(CASE WHEN color = 'vermelho' THEN 1 END) as reds,
            COUNT(CASE WHEN color = 'preto' THEN 1 END) as blacks,
            DATE(created_at) as date
          FROM blaze_history 
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `;
        break;
    }
    
    const [rows] = await pool.query(query, params);
    
    res.json({
      success: true,
      period,
      stats: rows,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar estatísticas',
      error: error.message 
    });
  }
});

// Rota para forçar uma coleta imediata (debug)
app.post('/api/scraper/collect', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const results = await blazeScraper.collectNow();
    res.json({
      success: true,
      message: `Coleta realizada: ${results.length} resultados`,
      count: results.length,
      results: results.slice(0, 5), // Retorna apenas os 5 primeiros para não sobrecarregar
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Erro na coleta manual:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro na coleta manual',
      error: error.message 
    });
  }
});

// --- ROTAS ADMIN ---

app.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, role, created_at, expiration_date FROM users');
    res.json(rows);
  } catch (error) { res.status(500).json({ message: 'Erro ao listar usuários' }); }
});

app.post('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.execute(
        'INSERT INTO users (name, email, password, role, expiration_date) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))', 
        [name, email, hashedPassword, role || 'user']
    );
    res.status(201).json({ message: 'Usuário criado' });
  } catch (error: any) { 
    res.status(500).json({ message: error.code === 'ER_DUP_ENTRY' ? 'Email já existe' : 'Erro ao criar usuário' }); 
  }
});

app.put('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, role, password } = req.body;
  try {
    if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.execute('UPDATE users SET name=?, email=?, role=?, password=? WHERE id=?', [name, email, role, hashedPassword, id]);
    } else {
        await pool.execute('UPDATE users SET name=?, email=?, role=? WHERE id=?', [name, email, role, id]);
    }
    res.json({ message: 'Usuário atualizado' });
  } catch (error) { res.status(500).json({ message: 'Erro ao atualizar' }); }
});

app.post('/admin/users/:id/renew', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { days } = req.body;
  try {
    await pool.execute(`UPDATE users SET expiration_date = DATE_ADD(IF(expiration_date > NOW(), expiration_date, NOW()), INTERVAL ? DAY) WHERE id = ?`, [days || 30, id]);
    res.json({ message: 'Assinatura renovada' });
  } catch (error) { res.status(500).json({ message: 'Erro ao renovar' }); }
});

app.delete('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  if (parseInt(req.params.id) === (req as any).user.id) return res.status(400).json({ message: 'Você não pode se deletar' });
  try {
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'Usuário deletado' });
  } catch (error) { res.status(500).json({ message: 'Erro ao deletar' }); }
});

app.get('/api/scraper/database/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const status = await blazeScraper.getDatabaseStatus();
    res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Erro ao verificar status do banco:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao verificar status do banco',
      error: error.message 
    });
  }
});

// Rota para forçar limpeza completa (apenas admin)
app.post('/api/scraper/database/clean', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await blazeScraper.forceClean();
    res.json({ 
      success: true, 
      message: 'Banco completamente limpo',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Erro na limpeza do banco:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro na limpeza do banco',
      error: error.message 
    });
  }
});

// Rota para coletar manualmente e manter 100 registros
app.post('/api/scraper/collect', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const results = await blazeScraper.collectNow();
    const status = await blazeScraper.getDatabaseStatus();
    
    res.json({
      success: true,
      message: `Coleta realizada. Banco agora tem ${status.total || 0} registros`,
      collected: results.length,
      databaseStatus: status,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Erro na coleta manual:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro na coleta manual',
      error: error.message 
    });
  }
});

// --- INICIALIZAÇÃO DO SCRAPER ---
const blazeScraper = new BlazeScraper();

// Iniciar scraper automaticamente se configurado
if (process.env.AUTO_START_SCRAPER === 'true') {
  console.log('🔄 Iniciando scraper automaticamente...');
  blazeScraper.start().catch(err => {
    console.error('❌ Erro ao iniciar scraper automático:', err);
  });
}

// Inicialização do sistema antigo (mantido para compatibilidade)
// const scraper = new BlazeWatcher();

// Tratamento de shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Recebido SIGINT, encerrando serviços...');
  await blazeScraper.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Recebido SIGTERM, encerrando serviços...');
  await blazeScraper.stop();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📡 Rotas Ativas:`);
  console.log(`   • /login (POST)`);
  console.log(`   • /dashboard (GET - protegido)`);
  console.log(`   • /admin/users (GET/POST/PUT/DELETE - admin)`);
  console.log(`   • /api/scraper/* (controle do scraper)`);
  console.log(`🔄 Scraper Status: ${blazeScraper.isActive() ? '✅ Ativo' : '⏸️ Inativo'}`);
  console.log(`🔧 Modo: ${process.env.NODE_ENV || 'development'}`);
});