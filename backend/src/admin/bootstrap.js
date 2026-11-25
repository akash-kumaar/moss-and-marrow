import 'dotenv/config';
import mongoose from 'mongoose';
import { Owner } from './models.js';
import { hashPassword } from './auth.js';

const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !password || password.length < 16 || !process.env.MONGODB_URI) {
  throw new Error('Set MONGODB_URI, ADMIN_BOOTSTRAP_EMAIL and a password of at least 16 characters in the approved local secret environment.');
}
try {
  await mongoose.connect(process.env.MONGODB_URI);
  await Owner.init();
  await Owner.create({email, passwordHash:await hashPassword(password), role:'owner'});
  console.log('Owner account created. Remove bootstrap password from the environment.');
} catch (error) {
  console.error(error.code === 11000 ? 'Owner already exists; account was not changed.' : 'Owner bootstrap failed.');
  process.exitCode=1;
} finally {await mongoose.disconnect();}
