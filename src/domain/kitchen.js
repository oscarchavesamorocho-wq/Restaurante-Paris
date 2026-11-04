import { ITEM_STATUS } from '../../shared/domain.js';
import { db, nowIso, transaction } from '../db/index.js';
import { conflict, notFound } from './errors.js';
import { recomputeOrderStatus, serializeItem } from './orders.js';

export function listKitchenQueue() {
  const rows = db.prepare(`
    SELECT oi.*, o.table_id, o.status AS order_status, t.name AS table_name,
           o.created_at AS order_created_at
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN restaurant_tables t ON t.id = o.table_id
    WHERE oi.status IN ('en_cola', 'preparando')
      AND o.status NOT IN ('cerrado', 'cancelado')
    ORDER BY oi.created_at ASC
  `).all();

  const now = Date.now();
  return rows.map((row) => ({
    ...serializeItem(row),
    tableId: row.table_id,
    tableName: row.table_name,
    orderStatus: row.order_status,
    waitingMinutes: Math.max(0, Math.floor((now - Date.parse(row.created_at)) / 60_000)),
  }));
}

export function listKitchenReady() {
  const rows = db.prepare(`
    SELECT oi.*, o.table_id, o.status AS order_status, t.name AS table_name,
           o.created_at AS order_created_at
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN restaurant_tables t ON t.id = o.table_id
    WHERE oi.status = 'listo'
      AND o.status NOT IN ('cerrado', 'cancelado')
      AND NOT EXISTS (
        SELECT 1 FROM dispatch_items di WHERE di.item_id = oi.id
      )
    ORDER BY oi.updated_at ASC
  `).all();

  const now = Date.now();
  return rows.map((row) => ({
    ...serializeItem(row),
    tableId: row.table_id,
    tableName: row.table_name,
    orderStatus: row.order_status,
    waitingMinutes: Math.max(0, Math.floor((now - Date.parse(row.updated_at)) / 60_000)),
  }));
}

function getItemWithOrder(itemId) {
  const row = db.prepare(`
    SELECT oi.*, o.status AS order_status
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.id = ?
  `).get(itemId);
  if (!row) throw notFound('El plato no existe.');
  return row;
}

function transition(itemId, fromStatus, toStatus) {
  return transaction(() => {
    const item = getItemWithOrder(itemId);
    if (item.status === toStatus) {
      return { itemId, orderId: item.order_id, status: toStatus };
    }
    if (item.status !== fromStatus) {
      throw conflict('El plato cambió de estado. Actualiza la vista e inténtalo de nuevo.');
    }
    if (item.order_status === 'cerrado' || item.order_status === 'cancelado') {
      throw conflict('El pedido ya está cerrado.');
    }

    db.prepare('UPDATE order_items SET status = ?, updated_at = ? WHERE id = ?')
      .run(toStatus, nowIso(), itemId);
    recomputeOrderStatus(item.order_id);
    return { itemId, orderId: item.order_id, status: toStatus };
  });
}

export function startItem(itemId) {
  return transition(itemId, ITEM_STATUS.QUEUED, ITEM_STATUS.PREPARING);
}

export function markItemReady(itemId) {
  return transition(itemId, ITEM_STATUS.PREPARING, ITEM_STATUS.READY);
}
