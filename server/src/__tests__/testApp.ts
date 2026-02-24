// Minimal express app for testing routes without DB/EventSync side effects
import express from 'express';
import betRoutes from '../routes/betRoutes';
import activityRoutes from '../routes/activityRoutes';
import statsRoutes from '../routes/statsRoutes';
import userRoutes from '../routes/userRoutes';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/bets', betRoutes);
  app.use('/api/activity', activityRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/users', userRoutes);
  return app;
}
