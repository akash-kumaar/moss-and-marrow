import { randomBytes, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { Owner, OwnerSession } from './models.js';
const scrypt = promisify(derive);
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + (await scrypt(password, salt, 64)).toString('hex');
}
export async function checkPassword(password, encoded) {
  const [salt, hex] = encoded.split(':');
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export const cookieName = process.env.NODE_ENV === 'production' ? '__Host-mm_owner' : 'mm_owner';
export const cookieOptions = {httpOnly:true, secure:process.env.NODE_ENV === 'production', sameSite:'strict', path:'/'};
export async function authenticated(req, res, next) {
  try {
    const raw = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return res.status(401).json({message:'Please sign in.'});
    const session = await OwnerSession.findOne({tokenHash:tokenHash(raw), expires:{$gt:new Date()}}).lean();
    const owner = session && await Owner.findById(session.user).select('email role').lean();
    if (!owner || owner.role !== 'owner') return res.status(403).json({message:'Owner access required.'});
    if (!['GET','HEAD'].includes(req.method) && req.get('X-CSRF-Token') !== session.csrf) return res.status(403).json({message:'Refresh your session and try again.'});
    req.owner = owner; req.ownerSession = session;
    next();
  } catch (error) {next(error);}
}
