const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/manager-point');
  const db = mongoose.connection.db;

  const startDate = "2026-03-03";
  const endDate = "2026-03-05";

  const dateFilter = {};
  if (startDate) {
    dateFilter.$gte = new Date(`${startDate}T00:00:00.000Z`);
  }
  if (endDate) {
    dateFilter.$lte = new Date(`${endDate}T23:59:59.999Z`);
  }

  const filter = {
    $or: [{ status: 'active' }, { is_deleted: false }]
  };
  filter.$and = [];
  filter.$and.push({
    $or: [
      { recorded_at: dateFilter },
      { date_record: dateFilter }
    ]
  });

  console.log("Constructed Filter:", JSON.stringify(filter, null, 2));

  const docs = await db.collection('academicrecords').find(filter).toArray();
  console.log("Matched Records COUNT:", docs.length);
  docs.forEach(d => {
    console.log(" - title:", d.record_title);
    console.log("   recorded_at:", d.recorded_at);
    console.log("   createdAt:", d.createdAt);
  });

  process.exit(0);
}
run().catch(console.error);
