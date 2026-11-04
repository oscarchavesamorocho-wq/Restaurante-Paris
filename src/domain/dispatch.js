import crypto from 'node:crypto';
import { DISPATCH_STATUS, ITEM_STATUS } from '../../shared/domain.js';
import { db, nowIso, transaction } from '../db/index.js';
import { conflict, notFound } from './errors.js';
import { getOrderOrThrow, recomputeOrderStatus, serializeItem } from './orders.js';

function serializeDispatch(row, items) {
  return {
    id: row.id,
    orderId: row.order_id,
    orderStatus: row.order_status,
    tableId: row.table_id,
    tableName: row.table_name,
    status: row.status,
    createdBy: row.created_by_name || null,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at || null,
    items: items.map((item) => ({
      ...serializeItem(item),
      tableName: row.table_name,
      tableId: row.table_id,
    })),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

const DISPATCH_SELECT = `
  SELECT d.*, o.status AS order_status, o.table_id, t.name AS table_name, u.name AS created_by_name
  FROM dispatches d
  JOIN orders o ON o.id = d.order_id
  JOIN restaurant_tables t ON t.id = o.table_id
  LEFT JOIN users u ON u.id = d.created_by
`;

function itemsForDispatch(dispatchId) {
  return db.prepare(`
    SELECT oi.* FROM dispatch_items di
    JOIN order_items oi ON oi.id = di.item_id
    WHERE di.dispatch_id = ?
    ORDER BY oi.created_at ASC
  `).all(dispatchId);
}

export function getDispatch(id) {
  const row = db.prepare(`${DISPATCH_SELECT} WHERE d.id = ?`).get(id);
  if (!row) throw notFound('El despacho no existe.');
  return serializeDispatch(row, itemsForDispatch(id));
}

export function listDispatches({ status = null, limit = 60 } = {}) {
  const where = [];
  const params = [];
  if (status) {
    where.push('d.status = ?');
    params.push(status);
  }
  params.push(Math.min(200, Math.max(1, Number(limit) || 60)));
  const rows = db.prepare(`
    ${DISPATCH_SELECT}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY d.created_at DESC
    LIMIT ?
  `).all(...params);
  return rows.map((row) => serializeDispatch(row, itemsForDispatch(row.id)));
}

export function listReadyGroups() {
  const orders = db.prepare(`
    SELECT o.id, o.table_id, o.status, o.created_at, t.name AS table_name
    FROM orders o
    JOIN restaurant_tables t ON t.id = o.table_id
    WHERE o.status IN ('abierto', 'en_cocina', 'listo')
      AND EXISTS (
        SELECT 1 FROM order_items oi
        WHERE oi.order_id = o.id
          AND oi.status = 'listo'
          AND NOT EXISTS (
            SELECT 1 FROM dispatch_items di WHERE di.item_id = oi.id
          )
      )
    ORDER BY o.created_at ASC
  `).all();

  const itemStatement = db.prepare(`
    SELECT * FROM order_items oi
    WHERE oi.order_id = ?
      AND oi.status = 'listo'
      AND NOT EXISTS (
        SELECT 1 FROM dispatch_items di WHERE di.item_id = oi.id
      )
    ORDER BY oi.created_at ASC
  `);

  return orders.map((order) => {
    const items = itemStatement.all(order.id);
    return {
      orderId: order.id,
      tableId: order.table_id,
      tableName: order.table_name,
      orderStatus: order.status,
      createdAt: order.created_at,
      items: items.map(serializeItem),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  });
}

export function createDispatch(orderId, actor) {
  const dispatchId = crypto.randomUUID();
  const now = nowIso();

  transaction(() => {
    const order = getOrderOrThrow(orderId);
    if (order.status === 'cerrado' || order.status === 'cancelado') {
      throw conflict('El pedido ya está cerrado.');
    }

    const existing = db.prepare('SELECT id FROM dispatches WHERE order_id = ?').get(orderId);
    if (existing) {
      const pendingReady = db.prepare(`
        SELECT COUNT(*) AS count FROM order_items oi
        WHERE oi.order_id = ?
          AND oi.status = 'listo'
          AND NOT EXISTS (SELECT 1 FROM dispatch_items di WHERE di.item_id = oi.id)
      `).get(orderId).count;
      if (pendingReady === 0) {
        throw conflict('Este pedido no tiene platos listos pendientes de despacho.');
      }
    }

    const readyItems = db.prepare(`
      SELECT * FROM order_items oi
      WHERE oi.order_id = ?
        AND oi.status = 'listo'
        AND NOT EXISTS (SELECT 1 FROM dispatch_items di WHERE di.item_id = oi.id)
      ORDER BY oi.created_at ASC
    `).all(orderId);
    if (readyItems.length === 0) {
      throw conflict('No hay platos listos para despachar en este pedido.');
    }

    db.prepare(`
      INSERT INTO dispatches (id, order_id, status, created_by, created_at)
      VALUES (?, ?, 'en_ruta', ?, ?)
    `).run(dispatchId, orderId, actor.id, now);

    const insertItem = db.prepare('INSERT INTO dispatch_items (dispatch_id, item_id) VALUES (?, ?)');
    const updateItem = db.prepare('UPDATE order_items SET status = ?, updated_at = ? WHERE id = ?');
    for (const item of readyItems) {
      insertItem.run(dispatchId, item.id);
      updateItem.run(ITEM_STATUS.ON_ROUTE, now, item.id);
    }

    recomputeOrderStatus(orderId);
  });

  return getDispatch(dispatchId);
}

export function deliverDispatch(id) {
  transaction(() => {
    const row = db.prepare('SELECT * FROM dispatches WHERE id = ?').get(id);
    if (!row) throw notFound('El despacho no existe.');
    if (row.status === DISPATCH_STATUS.DELIVERED) return;

    if (row.status !== DISPATCH_STATUS.ON_ROUTE) {
      throw conflict('El despacho no está en ruta.');
    }

    const now = nowIso();
    db.prepare("UPDATE dispatches SET status = 'entregado', delivered_at = ? WHERE id = ?")
      .run(now, id);
    db.prepare(`
      UPDATE order_items SET status = 'entregado', updated_at = ?
      WHERE id IN (SELECT item_id FROM dispatch_items WHERE dispatch_id = ?)
        AND status = 'en_ruta'
    `).run(now, id);
    recomputeOrderStatus(row.order_id);
  });

  return getDispatch(id);
}
