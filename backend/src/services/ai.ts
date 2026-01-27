// backend/src/services/ai.ts

export interface HistoryItem {
  id: number;
  result: string; // 'branco', 'vermelho', 'preto'
  number: number;
  created_at: string | Date;
}

export interface Prediction {
  suggestion: 'red' | 'black' | 'white' | 'wait';
  confidence: number;
  reason: string;
  strategies: { name: string; active: boolean }[];
}

export class BlazeAI {
  static analyze(history: HistoryItem[]): Prediction {
    // Validação mínima
    if (!history || history.length < 5) {
      return this.createWait('Coletando base de dados...');
    }

    // =================================================================
    // 📊 PREPARAÇÃO DE DADOS
    // =================================================================
    const total = history.length;
    const reds = history.filter(h => h.result === 'vermelho').length;
    const blacks = history.filter(h => h.result === 'preto').length;
    
    // Humor do mercado (Macro)
    const redPct = (reds / total) * 100;
    const blackPct = (blacks / total) * 100;
    let marketMood = 'neutral';
    if (redPct > 55) marketMood = 'red_heavy';
    if (blackPct > 55) marketMood = 'black_heavy';

    // Dados Micro (Imediatos)
    const lastResult = history[0];
    const sequence = this.getSequence(history);
    const isChess = this.checkChessPattern(history);

    // =================================================================
    // 💎 ESTRATÉGIA DIAMANTE: PADRÃO 2x1 (SOLICITADO NA IMAGEM)
    // =================================================================
    // Detecta: V, V, P, V, V ... (Prever: P)
    // Lógica: Se temos 2 da mesma cor agora, e antes deles veio a cor oposta,
    // e antes dessa oposta vieram mais 2 da cor atual... é um 2x1 CLARO.

    if (sequence.count === 2 && sequence.color !== 'branco') {
      const currentColor = sequence.color; // Ex: vermelho
      const targetColor = currentColor === 'vermelho' ? 'black' : 'red';
      const targetColorPt = targetColor === 'black' ? 'Preto' : 'Vermelho';

      // Pega o 3º resultado (que deve ser a cor oposta para configurar 2x1)
      // history[0] e [1] são iguais (já verificado em sequence.count)
      const third = history[2];
      const fourth = history[3];
      const fifth = history[4];

      // Verifica se o 3º é válido e é a cor oposta (Ex: Preto)
      if (third && third.result !== 'branco' && third.result !== currentColor) {
        
        let confidence = 85; // Base alta
        let reason = `Padrão 2x1 detectado (2 ${currentColor}s seguidos)`;

        // REFORÇO SÊNIOR: Verifica se o ciclo anterior também foi 2x1 (V,V,P,V,V...)
        // Isso eleva a confiança para 98% (Sinal da Imagem)
        if (fourth?.result === currentColor && fifth?.result === currentColor) {
            confidence = 98;
            reason = `PADRÃO DE OURO 2x1 (Ciclo Perfeito detectado)`;
        }

        // Se o usuário pediu especificamente "sinal de preto" no padrão da imagem (V,V -> P)
        // Damos um boost extra se a cor alvo for Preto
        if (targetColor === 'black') {
            confidence += 1; 
        }

        return {
            suggestion: targetColor,
            confidence: Math.min(confidence, 99),
            reason: reason,
            strategies: [
                { name: 'Mão Fixa', active: true },
                { name: 'Gale 1', active: true },
                { name: 'Proteção Branco', active: true }
            ]
        };
      }
    }

    // =================================================================
    // 🎯 ESTRATÉGIA A: SURF DE TENDÊNCIA (Macro x Micro)
    // =================================================================
    // Se não é 2x1, verifica se é Surf (Tendência longa)
    
    if (marketMood === 'red_heavy' && lastResult.result === 'vermelho' && sequence.count >= 2) {
      return {
        suggestion: 'red',
        confidence: 90,
        reason: `Surf no Vermelho! (Dominância ${redPct.toFixed(0)}%)`,
        strategies: [{ name: 'Mão Fixa', active: true }, { name: 'Cobrir Branco', active: true }]
      };
    }

    if (marketMood === 'black_heavy' && lastResult.result === 'preto' && sequence.count >= 2) {
      return {
        suggestion: 'black',
        confidence: 90,
        reason: `Surf no Preto! (Dominância ${blackPct.toFixed(0)}%)`,
        strategies: [{ name: 'Mão Fixa', active: true }, { name: 'Cobrir Branco', active: true }]
      };
    }

    // =================================================================
    // ♟️ ESTRATÉGIA B: QUEBRA DE SEQUÊNCIA (Gale)
    // =================================================================
    // Se esticou demais (4x+), aposta contra.
    if (sequence.count >= 4 && sequence.color !== 'branco') {
      const target = sequence.color === 'vermelho' ? 'black' : 'red';
      const confidence = Math.min(95, 80 + ((sequence.count - 4) * 5));

      return {
        suggestion: target,
        confidence,
        reason: `Probabilidade de quebra após ${sequence.count}x ${sequence.color}`,
        strategies: [
          { name: 'Gale 1', active: true },
          { name: 'Gale 2', active: sequence.count >= 5 },
          { name: 'Cobrir Branco', active: true }
        ]
      };
    }

    // =================================================================
    // 🏁 ESTRATÉGIA C: PADRÃO XADREZ
    // =================================================================
    if (isChess) {
      const target = lastResult.result === 'vermelho' ? 'black' : 'red';
      return {
        suggestion: target,
        confidence: 75,
        reason: 'Padrão Ping-Pong (Xadrez) identificado',
        strategies: [{ name: 'Mão Fixa', active: true }, { name: 'Gale 1', active: true }]
      };
    }

    // =================================================================
    // 👻 ESTRATÉGIA D: PÓS-BRANCO (Memória)
    // =================================================================
    if (lastResult.result === 'branco') {
      const last10 = history.slice(0, 10);
      const recentReds = last10.filter(h => h.result === 'vermelho').length;
      const recentBlacks = last10.filter(h => h.result === 'preto').length;
      
      const target = recentReds >= recentBlacks ? 'red' : 'black';
      
      return {
        suggestion: target,
        confidence: 60,
        reason: 'Retorno à tendência recente após Branco',
        strategies: [{ name: 'Gale 1', active: true }]
      };
    }

    // =================================================================
    // ⚖️ ESTRATÉGIA E: LEI DA COMPENSAÇÃO (Fallback)
    // =================================================================
    // Se nada bateu, olha o desequilíbrio curto (últimos 20)
    const last20 = history.slice(0, 20);
    const r20 = last20.filter(h => h.result === 'vermelho').length;
    const b20 = last20.filter(h => h.result === 'preto').length;

    if (Math.abs(r20 - b20) >= 4) {
      const target = r20 > b20 ? 'black' : 'red';
      return {
        suggestion: target,
        confidence: 45,
        reason: `Compensação de curto prazo (Últimos 20: ${r20}V x ${b20}P)`,
        strategies: [{ name: 'Mão Fixa', active: true }]
      };
    }

    return this.createWait('Mercado lateralizado (sem tendência clara).');
  }

  // --- Helpers ---

  private static createWait(reason: string): Prediction {
    return {
      suggestion: 'wait',
      confidence: 10,
      reason,
      strategies: []
    };
  }

  private static getSequence(history: HistoryItem[]) {
    let count = 0;
    if (history.length === 0) return { color: '', count: 0 };
    const firstColor = history[0].result;
    for (const item of history) {
      if (item.result === firstColor) count++;
      else break;
    }
    return { color: firstColor, count };
  }

  private static checkChessPattern(history: HistoryItem[]): boolean {
    if (history.length < 3) return false;
    const clean = history.filter(h => h.result !== 'branco').slice(0, 3);
    if (clean.length < 3) return false;
    return clean[0].result !== clean[1].result && clean[1].result !== clean[2].result;
  }
}