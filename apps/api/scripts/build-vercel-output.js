// Builds the Build Output API structure Vercel deploys directly, bypassing its
// zero-config NestJS detection entirely (which separately recompiles src/*.ts
// itself and crashes on @nestjs/core's ESM-only package -- see docs/RUNBOOK.md).
// We bundle our own already-working dist/main.js build with esbuild instead:
// bundling resolves the whole dependency graph at build time, so there's no
// runtime require()/import boundary left for Node to reject.
const { buildSync } = require('esbuild');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', '.vercel', 'output', 'functions', 'api.func');
fs.mkdirSync(outDir, { recursive: true });

buildSync({
  entryPoints: [path.join(__dirname, '..', 'dist', 'main.mjs')],
  outfile: path.join(outDir, 'index.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  logLevel: 'info',
  // NestJS core lazily imports these optional peer packages for features we
  // don't use (microservices, websockets) -- they're not installed, so
  // esbuild can't resolve them statically. Leaving them external is fine:
  // the lazy-load code path never actually runs for a plain HTTP app.
  external: ['@nestjs/microservices', '@nestjs/websockets'],
});

fs.writeFileSync(
  path.join(outDir, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.js',
      launcherType: 'Nodejs',
      shouldAddHelpers: true,
    },
    null,
    2,
  ),
);

const outputDir = path.join(__dirname, '..', '.vercel', 'output');
fs.writeFileSync(
  path.join(outputDir, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [{ src: '/(.*)', dest: '/api' }],
    },
    null,
    2,
  ),
);

console.log('Build Output API structure written to .vercel/output');
