import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const sw = fs.readFileSync('sw.js', 'utf-8');

describe('service worker', () => {
  it('ARCHIVOS solo lista rutas que existen, y FLORA_VERSION coincide con package.json', () => {
    const bloque = sw.match(/const ARCHIVOS = \[([\s\S]*?)\];/);
    expect(bloque).not.toBeNull();
    const rutas = [...bloque[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    expect(rutas.length).toBeGreaterThan(0);
    for (const ruta of rutas) {
      const relativa = ruta === './' ? 'index.html' : ruta.replace(/^\.\//, '');
      expect(fs.existsSync(relativa), ruta).toBe(true);
    }
    const version = fs.readFileSync('version.js', 'utf-8');
    const m = version.match(/FLORA_VERSION\s*=\s*'([^']+)'/);
    expect(m).not.toBeNull();
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    expect(m[1]).toBe(pkg.version);
  });
});
