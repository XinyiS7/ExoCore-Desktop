/**
 * Dev server launcher — spawns chat + chronicle Vite servers as detached
 * background processes, waits a few seconds for them to boot, then exits.
 * Tauri handles the actual readiness check when it opens the webview.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const servers = [
  { name: 'chat-core',  args: ['--filter', 'exo-chat-core', 'dev'] },
  { name: 'chronicle',  args: ['--filter', 'exo-chronicle', 'dev'] },
];

for (const { name, args } of servers) {
  const child = spawn('pnpm', args, {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    shell: true,
    windowsHide: true,
  });
  child.unref();
  console.log(`[dev-servers] Launched ${name} (pid ${child.pid})`);
}

console.log('[dev-servers] Waiting 5s for Vite servers to boot...');

// Keep event loop alive with this timeout (unref'd children don't count).
// After 5s, the timeout fires, event loop empties, Node exits cleanly.
setTimeout(() => {
  console.log('[dev-servers] Handing off to Tauri.');
}, 5000);
