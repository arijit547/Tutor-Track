import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

for (const [zone, instant, expected] of [
  ['Asia/Dhaka', '2026-11-17T18:30:00Z', '2026-11-18'],
  ['Asia/Dhaka', '2026-11-30T18:30:00Z', '2026-12-01'],
  ['America/Los_Angeles', '2026-11-18T02:30:00Z', '2026-11-17'],
] as const) {
  test(`session and payment defaults use calendar date ${expected} in ${zone}`, () => {
    const source = `import { localDate } from './services/localDate.ts'; process.stdout.write(localDate(new Date('${instant}')));`;
    const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source], {
      cwd: new URL('..', import.meta.url), env: { ...process.env, TZ: zone }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.equal(output, expected);
  });
}
