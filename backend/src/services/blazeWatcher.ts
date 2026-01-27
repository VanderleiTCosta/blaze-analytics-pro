// blazeWatcher.ts - Monitoramento Blaze com Puppeteer + @viniciusgdr/blaze (CORRIGIDO)

import puppeteer, { Browser, Page } from 'puppeteer';
import pool from '../database.js';

interface BlazeMessage {
  id: string;
  color: number; // 0 = Branco, 1 = Vermelho, 2 = Preto
  roll: number;
  created_at: string;
}

export class BlazeWatcher {
  private blazeSocket: any = null;

  constructor() {
    this.init();
  }

  // ========================================================================
  // 🚀 INICIALIZAÇÃO
  // ========================================================================
  private async init() {
    console.log('🛡️ Iniciando Monitoramento Blindado (Scraping + Socket Blaze Lib)...');

    // 1. Scraping inicial
    await this.seedViaPuppeteer();

    // // 2. Socket com @viniciusgdr/blaze
    // this.connectSocketWithLib();

    // 3. Loop infinito buscando histórico a cada 20s
    this.startHistoryLoop();
  }

  // loop infinito do histórico
  private startHistoryLoop() {
    const INTERVAL = 20_000; // 20 segundos

    setInterval(async () => {
      try {
        console.log('🔁 Loop 20s: atualizando histórico via Puppeteer...');
        await this.seedViaPuppeteer();
      } catch (err) {
        console.error('❌ Erro no loop de histórico:', err);
      }
    }, INTERVAL);
  }

  // ========================================================================
  // 🕷️ SCRAPING VIA PUPPETEER (igual ao teu original)
  // ========================================================================
  private async seedViaPuppeteer() {
    console.log('🕷️ Puppeteer: lendo histórico visual...');
    let browser: Browser | null = null;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      console.log('🕷️ Acessando Blaze...');
      await page.goto('https://blaze1.space/pt/games/double', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      await page.waitForSelector('.entries', { timeout: 20000 });

      const results = await page.evaluate(() => {
        const entries = document.querySelectorAll('.entries .entry');
        const data: any[] = [];

        entries.forEach((entry: Element) => {
          const box = entry.querySelector('.sm-box');
          if (!box) return;

          let color = -1;
          let roll = 0;

          if (box.classList.contains('red')) {
            color = 1;
            const numText = box.querySelector('.number')?.textContent;
            roll = numText ? parseInt(numText!, 10) : 0;
          } else if (box.classList.contains('black')) {
            color = 2;
            const numText = box.querySelector('.number')?.textContent;
            roll = numText ? parseInt(numText!, 10) : 0;
          } else if (box.classList.contains('white')) {
            color = 0;
            roll = 0;
          }

          if (color !== -1) {
            data.push({
              color,
              roll: isNaN(roll) ? 0 : roll,
              id: `scrap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              created_at: new Date().toISOString(),
            });
          }
        });

        return data;
      });

      console.log(`🕷️ ${results.length} registros salvos.`);
      for (const result of results) {
        await this.saveResult(result, 'SCRAPER');
      }
    } catch (error: any) {
      console.error(`⚠️ Erro Puppeteer: ${error.message}`);
    } finally {
      if (browser) await browser.close();
    }
  }

  // ========================================================================
  // 🔌 SOCKET COM @viniciusgdr/blaze (CORRIGIDO)
  // ========================================================================
//   private connectSocketWithLib() {
//   console.log('🔌 Conectando @viniciusgdr/blaze (doubles)...');

//   try {
//     this.blazeSocket = makeConnection({
//       type: 'doubles',
//       web: 'blaze',
//       cacheIgnoreRepeatedEvents: false,
//     });

//     // se a lib expuser o socket bruto:
//     if (this.blazeSocket.socket?.on) {
//       this.blazeSocket.socket.on('error', (err: any) => {
//         console.error('❌ Erro WebSocket bruto:', err?.message || err);
//       });
//     }

//     this.blazeSocket.ev.on('double.tick', (msg: any) => {
//       try {
//         console.log('🔍 double.tick:', JSON.stringify(msg, null, 2));
//         if (msg && typeof msg.color === 'number') {
//           this.saveResult(
//             {
//               id: msg.id || `double_${Date.now()}`,
//               color: msg.color,
//               roll: msg.roll || msg.number || msg.value || 0,
//               created_at: msg.created_at || msg.timestamp || new Date().toISOString(),
//             },
//             'SOCKET_LIB',
//           );
//         }
//       } catch (err) {
//         console.error('Erro double.tick:', err);
//       }
//     });

//     this.blazeSocket.ev.on('subscriptions', (subs: string[]) => {
//       console.log('📡 Subscriptions:', subs);
//     });

//     this.blazeSocket.ev.on('close', ({ code, reconnect }: any) => {
//       console.log(`❌ Close: code=${code}, reconnect=${reconnect}`);
//       if (reconnect) {
//         setTimeout(() => this.connectSocketWithLib(), 3000);
//       }
//     });

//     this.blazeSocket.ev.on('error', (err: any) => {
//       console.error('❌ Erro Blaze lib:', err);
//       setTimeout(() => this.connectSocketWithLib(), 5000);
//     });

//     console.log('✅ @viniciusgdr/blaze conectado!');
//   } catch (error) {
//     console.error('❌ Falha lib Blaze. Fallback manual em 10s...', error);
//     setTimeout(() => this.connectSocketManual(), 10000);
//   }
// }


  // ========================================================================
  // 🔌 FALLBACK MANUAL (teu código original)
  // ========================================================================
  private connectSocketManual() {
    // Coloque aqui teu connectSocket original como fallback
    console.log('🔌 Fallback: WebSocket manual (implementar se necessário)');
  }

  // ========================================================================
  // 💾 PERSISTÊNCIA (igual ao teu original)
  // ========================================================================
  private mapColor(colorId: number): string {
    if (colorId === 0) return 'branco';
    if (colorId === 1) return 'vermelho';
    return 'preto';
  }

  private async saveResult(data: BlazeMessage, source: string) {
    const mappedColor = this.mapColor(data.color);

    try {
      const [lastRows] = await pool.query(
        'SELECT id, number, result FROM history ORDER BY id DESC LIMIT 1'
      );

      const lastResult = (lastRows as any[])[0];

      if (
        lastResult &&
        lastResult.number === data.roll &&
        lastResult.result === mappedColor
      ) {
        return;
      }

      const icon = source.startsWith('SOCKET') ? '⚡' : '🕷️';
      console.log(`${icon} [${source}] ${mappedColor.toUpperCase()} (${data.roll})`);

      await pool.execute(
        'INSERT INTO history (result, number, created_at) VALUES (?, ?, ?)',
        [mappedColor, data.roll, new Date(data.created_at)]
      );

      const [countRows] = await pool.query('SELECT COUNT(*) as total FROM history');
      const total = (countRows as any[])[0].total;

      if (total > 100) {
        console.log(`🧹 Limpeza: ${total} → 100`);

        await pool.execute(`
          DELETE FROM history
          WHERE id NOT IN (
            SELECT id FROM (
              SELECT id FROM history ORDER BY id DESC LIMIT 100
            ) AS subquery
          )
        `);
      }
    } catch (error) {
      console.error('❌ Erro DB:', error);
    }
  }
}
