import crypto from 'node:crypto';
import {
  ITEM_STATUS,
  ORDER_RULES,
  ORDER_STATUS,
} from '../../shared/domain.js';
import { validateOrder } from '../../shared/validation.js';
import { db, nowIso, transaction } from '../db/index.js';
import { conflict, notFound, validationError } from './errors.js';
import { getTableOrThrow } from './tables.js';
import { todayInTz } from './time.js';

export function serializeItem(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    dishId: row.dish_id,
    dishName: row.dish_name,
    unitPriceCop: row.unit_price_cop,
    quantity: row.quantity,
    notes: row.notes,
    status: row.status,
    lineTotalCop: row.unit_price_cop * row.quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeOrder(row, items = null) {
  return {
    id: row.id,
    tableId: row.table_id,
    tableName: row.table_name,
    reservationId: row.reservation_id || null,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at || null,
    itemCount: Number(row.item_count ?? 0),
    pendingCount: Number(row.pending_count ?? 0),
    totalCop: Number(row.total_cop ?? 0),
    items: items ? items.map(serializeItem) : undefined,
  };
}

const ORDER_SELECT = `
  SELECT o.*, t.name AS table_name, u.name AS created_by_name,
    (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count,
    (SELECT COUNT(*) FROM order_items WHERE order_id = o.id AND status IN ('en_cola', 'preparando')) AS pending_count,
    (SELECT COALESCE(SUM(quantity * unit_price_cop), 0) FROM order_items WHERE order_id = o.id AND status <> 'cancelado') AS total_cop
  FROM orders o
  JOIN restaurant_tables t ON t.id = o.table_id
  LEFT JOIN users u ON u.id = o.created_by
`;

export function listDishes() {
  return db.prepare(`
    SELECT id, name, description, category, price_cop, active
    FROM dishes WHERE active = 1 ORDER BY category, name
  `).all().map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    priceCop: row.price_cop,
    active: Boolean(row.active),
  }));
}

export function listOrders(filters = {}) {
  const where = [];
  const params = [];
  if (filters.status === 'active') {
    where.push("o.status IN ('abierto', 'en_cocina', 'listo')");
  } else if (filters.status) {
    where.push('o.status = ?');
    params.push(filters.status);
  }
  if (filters.tableId) {
    where.push('o.table_id = ?');
    params.push(filters.tableId);
  }
  const limit = Math.min(200, Math.max(1, Number(filters.limit) || 80));
  params.push(limit);

  const rows = db.prepare(`
    ${ORDER_SELECT}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY o.created_at DESC
    LIMIT ?
  `).all(...params);

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');
  const itemRows = db.prepare(`
    SELECT * FROM order_items
    WHERE order_id IN (${placeholders})
    ORDER BY created_at ASC
  `).all(...ids);

  const itemsByOrder = new Map();
  for (const item of itemRows) {
    const list = itemsByOrder.get(item.order_id);
    if (list) list.push(item);
    else itemsByOrder.set(item.order_id, [item]);
  }

  return rows.map((row) => serializeOrder(row, itemsByOrder.get(row.id) || []));
}

export function getOrderOrThrow(id) {
  const row = db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(id);
  if (!row) throw notFound('El pedido no existe.');
  return row;
}

export function getOrder(id) {
  const row = getOrderOrThrow(id);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC').all(id);
  return serializeOrder(row, items);
}

export function recomputeOrderStatus(orderId) {
  const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
  if (!order) return;
  if (order.status === ORDER_STATUS.CLOSED || order.status === ORDER_STATUS.CANCELLED) return;

  const items = db.prepare('SELECT status FROM order_items WHERE order_id = ?').all(orderId);
  const active = items.filter((item) => item.status !== ITEM_STATUS.CANCELLED);

  let status = ORDER_STATUS.OPEN;
  if (active.length === 0) {
    status = ORDER_STATUS.CANCELLED;
  } else if (active.every((item) => item.status === ITEM_STATUS.DELIVERED)) {
    status = ORDER_STATUS.CLOSED;
  } else if (
    active.every((item) =>
      [ITEM_STATUS.READY, ITEM_STATUS.ON_ROUTE, ITEM_STATUS.DELIVERED].includes(item.status),
    )
  ) {
    status = ORDER_STATUS.READY;
  } else if (
    active.some((item) =>
      [ITEM_STATUS.PREPARING, ITEM_STATUS.READY, ITEM_STATUS.ON_ROUTE, ITEM_STATUS.DELIVERED].includes(item.status),
    )
  ) {
    status = ORDER_STATUS.IN_KITCHEN;
  }

  const closedAt = status === ORDER_STATUS.CLOSED || status === ORDER_STATUS.CANCELLED ? nowIso() : null;
  db.prepare(`
    UPDATE orders SET status = ?, updated_at = ?, closed_at = COALESCE(?, closed_at) WHERE id = ?
  `).run(status, nowIso(), closedAt, orderId);
}

export function createOrder(input, actor) {
  const tableId = Number(input?.tableId);
  const table = Number.isInteger(tableId) && tableId > 0 ? getTableOrThrow(tableId) : null;

  const rawItems = Array.isArray(input?.items) ? input.items : [];
  const dishIds = [...new Set(
    rawItems
      .map((item) => Number(item?.dishId))
      .filter((id) => Number.isInteger(id) && id > 0),
  )];

  const dishesById = new Map();
  if (dishIds.length > 0) {
    const placeholders = dishIds.map(() => '?').join(', ');
    const rows = db.prepare(`SELECT * FROM dishes WHERE id IN (${placeholders})`).all(...dishIds);
    for (const row of rows) dishesById.set(row.id, row);
  }

  const result = validateOrder(input, { table, dishesById });
  if (!result.valid) {
    const error = validationError(result.errors, 'Revisa los datos del pedido.');
    if (result.itemErrors) error.fields.itemErrors = result.itemErrors;
    throw error;
  }

  if (result.data.reservationId) {
    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(result.data.reservationId);
    if (!reservation) throw validationError({ reservationId: 'La reserva no existe.' });
    if (reservation.status !== 'activa') throw conflict('La reserva no está activa.');
    if (reservation.table_id !== result.data.tableId) {
      throw conflict('La reserva pertenece a otra mesa.');
    }
    if (reservation.date !== todayInTz()) {
      throw conflict('Solo puedes asociar reservas de hoy a un pedido.');
    }
  }

  const existing = db.prepare(`
    SELECT id FROM orders WHERE table_id = ? AND status IN ('abierto', 'en_cocina', 'listo')
  `).get(result.data.tableId);
  if (existing) {
    throw conflict('La mesa ya tiene un pedido activo.', {
      tableId: 'Cierra el pedido actual antes de abrir otro.',
    });
  }

  const orderId = crypto.randomUUID();
  const now = nowIso();
  const insertItem = db.prepare(`
    INSERT INTO order_items
      (id, order_id, dish_id, dish_name, unit_price_cop, quantity, notes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'en_cola', ?, ?)
  `);

  try {
    transaction(() => {
      db.prepare(`
        INSERT INTO orders (id, table_id, reservation_id, status, notes, created_by, created_at, updated_at)
        VALUES (?, ?, ?, 'abierto', ?, ?, ?, ?)
      `).run(
        orderId,
        result.data.tableId,
        result.data.reservationId,
        result.data.notes,
        actor.id,
        now,
        now,
      );

      for (const item of result.data.items) {
        insertItem.run(
          crypto.randomUUID(),
          orderId,
          item.dishId,
          item.dish.name,
          item.dish.price_cop,
          item.quantity,
          item.notes,
          now,
          now,
        );
      }
      recomputeOrderStatus(orderId);
    });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE constraint failed: orders.table_id')) {
      throw conflict('La mesa ya tiene un pedido activo.');
    }
    throw error;
  }

  return getOrder(orderId);
}

export function cancelOrder(id) {
  const row = getOrderOrThrow(id);
  if (row.status === ORDER_STATUS.CANCELLED) return getOrder(id);
  if (row.status === ORDER_STATUS.CLOSED) throw conflict('El pedido ya está cerrado.');

  const items = db.prepare('SELECT status FROM order_items WHERE order_id = ?').all(id);
  if (items.some((item) => [ITEM_STATUS.ON_ROUTE, ITEM_STATUS.DELIVERED].includes(item.status))) {
    throw conflict('No puedes cancelar un pedido con platos en ruta o entregados.');
  }

  transaction(() => {
    db.prepare(`
      UPDATE order_items SET status = 'cancelado', updated_at = ?
      WHERE order_id = ? AND status IN ('en_cola', 'preparando', 'listo')
    `).run(nowIso(), id);
    db.prepare("UPDATE orders SET status = 'cancelado', updated_at = ?, closed_at = ? WHERE id = ?")
      .run(nowIso(), nowIso(), id);
  });

  return getOrder(id);
}

export { ORDER_RULES, serializeOrder };
