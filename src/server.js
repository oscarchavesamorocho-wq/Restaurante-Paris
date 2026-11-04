import { createApp } from './app.js';
import { config } from './config.js';
import { closeDb, purgeExpiredSessions } from './db/index.js';
import { ensureSeed } from './db/seed.js';

async function main() {
  await ensureSeed();
  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    const displayHost = config.host === '0.0.0.0' ? 'localhost' : config.host;
    console.log(`\nCafé Paris · Sistema de reservas`);
    console.log(`Entorno: ${config.nodeEnv}`);
    console.log(`URL: http://${displayHost}:${config.port}`);
    console.log(`Zona horaria: ${config.restaurantTz}`);
    console.log(`Demo: ${config.demoMode ? 'activada' : 'desactivada'}\n`);
  });

  const cleanupTimer = setInterval(() => {
    try {
      purgeExpiredSessions();
    } catch (error) {
      console.error('[sessions] No se pudieron limpiar las sesiones expiradas:', error.message);
    }
  }, 3_600_000);
  cleanupTimer.unref();

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[server] Cerrando por ${signal}...`);
    server.close(() => {
      closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[startup] No se pudo iniciar el servidor:', error.message);
  process.exit(1);
});
