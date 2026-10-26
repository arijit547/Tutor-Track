import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// Some Firebase CLI debug modes print child-process environments. Pass only
// runtime essentials, excluding application credentials and agent variables.
const allowedNames = new Set([
  'path', 'pathext', 'systemroot', 'windir', 'comspec', 'userprofile', 'home',
  'homedrive', 'homepath', 'localappdata', 'appdata', 'temp', 'tmp', 'java_home',
  'lang', 'lc_all', 'lc_ctype', 'number_of_processors', 'processor_architecture',
  'os', 'node_extra_ca_certs',
]);
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => allowedNames.has(name.toLowerCase())));
childEnv.CI = 'true';
childEnv.FIREBASE_CLI_DISABLE_UPDATE_CHECK = 'true';
const result = spawnSync(process.execPath, [
  require.resolve('firebase-tools/lib/bin/firebase.js'),
  'emulators:exec', '--non-interactive', '--project', 'demo-tutortrack',
  '--only', 'firestore', '--config', '../firebase.rules-test.json',
  'node --test firestore.rules.test.mjs',
], { cwd: fileURLToPath(new URL('.', import.meta.url)), env: childEnv, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
// On this Windows/Java combination the CLI's SIGINT can leave Java listening
// after reporting a clean shutdown. Clean only our verified successful run.
if (process.platform === 'win32' && result.status === 0) {
  const cleanup = spawnSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-File', fileURLToPath(new URL('stop-emulator.ps1', import.meta.url)),
    '-RulesPath', fileURLToPath(new URL('../firestore.rules', import.meta.url)),
  ], { env: childEnv, stdio: 'inherit' });
  if (cleanup.status !== 0) console.error('Emulator cleanup did not complete.');
}
process.exitCode = result.status ?? 1;
