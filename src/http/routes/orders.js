import { Router } from 'express';
import { ORDER_STATUS, PERMISSIONS } from '../../../shared/domain.js';
import { requirePermission } from '../../auth/permissions.js';
import { assertUuid } from '../../domain/ids.js';
import {
  cancelOrder,
  createOrder,
  getOrder,
  listOrders,
} from '../../domain/orders.js';
import { assertEnum, assertLimit, sendData } from '../helpers.js';

export const ordersRouter = Router();

ordersRouter.get(
  '/',
  requirePermission(PERMISSIONS.ORDERS_READ),
  (req, res) => {
    const tableId = req.query.tableId ? Number(req.query.tableId) : null;
    sendData(res, listOrders({
      status: assertEnum(req.query.status, ['active', ...Object.values(ORDER_STATUS)], 'status'),
      tableId: Number.isInteger(tableId) && tableId > 0 ? tableId : null,
      limit: assertLimit(req.query.limit, 200),
    }));
  },
);

ordersRouter.post(
  '/',
  requirePermission(PERMISSIONS.ORDERS_WRITE),
  (req, res) => {
    sendData(res, createOrder(req.body, req.user), 201);
  },
);

ordersRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.ORDERS_READ),
  (req, res) => {
    sendData(res, getOrder(assertUuid(req.params.id, 'El pedido no existe.')));
  },
);

ordersRouter.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.ORDERS_WRITE),
  (req, res) => {
    const id = assertUuid(req.params.id, 'El pedido no existe.');
    sendData(res, cancelOrder(id));
  },
);
