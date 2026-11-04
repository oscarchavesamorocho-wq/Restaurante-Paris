import { Router } from 'express';
import { PERMISSIONS } from '../../../shared/domain.js';
import { requireAuth, requirePermission } from '../../auth/permissions.js';
import { getDashboard } from '../../domain/dashboard.js';
import { listDishes } from '../../domain/orders.js';
import { listTables } from '../../domain/tables.js';
import { sendData } from '../helpers.js';

export const dashboardRouter = Router();
export const tablesRouter = Router();
export const dishesRouter = Router();

dashboardRouter.get('/', requireAuth, requirePermission(PERMISSIONS.DASHBOARD_READ), (_req, res) => {
  sendData(res, getDashboard());
});

tablesRouter.get('/', requirePermission(PERMISSIONS.TABLES_READ), (_req, res) => {
  sendData(res, listTables());
});

dishesRouter.get('/', requirePermission(PERMISSIONS.ORDERS_READ), (_req, res) => {
  sendData(res, listDishes());
});
