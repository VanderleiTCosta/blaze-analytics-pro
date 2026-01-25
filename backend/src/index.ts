import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './database.js'; 
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// =============================================================
// 🚨 ÁREA CRÍTICA: MIDDLEWARES (A ORDEM IMPORTA!)
// =============================================================

// 1. Libera o acesso para o Frontend (CORS)
app.use(cors());

// 2. OBRIGATÓRIO: Habilita leitura de JSON no corpo da requisição
// Se esta linha não estiver aqui (ANTES das rotas), o login falha com erro 400.
app.use(express.json()); 

// 3. Log de Debug (Para vermos quem está batendo na porta)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// =============================================================
// 🛣️ ROTAS DA APLICAÇÃO
// =============================================================

// Rota de Login
app.post('/auth/login', async (req: Request, res: Response) => {
  // Debug: Mostra no terminal o que o Frontend enviou
  console.log('📦 DADOS RECEBIDOS (REQ.BODY):', req.body);

  const { email, password } = req.body;

  // Validação
  if (!email || !password) {
    console.log('❌ Falha: Email ou senha não enviados.');
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }

  try {
    // 1. Busca usuário
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    const users = rows as any[];

    if (users.length === 0) {
      console.log('❌ Falha: Usuário não encontrado.');
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const user = users[0];

    // 2. Compara senha
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log('❌ Falha: Senha incorreta.');
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    // 3. Gera Token
    const secret = process.env.JWT_SECRET || 'segredo_padrao_dev';
    const token = jwt.sign(
      { id: user.id, role: user.role },
      secret,
      { expiresIn: '24h' }
    );

    console.log('✅ SUCESSO: Usuário logado!');
    
    // Retorna dados para o Frontend
    res.json({
      message: 'Login realizado',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('🔥 Erro Crítico:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota de Teste
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend Blaze Analytics ON!' });
});

app.listen(port, () => {
  console.log(`🚀 SERVIDOR RODANDO NA PORTA ${port}`);
  console.log(`👉 Teste Login em: http://localhost:${port}/auth/login`);
});