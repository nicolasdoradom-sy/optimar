import { describe, expect, it } from 'vitest';
import { routeFromHash, routes } from '../src/navigation/router.js';

describe('routeFromHash', () => {
  it('resuelve los seis apartados por su hash', () => {
    for (const route of routes) {
      expect(routeFromHash(`#${route.id}`)).toEqual(route);
    }
  });

  it('usa el extractor como apartado predeterminado para hashes vacíos o desconocidos', () => {
    expect(routeFromHash('')).toEqual(routes[0]);
    expect(routeFromHash('#no-existe')).toEqual(routes[0]);
  });
});