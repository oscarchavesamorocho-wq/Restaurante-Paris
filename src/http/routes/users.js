import { Router } from 'express';
import { PERMISSIONS } from '../../../shared/domain.js';
import { requirePermission } from '../../auth/permissions.js';
import { clearSessionCookie } from '../../auth/sessions.js';
import { resetDemo } from '../../domain/demo.js';
import { assertUuid } from '../../domain/ids.js';
import {
  createUser,
  listUsers,
  resetUserPassword,
  updateUser,
} from '../../domain/users.js';
import { sendData } from '../helpers.js';

export const usersRouter = Router();

usersRouter.get(
  '/',
  requirePermission(PERMISSIONS.USERS_MANAGE),
  (_req, res) => {
    sendData(res, listUsers());
  },
);

usersRouter.post(
  '/',
  requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req, res) => {
    sendData(res, await createUser(req.body), 201);
  },
);

usersRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.USERS_MANAGE),
  (req, res) => {
    const id = assertUuid(req.params.id, 'El usuario no existe.');
    sendData(res, updateUser(req.user.id, id, req.body));
  },
);

usersRouter.post(
  '/:id/password',
  requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req, res) => {
    const id = assertUuid(req.params.id, 'El usuario no existe.');
    const result = await resetUserPassword(req.user.id, id, req.body);
    if (id === req.user.id) clearSessionCookie(res);
    sendData(res, { ...result, sessionInvalidated: id === req.user.id });
  },
);

export const adminRouter = Router();

adminRouter.post(
  '/demo/reset',
  requirePermission(PERMISSIONS.DEMO_RESET),
  (req, res) => {
    sendData(res, resetDemo(req.body, req.user));
  },
);
