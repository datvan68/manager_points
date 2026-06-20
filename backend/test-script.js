const cp = require('child_process');

async function main() {
  console.log('--- RUNNING TESTS ---');
  try {
    const testOut = cp.execSync('npm test -- notifications', { cwd: 'd:/PROJECT/manager_points/backend', encoding: 'utf8' });
    console.log('Tests Passed!');
    console.log(testOut);
  } catch (err) {
    console.error('Tests Failed!');
    console.error(err.stdout);
    console.error(err.stderr);
  }

  console.log('\n--- RUNNING START:DEV ---');
  const p = cp.spawn('npm', ['run', 'start:dev'], { cwd: 'd:/PROJECT/manager_points/backend', shell: true });
  let output = '';
  p.stdout.on('data', (data) => { output += data.toString(); });
  p.stderr.on('data', (data) => { output += data.toString(); });

  await new Promise((resolve) => setTimeout(resolve, 15000));
  
  // Kill the process tree (since npm spawns node)
  if (process.platform === 'win32') {
    cp.spawnSync('taskkill', ['/pid', p.pid, '/f', '/t']);
  } else {
    p.kill();
  }

  console.log('Start dev output:');
  console.log(output);

  if (output.includes('Duplicate schema index')) {
    console.log('\nRESULT: WARNING FOUND!');
  } else {
    console.log('\nRESULT: NO WARNING FOUND!');
  }
}

main();
