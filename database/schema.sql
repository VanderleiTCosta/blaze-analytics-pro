CREATE DATABASE IF NOT EXISTS blaze_analytics;
USE blaze_analytics;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir usuário admin inicial (senha: admin123)
-- Hash gerado para 'admin123': $2b$10$7vYp7vYp7vYp7vYp7vYp7u1vXyXyXyXyXyXyXyXyXyXyXyXyXyXy (Exemplo ilustrativo, o código backend usará bcrypt real)
-- Nota: No ambiente real, o admin deve ser criado via script de seed ou primeiro acesso.
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', '$2b$10$Ep76J5K65K65K65K65K65K65K65K65K65K65K65K65K65K65K65K', 'admin')
ON DUPLICATE KEY UPDATE username=username;
