// Compila los tests con TypeScript y los corre con el runner nativo de Node.
// No necesita dependencias extra. Uso: pnpm test
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const salida = '.test-dist';
rmSync(salida, { recursive: true, force: true });

const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');
const compilacion = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.test.json'], { stdio: 'inherit' });
if (compilacion.status !== 0) process.exit(compilacion.status ?? 1);

// El proyecto es "type": "module"; los tests compilados son CommonJS
mkdirSync(salida, { recursive: true });
writeFileSync(join(salida, 'package.json'), JSON.stringify({ type: 'commonjs' }));

const carpeta = join(salida, 'tests');
const archivos = existsSync(carpeta)
  ? readdirSync(carpeta)
      .filter((f) => f.endsWith('.test.js'))
      .map((f) => join(carpeta, f))
  : [];

const ejecucion = spawnSync(process.execPath, ['--test', ...archivos], { stdio: 'inherit' });
process.exit(ejecucion.status ?? 1);
