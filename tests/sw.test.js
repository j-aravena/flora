import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { extraerVersion } from '../actualizacion.js';

const sw = fs.readFileSync('sw.js', 'utf-8');
const app = fs.readFileSync('app.js', 'utf-8');

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

  it('sw.js activa la versión en espera al recibir SKIP_WAITING', () => {
    expect(sw).toMatch(/SKIP_WAITING/);
    expect(sw).toMatch(/skipWaiting\(\)/);
  });

  it('app.js registra el service worker con updateViaCache en none', () => {
    expect(app).toMatch(/updateViaCache:\s*'none'/);
  });
});

describe('extraerVersion', () => {
  it('extrae la versión de un texto de version.js y lanza un error si no hay versión', () => {
    expect(extraerVersion("self.FLORA_VERSION = '1.2.0';")).toBe('1.2.0');
    expect(() => extraerVersion('contenido sin versión')).toThrow();
  });
});
