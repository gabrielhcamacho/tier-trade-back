import { describe, expect, it } from 'vitest';
import { CORS_METHODS, createCorsOptions } from './cors.js';

describe('CORS configuration', () => {
  it('allows the browser methods used by the API', () => {
    expect(createCorsOptions('http://localhost:3000')).toEqual({
      origin: 'http://localhost:3000',
      methods: CORS_METHODS,
      credentials: false,
    });
    expect(CORS_METHODS).toContain('PATCH');
    expect(CORS_METHODS).toContain('PUT');
    expect(CORS_METHODS).toContain('DELETE');
  });
});
