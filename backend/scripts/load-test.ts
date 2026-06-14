import { Logger } from '@nestjs/common';
import * as mongoose from 'mongoose';
import * as jwt from 'jsonwebtoken';

const API_URL = 'http://localhost:8000/academic-record';
const BULK_API_URL = 'http://localhost:8000/academic-record/bulk';
const logger = new Logger('LoadTest');
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key_here';

async function runTest() {
  logger.log('--- Starting Load Test ---');
  
  const student_id = new mongoose.Types.ObjectId().toString();
  const criterion_id = new mongoose.Types.ObjectId().toString();
  const semester_id = new mongoose.Types.ObjectId().toString();

  const token = jwt.sign(
    { sub: new mongoose.Types.ObjectId().toString(), roleName: 'Admin', userId: new mongoose.Types.ObjectId().toString() },
    JWT_SECRET
  );

  logger.log(`Using IDs: Student=${student_id}, Criterion=${criterion_id}`);

  const totalRecords = 500; // test volume for bulk
  const concurrencyCount = 200; // concurrent test volume

  // Test 1: Sequential Bulk
  logger.log(`[TEST 1] Sending ${totalRecords} records to Bulk API in one request...`);
  const bulkRecords = [];
  const actionBatchId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  for (let i = 0; i < totalRecords; i++) {
    bulkRecords.push({
      student_id,
      criterion_id,
      semester_id,
      record_title: `Bulk Test Load ${i}`,
      description: `Description ${i}`,
      status: 'active',
      source: 'manual_record',
      idempotency_key: `load_test:${actionBatchId}:${student_id}:${criterion_id}:${i}`,
    });
  }

  const startTime1 = Date.now();
  try {
    const res = await fetch(BULK_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ records: bulkRecords })
    });
    const data = await res.json();
    logger.log(`[TEST 1] Success! Time: ${Date.now() - startTime1}ms, Result:`, data);
  } catch (err) {
    logger.error(`[TEST 1] Error:`, err);
  }

  // Test 2: Concurrency on Bulk API
  // Gửi 5 batch song song, mỗi batch 20 records CÙNG vào student_id, criterion_id để test Race Condition của score engine
  logger.log(`[TEST 2] Sending 5 concurrent BULK requests to test Atomic Updates/Score Engine...`);
  const bulkPromises = [];
  const startTime2 = Date.now();
  
  for (let b = 0; b < 5; b++) {
    const records = [];
    const batchId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    for (let i = 0; i < 20; i++) {
      records.push({
        student_id,
        criterion_id,
        semester_id,
        record_title: `Concurrent Bulk ${b}-${i}`,
        description: `Description ${b}-${i}`,
        status: 'active',
        source: 'manual_record',
        idempotency_key: `load_test_concurrent:${batchId}:${student_id}:${criterion_id}:${i}`,
      });
    }

    bulkPromises.push(
      fetch(BULK_API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ records })
      }).then(r => r.json())
    );
  }

  try {
    const results = await Promise.allSettled(bulkPromises);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    logger.log(`[TEST 2] Success: ${fulfilled.length}, Failed: ${rejected.length}. Time: ${Date.now() - startTime2}ms`);
  } catch (err) {
    logger.error(`[TEST 2] Error:`, err);
  }

  // Test 3: Concurrent Individual Requests (Old format fallback)
  logger.log(`[TEST 3] Sending ${concurrencyCount} individual POST requests concurrently...`);
  const promises = [];
  const startTime3 = Date.now();
  
  for (let i = 0; i < concurrencyCount; i++) {
    const payload = {
      student_id,
      criterion_id,
      semester_id,
      record_title: `Concurrent Single Load ${i}`,
      description: `Description ${i}`,
      status: 'active',
      source: 'manual_record',
      idempotency_key: `concurrent_single:${Date.now()}:${student_id}:${criterion_id}:${i}`,
    };

    promises.push(
      fetch(API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      }).then(r => r.json())
    );
  }

  try {
    const results = await Promise.allSettled(promises);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    logger.log(`[TEST 3] Success: ${fulfilled.length}, Failed: ${rejected.length}. Time: ${Date.now() - startTime3}ms`);
    
    // --- ASSERTIONS ---
    logger.log('--- Checking Database Assertions ---');
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/manager_point';
    await mongoose.connect(MONGODB_URI);
    
    // Test 2 asserted: 5 concurrent requests of 20 records (total 100).
    // Due to idempotency_key, each concurrent batch has the exact SAME keys!
    // Wait, in the script, batchId is generated ONCE for the whole Test 2?
    // No, batchId is generated inside the b loop: const batchId = Date.now()...
    // So 5 different batches. They will all insert! Wait... idempotency_key is different for each batch!
    // So 5 * 20 = 100 records will be inserted for this student_id and criterion_id.
    
    const summary = await mongoose.connection.collection('summariespoints').findOne({ 
      student_id: new mongoose.Types.ObjectId(student_id),
      semester_id: new mongoose.Types.ObjectId(semester_id)
    });
    
    if (summary) {
      const detail = summary.details?.find((d: any) => d.criterion_id.toString() === criterion_id);
      logger.log(`Assertion: Found summary point for student. Total occurrences for criterion: ${detail?.total_occurrences}`);
      logger.log(`Assertion: Total score for criterion: ${detail?.total_score}`);
    } else {
      logger.error('Assertion Failed: Summary point not found!');
    }

    await mongoose.disconnect();
    
    logger.log('--- Load Test Finished ---');
  } catch (err) {
    logger.error(`[TEST 3] Error:`, err);
  }
}

runTest().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
