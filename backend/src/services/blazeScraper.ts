// services/blazeScraper.ts
import puppeteer, { Browser, Page } from 'puppeteer';
import pool from '../database';

export interface BlazeResult {
    color: string;
    number: number;
    created_at: string;
    timestamp: number;
}

export class BlazeScraper {
    private isRunning: boolean = false;
    private isProcessing: boolean = false; // 🔒 Trava para evitar sobreposição
    private browser: Browser | null = null;
    private page: Page | null = null;
    private interval: NodeJS.Timeout | null = null;
    
    // URL com Modal V2 forçado
    private readonly BLAZE_URL = 'https://blaze.bet.br/pt/games/double?modal=double_history-v2_index&roomId=1';
    
    // Aumentei levemente o intervalo para dar tempo do reload acontecer sem estresse
    private readonly INTERVAL_MS = 8000; // 15 segundos (Reload leva uns 3-5s)
    private readonly MAX_RECORDS = 2000;

    constructor() {
        console.log(`🔧 BlazeScraper inicializado (Refresh Mode)`);
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('⚠️ Scraper já está rodando');
            return;
        }

        console.log('🚀 Iniciando BlazeScraper com Auto-Refresh...');
        this.isRunning = true;

        try {
            await this.initBrowser();
            
            // Primeira coleta
            await this.collectAndClean();
            
            // Loop Infinito Protegido
            this.interval = setInterval(async () => {
                if (this.isProcessing) {
                    console.log('⏳ Scraper ainda processando ciclo anterior, pulando...');
                    return;
                }
                try {
                    await this.collectAndClean();
                } catch (error) {
                    console.error('❌ Erro no ciclo:', error);
                }
            }, this.INTERVAL_MS);

            console.log(`✅ BlazeScraper rodando a cada ${this.INTERVAL_MS/1000} segundos`);
        } catch (error) {
            console.error('❌ Erro ao iniciar:', error);
            await this.stop();
            throw error;
        }
    }

    async stop(): Promise<void> {
        this.isRunning = false;
        
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }

        console.log('🛑 BlazeScraper parado');
    }

    private async initBrowser(): Promise<void> {
        console.log('🌐 Inicializando navegador...');
        
        this.browser = await puppeteer.launch({
            headless: process.env.PUPPETEER_HEADLESS === 'true',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--window-size=1920,1080'
            ],
            defaultViewport: { width: 1920, height: 1080 }
        });

        this.page = await this.browser.newPage();
        
        // Headers para parecer humano e evitar bloqueios
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        });

        await this.page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        this.page.setDefaultTimeout(45000);
        
        // A navegação inicial acontece no performScraping agora via reload
        // Mas precisamos abrir a primeira vez
        console.log('🌐 Abrindo Blaze pela primeira vez...');
        await this.page.goto(this.BLAZE_URL, { waitUntil: 'domcontentloaded' });
    }

    async collectAndClean(): Promise<BlazeResult[]> {
        this.isProcessing = true; // 🔒 Bloqueia novas execuções
        console.log('🔄 Iniciando ciclo de coleta (Refresh + Scrap)...');

        try {
            const results = await this.performScraping();
            
            if (results.length > 0) {
                await this.cleanAndSaveDatabase(results);
            }
            
            return results;
        } catch (error) {
            console.error('❌ Erro na coleta:', error);
            
            // Lógica de autorecuperação simples
            if (error instanceof Error && error.message.includes('Target closed')) {
                await this.reconnect();
            }
            return [];
        } finally {
            this.isProcessing = false; // 🔓 Libera para o próximo ciclo
        }
    }

    // ========================================================================
    // 🕷️ SCRAPING COM AUTO-REFRESH (Sua Solicitação)
    // ========================================================================
    private async performScraping(): Promise<BlazeResult[]> {
        if (!this.page) throw new Error('Página não inicializada');

        try {
            // 🔄 O SEGREDO: Reload ANTES de coletar.
            // Isso fecha e reabre o modal (devido à URL) e garante dados frescos.
            // Usamos 'domcontentloaded' que é mais rápido que carregar todas as imagens.
            // console.log('🔄 Recarregando página para atualizar modal...');
            await this.page.reload({ waitUntil: 'domcontentloaded' });
            
            // Aguarda o elemento chave aparecer (Prova que o modal abriu e carregou)
            await this.page.waitForSelector('.history__double__center', { timeout: 20000 });

            const results = await this.page.evaluate(() => {
                const data: any[] = [];
                const numbers = document.querySelectorAll('.history__double__center');
                const dates = document.querySelectorAll('.history__double__date');

                const limit = Math.min(numbers.length, dates.length, 50);

                for (let i = 0; i < limit; i++) {
                    const numEl = numbers[i];
                    const dateEl = dates[i];

                    const rawNum = numEl.textContent?.trim() || '0';
                    const number = parseInt(rawNum, 10);

                    // Regra de cores
                    let color = 'branco';
                    if (number >= 1 && number <= 6) color = 'vermelho';
                    else if (number >= 7 && number <= 14) color = 'preto';

                    // Data e Hora
                    const paragraphs = dateEl.querySelectorAll('p');
                    const dateStr = paragraphs[0]?.textContent?.trim();
                    const timeStr = paragraphs[1]?.textContent?.trim();

                    if (dateStr && timeStr) {
                        const [day, month, year] = dateStr.split('/');
                        const isoDate = `${year}-${month}-${day} ${timeStr}`;

                        data.push({
                            color,
                            number,
                            created_at: isoDate,
                            timestamp: new Date(isoDate).getTime() || Date.now()
                        });
                    }
                }
                return data;
            });

            console.log(`📊 ${results.length} resultados frescos coletados.`);
            return results;

        } catch (error) {
            // Se der timeout esperando o seletor, pode ser que o site caiu ou mudou
            console.error('⚠️ Falha ao ler dados da página (timeout ou seletor ausente).');
            throw error;
        }
    }

    private async cleanAndSaveDatabase(results: BlazeResult[]): Promise<void> {
        if (results.length === 0) return;

        // Inverte ordem: [Antigo -> Novo] para inserção correta
        const resultsToSave = [...results].reverse(); 

        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            let savedCount = 0;
            
            for (const result of resultsToSave) {
                const [res] = await connection.execute(
                    'INSERT IGNORE INTO blaze_history (color, number, created_at, source) VALUES (?, ?, ?, ?)',
                    [result.color, result.number, result.created_at, 'scraper_v2']
                );
                
                if ((res as any).affectedRows > 0) savedCount++;
            }

            if (savedCount > 0) {
                console.log(`💾 ${savedCount} novos registros salvos.`);
            }

            // Manutenção (Limpeza > 2000)
            const LIMIT_TO_KEEP = 2000;
            const [countRows] = await connection.execute('SELECT COUNT(*) as total FROM blaze_history');
            const total = (countRows as any[])[0].total;

            if (total > LIMIT_TO_KEEP) {
                await connection.execute(`
                    DELETE FROM blaze_history 
                    WHERE id NOT IN (
                        SELECT id FROM (
                            SELECT id FROM blaze_history 
                            ORDER BY id DESC 
                            LIMIT ?
                        ) AS subquery
                    )
                `, [LIMIT_TO_KEEP]);
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            console.error('❌ Erro na transação:', error);
        } finally {
            connection.release();
        }
    }

    private async reconnect(): Promise<void> {
        console.log('🔄 Tentando reconexão completa...');
        try {
            await this.stop();
            await new Promise(resolve => setTimeout(resolve, 5000));
            await this.start();
        } catch (error) {
            console.error('❌ Falha fatal na reconexão:', error);
        }
    }

    isActive(): boolean { return this.isRunning; }

    async getDatabaseStatus(): Promise<any> {
        try {
            const [countRows] = await pool.execute('SELECT COUNT(*) as total FROM blaze_history');
            const [latestRows] = await pool.execute('SELECT * FROM blaze_history ORDER BY id DESC LIMIT 5');
            return {
                total: (countRows as any[])[0].total,
                latest: latestRows,
                timestamp: new Date().toISOString()
            };
        } catch (error) { return null; }
    }

    async forceClean(): Promise<void> {
        try {
            await pool.execute('DELETE FROM blaze_history');
            console.log('✅ Banco limpo.');
        } catch (error) { console.error(error); }
    }
    
    // Método auxiliar (já que estamos usando reload, collectNow também fará refresh)
    async collectNow(): Promise<BlazeResult[]> {
        console.log('🔄 Coleta manual solicitada...');
        return await this.collectAndClean();
    }
}