export class AppError extends Error {
  constructor(status, code, message, fields = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function validationError(fields, message = 'Revisa los datos enviados.') {
  return new AppError(422, 'validation_error', message, fields);
}

export function unauthorized(message = 'Debes iniciar sesión.') {
  return new AppError(401, 'unauthorized', message);
}

export function forbidden(message = 'No tienes permisos para esta acción.') {
  return new AppError(403, 'forbidden', message);
}

export function notFound(message = 'El recurso no existe.') {
  return new AppError(404, 'not_found', message);
}

export function conflict(message, fields = null) {
  return new AppError(409, 'conflict', message, fields);
}

export function badRequest(message, fields = null) {
  return new AppError(400, 'bad_request', message, fields);
}
