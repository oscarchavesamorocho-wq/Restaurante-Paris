import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { isRealIsoDate, isValidEmail, passwordProblem } from '../../shared/validation.js';
import { generateTemporaryPassword, hashPassword } from '../auth/passwords.js';
import { todayInTz } from '../domain/time.js';
import { db, nowIso } from './index.js';

const TABLES = [
  { id: 1, number: 1, name: 'Mesa 1', capacity: 2, zone: 'Salón' },
  { id: 2, number: 2, name: 'Mesa 2', capacity: 4, zone: 'Salón' },
  { id: 3, number: 3, name: 'Mesa 3', capacity: 4, zone: 'Salón' },
  { id: 4, number: 4, name: 'Mesa 4', capacity: 2, zone: 'Terraza' },
  { id: 5, number: 5, name: 'Mesa 5', capacity: 6, zone: 'Salón' },
  { id: 6, number: 6, name: 'Mesa 6', capacity: 4, zone: 'Terraza' },
  { id: 7, number: 7, name: 'Mesa 7', capacity: 8, zone: 'Salón' },
  { id: 8, number: 8, name: 'Mesa 8', capacity: 2, zone: 'Terraza' },
];

const DISHES = [
  {
    id: 1,
    name: 'Croissant de mantequilla',
    description: 'Hojaldre artesanal con mantequilla europea.',
    category: 'Panadería',
    priceCop: 6500,
  },
  {
    id: 2,
    name: 'Café americano',
    description: 'Café de origen filtrado, taza grande.',
    category: 'Bebidas',
    priceCop: 5000,
  },
  {
    id: 3,
    name: 'Capuchino',
    description: 'Espresso con leche vaporizada y espuma cremosa.',
    category: 'Bebidas',
    priceCop: 7500,
  },
  {
    id: 4,
    name: 'Tostada francesa',
    description: 'Pan brioche, canela, miel y frutos rojos.',
    category: 'Desayunos',
    priceCop: 18000,
  },
  {
    id: 5,
    name: 'Omelette de queso',
    description: 'Tres huevos, queso madurado y finas hierbas.',
    category: 'Desayunos',
    priceCop: 16000,
  },
  {
    id: 6,
    name: 'Ensalada César',
    description: 'Lechuga romana, parmesano y aderezo de la casa.',
    category: 'Entradas',
    priceCop: 22000,
  },
  {
    id: 7,
    name: 'Sándwich de pollo',
    description: 'Pollo rostizado, aguacate y pan artesanal.',
    category: 'Almuerzos',
    priceCop: 19000,
  },
  {
    id: 8,
    name: 'Tarta de manzana',
    description: 'Receta de la casa con caramelo y canela.',
    category: 'Postres',
    priceCop: 12000,
  },
];

const DEMO_USERS = [
  { role: 'admin', name: 'Administrador Café Paris', emailKey: 'demoAdminEmail' },
  { role: 'mesero', name: 'Camila Restrepo', email: 'mesero@cafeparis.local' },
  { role: 'cocina', name: 'Mateo Rincón', email: 'cocina@cafeparis.local' },
  { role: 'despacho', name: 'Valentina Cruz', email: 'despacho@cafeparis.local' },
];

function insertTables() {
  const statement = db.prepare(`
    INSERT INTO restaurant_tables (id, number, name, capacity, zone, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  for (const table of TABLES) {
    statement.run(table.id, table.number, table.name, table.capacity, table.zone);
  }
  return TABLES.length;
}

function insertDishes(isDemo) {
  const statement = db.prepare(`
    INSERT INTO dishes (id, name, description, category, price_cop, active, is_demo)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `);
  for (const dish of DISHES) {
    statement.run(dish.id, dish.name, dish.description, dish.category, dish.priceCop, isDemo ? 1 : 0);
  }
  return DISHES.length;
}

function assertDemoPassword(password) {
  const problem = passwordProblem(password);
  if (problem) {
    throw new Error(`DEMO_ADMIN_PASSWORD no cumple la política: ${problem}`);
  }
}

async function createUser({ name, email, role, password, isDemo }) {
  const now = nowIso();
  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO users (id, name, email, role, password_hash, active, is_demo, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(id, name, email.toLowerCase(), role, passwordHash, isDemo ? 1 : 0, now, now);
  return id;
}

function writeDemoCredentials(entries) {
  if (!config.demoMode || entries.length === 0) return null;
  if (config.isTest) return null;
  const filePath = path.join(config.rootDir, '.demo-credentials.txt');
  const lines = [
    'Café Paris - credenciales de demostración',
    `Generadas: ${new Date().toISOString()}`,
    'Archivo local ignorado por git. No se incluye en el ZIP.',
    '',
    ...entries.map((entry) => `${entry.role.padEnd(9)} ${entry.email}  ${entry.password}`),
    '',
    'Cambia o desactiva estas cuentas antes de cualquier uso real.',
  ];
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, { mode: 0o600 });
  return filePath;
}

async function seedDemoUsers() {
  if (!isValidEmail(config.demoAdminEmail)) {
    throw new Error('DEMO_ADMIN_EMAIL no es un correo válido.');
  }
  const adminPassword = config.demoAdminPassword || generateTemporaryPassword();
  if (config.demoAdminPassword) assertDemoPassword(adminPassword);
  const entries = [];

  const users = [];
  for (const definition of DEMO_USERS) {
    const email = definition.emailKey === 'demoAdminEmail' ? config.demoAdminEmail : definition.email;
    const password = definition.role === 'admin' ? adminPassword : generateTemporaryPassword();
    await createUser({
      name: definition.name,
      email,
      role: definition.role,
      password,
      isDemo: true,
    });
    users.push({ role: definition.role, email, password });
    entries.push({ role: definition.role, email, password });
  }

  const filePath = writeDemoCredentials(entries);
  if (!config.isTest) {
    console.log('\n[seed] Cuentas de demostración creadas:');
    for (const entry of entries) {
      console.log(`  ${entry.role.padEnd(9)} ${entry.email}  ${entry.password}`);
    }
    if (filePath) console.log(`[seed] Credenciales guardadas en ${filePath} (no incluir en el ZIP).\n`);
  }
  return users;
}

async function seedBootstrapAdmin() {
  const email = config.bootstrapAdminEmail;
  const password = config.bootstrapAdminPassword;
  if (!email || !password) {
    throw new Error(
      'No hay usuarios y BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD no están definidos. ' +
        'Configúralos una sola vez para crear el administrador inicial, o usa DEMO_MODE=true en desarrollo.',
    );
  }
  if (!isValidEmail(email)) throw new Error('BOOTSTRAP_ADMIN_EMAIL no es un correo válido.');
  assertDemoPassword(password);
  await createUser({
    name: 'Administrador',
    email,
    role: 'admin',
    password,
    isDemo: false,
  });
  console.log(`[seed] Administrador inicial creado: ${email}. Elimina las variables BOOTSTRAP_* del entorno.`);
}

function seedDemoBusiness(adminId) {
  const today = todayInTz();
  const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

  const reservationA = crypto.randomUUID();
  const reservationB = crypto.randomUUID();
  const orderA = crypto.randomUUID();
  const orderB = crypto.randomUUID();
  const dispatchB = crypto.randomUUID();

  db.prepare(`
    INSERT INTO reservations
      (id, table_id, customer_name, customer_phone, date, time, people, notes, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'activa', ?, ?, ?)
  `).run(
    reservationA, 2, 'Lucía Gómez', '+57 300 123 4567', today, '12:30', 4,
    'Cumpleaños; preparar una vela.', adminId, minutesAgo(120), minutesAgo(120),
  );
  db.prepare(`
    INSERT INTO reservations
      (id, table_id, customer_name, customer_phone, date, time, people, notes, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'activa', ?, ?, ?)
  `).run(
    reservationB, 4, 'Carlos Pérez', '+57 310 555 0199', today, '19:00', 2,
    '', adminId, minutesAgo(90), minutesAgo(90),
  );

  const insertOrder = db.prepare(`
    INSERT INTO orders (id, table_id, reservation_id, status, notes, created_by, created_at, updated_at)
    VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
  `);
  insertOrder.run(orderA, 6, 'en_cocina', 'Mesa junto a la ventana.', adminId, minutesAgo(30), minutesAgo(10));
  insertOrder.run(orderB, 7, 'listo', '', adminId, minutesAgo(50), minutesAgo(10));

  const insertItem = db.prepare(`
    INSERT INTO order_items
      (id, order_id, dish_id, dish_name, unit_price_cop, quantity, notes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const itemA1 = crypto.randomUUID();
  const itemA2 = crypto.randomUUID();
  const itemB1 = crypto.randomUUID();

  insertItem.run(itemA1, orderA, 3, 'Capuchino', 7500, 2, 'Sin azúcar.', 'preparando', minutesAgo(30), minutesAgo(15));
  insertItem.run(itemA2, orderA, 8, 'Tarta de manzana', 12000, 1, '', 'listo', minutesAgo(30), minutesAgo(8));
  insertItem.run(itemB1, orderB, 7, 'Sándwich de pollo', 19000, 1, 'Sin cebolla.', 'en_ruta', minutesAgo(50), minutesAgo(10));

  db.prepare(`
    INSERT INTO dispatches (id, order_id, status, created_by, created_at)
    VALUES (?, ?, 'en_ruta', ?, ?)
  `).run(dispatchB, orderB, adminId, minutesAgo(10));
  db.prepare('INSERT INTO dispatch_items (dispatch_id, item_id) VALUES (?, ?)').run(dispatchB, itemB1);

  return { reservations: 2, orders: 2, dispatches: 1 };
}

export async function ensureSeed() {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  let admin = db.prepare("SELECT id FROM users WHERE role = 'admin' AND active = 1 ORDER BY created_at LIMIT 1").get();

  if (userCount === 0) {
    if (config.demoMode) {
      await seedDemoUsers();
      admin = db.prepare("SELECT id FROM users WHERE role = 'admin' AND active = 1 LIMIT 1").get();
    } else {
      await seedBootstrapAdmin();
      admin = db.prepare("SELECT id FROM users WHERE role = 'admin' AND active = 1 LIMIT 1").get();
    }
  }

  if (db.prepare('SELECT COUNT(*) AS count FROM restaurant_tables').get().count === 0) {
    insertTables();
  }
  if (db.prepare('SELECT COUNT(*) AS count FROM dishes').get().count === 0) {
    insertDishes(config.demoMode);
  }

  if (config.demoMode && admin) {
    const reservationCount = db.prepare('SELECT COUNT(*) AS count FROM reservations').get().count;
    const orderCount = db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
    if (reservationCount === 0 && orderCount === 0) {
      seedDemoBusiness(admin.id);
      console.log('[seed] Datos de demostración creados (reservas, pedidos y despacho).');
    }
  }
}

export function resetDemoData(adminId) {
  if (!config.demoMode) {
    throw new Error('El reinicio de datos demo está deshabilitado fuera de DEMO_MODE.');
  }
  if (!adminId) throw new Error('Se requiere un administrador para reiniciar la demo.');

  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('DELETE FROM dispatch_items');
    db.exec('DELETE FROM dispatches');
    db.exec('DELETE FROM order_items');
    db.exec('DELETE FROM orders');
    db.exec('DELETE FROM reservations');
    db.exec('DELETE FROM dishes');
    db.exec('DELETE FROM restaurant_tables');
    insertTables();
    insertDishes(true);
    seedDemoBusiness(adminId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { tables: TABLES.length, dishes: DISHES.length, reservations: 2, orders: 2, dispatches: 1 };
}

export function seedSummary() {
  return {
    users: db.prepare('SELECT COUNT(*) AS count FROM users').get().count,
    tables: db.prepare('SELECT COUNT(*) AS count FROM restaurant_tables').get().count,
    dishes: db.prepare('SELECT COUNT(*) AS count FROM dishes').get().count,
    today: todayInTz(),
    validDate: isRealIsoDate(todayInTz()),
  };
}

export { TABLES, DISHES };
