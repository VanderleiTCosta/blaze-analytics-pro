import WebSocket from 'ws';
import pool  from '../database.js';
import puppeteer from 'puppeteer';

interface BlazeMessage {
  id: string; 
  color: number; // 0 = Branco, 1 = Vermelho, 2 = Preto
  roll: number;
  created_at: string;
}

export class BlazeWatcher {
  private ws: WebSocket | null = null;
  // URL WebSocket atualizada
  private wsUrl = 'wss://api-v2.blaze.bet.br/replication/?EIO=3&transport=websocket';
  private pingInterval: NodeJS.Timeout | null = null;

  // Headers para o Socket
  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://blaze.bet.br',
    'Referer': 'https://blaze.bet.br/pt/games/double'
  };

  constructor() {
    this.init();
  }

  private async init() {
    console.log('🛡️ Iniciando Monitoramento Blindado (Scraping + Socket)...');
    
    // 1. Scraping Visual (Baseado no HTML que você enviou)
    await this.seedViaPuppeteer();

    // 2. Conecta Socket (Mantém atualizado)
    this.connectSocket();
  }

  // =========================================================================
  // 🕷️ SCRAPING VIA PUPPETEER (Lê o HTML direto da tela)
  // =========================================================================
  private async seedViaPuppeteer() {
    console.log('🕷️ Iniciando navegador Puppeteer para ler histórico visual...');
    
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true, // Roda sem interface gráfica
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      
      // Define User-Agent real
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      console.log('🕷️ Acessando Blaze...');
      // Tenta acessar o espelho que costuma ter menos proteção
      await page.goto('https://blaze1.space/pt/games/double', { waitUntil: 'networkidle2', timeout: 60000 });

      // Espera o container .entries aparecer (Baseado no seu HTML)
      console.log('🕷️ Aguardando carregamento dos elementos (.entries)...');
      await page.waitForSelector('.entries', { timeout: 20000 });

      // Extrai os dados
      const results = await page.evaluate(() => {
        // Seleciona todas as entradas
        const entries = document.querySelectorAll('.entries .entry');
        const data: any[] = [];

        entries.forEach((entry) => {
          const box = entry.querySelector('.sm-box');
          if (!box) return;

          let color = -1;
          let roll = 0;
          
          // Verifica a classe para determinar a cor
          if (box.classList.contains('red')) {
            color = 1; // Vermelho
            // Pega o texto da div .number
            const numText = box.querySelector('.number')?.textContent;
            roll = numText ? parseInt(numText, 10) : 0;
          } else if (box.classList.contains('black')) {
            color = 2; // Preto
            const numText = box.querySelector('.number')?.textContent;
            roll = numText ? parseInt(numText, 10) : 0;
          } else if (box.classList.contains('white')) {
            color = 0; // Branco
            roll = 0;  // Branco sempre é zero
          }

          // Se identificou uma cor válida, adiciona
          if (color !== -1) {
            data.push({
              color,
              roll: isNaN(roll) ? 0 : roll,
              // Cria um ID único baseado no tempo e posição para evitar duplicação no scrape
              id: 'scrap_' + Date.now() + '_' + Math.random(),
              created_at: new Date().toISOString()
            });
          }
        });

        return data;
      });

      console.log(`🕷️ Sucesso! ${results.length} registros visuais extraídos.`);

      // Salva no banco de dados
      // Nota: Geralmente a lista visual vem da Esquerda (Antigo) -> Direita (Novo).
      // Vamos salvar na ordem que vieram.
      for (const result of results) {
        await this.saveResult({
            id: result.id,
            color: result.color,
            roll: result.roll,
            created_at: result.created_at
        }, 'SCRAPER');
      }

    } catch (error: any) {
      console.error(`⚠️ Erro no Puppeteer: ${error.message}`);
      console.log('⚠️ O sistema seguirá apenas com o WebSocket.');
    } finally {
      if (browser) await browser.close();
    }
  }

  // =========================================================================
  // 🔌 SOCKET (TEMPO REAL)
  // =========================================================================
  private connectSocket() {
    if (this.ws) {
      try { this.ws.terminate(); } catch (e) {}
    }

    console.log(`🔌 Conectando WebSocket...`);
    this.ws = new WebSocket(this.wsUrl, { headers: this.headers });

    this.ws.on('open', () => {
      console.log('✅ Socket Conectado! (Live)');
      this.ws?.send('420["cmd", {"id": "subscribe", "payload": {"room": "double_v2"}}]');
      this.startHeartbeat();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      const msg = data.toString();
      
      if (msg === '2') {
        this.ws?.send('3');
        return;
      }

      if (msg.startsWith('42')) {
        try {
          const json = JSON.parse(msg.substring(2));
          const payload = json[1];

          if (payload && payload.status === 'complete' && typeof payload.color === 'number') {
            this.saveResult({
              id: payload.id,
              color: payload.color,
              roll: payload.roll,
              created_at: payload.created_at || new Date().toISOString()
            }, 'SOCKET');
          }
        } catch (e) {}
      }
    });

    this.ws.on('close', () => {
      console.log('❌ Socket caiu. Reconectando...');
      this.cleanupSocket();
      setTimeout(() => this.connectSocket(), 5000);
    });

    this.ws.on('error', (err) => {
        if (!err.message.includes('503')) console.error('Erro Socket:', err.message);
    });
  }

  private startHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('2');
    }, 25000);
  }

  private cleanupSocket() {
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  // =========================================================================
  // 💾 PERSISTÊNCIA
  // =========================================================================
  private mapColor(colorId: number): string {
    if (colorId === 0) return 'branco';
    if (colorId === 1) return 'vermelho';
    return 'preto';
  }

  private async saveResult(data: BlazeMessage, source: string) {
    const mappedColor = this.mapColor(data.color);

    try {
      // Verifica duplicidade 
      // Se for SCRAPER, usa lógica flexível (mesmo número/cor recente)
      // Se for SOCKET, usa ID exato ou flexível
      
      let sql = 'SELECT id FROM history WHERE id = ?';
      let params: any[] = [data.id];

      // Lógica de desduplicação robusta
      // Se já existe um registro com mesmo NÚMERO e COR nos últimos 40 segundos, ignoramos
      // Isso evita que o Scraper pegue o que o Socket acabou de pegar e vice-versa
    //   const [recentDup] = await pool.query(
    //     'SELECT id FROM history WHERE created_at > NOW() - INTERVAL 40 SECOND AND number = ? AND result = ?',
    //     [data.roll, mappedColor]
    //   );

    //   if ((recentDup as any[]).length > 0) return;

      const icon = source === 'SOCKET' ? '⚡' : '🕷️';
      console.log(`${icon} [${source}] Novo: ${mappedColor.toUpperCase()} (${data.roll})`);

      await pool.execute(
        'INSERT INTO history (result, number, created_at) VALUES (?, ?, ?)',
        [mappedColor, data.roll, new Date(data.created_at)]
      );

      // Limpeza
      await pool.execute(`
        DELETE FROM history 
        WHERE id NOT IN (
          SELECT id FROM (
            SELECT id FROM history ORDER BY created_at DESC LIMIT 100
          ) as subquery
        )
      `);
    } catch (error) {
      console.error('Erro DB:', error);
    }
  }
}