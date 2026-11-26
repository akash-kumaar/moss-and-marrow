import { failedLoginGuard } from './loginGuard.js';
import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import Reservation from '../models/Reservation.js';
import Enquiry from '../models/Enquiry.js';
import MenuItem from '../models/MenuItem.js';
import { Owner, OwnerSession } from './models.js';
import { authenticated, checkPassword, cookieName, cookieOptions, tokenHash } from './auth.js';
import { limitRequests } from '../security.js';

const router = Router();
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
const login = z.object({email:z.string().email().max(254),password:z.string().min(1).max(256)}).strict();
router.post('/login', failedLoginGuard(), async(req,res,next)=>{
  try {
    const input=login.parse(req.body);
    const owner=await Owner.findOne({email:input.email.trim().toLowerCase()});
    // Perform password work for unknown accounts as well.
    const valid=await checkPassword(input.password,owner?.passwordHash || ('0'.repeat(32)+':'+ '0'.repeat(128)));
    if(!owner || !valid || owner.role!=='owner') return res.status(401).json({message:'Sign-in details are incorrect.'});
    const raw=randomBytes(32).toString('hex');
    await OwnerSession.create({tokenHash:tokenHash(raw),user:owner._id,csrf:randomBytes(32).toString('hex'),expires:new Date(Date.now()+8*3600000)});
    res.cookie(cookieName,raw,{...cookieOptions,maxAge:8*3600000}).json({data:{signedIn:true}});
  } catch(error){next(error);}
});
router.use(authenticated);
router.get('/session',(req,res)=>res.json({data:{email:req.owner.email,csrf:req.ownerSession.csrf}}));
router.post('/logout',async(req,res,next)=>{
  try {await OwnerSession.deleteOne({_id:req.ownerSession._id});res.clearCookie(cookieName,cookieOptions).json({data:{signedOut:true}});}catch(error){next(error);}
});
const branches=['indiranagar','koramangala','whitefield'];
const statuses=['pending','confirmed','cancelled','completed'];
const querySchema=z.object({
  page:z.coerce.number().int().min(1).max(10000).default(1),
  q:z.string().trim().max(120).default(''),
  branch:z.enum(branches).optional(),
  status:z.string().max(20).optional(),
  from:z.string().date().optional(),to:z.string().date().optional(),
  sort:z.enum(['date','createdAt']).default('createdAt'),
  export:z.enum(['csv']).optional(),
}).strict();
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function filter(input,kind) {
  const f={};
  if(input.branch) f.branch=input.branch;
  if(input.status) {
    const valid=kind==='reservations'?statuses:['pending','resolved'];
    if(!valid.includes(input.status)) throw new z.ZodError([{code:'custom',path:['status'],message:'Invalid status'}]);
    f.status=input.status==='pending' && kind==='enquiries'?{$in:['pending',null]}:input.status;
  }
  const dateField=kind==='reservations'?'date':'createdAt';
  if(input.from||input.to) {
    f[dateField]={};
    if(input.from) f[dateField].$gte=new Date(input.from);
    if(input.to) f[dateField].$lt=new Date(Date.parse(input.to)+86400000);
  }
  if(input.q) f.$or=(kind==='reservations'?['reference','customer.name','customer.email']:['reference','name','email','message']).map(field=>({[field]:{$regex:escapeRegex(input.q),$options:'i'}}));
  return f;
}
const models={reservations:Reservation,enquiries:Enquiry,menu:MenuItem};
const withoutInternal={_id:0,__v:0,requestKey:0,fingerprint:0,seatSlot:0};
for(const kind of ['reservations','enquiries']) {
  router.get('/'+kind,async(req,res,next)=>{
    try {
      const input=querySchema.parse(req.query), f=filter(input,kind), model=models[kind];
      const [items,total]=await Promise.all([model.find(f).select(withoutInternal).sort({[input.sort]:-1,reference:1}).skip((input.page-1)*30).limit(30).lean(),model.countDocuments(f)]);
      res.json({data:{items,total,page:input.page,pages:Math.ceil(total/30)}});
    }catch(error){next(error);}
  });
  router.get('/'+kind+'/export',async(req,res,next)=>{
    try {
      const input=querySchema.parse(req.query),model=models[kind],f=filter(input,kind);
      if(await model.countDocuments(f)>5000) return res.status(422).json({message:'Narrow the filters to at most 5,000 records before exporting.'});
      const docs=await model.find(f).select(withoutInternal).sort({createdAt:-1}).limit(5000).lean();
      const fields=kind==='reservations'?['reference','branch','date','time','guests','status','name','email','phone','createdAt']:['reference','type','branch','status','name','email','message','createdAt'];
      const cell=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
      const rows=docs.map(doc=>({...doc,...doc.customer}));
      res.type('text/csv').attachment(kind+'.csv').send([fields.map(cell).join(','),...rows.map(row=>fields.map(field=>cell(row[field] instanceof Date?row[field].toISOString():row[field])).join(','))].join('\r\n'));
    }catch(error){next(error);}
  });
  router.patch('/'+kind+'/:reference',async(req,res,next)=>{
    try {
      const input=z.object({status:z.enum(kind==='reservations'?statuses:['pending','resolved'])}).strict().parse(req.body);
      const reference=z.string().regex(/^MM-(?:E-)?[A-Z0-9-]{5,30}$/).parse(req.params.reference);
      const prior=await models[kind].findOne({reference}).lean();
      if(!prior)return res.status(404).json({message:'Record not found.'});
      if(kind==='reservations' && ['cancelled','completed'].includes(prior.status) && ['pending','confirmed'].includes(input.status))
        return res.status(409).json({message:'This booking has released its seating. Create a new reservation to check capacity.'});
      const data=await models[kind].findOneAndUpdate({reference,status:prior.status},{$set:input},{new:true,runValidators:true}).select(withoutInternal).lean();
      if(!data)return res.status(404).json({message:'Record not found.'});
      res.json({data});
    }catch(error){if(error.code===11000)return res.status(409).json({message:'That seating is full. Review the reservation before confirming.'});next(error);}
  });
}
router.get('/overview',async(req,res,next)=>{
  try {
    const input=querySchema.parse(req.query),f=filter(input,'reservations');
    delete f.$or;delete f.status;
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const week=new Date(today);week.setUTCDate(week.getUTCDate()-((week.getUTCDay()+6)%7));
    const month=new Date(today.slice(0,7)+'-01');
    const end=new Date(Date.parse(today)+86400000);
    const data=await Reservation.aggregate([{$match:f},{$facet:{
      week:[{$match:{date:{$gte:week,$lt:new Date(week.getTime()+7*86400000)}}},{$count:'count'}],
      month:[{$match:{date:{$gte:month,$lt:new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,1))}}},{$count:'count'}],
      customers:[{$match:{'customer.email':{$type:'string'}}},{$group:{_id:{$toLower:{$trim:{input:'$customer.email'}}}}},{$count:'count'}],
      upcoming:[{$match:{date:{$gte:new Date(today)},status:{$in:['pending','confirmed']}}},{$group:{_id:'$branch',count:{$sum:1},guests:{$sum:'$guests'}}}],
      todayBranches:[{$match:{date:{$gte:new Date(today),$lt:end},status:{$in:['pending','confirmed']}}},{$group:{_id:'$branch',count:{$sum:1},guests:{$sum:'$guests'}}}],
      totals:[{$group:{_id:null,total:{$sum:1},guests:{$sum:'$guests'}}}],
      statuses:[{$group:{_id:'$status',count:{$sum:1}}}],
      branches:[{$group:{_id:'$branch',count:{$sum:1},guests:{$sum:'$guests'}}}],
      trend:[{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$date',timezone:'UTC'}},count:{$sum:1},guests:{$sum:'$guests'}}},{$sort:{_id:-1}},{$limit:90}],
      hours:[{$group:{_id:'$time',count:{$sum:1}}}],
      today:[{$match:{date:{$gte:new Date(today),$lt:new Date(Date.parse(today)+86400000)},status:{$in:['pending','confirmed']}}},{$group:{_id:null,count:{$sum:1},guests:{$sum:'$guests'}}}],
    }}]).option({maxTimeMS:5000});
    const enquiries=await Enquiry.countDocuments(input.branch?{branch:input.branch}:{});
    const pendingEnquiries=await Enquiry.countDocuments({status:{$in:['pending',null]},...input.branch&&{branch:input.branch}});
    res.json({data:{...data[0],enquiries,pendingEnquiries}});
  }catch(error){next(error);}
});
router.get('/customers',async(req,res,next)=>{
  try {
    const input=querySchema.parse(req.query);
    const f=filter({...input,q:'',status:undefined},'reservations');
    const stages=[{$match:{...f,'customer.email':{$type:'string'}}},{$sort:{createdAt:1}},{$group:{
      _id:{$toLower:{$trim:{input:'$customer.email'}}},name:{$last:'$customer.name'},phone:{$last:'$customer.phone'},
      bookings:{$sum:1},first:{$min:'$date'},last:{$max:'$date'},branches:{$addToSet:'$branch'},
    }}];
    if(input.q) stages.push({$match:{$or:[{_id:{$regex:escapeRegex(input.q),$options:'i'}},{name:{$regex:escapeRegex(input.q),$options:'i'}}]}});
    stages.push({$sort:{last:-1,_id:1}},{$facet:{items:[{$skip:(input.page-1)*30},{$limit:30}],total:[{$count:'count'}]}});
    const [result]=await Reservation.aggregate(stages).option({maxTimeMS:5000});
    res.json({data:{items:result.items,total:result.total[0]?.count??0}});
  } catch(error){next(error);}
});
router.get('/integrity',async(req,res,next)=>{
  try{
    const input=querySchema.parse(req.query);
    const f=filter(input,'reservations');
    const signals={$set:{signals:{$concatArrays:[
      {$cond:[{$regexMatch:{input:{$ifNull:['$customer.email','']},regex:'@(example\\.com|example\\.test|example\\.invalid)$',options:'i'}},['Reserved example email domain'],[]]},
      {$cond:[{$regexMatch:{input:{$ifNull:['$customer.name','']},regex:'^(test|load|guest[ _-]*[0-9]|user[ _-]*[0-9])',options:'i'}},['Test-like name pattern'],[]]},
      {$cond:[{$gte:['$emailCount',20]},['Email associated with 20 or more bookings'],[]]},
      {$cond:[{$gte:['$minuteCount',30]},['At least 30 bookings created in this minute'],[]]},
    ]}}};
    // Window counts are computed before filters so narrow searches cannot conceal bursts.
    const pipeline=[
      {$set:{emailKey:{$toLower:{$ifNull:['$customer.email','']}},minuteKey:{$dateTrunc:{date:'$createdAt',unit:'minute'}}}},
      {$setWindowFields:{partitionBy:'$emailKey',output:{emailCount:{$count:{},window:{documents:['unbounded','unbounded']}}}}},
      {$setWindowFields:{partitionBy:'$minuteKey',output:{minuteCount:{$count:{},window:{documents:['unbounded','unbounded']}}}}},
      signals,{$match:{...f,'signals.0':{$exists:true}}},{$sort:{createdAt:-1,reference:1}},
      {$facet:{items:[{$skip:input.export?0:(input.page-1)*30},{$limit:input.export?5001:30},{$project:{...withoutInternal,emailKey:0,minuteKey:0,emailCount:0,minuteCount:0}}],total:[{$count:'count'}]}},
    ];
    const [result]=await Reservation.aggregate(pipeline).allowDiskUse(true).option({maxTimeMS:5000});
    if(input.export) {
      if(result.items.length>5000)return res.status(422).json({message:'Narrow the filters to at most 5,000 records.'});
      const cell=value=>'"'+String(value??'').replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"';
      const rows=result.items.map(item=>[item.reference,item.customer?.name,item.customer?.email,item.branch,item.createdAt?.toISOString(),item.signals.join('; ')]);
      return res.type('text/csv').attachment('booking-integrity.csv').send([['Reference','Name','Email','Branch','Created','Review signals'],...rows].map(row=>row.map(cell).join(',')).join('\r\n'));
    }
    res.json({data:{items:result.items,total:result.total[0]?.count??0}});
  }catch(error){next(error);}
});
router.get('/menu',async(req,res,next)=>{try{res.json({data:{items:await MenuItem.find().select('-_id -__v').sort({displayOrder:1}).limit(250).lean()}});}catch(error){next(error);}});
const menuSchema=z.object({name:z.string().trim().min(2).max(120),slug:z.string().regex(/^[a-z0-9-]{2,100}$/),description:z.string().max(1500),price:z.number().min(0).max(100000),category:z.string().min(2).max(100),isAvailable:z.boolean(),image:z.string().regex(/^\/images\/[a-zA-Z0-9/_-]+\.(webp|png|jpg|jpeg)$/)}).strict();
router.post('/menu',async(req,res,next)=>{try{const data=await MenuItem.create(menuSchema.parse(req.body));res.status(201).json({data:{slug:data.slug}});}catch(error){if(error.code===11000)return res.status(409).json({message:'A dish with this slug already exists.'});next(error);}});
router.patch('/menu/:slug',async(req,res,next)=>{try{const input=menuSchema.omit({slug:true}).parse(req.body);const data=await MenuItem.findOneAndUpdate({slug:req.params.slug},{$set:input},{new:true,runValidators:true}).select('-_id -__v');if(!data)return res.status(404).json({message:'Dish not found.'});res.json({data});}catch(error){next(error);}});
export default router;
