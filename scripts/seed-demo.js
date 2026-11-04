import { closeDb } from '../src/db/index.js';
import { ensureSeed, seedSummary } from '../src/db/seed.js';

try {
  await ensureSeed();
  const summary = seedSummary();
  console.log('[seed] Estado actual:', summary);
} catch (error) {
  console.error('[seed] Error:', error.message);
  process.exitCode = 1;
} finally {
  closeDb();
}
