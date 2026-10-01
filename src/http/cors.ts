export const CORS_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

export function createCorsOptions(origin = 'http://localhost:3000') {
  return {
    origin,
    methods: [...CORS_METHODS],
    credentials: false,
  };
}
