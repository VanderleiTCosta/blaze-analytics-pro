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
    private isProcessing: boolean = false; // Trava para não encavalar coletas
    private browser: Browser | null = null;
    private page: Page | null = null;
    private interval: NodeJS.Timeout | null = null;
    
    // Variável para memória visual (O que estava na tela na última checagem?)
    private lastSeenNumber: string = '';

    // URL Padrão (Sem modal, pois vamos monitorar a home primeiro)
    private readonly BLAZE_URL = 'https://blaze.bet.br/pt/games/double';
    
    // Intervalo de Monitoramento Passivo (Olhar a barra)
    private readonly MONITOR_INTERVAL_MS = 1000; // 1 segundo (Muito rápido e seguro)
    private readonly MAX_RECORDS = 2000;

    constructor() {
        console.log(`🔧 BlazeScraper inicializado (Modo Híbrido: Monitor Passivo -> Coleta Ativa)`);
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('⚠️ Scraper já está rodando');
            return;
        }

        console.log('🚀 Iniciando BlazeScraper...');
        this.isRunning = true;

        try {
            await this.initBrowser();
            
            // Primeira coleta forçada para popular o banco e calibrar o lastSeenNumber
            console.log('🏁 Realizando coleta inicial...');
            await this.collectAndClean();

            // =================================================================
            // LOOP DE MONITORAMENTO (O Segredo da Performance)
            // =================================================================
            this.interval = setInterval(async () => {
                // Se já estiver coletando (abrindo modal), não atrapalha
                if (this.isProcessing) return;

                try {
                    // 1. Apenas olha a barra horizontal (Leve)
                    const hasNewRound = await this.checkMainBarForChanges();

                    // 2. Se mudou o número, dispara a coleta detalhada (Pesada)
                    if (hasNewRound) {
                        console.log('⚡ Novo giro detectado! Iniciando coleta detalhada...');
                        await this.collectAndClean();
                    }
                } catch (error) {
                    console.error('❌ Erro no monitoramento:', error);
                }
            }, this.MONITOR_INTERVAL_MS);

            console.log(`✅ Monitor visual ativo a cada ${this.MONITOR_INTERVAL_MS}ms`);
        } catch (error) {
            console.error('❌ Erro ao iniciar scraper:', error);
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
        
        // Headers para evitar detecção
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        });

        await this.page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        this.page.setDefaultTimeout(30000);
        
        console.log('🌐 Acessando Blaze...');
        await this.page.goto(this.BLAZE_URL, { waitUntil: 'networkidle2' });
        
        // Aguarda a barra de recentes carregar (para o monitor funcionar)
        await this.page.waitForSelector('.entries', { timeout: 60000 }).catch(() => {
            console.log('⚠️ Barra de entries demorou, mas seguindo...');
        });
    }

    // ========================================================================
    // 👁️ MONITOR PASSIVO (Olha a barra horizontal)
    // ========================================================================
    private async checkMainBarForChanges(): Promise<boolean> {
        if (!this.page) return false;

        try {
            // Pega o número mais recente da barra horizontal (.entries > .entry > .number)
            const latestResult = await this.page.evaluate(() => {
                // Tenta seletor padrão da Blaze para a barra
                const entry = document.querySelector('.entries .entry:first-child .number'); 
                // Fallback caso seja branco (às vezes a classe muda ou não tem texto number direto)
                const entryBox = document.querySelector('.entries .entry:first-child .sm-box');
                
                if (entry) return entry.textContent?.trim();
                if (entryBox) return entryBox.textContent?.trim() || 'BRANCO'; // Se for branco as vezes vem vazio
                
                return null;
            });

            if (!latestResult) return false;

            // Compara com a memória
            if (latestResult !== this.lastSeenNumber) {
                // Se for a primeira vez rodando, apenas salva e não dispara (evita falso positivo no boot)
                if (this.lastSeenNumber === '') {
                    this.lastSeenNumber = latestResult;
                    return false; 
                }

                console.log(`👀 Mudança visual: ${this.lastSeenNumber} -> ${latestResult}`);
                this.lastSeenNumber = latestResult;
                return true; // GATILHO ATIVADO
            }

            return false;
        } catch (error) {
            // Erros de leitura aqui não são críticos, apenas ignora e tenta no prox segundo
            return false;
        }
    }

    // ========================================================================
    // 🔄 CONTROLADOR DE COLETA
    // ========================================================================
    async collectAndClean(): Promise<BlazeResult[]> {
        this.isProcessing = true; // Bloqueia novas coletas enquanto essa roda

        try {
            // Executa a sequência: Abrir Modal -> Ler -> Fechar
            const results = await this.performActiveScraping();
            
            if (results.length > 0) {
                // Atualiza o lastSeenNumber com o mais recente do modal para garantir sincronia
                // O results[0] no array cru do scraping é o topo da lista (mais recente)
                if (results[0]) {
                    this.lastSeenNumber = results[0].number.toString();
                }

                await this.cleanAndSaveDatabase(results);
            }
            
            return results;
        } catch (error) {
            console.error('❌ Erro na coleta ativa:', error);
            
            // Autorecuperação
            if (error instanceof Error && error.message.includes('Target closed')) {
                await this.reconnect();
            }
            return [];
        } finally {
            this.isProcessing = false; // Libera a trava
        }
    }

    // ========================================================================
    // 🕷️ COLETA ATIVA (Abre Modal -> Lê -> Fecha)
    // ========================================================================
    private async performActiveScraping(): Promise<BlazeResult[]> {
        if (!this.page) throw new Error('Página não inicializada');

        try {
            // 1. ABRIR MODAL (Se não estiver aberto)
            const isModalOpen = await this.page.$('.history__double__center');
            
            if (!isModalOpen) {
                // console.log('🔘 Abrindo modal para pegar timestamp preciso...');

                // Tenta esperar o container de botões
                try {
                    await this.page.waitForSelector('.buttons-history button', { timeout: 5000 });
                } catch (e) {}

                await this.page.evaluate(() => {
                    // Tenta clicar no botão via classe pai (Mais seguro)
                    const targetBtn = document.querySelector('.buttons-history button') as HTMLElement;
                    if (targetBtn) {
                        targetBtn.click();
                        return;
                    }
                    
                    // Fallback via SVG (Gráfico)
                    const allButtons = Array.from(document.querySelectorAll('button'));
                    const graphBtn = allButtons.find(btn => btn.innerHTML.includes('<rect y="10"'));
                    if (graphBtn) (graphBtn as HTMLElement).click();
                });

                // Espera o modal carregar
                await this.page.waitForSelector('.history__double__center', { timeout: 8000 });
            }

            // 2. LER DADOS
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

                    // Regra de Cores
                    let color = 'branco';
                    if (number >= 1 && number <= 7) color = 'vermelho';
                    else if (number >= 8 && number <= 14) color = 'preto';

                    // Data e Hora (Parsing manual DD/MM/YYYY)
                    const paragraphs = dateEl.querySelectorAll('p');
                    const dateStr = paragraphs[0]?.textContent?.trim(); // "27/01/2026"
                    const timeStr = paragraphs[1]?.textContent?.trim(); // "16:26:14"

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

            console.log(`📊 ${results.length} resultados extraídos.`);

            // 3. FECHAR MODAL
            const closeSelector = '#parent-modal-close';
            const closeBtn = await this.page.$(closeSelector);
            if (closeBtn) {
                await this.page.evaluate((sel) => {
                    const el = document.querySelector(sel) as HTMLElement;
                    if (el) el.click();
                }, closeSelector);
                
                await new Promise(r => setTimeout(r, 300)); // Pequena pausa visual
            }

            return results;

        } catch (error: any) {
            console.error(`⚠️ Falha na interação com Modal: ${error.message}`);
            // Se der erro crítico, tenta reload para limpar estado
            if (this.page && error.message.includes('timeout')) {
                try { await this.page.reload({ waitUntil: 'networkidle2' }); } catch (e) {}
            }
            throw error;
        }
    }

    private async cleanAndSaveDatabase(results: BlazeResult[]): Promise<void> {
        if (results.length === 0) return;

        // Inverte [Antigo -> Novo] para inserção correta com ID incremental
        const resultsToSave = [...results].reverse(); 

        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            let savedCount = 0;
            
            for (const result of resultsToSave) {
                const [res] = await connection.execute(
                    'INSERT IGNORE INTO blaze_history (color, number, created_at, source) VALUES (?, ?, ?, ?)',
                    [result.color, result.number, result.created_at, 'scraper_hybrid']
                );
                
                if ((res as any).affectedRows > 0) savedCount++;
            }

            if (savedCount > 0) {
                console.log(`💾 ${savedCount} novos registros salvos.`);
            }

            // Limpeza Automática (> 2000)
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
        console.log('🔄 Reconexão forçada...');
        try {
            await this.stop();
            await new Promise(resolve => setTimeout(resolve, 5000));
            await this.start();
        } catch (error) { console.error(error); }
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

    async collectNow(): Promise<BlazeResult[]> {
        return await this.collectAndClean();
    }
}