import mongoose from 'mongoose';

const enquirySchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true },
  type: { type: String, required: true, enum: ['general', 'private-dining'] },
  name: { type: String, required: true, maxlength: 100 },
  email: { type: String, required: true, maxlength: 254 },
  message: { type: String, required: true, maxlength: 2000 },
  branch: { type: String, maxlength: 100 },
}, { timestamps: true });

export default mongoose.model('Enquiry', enquirySchema);
