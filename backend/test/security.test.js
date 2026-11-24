import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Reservation from '../src/models/Reservation.js';
import { limitRequests, trustFrontend } from '../src/security.js';
import { botConfig, verifyReservationToken } from '../src/bot.js';

test('trusted proxy matches only resolved frontend peer', async () => {
  const trust = trustFrontend(async () => ({address:'172.20.0.5'}));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(trust('::ffff:172.20.0.5'), true);
  assert.equal(trust('172.20.0.6'), false);
});

test('Turnstile disabled, verified, expired, mismatched and incomplete configuration', async () => {
  assert.equal(await verifyReservationToken(undefined, botConfig({})), true);
  assert.throws(() => botConfig({TURNSTILE_ENABLED:'true'}));
  const config = {hostname:'restaurant.example', secret:'test-only'};
  const answer = {success:true,hostname:config.hostname,action:'reservation',challenge_ts:new Date().toISOString()};
  const check = changes => verifyReservationToken('test', config, async () => Response.json({...answer,...changes}));
  assert.equal(await check({}), true);
  for (const changes of [{success:false},{hostname:'other.example'},{action:'other'},{challenge_ts:'2000-01-01'}]) assert.equal(await check(changes), false);
});

test('window resets and separates clients', () => {
  let time = 0;
  const limit = limitRequests(1,60000,()=>time);
  const enter = ip => {
    let status = 200;
    const response = {set(){},status(n){status=n;return this;},json(){}};
    limit({ip},response,()=>{});
    return status;
  };
  assert.equal(enter('a'),200); assert.equal(enter('a'),429); assert.equal(enter('b'),200);
  time=60000; assert.equal(enter('a'),200);
});

test('local HTTP validation, limits, privacy and unavailable database', async t => {
  const server = app.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port+'/api/v1';
  const booking={branch:'whitefield',date:'2030-03-01',time:'1:30 PM',guests:2,customer:{name:'Test guest',email:'test@example.invalid'}};
  const post=(body,headers={})=>fetch(base+'/reservations',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  for(const changes of [{branch:'unknown'},{date:'2030-02-30'},{date:'2020-01-01'},{time:'midnight'},{guests:17},{status:'confirmed'},{customer:{name:'a',email:'invalid'}}])
    assert.equal((await post({...booking,...changes})).status,400);
  assert.equal((await post({...booking,notes:'x'.repeat(16000)})).status,413);
  assert.equal((await fetch(base+'/health')).status,503);
  for(let i=0;i<6;i++) await post({}, {'X-Forwarded-For':'192.0.2.'+i});
  const blocked=await post({});
  assert.equal(blocked.status,429); assert.ok(Number(blocked.headers.get('retry-after'))>0);
});

// Opt-in integration test uses only a newly named local database.
test('actual MongoDB indexes enforce retries and concurrent seating capacity', {skip:!process.env.TEST_MONGO_PORT}, async t=>{
  const port=Number(process.env.TEST_MONGO_PORT);
  const db='moss_test_'+Date.now();
  await mongoose.connect('mongodb://127.0.0.1:'+port+'/'+db);
  t.after(async()=>{await mongoose.disconnect();});
  await Reservation.init();
  const {default: isolatedApp} = await import('../src/app.js?integration');
  const server=isolatedApp.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port+'/api/v1/reservations';
  const booking={branch:'whitefield',date:'2030-03-01',time:'1:30 PM',guests:2,customer:{name:'Test guest',email:'test@example.invalid'}};
  // Separate app instance with fresh rate windows for the integration scenario.
  const headers={'Content-Type':'application/json','Idempotency-Key':'test-reservation-00001'};
  const request=(payload,key)=>fetch(url,{method:'POST',headers:{...headers,'Idempotency-Key':key},body:JSON.stringify(payload)});
  // Direct DB writes below exercise the production unique constraint independently of HTTP throttling.
  const pair = await Promise.all([request(booking,headers['Idempotency-Key']),request(booking,headers['Idempotency-Key'])]);
  assert.deepEqual(pair.map(r=>r.status).sort(),[200,201]);
  const receipts=await Promise.all(pair.map(r=>r.json()));
  assert.equal(receipts[0].data.reference, receipts[1].data.reference);
  assert.equal((await request({...booking,guests:3},headers['Idempotency-Key'])).status,409);
  assert.equal((await request(booking,'test-reservation-00002')).status,201);
  const record={...booking,date:new Date(booking.date),seatSlot:19,reference:'MM-TEST',requestKey:'test-index'};
  await Reservation.create(record);
  await assert.rejects(Reservation.create({...record,reference:'MM-SECOND',requestKey:'other'}),{code:11000});
  assert.equal(await Reservation.countDocuments(),3);
});
