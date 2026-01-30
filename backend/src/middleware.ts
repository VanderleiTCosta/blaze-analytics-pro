import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// CORREÇÃO CRÍTICA: "extends Request"
// Isso diz ao TS: "AuthRequest tem tudo que uma Request tem, MAIS a propriedade user"
export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // Agora o TS sabe que 'req' tem 'headers'
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.sendStatus(401); // Unauthorized
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (err: any, user: any) => {
    if (err) {
      res.sendStatus(403); // Forbidden
      return;
    }
    req.user = user;
    next();
  });
};