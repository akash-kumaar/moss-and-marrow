import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import Reservation from '../models/Reservation.js';

const router = Router();
const schema = z.object({
  branch: z.string().trim().min(2).max(100),
  date: z.coerce.date(),
  time: z.string().trim().min(3).max(40),
  guests: z.number().int().min(1).max(16),
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    phone: z.string().max(40).optional(),
  }),
  notes: z.string().max(1000).optional(),
});

router.post('/', async (req, res, next) => {
  try {
    const input = schema.parse(req.body);
    // Booking dates are calendar-day values. Calculate the query bounds on copies.
    const start = new Date(input.date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const count = await Reservation.countDocuments({
      branch: input.branch, date: { $gte: start, $lt: end }, time: input.time,
      status: { $in: ['pending', 'confirmed'] },
    });
    if (count >= 20) return res.status(409).json({ message: 'That seating is fully booked.' });
    const reference = 'MM-' + randomUUID().slice(0, 13).toUpperCase();
    const data = await Reservation.create({ ...input, reference });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});
export default router;
