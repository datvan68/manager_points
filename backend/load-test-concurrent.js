const API_URL = 'http://localhost:8000/academic-record';

async function generateTestData() {
  const mongoose = require('mongoose');
  const student_id = new mongoose.Types.ObjectId().toString();
  const criterion_id = new mongoose.Types.ObjectId().toString();
  const semester_id = new mongoose.Types.ObjectId().toString();

  return { student_id, criterion_id, semester_id };
}

async function loadTest() {
  console.log('--- Starting Concurrent Load Test ---');
  const { student_id, criterion_id, semester_id } = await generateTestData();

  console.log('Using IDs:', { student_id, criterion_id, semester_id });

  const totalRequests = 1000;
  const promises = [];
  
  console.log(`Sending ${totalRequests} individual POST requests concurrently...`);
  const startTime = Date.now();

  for (let i = 0; i < totalRequests; i++) {
    const payload = {
      student_id,
      criterion_id,
      semester_id,
      record_title: `Concurrent Test Load ${i}`,
      description: `Description ${i}`,
      status: 'active',
      source: 'manual_record',
      idempotency_key: `load-test-${student_id}-${criterion_id}-${Date.now()}-${i}`,
    };

    promises.push(
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json())
    );
  }

  try {
    const results = await Promise.allSettled(promises);
    const endTime = Date.now();
    console.log(`Finished in ${endTime - startTime}ms`);
    
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    
    console.log(`Success: ${fulfilled.length}, Failed: ${rejected.length}`);
    if (rejected.length > 0) {
      console.log('Sample Error:', rejected[0].reason);
    }
    
    console.log('Please check the MongoDB database to ensure that SummaryPoint.details[...].current_count is exactly', fulfilled.length);
    
  } catch (error) {
    console.error('Error during load test:', error);
  }
}

loadTest();
