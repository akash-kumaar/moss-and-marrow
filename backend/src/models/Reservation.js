import mongoose from'mongoose';
const reservationSchema=new mongoose.Schema({reference:{type:String,unique:true,required:true},branch:{type:String,required:true},date:{type:Date,required:true},time:{type:String,required:true},guests:{type:Number,required:true,min:1},customer:{name:{type:String,required:true},email:{type:String,required:true},phone:String},status:{type:String,enum:['pending','confirmed','cancelled','completed'],default:'pending'},notes:String},{timestamps:true, autoIndex:false});
reservationSchema.add({ requestKey: String, fingerprint: String, seatSlot: Number });
reservationSchema.index({requestKey:1}, {unique:true, sparse:true});
reservationSchema.index({branch:1,time:1,status:1,date:1});
reservationSchema.index({branch:1,date:1,time:1,seatSlot:1}, {
  unique:true, partialFilterExpression:{seatSlot:{$type:'number'},status:{$in:['pending','confirmed']}},
});
export default mongoose.model('Reservation',reservationSchema);
