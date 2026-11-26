import 'dotenv/config';
import mongoose from 'mongoose';
import { Owner, OwnerSession } from './models.js';
import { hashPassword } from './auth.js';
const email=process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password=process.env.ADMIN_BOOTSTRAP_PASSWORD;
if (!email || !password || password.length<16 || password.length>256 || !process.env.MONGODB_URI) throw new Error('Provide database URI, admin email and a password of 16–256 characters through the private environment.');
try {
  await mongoose.connect(process.env.MONGODB_URI);
  const owner=await Owner.findOne({email,role:'owner'});
  if(!owner) throw new Error('Owner not found');
  owner.passwordHash=await hashPassword(password);
  await owner.save();
  await OwnerSession.deleteMany({user:owner._id});
  console.log('Password changed. Existing sessions revoked.');
} catch { console.error('Password reset failed; check the account and database connection.');process.exitCode=1; }
finally {await mongoose.disconnect();}
