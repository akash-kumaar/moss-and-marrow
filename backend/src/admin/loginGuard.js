// Failed-password limits are per client IP; successful logins clear the counter.
export function failedLoginGuard(now = Date.now) {
  const clients = new Map();
  return (req,res,next) => {
    const time=now();
    for(const [key,state] of clients) if(state.expires<=time) clients.delete(key);
    const key=req.ip;
    const state=clients.get(key);
    if(state?.blockedUntil>time) {
      const retryAfter=Math.ceil((state.blockedUntil-time)/1000);
      res.set('Retry-After',String(retryAfter));
      return res.status(429).json({message:'Two incorrect attempts. Please wait before trying again.',retryAfter});
    }
    if(!state && clients.size>=16384) return res.status(429).set('Retry-After','60').json({message:'Please retry in one minute.',retryAfter:60});
    const sendJson=res.json.bind(res);
    res.json=body=>{
      if(res.statusCode===401) {
        const current=clients.get(key)||{failures:0,expires:now()+60000};
        current.failures++;
        if(current.failures>=2) {current.blockedUntil=now()+60000;current.expires=current.blockedUntil;res.status(429).set('Retry-After','60');body={message:'Two incorrect attempts. Please wait one minute.',retryAfter:60};}
        clients.set(key,current);
      } else if(res.statusCode===200) clients.delete(key);
      return sendJson(body);
    };
    next();
  };
}
