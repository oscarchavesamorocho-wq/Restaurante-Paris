import crypto from 'node:crypto';
import {
  RESERVATION_RULES,
  RESERVATION_STATUS,
  timeToMinutes,
} from '../../shared/domain.js';
import { validateReservation } from '../../shared/validation.js';
import { db, nowIso, transaction } from '../db/index.js';
import { conflict, notFound, validationError } from './errors.js';
import { getTableOrThrow } from './tables.js';
import { timeInTz, todayInTz } from './time.js';

function serialize(row) {
  return {
    id: row.id,
    tableId: row.table_id,
    tableName: row.table_name,
    tableCapacity: row.table_capacity,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    date: row.date,
    time: row.time,
    people: row.people,
    notes: row.notes,
    status: row.status,
    createdBy: row.created_by_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_BASE = `
  SELECT r.*, t.name AS table_name, t.capacity AS table_capacity, u.name AS created_by_name
  FROM reservations r
  JOIN restaurant_tables t ON t.id = r.table_id
  LEFT JOIN users u ON u.id = r.created_by
`;

export function listReservations(filters = {}) {
  const where = [];
  const params = [];

  if (filters.date) {
    where.push('r.date = ?');
    params.push(filters.date);
  }
  if (filters.status) {
    where.push('r.status = ?');
    params.push(filters.status);
  }
  if (filters.tableId) {
    where.push('r.table_id = ?');
    params.push(filters.tableId);
  }
  if (filters.q) {
    where.push('(r.customer_name LIKE ? OR r.customer_phone LIKE ?)');
    const term = `%${filters.q}%`;
    params.push(term, term);
  }

  const limit = Math.min(300, Math.max(1, Number(filters.limit) || 200));
  params.push(limit);
  const sql = `${SELECT_BASE}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY r.date DESC, r.time ASC
    LIMIT ?
  `;
  return db.prepare(sql).all(...params).map(serialize);
}

export function getReservationOrThrow(id) {
  const row = db.prepare(`${SELECT_BASE} WHERE r.id = ?`).get(id);
  if (!row) throw notFound('La reserva no existe.');
  return row;
}

export function getReservation(id) {
  return serialize(getReservationOrThrow(id));
}

function assertNoOverlap({ tableId, date, time, excludeId = null }) {
  const rows = db.prepare(`
    SELECT id, time FROM reservations
    WHERE table_id = ? AND date = ? AND status = 'activa' AND id <> ?
  `).all(tableId, date, excludeId || '');
  const target = timeToMinutes(time);
  const overlapping = rows.some(
    (row) => Math.abs(timeToMinutes(row.time) - target) < RESERVATION_RULES.slotMinutes,
  );
  if (overlapping) {
    throw conflict(
      'La mesa ya tiene una reserva en un horario cercano. Elige otra hora o mesa.',
      { time: 'Horario no disponible para esta mesa.' },
    );
  }
}

export function createReservation(input, actor) {
  const tableId = Number(input?.tableId);
  const table = Number.isInteger(tableId) && tableId > 0 ? getTableOrThrow(tableId) : null;
  const result = validateReservation(input, {
    table,
    today: todayInTz(),
    nowTime: timeInTz(),
  });
  if (!result.valid) throw validationError(result.errors);

  assertNoOverlap(result.data);

  const id = crypto.randomUUID();
  const now = nowIso();
  db.prepare(`
    INSERT INTO reservations
      (id, table_id, customer_name, customer_phone, date, time, people, notes, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'activa', ?, ?, ?)
  `).run(
    id,
    result.data.tableId,
    result.data.customerName,
    result.data.customerPhone,
    result.data.date,
    result.data.time,
    result.data.people,
    result.data.notes,
    actor.id,
    now,
    now,
  );

  return getReservation(id);
}

export function updateReservation(id, input) {
  const current = getReservationOrThrow(id);
  if (current.status === RESERVATION_STATUS.CANCELLED) {
    throw conflict('No puedes editar una reserva cancelada.');
  }
  if (current.status === RESERVATION_STATUS.COMPLETED) {
    throw conflict('No puedes editar una reserva completada.');
  }

  const tableId = Number(input?.tableId ?? current.table_id);
  const table = Number.isInteger(tableId) && tableId > 0 ? getTableOrThrow(tableId) : null;
  const result = validateReservation(
    {
      tableId,
      customerName: input?.customerName ?? current.customer_name,
      customerPhone: input?.customerPhone ?? current.customer_phone,
      date: input?.date ?? current.date,
      time: input?.time ?? current.time,
      people: input?.people ?? current.people,
      notes: input?.notes ?? current.notes,
    },
    { table, today: todayInTz(), nowTime: timeInTz() },
  );
  if (!result.valid) throw validationError(result.errors);

  const activeOrder = db.prepare(`
    SELECT id FROM orders
    WHERE reservation_id = ? AND status IN ('abierto', 'en_cocina', 'listo')
  `).get(id);
  if (activeOrder && result.data.tableId !== current.table_id) {
    throw conflict('No puedes cambiar la mesa de una reserva con pedido activo.');
  }

  assertNoOverlap({ ...result.data, excludeId: id });

  db.prepare(`
    UPDATE reservations
    SET table_id = ?, customer_name = ?, customer_phone = ?, date = ?, time = ?,
        people = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    result.data.tableId,
    result.data.customerName,
    result.data.customerPhone,
    result.data.date,
    result.data.time,
    result.data.people,
    result.data.notes,
    nowIso(),
    id,
  );

  return getReservation(id);
}

export function cancelReservation(id) {
  const row = getReservationOrThrow(id);
  if (row.status === RESERVATION_STATUS.CANCELLED) return getReservation(id);
  if (row.status === RESERVATION_STATUS.COMPLETED) {
    throw conflict('La reserva ya está completada.');
  }
  db.prepare("UPDATE reservations SET status = 'cancelada', updated_at = ? WHERE id = ?")
    .run(nowIso(), id);
  return getReservation(id);
}

export function completeReservation(id) {
  const row = getReservationOrThrow(id);
  if (row.status === RESERVATION_STATUS.COMPLETED) return getReservation(id);
  if (row.status === RESERVATION_STATUS.CANCELLED) {
    throw conflict('La reserva está cancelada.');
  }
  const activeOrder = db.prepare(`
    SELECT id FROM orders
    WHERE reservation_id = ? AND status IN ('abierto', 'en_cocina', 'listo')
  `).get(id);
  if (activeOrder) throw conflict('Cierra el pedido asociado antes de completar la reserva.');

  db.prepare("UPDATE reservations SET status = 'completada', updated_at = ? WHERE id = ?")
    .run(nowIso(), id);
  return getReservation(id);
}

export { transaction };
