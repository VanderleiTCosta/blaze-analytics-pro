// scripts/startScraper.ts
import { BlazeScraper } from '../services/blazeScraper.js';

async function main() {
    console.log('🚀 Iniciando scraper da Blaze...');
    
    try {
        const blazeScraper = new BlazeScraper();
        console.log('✅ Scraper iniciado com sucesso!');
        
        // Manter o script rodando
        process.on('SIGINT', async () => {
            console.log('\n🛑 Recebido SIGINT, parando scraper...');
            await blazeScraper.stop();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('\n🛑 Recebido SIGTERM, parando scraper...');
            await blazeScraper.stop();
            process.exit(0);
        });
        
        // Manter processo ativo
        setInterval(() => {
            // Apenas manter vivo
        }, 60000);
        
    } catch (error) {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    }
}

main();