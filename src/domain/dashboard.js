import { RESTAURANT_NAME } from '../../shared/domain.js';
import { db } from '../db/index.js';
import { listDispatches } from './dispatch.js';
import { listKitchenQueue } from './kitchen.js';
import { listTables } from './tables.js';
import { timeInTz, todayInTz, timezoneLabel } from './time.js';

export function getDashboard() {
  const today = todayInTz();
  const tables = listTables();
  const kitchen = listKitchenQueue();
  const activeDispatchList = listDispatches({ status: 'en_ruta', limit: 5 });

  const reservationsToday = db.prepare(`
    SELECT r.id, r.customer_name, r.time, r.people, r.status, t.name AS table_name
    FROM reservations r
    JOIN restaurant_tables t ON t.id = r.table_id
    WHERE r.date = ? AND r.status = 'activa'
    ORDER BY r.time ASC
    LIMIT 6
  `).all(today).map((row) => ({
    id: row.id,
    customerName: row.customer_name,
    time: row.time,
    people: row.people,
    status: row.status,
    tableName: row.table_name,
  }));

  const reservationsCount = db.prepare(`
    SELECT COUNT(*) AS count FROM reservations WHERE date = ? AND status = 'activa'
  `).get(today).count;

  return {
    restaurantName: RESTAURANT_NAME,
    today,
    time: timeInTz(),
    timezone: timezoneLabel(),
    counts: {
      reservationsToday: reservationsCount,
      pendingDishes: kitchen.length,
      activeDispatches: activeDispatchList.length,
      occupiedTables: tables.filter((table) => table.status === 'ocupada').length,
      totalTables: tables.length,
    },
    reservationsToday,
    kitchen: kitchen.slice(0, 6),
    activeDispatches: activeDispatchList,
    tables,
  };
}
