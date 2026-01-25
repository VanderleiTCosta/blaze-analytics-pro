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
    // Se não tiver dados suficientes, aguarda
    if (!history || history.length < 5) {
      return {
        suggestion: 'wait',
        confidence: 0,
        reason: 'Coletando dados do servidor...',
        strategies: []
      };
    }

    const lastResult = history[0];
    const sequence = this.getSequence(history);
    
    // ===============================================
    // ESTRATÉGIA 1: Quebra de Sequência (Trend Reversal)
    // ===============================================
    // Se saiu a mesma cor 4x ou mais (exceto branco), a probabilidade de troca aumenta
    if (sequence.count >= 4 && sequence.color !== 'branco') {
      const opposite = sequence.color === 'vermelho' ? 'black' : 'red';
      const confidenceBase = 85;
      const confidence = Math.min(99, confidenceBase + (sequence.count * 2));

      return {
        suggestion: opposite,
        confidence,
        reason: `Tendência de quebra detectada após ${sequence.count}x ${sequence.color.toUpperCase()}`,
        strategies: [
          { name: 'Gale 1', active: true },
          { name: 'Gale 2', active: true },
          { name: 'Cobrir Branco', active: true }
        ]
      };
    }

    // ===============================================
    // ESTRATÉGIA 2: Padrão Xadrez (Alternância)
    // ===============================================
    // Detecta V, P, V, P...
    if (this.checkChessPattern(history)) {
      const nextColor = lastResult.result === 'vermelho' ? 'black' : 'red';
      return {
        suggestion: nextColor,
        confidence: 78,
        reason: 'Padrão de Alternância (Xadrez) identificado',
        strategies: [
          { name: 'Mão Fixa', active: true },
          { name: 'Gale 1', active: false }, // Xadrez é arriscado para Gale longo
          { name: 'Cobrir Branco', active: true }
        ]
      };
    }

    // ===============================================
    // ESTRATÉGIA 3: Surf no Branco (Pós-Branco)
    // ===============================================
    if (lastResult.result === 'branco') {
      // Estatística comum: Repetir a cor que veio ANTES do branco
      const preWhite = history[1]?.result;
      if (preWhite && preWhite !== 'branco') {
        return {
          suggestion: preWhite === 'vermelho' ? 'red' : 'black',
          confidence: 60,
          reason: 'Retorno à tendência pré-branco',
          strategies: [{ name: 'Gale 1', active: true }]
        };
      }
    }

    // ===============================================
    // MODO DE ESPERA (Sem padrão claro)
    // ===============================================
    return {
      suggestion: 'wait',
      confidence: 15,
      reason: 'Analisando mercado... Aguarde sinal claro.',
      strategies: []
    };
  }

  // Helper: Conta quantos resultados iguais seguidos saíram
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

  // Helper: Verifica padrão V, P, V, P (ignorando brancos antigos)
  private static checkChessPattern(history: HistoryItem[]): boolean {
    if (history.length < 4) return false;
    
    // Remove brancos para análise de xadrez limpo
    const cleanHistory = history.filter(h => h.result !== 'branco').slice(0, 4);
    if (cleanHistory.length < 4) return false;

    return (
      cleanHistory[0].result !== cleanHistory[1].result &&
      cleanHistory[1].result !== cleanHistory[2].result &&
      cleanHistory[2].result !== cleanHistory[3].result
    );
  }
}