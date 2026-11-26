import { reachableEmailDomain } from './emailDomain.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { configuredLimit, limitRequests, trustFrontend } from './security.js';
import menu from './routes/menu.js';
import reservations from './routes/reservations.js';
import enquiries from './routes/enquiries.js';
import admin from './admin/routes.js';
import imageReview from './routes/imageReview.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
if (process.env.NODE_ENV === 'production') app.set('trust proxy', trustFrontend());
app.use((req, res, next) => {
  const start = Date.now();
  const endpoint = req.path.match(/^\/api\/v1\/(reservations|enquiries|menu|health|image-review)(?:\/|$)/i)?.[1]?.toLowerCase() || 'other';
  res.on('finish', () => console.log(JSON.stringify({
    event: res.statusCode === 429 ? 'rate_limit' : 'request',
    endpoint, ip: req.ip, method: req.method, status: res.statusCode, durationMs: Date.now() - start,
  })));
  next();
});
app.get('/api/v1/health', (req, res) => mongoose.connection.readyState === 1 ? res.json({ status: 'ok' }) : res.status(503).json({status: 'unavailable'}));
const apiLimit = limitRequests(configuredLimit('API_REQUESTS_PER_MINUTE', 240), 60000);
app.use('/api/v1', (req,res,next) => {
  if (process.env.NODE_ENV !== 'production' && /^\/admin(?:\/|$)/.test(req.path)) return next();
  return apiLimit(req,res,next);
});
for (const [path, key, max] of [['reservations','RESERVATIONS_PER_10_MINUTES',12], ['enquiries','ENQUIRIES_PER_10_MINUTES',10]]) {
  app.post('/api/v1/' + path, limitRequests(configuredLimit(key, max), 600000));
}
app.use(express.json({ limit: '12kb' }));
app.post(['/api/v1/reservations','/api/v1/enquiries'], reachableEmailDomain);
app.use('/api/v1/admin', admin);
app.use('/api/v1/menu', menu);
app.use('/api/v1/reservations', reservations);
app.use('/api/v1/enquiries', enquiries);
if (process.env.NODE_ENV !== 'production') app.use('/api/v1/image-review', imageReview);
app.use((err, req, res, next) => {
  if (err.name === 'ZodError') return res.status(400).json({
    message: 'Please check the information provided.', errors: err.issues,
  });
  console.error(JSON.stringify({ event: 'request_error', kind: err.name }));
  if (/Mongo|Mongoose/.test(err.name)) return res.status(503).json({message:'Database temporarily unavailable.'});
  res.status(err.status || 500).json({
    message: err.status === 413 ? 'Request too large.' : err.status === 400 ? 'Malformed request.' : 'Something went wrong. Please try again.',
  });
});
export default app;
