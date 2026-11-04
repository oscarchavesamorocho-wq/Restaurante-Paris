import { Router } from 'express';
import { PERMISSIONS } from '../../../shared/domain.js';
import { requirePermission } from '../../auth/permissions.js';
import { assertUuid } from '../../domain/ids.js';
import { listKitchenQueue, listKitchenReady, markItemReady, startItem } from '../../domain/kitchen.js';
import { sendData } from '../helpers.js';

export const kitchenRouter = Router();

kitchenRouter.get(
  '/queue',
  requirePermission(PERMISSIONS.KITCHEN_READ),
  (_req, res) => {
    sendData(res, listKitchenQueue());
  },
);

kitchenRouter.get(
  '/ready',
  requirePermission(PERMISSIONS.KITCHEN_READ),
  (_req, res) => {
    sendData(res, listKitchenReady());
  },
);

kitchenRouter.post(
  '/items/:id/start',
  requirePermission(PERMISSIONS.KITCHEN_WRITE),
  (req, res) => {
    sendData(res, startItem(assertUuid(req.params.id, 'El plato no existe.')));
  },
);

kitchenRouter.post(
  '/items/:id/ready',
  requirePermission(PERMISSIONS.KITCHEN_WRITE),
  (req, res) => {
    sendData(res, markItemReady(assertUuid(req.params.id, 'El plato no existe.')));
  },
);
