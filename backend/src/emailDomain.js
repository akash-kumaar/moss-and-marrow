import { resolveMx } from 'node:dns/promises';

// Domain validation is not proof of mailbox ownership. No customer data is cached.
export async function reachableEmailDomain(req, res, next) {
  if (process.env.NODE_ENV !== 'production') return next();
  const email = req.body?.customer?.email || req.body?.email;
  if (typeof email !== 'string' || email.length > 254) return res.status(400).json({message:'Enter a valid email address.'});
  const domain = email.trim().split('@')[1]?.toLowerCase();
  if (!domain || /(^|\.)(example\.(com|org|net)|localhost|invalid|test)$/.test(domain)) return res.status(400).json({message:'Use a reachable email domain.'});
  let timer;
  try {
    const records = await Promise.race([resolveMx(domain), new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),2500);})]);
    if (!records.some(record=>record.exchange && record.exchange!=='.')) return res.status(400).json({message:'Use an email domain that accepts mail.'});
    next();
  } catch(error) {
    if (['ENOTFOUND','ENODATA'].includes(error.code)) return res.status(400).json({message:'Use an email domain that accepts mail.'});
    return res.status(503).json({message:'Email domain verification is temporarily unavailable. Please retry.'});
  } finally {clearTimeout(timer);}
}
