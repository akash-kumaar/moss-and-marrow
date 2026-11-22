import mongoose from'mongoose';
const reservationSchema=new mongoose.Schema({reference:{type:String,unique:true,required:true},branch:{type:String,required:true},date:{type:Date,required:true},time:{type:String,required:true},guests:{type:Number,required:true,min:1},customer:{name:{type:String,required:true},email:{type:String,required:true},phone:String},status:{type:String,enum:['pending','confirmed','cancelled'],default:'pending'},notes:String},{timestamps:true});
export default mongoose.model('Reservation',reservationSchema);
