import { Router } from 'express';
import {
  PERMISSIONS,
  RESERVATION_STATUS,
} from '../../../shared/domain.js';
import { requirePermission } from '../../auth/permissions.js';
import {
  cancelReservation,
  completeReservation,
  createReservation,
  getReservation,
  listReservations,
  updateReservation,
} from '../../domain/reservations.js';
import { assertUuid } from '../../domain/ids.js';
import { notFound } from '../../domain/errors.js';
import { assertEnum, assertLimit, assertQueryDate, assertQueryText, sendData } from '../helpers.js';

export const reservationsRouter = Router();

reservationsRouter.get(
  '/',
  requirePermission(PERMISSIONS.RESERVATIONS_READ),
  (req, res) => {
    const tableId = req.query.tableId ? Number(req.query.tableId) : null;
    sendData(res, listReservations({
      date: assertQueryDate(req.query.date),
      status: assertEnum(req.query.status, Object.values(RESERVATION_STATUS), 'status'),
      tableId: Number.isInteger(tableId) && tableId > 0 ? tableId : null,
      q: assertQueryText(req.query.q, 'q', 80),
      limit: assertLimit(req.query.limit, 300),
    }));
  },
);

reservationsRouter.post(
  '/',
  requirePermission(PERMISSIONS.RESERVATIONS_WRITE),
  (req, res) => {
    sendData(res, createReservation(req.body, req.user), 201);
  },
);

reservationsRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.RESERVATIONS_READ),
  (req, res) => {
    sendData(res, getReservation(assertUuid(req.params.id, 'La reserva no existe.')));
  },
);

reservationsRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.RESERVATIONS_WRITE),
  (req, res) => {
    const id = assertUuid(req.params.id, 'La reserva no existe.');
    sendData(res, updateReservation(id, req.body));
  },
);

reservationsRouter.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.RESERVATIONS_WRITE),
  (req, res) => {
    const id = assertUuid(req.params.id, 'La reserva no existe.');
    sendData(res, cancelReservation(id));
  },
);

reservationsRouter.post(
  '/:id/complete',
  requirePermission(PERMISSIONS.RESERVATIONS_WRITE),
  (req, res) => {
    const id = assertUuid(req.params.id, 'La reserva no existe.');
    sendData(res, completeReservation(id));
  },
);

reservationsRouter.use((_req, _res, next) => next(notFound('La reserva no existe.')));
