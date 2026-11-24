import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import Enquiry from '../models/Enquiry.js';

const router = Router();
const schema = z.object({
  type: z.enum(['general', 'private-dining']),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(5).max(2000),
  branch: z.enum(['indiranagar','whitefield','koramangala']).optional(),
}).strict();

router.post('/', async (req, res, next) => {
  try {
    const input = schema.parse(req.body);
    const reference = 'MM-E-' + randomUUID().slice(0, 13).toUpperCase();
    await Enquiry.create({ ...input, reference });
    res.status(201).json({ data: { reference } });
  } catch (error) {
    next(error);
  }
});

export default router;
