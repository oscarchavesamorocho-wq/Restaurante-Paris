import { Router } from 'express';
import { DISPATCH_STATUS, PERMISSIONS } from '../../../shared/domain.js';
import { requirePermission } from '../../auth/permissions.js';
import {
  createDispatch,
  deliverDispatch,
  getDispatch,
  listDispatches,
  listReadyGroups,
} from '../../domain/dispatch.js';
import { assertUuid } from '../../domain/ids.js';
import { validationError } from '../../domain/errors.js';
import { assertEnum, assertLimit, sendData } from '../helpers.js';

export const dispatchRouter = Router();

dispatchRouter.get(
  '/ready',
  requirePermission(PERMISSIONS.DISPATCH_READ),
  (_req, res) => {
    sendData(res, listReadyGroups());
  },
);

dispatchRouter.get(
  '/',
  requirePermission(PERMISSIONS.DISPATCH_READ),
  (req, res) => {
    sendData(res, listDispatches({
      status: assertEnum(req.query.status, Object.values(DISPATCH_STATUS), 'status'),
      limit: assertLimit(req.query.limit, 200),
    }));
  },
);

dispatchRouter.post(
  '/',
  requirePermission(PERMISSIONS.DISPATCH_WRITE),
  (req, res) => {
    const orderId = req.body?.orderId;
    if (typeof orderId !== 'string') {
      throw validationError({ orderId: 'Selecciona un pedido para despachar.' });
    }
    sendData(res, createDispatch(assertUuid(orderId, 'El pedido no existe.'), req.user), 201);
  },
);

dispatchRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.DISPATCH_READ),
  (req, res) => {
    sendData(res, getDispatch(assertUuid(req.params.id, 'El despacho no existe.')));
  },
);

dispatchRouter.post(
  '/:id/deliver',
  requirePermission(PERMISSIONS.DISPATCH_WRITE),
  (req, res) => {
    const id = assertUuid(req.params.id, 'El despacho no existe.');
    sendData(res, deliverDispatch(id));
  },
);
