import { it, expect } from 'vitest';
import Dexie from '../vendor/dexie.mjs';

it('el entorno de pruebas tiene IndexedDB, JSZip, Blob y randomUUID', async () => {
  expect(globalThis.indexedDB).toBeDefined();
  expect(globalThis.JSZip).toBeDefined();
  expect(crypto.randomUUID()).toHaveLength(36);
  const db = new Dexie('entorno');
  db.version(1).stores({ t: 'id' });
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' });
  await db.t.put({ id: 1, blob });
  const r = await db.t.get(1);
  expect(r.blob).toBeInstanceOf(Blob);
  expect(r.blob.size).toBe(3);
});
