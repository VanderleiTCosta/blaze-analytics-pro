# Dockerfile para o Backend (com suporte a Puppeteer/Chromium)
# Atualizado para Node 20 para compatibilidade com dependências
FROM node:20-slim

# Instalar dependências do sistema necessárias para o Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Definir diretório de trabalho
WORKDIR /usr/src/app

# Copiar apenas os arquivos de dependências primeiro
COPY package*.json ./

# Instalar dependências (incluindo devDependencies para o build)
RUN npm install

# Copiar o restante do código
COPY . .

# Garantir permissão de execução para binários locais do npm
RUN chmod -R +x node_modules/.bin

# Compilar o TypeScript para JavaScript
RUN npm run build

# O Render define a porta automaticamente via variável de ambiente PORT
CMD [ "npm", "run", "start" ]
