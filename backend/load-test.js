const API_URL = 'http://localhost:8000/academic-record';
const BULK_API_URL = 'http://localhost:8000/academic-record/bulk';

async function generateTestData() {
  // Using arbitrary ObjectIds for testing.
  const mongoose = require('mongoose');
  const student_id = new mongoose.Types.ObjectId().toString();
  const criterion_id = new mongoose.Types.ObjectId().toString();
  const semester_id = new mongoose.Types.ObjectId().toString();

  return { student_id, criterion_id, semester_id };
}

async function loadTest() {
  console.log('--- Starting Load Test ---');
  const { student_id, criterion_id, semester_id } = await generateTestData();

  console.log('Using IDs:', { student_id, criterion_id, semester_id });

  const totalRecords = 1000;
  const records = [];
  
  for (let i = 0; i < totalRecords; i++) {
    records.push({
      student_id,
      criterion_id,
      semester_id,
      record_title: `Test Load ${i}`,
      description: `Description ${i}`,
      status: 'active',
      source: 'manual_record',
      idempotency_key: `load-test-${student_id}-${criterion_id}-${Date.now()}-${i}`,
    });
  }

  console.log(`Sending ${totalRecords} records to Bulk API...`);
  const startTime = Date.now();

  try {
    const res = await fetch(BULK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(records)
    });
    const data = await res.json();
    const endTime = Date.now();
    console.log(`Success! Time taken: ${endTime - startTime}ms`);
    console.log('Response:', data);
    
  } catch (error) {
    console.error('Error during load test:', error);
  }
}

loadTest();
