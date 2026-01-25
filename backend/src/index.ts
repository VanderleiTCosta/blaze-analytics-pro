import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { BlazeWatcher } from './services/blazeWatcher.js';
import { BlazeAI } from './services/ai.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'segredo_padrao_dev';

app.use(cors());
app.use(express.json());

// Middlewares
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Acesso negado.' });

  jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Token inválido.' });
    try {
      const [rows] = await pool.query('SELECT expiration_date, role FROM users WHERE id = ?', [user.id]);
      const dbUser = (rows as any[])[0];
      if (!dbUser) return res.status(403).json({ message: 'Usuário não encontrado.' });

      if (dbUser.role === 'admin') {
        (req as any).user = user;
        return next();
      }
      const now = new Date();
      const expiration = new Date(dbUser.expiration_date);
      if (!dbUser.expiration_date || now > expiration) {
        return res.status(402).json({ message: '⛔ Assinatura expirada!', expired: true });
      }
      (req as any).user = user;
      next();
    } catch (error) { return res.status(500).json({ message: 'Erro de validação.' }); }
  });
};

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (user && user.role === 'admin') next();
  else res.status(403).json({ message: 'Acesso restrito.' });
};

// Rotas Gerais
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    const users = rows as any[];
    if (users.length === 0) return res.status(401).json({ message: 'Inválido' });
    const user = users[0];
    if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Inválido' });
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ message: 'OK', token, user: { id: user.id, name: user.name, email: user.email, role: user.role, expiration_date: user.expiration_date } });
  } catch (error) { res.status(500).json({ message: 'Erro interno' }); }
});

app.put('/auth/me/password', authenticateToken, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = (req as any).user.id;
  try {
    const [rows] = await pool.execute('SELECT password FROM users WHERE id = ?', [userId]);
    const user = (rows as any[])[0];
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) return res.status(400).json({ message: 'Senha atual incorreta' });
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [await bcrypt.hash(newPassword, 10), userId]);
    res.json({ message: 'Senha atualizada' });
  } catch (error) { res.status(500).json({ message: 'Erro' }); }
});

// Rota Dashboard
app.get('/api/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM history ORDER BY created_at DESC LIMIT 100');
    const history = rows as any[];
    const total = history.length || 1;
    const stats = {
      redCount: history.filter(h => h.result === 'vermelho').length,
      blackCount: history.filter(h => h.result === 'preto').length,
      whiteCount: history.filter(h => h.result === 'branco').length,
    };
    const aiPrediction = BlazeAI.analyze(history);
    res.json({
      history,
      stats: {
        ...stats,
        redPercentage: Math.round((stats.redCount / total) * 100),
        blackPercentage: Math.round((stats.blackCount / total) * 100),
        whitePercentage: Math.round((stats.whiteCount / total) * 100),
      },
      analysis: { prediction: aiPrediction, lastUpdate: new Date() }
    });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Erro IA' }); }
});

// Rotas Admin
app.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, role, created_at, expiration_date FROM users');
    res.json(rows);
  } catch (error) { res.status(500).json({ message: 'Erro' }); }
});

app.post('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    await pool.execute('INSERT INTO users (name, email, password, role, expiration_date) VALUES (?, ?, ?, ?, NULL)', [name, email, await bcrypt.hash(password, 10), role || 'user']);
    res.status(201).json({ message: 'Criado' });
  } catch (error: any) { res.status(500).json({ message: error.code === 'ER_DUP_ENTRY' ? 'Email já existe' : 'Erro' }); }
});

app.put('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, role, password } = req.body;
  try {
    if (password) await pool.execute('UPDATE users SET name=?, email=?, role=?, password=? WHERE id=?', [name, email, role, await bcrypt.hash(password, 10), id]);
    else await pool.execute('UPDATE users SET name=?, email=?, role=? WHERE id=?', [name, email, role, id]);
    res.json({ message: 'Atualizado' });
  } catch (error) { res.status(500).json({ message: 'Erro' }); }
});

app.post('/admin/users/:id/renew', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { days } = req.body;
  try {
    await pool.execute(`UPDATE users SET expiration_date = DATE_ADD(NOW(), INTERVAL ? DAY) WHERE id = ?`, [days || 30, id]);
    res.json({ message: 'Renovado' });
  } catch (error) { res.status(500).json({ message: 'Erro' }); }
});

app.delete('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  if (parseInt(req.params.id) === (req as any).user.id) return res.status(400).json({ message: 'Não pode se deletar' });
  try {
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deletado' });
  } catch (error) { res.status(500).json({ message: 'Erro' }); }
});

const scraper = new BlazeWatcher();

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📡 Serviço de Coleta Blaze: ATIVO`);
});