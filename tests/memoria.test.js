import { describe, it, expect } from 'vitest';
import { crearMemoria, CLAVE_MEMORIA } from '../ui/memoria.js';
import { FILTRO_VACIO } from '../filtros.js';

function almacenFalso(inicial = {}) {
  const datos = { ...inicial };
  return { getItem: k => datos[k] ?? null, setItem: (k, v) => { datos[k] = String(v); }, datos };
}

describe('memoria de la lista', () => {
  it('parte vacía y persiste los cambios', () => {
    const almacen = almacenFalso();
    const m = crearMemoria(() => almacen);
    expect(m.estado()).toEqual({ filtro: FILTRO_VACIO, orden: 'nombre', ancla: null, ultimaId: null });
    m.actualizar({ filtro: { ...FILTRO_VACIO, sitio: 'STP' }, ancla: { id: 'x', desfase: 40 } });
    const otra = crearMemoria(() => almacen);
    expect(otra.estado().filtro.sitio).toBe('STP');
    expect(otra.estado().ancla).toEqual({ id: 'x', desfase: 40 });
  });

  it('completa filtros guardados con claves nuevas y tolera basura', () => {
    const m = crearMemoria(() => almacenFalso({ [CLAVE_MEMORIA]: JSON.stringify({ filtro: { sitio: 'STP' } }) }));
    expect(m.estado().filtro).toEqual({ ...FILTRO_VACIO, sitio: 'STP' });
    const roto = crearMemoria(() => almacenFalso({ [CLAVE_MEMORIA]: '{no es json' }));
    expect(roto.estado().orden).toBe('nombre');
  });

  it('funciona aunque el almacenamiento falle', () => {
    const m = crearMemoria(() => { throw new Error('bloqueado'); });
    expect(m.actualizar({ orden: 'familia' }).orden).toBe('familia');
    expect(m.estado().orden).toBe('familia');
  });

  it('limpiarFiltros conserva el orden y borra el ancla', () => {
    const m = crearMemoria(() => almacenFalso());
    m.actualizar({ filtro: { ...FILTRO_VACIO, sitio: 'STP' }, orden: 'familia', ancla: { id: 'a', desfase: 0 } });
    expect(m.limpiarFiltros()).toMatchObject({ filtro: FILTRO_VACIO, orden: 'familia', ancla: null });
  });
});
