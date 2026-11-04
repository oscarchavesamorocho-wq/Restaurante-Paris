import { Router } from 'express';
import { RESTAURANT_NAME } from '../../shared/domain.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter, dishesRouter, tablesRouter } from './routes/catalog.js';
import { dispatchRouter } from './routes/dispatch.js';
import { kitchenRouter } from './routes/kitchen.js';
import { ordersRouter } from './routes/orders.js';
import { reservationsRouter } from './routes/reservations.js';
import { adminRouter, usersRouter } from './routes/users.js';
import { sendData } from './helpers.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  sendData(res, { status: 'ok', restaurant: RESTAURANT_NAME });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/tables', tablesRouter);
apiRouter.use('/dishes', dishesRouter);
apiRouter.use('/reservations', reservationsRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/kitchen', kitchenRouter);
apiRouter.use('/dispatches', dispatchRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/admin', adminRouter);
