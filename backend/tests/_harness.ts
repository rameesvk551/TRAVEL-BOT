// Minimal zero-dependency test harness. Deliberately tiny: the point is that a suite EXISTS
// and runs with `npm test`, not that we adopt a framework.

const suites: Array<{ name: string; fn: () => void | Promise<void> }> = [];

let currentSuite = '';
let passed = 0;
let failed = 0;
const failures: string[] = [];

function describe(name: string, fn: () => void | Promise<void>) {
  suites.push({ name, fn });
}

function ok(name: string, condition: any, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`    \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failed += 1;
    const label = `${currentSuite} › ${name}${detail ? ` — ${detail}` : ''}`;
    failures.push(label);
    console.log(`    \x1b[31m✗ ${name}\x1b[0m${detail ? ` — ${detail}` : ''}`);
  }
}

function equal(name: string, actual: any, expected: any) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  ok(name, a === e, a === e ? '' : `expected ${e}, got ${a}`);
}

async function run() {
  for (const suite of suites) {
    currentSuite = suite.name;
    console.log(`\n  \x1b[1m${suite.name}\x1b[0m`);
    try {
      await suite.fn();
    } catch (err: any) {
      failed += 1;
      failures.push(`${suite.name} › THREW: ${err.message}`);
      console.log(`    \x1b[31m✗ threw: ${err.message}\x1b[0m`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  if (failed) {
    console.log(`\x1b[31m  ${failed} failed\x1b[0m, ${passed} passed\n`);
    failures.forEach((f) => console.log(`    \x1b[31m•\x1b[0m ${f}`));
    console.log('');
    process.exit(1);
  }
  console.log(`\x1b[32m  ${passed} passed\x1b[0m, 0 failed\n`);
  process.exit(0);
}

module.exports = { describe, ok, equal, run };
