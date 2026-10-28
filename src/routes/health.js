import { Router } from 'express';
import { config } from '../config.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Café backend API is running smoothly',
    app: 'Coffee & Milk Tea Shop API',
    version: '1.0.0',
    environment: config.environment,
  });
});

export default router;

