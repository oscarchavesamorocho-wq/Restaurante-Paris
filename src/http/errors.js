import { config } from '../config.js';
import { AppError } from '../domain/errors.js';

export function apiNotFound(_req, res) {
  res.status(404).json({
    error: { code: 'not_found', message: 'El recurso solicitado no existe.' },
  });
}

export function errorHandler(error, req, res, _next) {
  if (res.headersSent) return;

  if (error instanceof AppError) {
    const body = {
      error: {
        code: error.code,
        message: error.message,
      },
    };
    if (error.fields) body.error.fields = error.fields;
    res.status(error.status).json(body);
    return;
  }

  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({
      error: { code: 'invalid_json', message: 'El cuerpo de la petición no es JSON válido.' },
    });
    return;
  }

  if (error?.type === 'entity.too.large') {
    res.status(413).json({
      error: { code: 'payload_too_large', message: 'La petición es demasiado grande.' },
    });
    return;
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: config.isProduction
        ? 'Ocurrió un error inesperado.'
        : `Error interno: ${error?.message || 'desconocido'}`,
    },
  });
}
