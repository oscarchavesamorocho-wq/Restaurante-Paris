import { TABLE_STATUS } from '../../shared/domain.js';
import { db } from '../db/index.js';
import { notFound } from './errors.js';
import { todayInTz } from './time.js';

function serializeTable(row, activeOrder, reservation) {
  let status = TABLE_STATUS.AVAILABLE;
  if (activeOrder) status = TABLE_STATUS.OCCUPIED;
  else if (reservation) status = TABLE_STATUS.RESERVED;

  return {
    id: row.id,
    number: row.number,
    name: row.name,
    capacity: row.capacity,
    zone: row.zone,
    active: Boolean(row.active),
    status,
    activeOrder: activeOrder
      ? { id: activeOrder.id, status: activeOrder.status, createdAt: activeOrder.created_at }
      : null,
    reservation: reservation
      ? {
          id: reservation.id,
          customerName: reservation.customer_name,
          time: reservation.time,
          people: reservation.people,
          status: reservation.status,
        }
      : null,
  };
}

export function listTables() {
  const rows = db.prepare(`
    SELECT * FROM restaurant_tables WHERE active = 1 ORDER BY number
  `).all();
  const today = todayInTz();

  const orderStatement = db.prepare(`
    SELECT id, status, created_at FROM orders
    WHERE table_id = ? AND status IN ('abierto', 'en_cocina', 'listo')
    ORDER BY created_at DESC LIMIT 1
  `);
  const reservationStatement = db.prepare(`
    SELECT id, customer_name, time, people, status FROM reservations
    WHERE table_id = ? AND date = ? AND status = 'activa'
    ORDER BY time ASC LIMIT 1
  `);

  return rows.map((row) => serializeTable(
    row,
    orderStatement.get(row.id),
    reservationStatement.get(row.id, today),
  ));
}

export function getTableOrThrow(id) {
  const row = db.prepare('SELECT * FROM restaurant_tables WHERE id = ? AND active = 1').get(id);
  if (!row) throw notFound('La mesa no existe.');
  return row;
}
