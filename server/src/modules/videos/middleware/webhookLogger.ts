import { Request, Response, NextFunction } from 'express';
import WebhookEvent from '../models/WebhookEvent';

/**
 * Middleware simple para registrar todos los webhooks entrantes
 * Guarda el endpoint y el payload completo en la base de datos
 */
export const webhookLogger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Guardar el evento de webhook de forma asíncrona sin bloquear
    setImmediate(async () => {
      try {
        await WebhookEvent.create({
          endpoint: req.path,
          payload: req.body
        });
      } catch (error) {
        // Log silencioso - no queremos interrumpir el flujo del webhook
        console.error('[WebhookLogger] Error saving webhook event:', error);
      }
    });
  } catch (error) {
    // Si algo falla, solo loggear pero no interrumpir
    console.error('[WebhookLogger] Unexpected error in middleware:', error);
  }

  // Siempre continuar con el siguiente middleware
  next();
};
