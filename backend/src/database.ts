import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Configuração robusta para SAAS (Connection Pool)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'blaze_analytics',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Teste rápido de conexão ao iniciar
pool.getConnection()
  .then((conn) => {
    console.log('✅ Conectado ao MySQL com sucesso!');
    conn.release();
  })
  .catch((err) => {
    console.error('❌ Erro ao conectar no MySQL:', err.message);
  });

export default pool;