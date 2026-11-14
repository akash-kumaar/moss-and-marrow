import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';

const port = Number(process.env.PORT) || 5000;
const host = process.env.HOST || '0.0.0.0';
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/moss_and_marrow';

async function startServer() {
  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');

    app.listen(port, host, () => {
      console.log(`Moss & Marrow API running on ${host}:${port}`);
    });
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

startServer();

