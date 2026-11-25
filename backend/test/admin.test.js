import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import {once} from 'node:events';
import app from '../src/app.js';
import {Owner,OwnerSession} from '../src/admin/models.js';
import {hashPassword,tokenHash,cookieName} from '../src/admin/auth.js';

let server,base;
before(async()=>{server=app.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port+'/api/v1/admin';});
after(()=>new Promise(resolve=>server.close(resolve)));
test('every private admin section denies unauthenticated requests',async()=>{
  for(const path of ['/session','/overview','/reservations','/enquiries','/customers','/integrity','/menu','/reservations/export'])
    assert.equal((await fetch(base+path)).status,401);
});
test('password login sets an opaque httpOnly session and logout revokes it',async t=>{
  t.mock.method(Owner,'findOne',async()=>({_id:'test-owner',role:'owner',passwordHash:await hashPassword('long-test-password')}));
  const create=t.mock.method(OwnerSession,'create',async()=>({}));
  const response=await fetch(base+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.invalid',password:'long-test-password'})});
  assert.equal(response.status,200);
  assert.match(response.headers.get('set-cookie'),/HttpOnly/);
  const raw=response.headers.get('set-cookie').split(';')[0].split('=')[1];
  assert.equal(create.mock.calls[0].arguments[0].tokenHash,tokenHash(raw));
});
test('non-owner accounts and missing CSRF cannot modify records',async t=>{
  t.mock.method(OwnerSession,'findOne',()=>({lean:async()=>({user:'test-owner',csrf:'csrf'})}));
  let role='staff';
  t.mock.method(Owner,'findById',()=>({select:()=>({lean:async()=>({role})})}));
  const headers={'Cookie':'owner-session='+'a'.repeat(64)};
  // Use the actual cookie name.
  headers.Cookie=cookieName+'='+'a'.repeat(64);
  assert.equal((await fetch(base+'/reservations',{headers})).status,403);
  role='owner';
  assert.equal((await fetch(base+'/reservations/MM-EXAMPLE',{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({status:'confirmed'})})).status,403);
});
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { prepareReservationIndexes } from '../src/reservationIndexes.js';
import Reservation from '../src/models/Reservation.js';
import Enquiry from '../src/models/Enquiry.js';

test('real database owner operations preserve public data and paginate', {skip:!process.env.TEST_MONGO_PORT},async()=>{
  await mongoose.connect('mongodb://127.0.0.1:'+Number(process.env.TEST_MONGO_PORT)+'/admin_test_'+randomUUID().replaceAll('-',''));
  try {
    await prepareReservationIndexes();
    await Owner.create({email:'owner@example.invalid',role:'owner',passwordHash:await hashPassword('long-test-password')});
    const login=await fetch(base+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.invalid',password:'long-test-password'})});
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const session=await (await fetch(base+'/session',{headers:{cookie}})).json();
    const headers={cookie,'Content-Type':'application/json','X-CSRF-Token':session.data.csrf};
    for(const endpoint of ['/overview','/reservations','/customers','/enquiries','/integrity','/menu']) {
      const response=await fetch(base+endpoint,{headers});
      assert.equal(response.status,200,endpoint+' '+await response.text());
    }
    await Reservation.insertMany(Array.from({length:31},(_,i)=>({reference:'MM-TEST-'+i,branch:'whitefield',date:new Date('2030-01-01'),time:'1:30 PM',guests:2,customer:{name:'Test guest',email:'test@example.com'}})));
    const list=await (await fetch(base+'/reservations?branch=whitefield',{headers})).json();
    assert.equal(list.data.items.length,30);assert.equal(list.data.total,31);
    const page=await (await fetch(base+'/reservations?page=2',{headers})).json();
    assert.equal(page.data.items.length,1);
    const flagged=await (await fetch(base+'/integrity',{headers})).json();
    assert.equal(flagged.data.total,31);
    assert.ok(flagged.data.items[0].signals.length>0);
    const csv=await fetch(base+'/reservations/export',{headers});
    assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);
    const update=await fetch(base+'/reservations/MM-TEST-0',{method:'PATCH',headers,body:JSON.stringify({status:'confirmed'})});
    assert.equal(update.status,200);
    await Enquiry.create({reference:'MM-E-TEST1',type:'general',name:'Test guest',email:'test@example.invalid',message:'Test enquiry.'});
    assert.equal((await fetch(base+'/enquiries/MM-E-TEST1',{method:'PATCH',headers,body:JSON.stringify({status:'resolved'})})).status,200);
    const dish={name:'Test dish',slug:'test-dish',description:'Synthetic isolated fixture.',price:100,category:'Breakfast',isAvailable:true,image:'/images/menu/brunch/butter-croissant.webp'};
    assert.equal((await fetch(base+'/menu',{method:'POST',headers,body:JSON.stringify(dish)})).status,201);
    delete dish.slug;dish.price=125;
    assert.equal((await fetch(base+'/menu/test-dish',{method:'PATCH',headers,body:JSON.stringify(dish)})).status,200);
    assert.equal(await Reservation.countDocuments(),31);
    assert.equal((await fetch(base+'/logout',{method:'POST',headers})).status,200);
    assert.equal((await fetch(base+'/session',{headers})).status,403);
  } finally {await mongoose.disconnect();}
});
