const http = require('http');
const jwt = require('jsonwebtoken');

const API_HOST = 'localhost';
const API_PORT = 8000;
const API_PATH = '/api/system/performance/metrics';
const JWT_SECRET = 'your_secret_key_here'; // from .env

async function runLoadTest() {
  console.log('--- Starting System Performance Metrics Load Test ---');
  const totalRequests = 1000;
  const promises = [];
  
  console.log(`Sending ${totalRequests} concurrent POST requests to ${API_PATH}...`);
  
  // Create a base token to avoid generating 1000 tokens if we just want to test rate limit.
  // Actually, wait, let's just generate a valid token for each user.
  const token = jwt.sign({ user_id: '6a0ab13018618bd3fe177e8c', roleName: 'student' }, JWT_SECRET);

  for (let i = 0; i < totalRequests; i++) {
    const ip = `10.1.0.${i % 50}`;
    const start = Date.now();
    const payload = JSON.stringify({
      route: '/api/test',
      device_type: 'desktop',
      ttfb_ms: Math.random() * 100,
      dom_content_loaded_ms: Math.random() * 200
    });

    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Forwarded-For': ip,
        'Authorization': `Bearer ${token}`
      }
    };

    promises.push(new Promise((resolve) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, duration: Date.now() - start });
        });
      });
      req.on('error', (e) => resolve({ status: 500, duration: Date.now() - start, error: e.message }));
      req.write(payload);
      req.end();
    }));
  }

  const startTime = Date.now();
  const results = await Promise.all(promises);
  const endTime = Date.now();

  const durations = results.map(r => r.duration).sort((a, b) => a - b);
  const p95Index = Math.floor(durations.length * 0.95);
  const p95 = durations[p95Index];
  
  let successCount = 0;
  let rateLimitedCount = 0;
  let serverErrorCount = 0;
  let otherErrorCount = 0;

  for (const r of results) {
    if (r.status >= 200 && r.status < 300) successCount++;
    else if (r.status === 429) rateLimitedCount++;
    else if (r.status >= 500) serverErrorCount++;
    else otherErrorCount++;
  }

  console.log(`\n--- Test Results ---`);
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Total Time: ${endTime - startTime}ms`);
  console.log(`Success (2xx): ${successCount}`);
  console.log(`Rate Limited (429): ${rateLimitedCount}`);
  console.log(`Server Errors (5xx): ${serverErrorCount}`);
  console.log(`Other Errors: ${otherErrorCount}`);
  
  console.log(`\n--- Performance ---`);
  console.log(`p95 Response Time: ${p95}ms`);
  console.log(`Average Response Time: ${Math.round(durations.reduce((a,b)=>a+b, 0) / durations.length)}ms`);
  console.log(`Min: ${durations[0]}ms, Max: ${durations[durations.length-1]}ms`);
}

runLoadTest();
