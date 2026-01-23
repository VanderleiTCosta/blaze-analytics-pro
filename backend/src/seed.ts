import bcrypt from 'bcryptjs';
// IMPORTANTE: Mantenha o .js no final, mesmo sendo TypeScript
import pool from './database.js'; 

async function seed() {
  const connection = await pool.getConnection();
  try {
    console.log('🚀 VERSÃO DE CORREÇÃO: Iniciando...');

    // 1. Limpeza: Apaga a tabela antiga que está a causar o erro
    console.log('🧹 Excluindo tabela antiga (DROP TABLE)...');
    await connection.execute('DROP TABLE IF EXISTS users');

    // 2. Construção: Cria a tabela nova com a coluna EMAIL correta
    console.log('🏗️ Criando tabela nova (CREATE TABLE)...');
    await connection.execute(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. População: Cria o Admin
    console.log('👤 Criando usuário Admin...');
    const email = 'admin@blaze.com';
    const passwordRaw = 'admin123';
    const hashedPassword = await bcrypt.hash(passwordRaw, 10);

    await connection.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Admin User', email, hashedPassword, 'admin']
    );
    
    console.log('✅ SUCESSO TOTAL! O banco foi corrigido.');
    console.log(`🔑 Login: ${email}`);
    console.log(`🔑 Senha: ${passwordRaw}`);

  } catch (error) {
    console.error('❌ Erro durante o seed:', error);
  } finally {
    connection.release();
    await pool.end();
    process.exit();
  }
}

seed();