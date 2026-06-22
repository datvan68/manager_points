const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/manager_points_test');
  const schema = new mongoose.Schema({ recorded_at: Date, date_record: String }, { strict: false });
  const Model = mongoose.model('TestRecord', schema);
  await Model.deleteMany({});
  
  await Model.create({ recorded_at: null, date_record: null, title: 'both null' });
  await Model.create({ title: 'both missing' });
  await Model.create({ recorded_at: new Date('2026-06-21T00:00:00Z'), title: 'outside range' });
  await Model.create({ date_record: '2026-03-04', title: 'string inside range' });
  
  const docs = await Model.find({
    $or: [
      { recorded_at: { $gte: new Date('2026-03-01Z'), $lte: new Date('2026-03-10Z') } },
      { date_record: { $gte: new Date('2026-03-01Z'), $lte: new Date('2026-03-10Z') } }
    ]
  });
  
  console.log('Matches:');
  docs.forEach(d => console.log(d.title));
  
  process.exit(0);
}

run().catch(console.error);
