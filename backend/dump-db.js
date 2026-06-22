const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/manager-point');
  const db = mongoose.connection.db;
  
  const dateFilter = {
    $gte: new Date('InvalidDateT00:00:00.000Z'),
    $lte: new Date('InvalidDateT23:59:59.999Z')
  };
  
  const filter = {
    $and: [
      {
        $or: [
          { recorded_at: dateFilter },
          { date_record: dateFilter }
        ]
      }
    ]
  };

  const docs = await db.collection('academicrecords').find(filter).toArray();
  console.log("Matched Records:", JSON.stringify(docs.map(d => d.recorded_at), null, 2));

  process.exit(0);
}
run().catch(console.error);
