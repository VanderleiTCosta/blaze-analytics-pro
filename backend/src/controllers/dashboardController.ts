// backend/src/controllers/dashboardController.ts

import { Request, Response } from 'express';
import pool from '../database.js';
import { BlazeAI } from '../services/ai.js';

export const getDashboardData = async (req: Request, res: Response) => {
  try {
    // Busca histórico (últimas 50 rodadas)
    const [historyRows] = await pool.query(`
      SELECT id, result, number, created_at 
      FROM history 
      ORDER BY created_at DESC 
      LIMIT 50
    `);
    
    // Calcula estatísticas das últimas 50 rodadas
    const [statsRows] = await pool.query(`
      SELECT 
        COUNT(CASE WHEN result = 'vermelho' THEN 1 END) as reds,
        COUNT(CASE WHEN result = 'preto' THEN 1 END) as blacks,
        COUNT(CASE WHEN result = 'branco' THEN 1 END) as whites,
        COUNT(*) as total
      FROM (
        SELECT * FROM history 
        ORDER BY created_at DESC 
        LIMIT 50
      ) as recent_history
    `);
    
    // Formata o histórico
    const history = (historyRows as any[]).map((row) => ({
      id: row.id,
      result: row.result,
      number: row.number,
      created_at: row.created_at.toISOString()
    }));
    
    const stats = (statsRows as any[])[0];
    
    // Usa a IA para análise
    const prediction = BlazeAI.analyze(history);
    
    // Formata a predição para o frontend
    let predictionColor = 'aguardar';
    if (prediction.suggestion === 'red') predictionColor = 'vermelho';
    if (prediction.suggestion === 'black') predictionColor = 'preto';
    if (prediction.suggestion === 'white') predictionColor = 'branco';
    
    res.json({
      history,
      stats,
      prediction: {
        color: predictionColor,
        confidence: prediction.confidence,
        message: prediction.reason
      }
    });
    
  } catch (error: any) {
    console.error('Erro no dashboard:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};