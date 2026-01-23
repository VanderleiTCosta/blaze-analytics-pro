import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './database.js'; 
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// Se você ainda não criou o middleware.ts, remova a linha abaixo temporariamente
// import { verifyToken } from './middleware.js'; 

dotenv.config();

const app = express();
// Define a porta 3001 explicitamente para bater com o seu erro
const port = process.env.PORT || 3001; 

app.use(cors());
app.use(express.json());

// --- Rota de Teste (Healthcheck) ---
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Backend is running correctly' });
});

// --- ROTA DE LOGIN (A QUE ESTÁ FALTANDO) ---
// O erro 404 acontece porque este bloco não existe no seu arquivo atual
app.post('/auth/login', async (req: Request, res: Response) => {
  console.log('📦 Body recebido:', req.body);
  const { email, password } = req.body;

  // Validação básica
  if (!email || !password) {
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }

  try {
    console.log(`🔑 Tentativa de login: ${email}`);

    // 1. Buscar usuário no banco
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    const users = rows as any[];

    if (users.length === 0) {
      console.log('❌ Usuário não encontrado');
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const user = users[0];

    // 2. Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log('❌ Senha incorreta');
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    // 3. Gerar Token (JWT)
    const secret = process.env.JWT_SECRET || 'blaze_secret_key_123';
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      secret,
      { expiresIn: '24h' }
    );

    // 4. Sucesso!
    console.log('✅ Login autorizado!');
    res.json({
      message: 'Login realizado com sucesso',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Erro interno no login:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`   👉 Rota de login ativa: http://localhost:${port}/auth/login`);
});