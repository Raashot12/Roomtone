import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const packageDirectory = resolve(process.cwd(), 'node_modules/@wasmpeg/cpu/dist');
const publicDirectory = resolve(process.cwd(), 'public/wasmpeg');

mkdirSync(publicDirectory, { recursive: true });
for (const fileName of ['cpu.js', 'cpu.wasm']) {
  copyFileSync(resolve(packageDirectory, fileName), resolve(publicDirectory, fileName));
}
