import Reservation from './models/Reservation.js';

// The unique sparse index includes explicit nulls, but excludes missing keys.
export async function prepareReservationIndexes(model = Reservation) {
  const invalid = await model.collection.findOne({ $expr: { $or: [
    { $ne: [{ $type: '$reference' }, 'string'] },
    { $not: [{ $in: [{ $type: '$requestKey' }, ['missing', 'string', 'null']] }] },
    { $and: [
      { $ne: [{ $type: '$seatSlot' }, 'missing'] },
      { $not: [{ $in: ['$seatSlot', Array.from({ length: 20 }, (_, slot) => slot)] }] },
    ] },
  ] } }, { projection: { _id: 1 }, maxTimeMS: 15000 });
  if (invalid) throw new Error('Reservation index preflight: incompatible field types or seating slot.');
  try {
    await model.createIndexes();
  } catch (error) {
    // Mongo duplicate-key messages can include indexed values. Never emit them.
    const reason = error.code === 11000 ? 'duplicate indexed values'
      : [85, 86].includes(error.code) ? 'conflicting index definition'
      : 'index initialization unsuccessful';
    throw new Error('Reservation index preflight: ' + reason);
  }
}
