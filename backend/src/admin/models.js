import mongoose from 'mongoose';

const user = new mongoose.Schema({
  email: {type:String, required:true, unique:true},
  passwordHash: {type:String, required:true},
  role: {type:String, enum:['owner'], required:true},
}, {timestamps:true});
const session = new mongoose.Schema({
  tokenHash: {type:String, required:true, unique:true},
  user: {type:mongoose.Schema.Types.ObjectId, ref:'Owner', required:true},
  csrf: {type:String, required:true},
  expires: {type:Date, required:true, expires:0},
}, {timestamps:true});
export const Owner = mongoose.model('Owner', user);
export const OwnerSession = mongoose.model('OwnerSession', session);
