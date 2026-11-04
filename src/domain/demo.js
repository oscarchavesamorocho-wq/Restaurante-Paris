import { validateDemoReset } from '../../shared/validation.js';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { resetDemoData } from '../db/seed.js';
import { AppError, validationError } from './errors.js';

export function resetDemo(input, actor) {
  if (!config.demoMode) {
    throw new AppError(403, 'demo_disabled', 'El reinicio de datos demo está deshabilitado.');
  }
  const result = validateDemoReset(input);
  if (!result.valid) throw validationError(result.errors);

  const summary = resetDemoData(actor.id);
  return {
    ...summary,
    resetAt: new Date().toISOString(),
    note: 'Se restablecieron mesas, platos, reservas, pedidos y despachos. Los usuarios se conservaron.',
    tables: db.prepare('SELECT COUNT(*) AS count FROM restaurant_tables').get().count,
    dishes: db.prepare('SELECT COUNT(*) AS count FROM dishes').get().count,
  };
}
