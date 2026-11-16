// TEMBAK TERUS entrypoint: builds the submission dossier and copies the game tree.
/**
 * TEMBAK TERUS — ThreeJS FPS 02 entry.
 * Handover contract: Copies game/ and screenshots/ to MAKEFUN_OUTPUT_DIR,
 * writes dossier.json byte-identically across runs.
 */

import { cpSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

if (!existsSync(join(here, 'screenshots'))) {
  console.error('Error: screenshots/ directory not found.');
  process.exit(2);
}
const screenshots = readdirSync(join(here, 'screenshots'));
if (!screenshots.some(f => f.endsWith('.png'))) {
  console.error('Error: No screenshots found in screenshots/.');
  process.exit(2);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648 }),
);
