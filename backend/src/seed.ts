import bcrypt from 'bcryptjs';
import pool from './database';

async function seed() {
    try {
        console.log('Iniciando seed do usuário admin...');
        
        const username = 'admin';
        const password = 'admin123';
        const role = 'admin';
        
        const password_hash = await bcrypt.hash(password, 10);
        
        // Verifica se o usuário já existe
        const [rows]: any = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        
        if (rows.length > 0) {
            console.log('Usuário admin já existe. Atualizando senha...');
            await pool.query(
                'UPDATE users SET password_hash = ?, role = ? WHERE username = ?',
                [password_hash, role, username]
            );
        } else {
            console.log('Criando novo usuário admin...');
            await pool.query(
                'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                [username, password_hash, role]
            );
        }
        
        console.log('-----------------------------------');
        console.log('Sucesso! Usuário admin configurado.');
        console.log('Usuário: admin');
        console.log('Senha: admin123');
        console.log('-----------------------------------');
        
        process.exit(0);
    } catch (error) {
        console.error('Erro ao executar seed:', error);
        process.exit(1);
    }
}

seed();
