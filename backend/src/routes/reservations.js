import { randomUUID, createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import Reservation from '../models/Reservation.js';

import { botConfig, verifyReservationToken } from '../bot.js';
const router = Router();
const challenge = botConfig();
router.get('/config', (req,res) => res.json({siteKey:challenge?.siteKey ?? null}));
const schema = z.object({
  branch: z.enum(['whitefield', 'koramangala', 'indiranagar']),
  date: z.string().date(),
  time: z.enum(['12:30 PM','1:30 PM','7:30 PM','8:30 PM']),
  guests: z.number().int().min(1).max(16),
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    phone: z.string().regex(/^[+\d ()-]{7,25}$/).refine(value => (value.match(/\d/g) || []).length >= 7).optional(),
  }).strict(),
  notes: z.string().max(1000).optional(),
}).strict();

function receipt(record) {
  const {reference, branch, date, time, guests, status} = record;
  return {data:{reference, branch, date, time, guests, status}};
}

router.post('/', async (req, res, next) => {
  try {
    const {turnstileToken, ...details} = req.body || {};
    const input = schema.parse(details);
    const key = req.get('Idempotency-Key');
    if (key !== undefined && !/^[a-zA-Z0-9_-]{16,128}$/.test(key)) return res.status(400).json({message:'Invalid reservation key.'});
    const digest = value => createHash('sha256').update(value).digest('hex');
    const requestKey = key && digest(key);
    const fingerprint = digest(JSON.stringify(input));
    async function replay() {
      const prior = await Reservation.findOne({requestKey});
      if (!prior) return false;
      if (prior.fingerprint === fingerprint) res.json(receipt(prior));
      else res.status(409).json({message:'Reservation key already used for different details.'});
      return true;
    }
    if (requestKey && await replay()) return;
    const hour = Number(input.time.split(':')[0]) % 12 + 12;
    if (Date.parse(input.date + 'T' + hour + ':30:00+05:30') <= Date.now()) return res.status(400).json({message:'Choose a future seating.'});
    try {
      if (!await verifyReservationToken(turnstileToken, challenge)) return res.status(400).json({message:'Complete verification and try again.'});
    } catch {
      return res.status(503).json({message:'Verification temporarily unavailable. Please retry.'});
    }
    input.date = new Date(input.date);
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
    const legacyCount = count ? await Reservation.countDocuments({
      branch:input.branch, date:{ $gte:start, $lt:end }, time:input.time,
      status:{$in:['pending','confirmed']}, seatSlot:{$exists:false},
    }) : 0;
    for (let seatSlot = legacyCount; seatSlot < 20; seatSlot++) {
      try {
        const data = await Reservation.create({ ...input, reference, seatSlot, ...(requestKey && {requestKey, fingerprint}) });
        return res.status(201).json(receipt(data));
      } catch (err) {
        if (requestKey && err.code === 11000 && await replay()) return;
        if (err.code === 11000 && err.keyPattern?.seatSlot) continue;
        throw err;
      }
    }
    return res.status(409).json({message:'That seating is fully booked.'});
  } catch (error) {
    next(error);
  }
});
export default router;
