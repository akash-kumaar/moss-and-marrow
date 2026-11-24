import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';

const port = Number(process.env.PORT) || 5000;
const host = process.env.HOST || '0.0.0.0';
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/moss_and_marrow';

async function startServer() {
  try {
    mongoose.set('bufferCommands', false);
    mongoose.set('maxTimeMS', 5000);
    await mongoose.connect(mongoUri, { maxPoolSize: 12, serverSelectionTimeoutMS: 5000, waitQueueTimeoutMS: 3000 });
    await mongoose.model('Reservation').init();
    console.log('MongoDB connected successfully');

    const server = app.listen(port, host, () => {
      console.log(`Moss & Marrow API running on ${host}:${port}`);
    });
    server.requestTimeout = 20000;
    server.headersTimeout = 15000;
  } catch (err) {
    console.error('MongoDB connection failed:', err.name);
    process.exit(1);
  }
}

startServer();

