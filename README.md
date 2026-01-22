# Blaze Analytics Pro

Sistema Full Stack para análise de histórico e padrões da Blaze (Double).

## Stack Tecnológica
- **Frontend:** React (Vite), TypeScript, Tailwind CSS, Lucide React, Axios.
- **Backend:** Node.js, Express, TypeScript, MySQL2, JWT, BcryptJS.
- **Banco de Dados:** MySQL (XAMPP).

## Requisitos
- Node.js (v18+)
- XAMPP (MySQL)

## Instalação e Configuração

### 1. Banco de Dados
1. Abra o **phpMyAdmin** no XAMPP.
2. Crie um banco de dados chamado `blaze_analytics`.
3. Importe o arquivo `database/schema.sql` ou execute o conteúdo dele no console SQL.

### 2. Backend
1. Navegue até a pasta `backend`:
   ```bash
   cd backend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure o arquivo `.env` (já pré-configurado para XAMPP padrão).
4. Inicie o servidor:
   ```bash
   npm run dev
   ```

### 3. Frontend
1. Navegue até a pasta `frontend`:
   ```bash
   cd frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie a aplicação:
   ```bash
   npm run dev
   ```

## Acesso Inicial
- **URL:** `http://localhost:5173`
- **Usuário:** `admin`
- **Senha:** `admin123`

## Funcionalidades
- **Autenticação JWT:** Login seguro e proteção de rotas.
- **Dashboard em Tempo Real:** Polling de 5 segundos para atualização de dados.
- **Análise de Padrões:** Lógica no backend para identificar sequências e sugerir entradas.
- **Admin:** Rota protegida para criação de novos usuários (via API).
- **Design Dark Mode:** Interface profissional inspirada no protótipo.
