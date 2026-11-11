// Builds what wrangler.toml deploys: node contrib/cloudflare/build.mjs, from anywhere, on any OS.
import { execSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const run = (cmd, dir) => execSync(cmd, { cwd: root + dir, stdio: 'inherit' });

run('npm ci --ignore-scripts --omit=optional', 'api');
run('npm ci --ignore-scripts', 'frontend');
run('npm run build', 'frontend');

const dist = root + 'contrib/cloudflare/dist';
rmSync(dist, { recursive: true, force: true });
cpSync(root + 'frontend/dist', dist, { recursive: true });
cpSync(root + 'catalogue/media', dist + '/exercise-media', { recursive: true });
cpSync(root + 'contrib/cloudflare/_headers', dist + '/_headers');

// Long-press the installed app icon (Android, desktop) to jump straight there; done here so upstream's manifest.json stays untouched.
const manifest = JSON.parse(readFileSync(dist + '/manifest.json', 'utf8'));
const icon = [{ src: 'icon-180.png', sizes: '180x180', type: 'image/png' }];
manifest.shortcuts = [
  { name: 'Start workout', short_name: 'Workout', url: './#/workout', icons: icon },
  { name: 'Log food', short_name: 'Food', url: './#/food', icons: icon },
  { name: 'Weigh in', short_name: 'Weigh in', url: './#/checkin', icons: icon },
  { name: 'Garmin', short_name: 'Garmin', url: './#/garmin', icons: icon }
];
writeFileSync(dist + '/manifest.json', JSON.stringify(manifest, null, 2));
