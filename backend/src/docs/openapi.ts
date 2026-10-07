const err = { description: 'Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } };
const ok = (d = 'OK') => ({ description: d });
const bearer = [{ bearerAuth: [] }];
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const json = (ref: string) => ({ required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } });

export const openapi = {
  openapi: '3.0.3',
  info: { title: 'EventHub API', version: '1.0.0', description: 'Auth uses httpOnly cookies: call POST /auth/login right here in Swagger UI and the browser stores the cookies and sends them automatically on later calls (no Authorize button needed). All responses: { success, data, meta? } or { success:false, error:{code,message,details?} }' },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: { type: 'object', properties: { success: { type: 'boolean', example: false }, error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} } } } },
      Register: { type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string', minLength: 8 } } },
      Login: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } },
      Event: { type: 'object', required: ['title', 'description', 'category', 'date', 'venue', 'city', 'price', 'totalSeats'], properties: {
        title: { type: 'string' }, description: { type: 'string' }, category: { type: 'string', enum: ['concert', 'workshop', 'conference', 'sports'] },
        date: { type: 'string', format: 'date-time' }, venue: { type: 'string' }, city: { type: 'string' }, price: { type: 'number' },
        totalSeats: { type: 'integer' }, imageUrl: { type: 'string' }, details: { type: 'object', example: { artist: 'Arijit Singh' } } } },
      Hold: { type: 'object', required: ['eventId', 'quantity'], properties: { eventId: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 6 } } },
    },
  },
  paths: {
    '/auth/register': { post: { tags: ['Auth'], requestBody: json('Register'), responses: { 201: ok('Registered'), 400: err, 409: err } } },
    '/auth/login': { post: { tags: ['Auth'], requestBody: json('Login'), responses: { 200: ok(), 401: err, 429: err } } },
    '/auth/refresh': { post: { tags: ['Auth'], summary: 'Rotate refresh token (httpOnly cookie)', responses: { 200: ok(), 401: err } } },
    '/auth/logout': { post: { tags: ['Auth'], responses: { 200: ok() } } },
    '/auth/me': { get: { tags: ['Auth'], security: bearer, responses: { 200: ok(), 401: err } } },
    '/events': {
      get: { tags: ['Events'], summary: 'List events', parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } },
        { name: 'q', in: 'query', schema: { type: 'string' } }, { name: 'category', in: 'query', schema: { type: 'string' } },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'minPrice', in: 'query', schema: { type: 'number' } }, { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
        { name: 'sort', in: 'query', schema: { type: 'string', enum: ['date_asc', 'date_desc', 'price_asc', 'price_desc'] } }], responses: { 200: ok() } },
      post: { tags: ['Events'], summary: 'Create (admin)', security: bearer, requestBody: json('Event'), responses: { 201: ok(), 400: err, 403: err } },
    },
    '/events/{id}': {
      get: { tags: ['Events'], parameters: [idParam], responses: { 200: ok(), 404: err } },
      put: { tags: ['Events'], summary: 'Update (admin)', security: bearer, parameters: [idParam], requestBody: json('Event'), responses: { 200: ok(), 409: err } },
      delete: { tags: ['Events'], summary: 'Delete (admin)', security: bearer, parameters: [idParam], responses: { 200: ok(), 409: err } },
    },
    '/events/{id}/stream': { get: { tags: ['Events'], summary: 'SSE live seat count', parameters: [idParam], responses: { 200: ok('text/event-stream') } } },
    '/bookings/hold': { post: { tags: ['Bookings'], summary: 'Hold seats for 5 minutes', security: bearer, requestBody: json('Hold'), responses: { 201: ok(), 409: err, 429: err } } },
    '/bookings/me': { get: { tags: ['Bookings'], security: bearer, responses: { 200: ok() } } },
    '/bookings/{id}': { get: { tags: ['Bookings'], security: bearer, parameters: [idParam], responses: { 200: ok(), 404: err } } },
    '/bookings/{id}/pay': { post: { tags: ['Bookings'], summary: 'Mock payment (random success/failure)', security: bearer, parameters: [idParam], responses: { 200: ok(), 402: err, 410: err } } },
    '/bookings/{id}/cancel': { post: { tags: ['Bookings'], summary: 'Cancel (>=24h before event)', security: bearer, parameters: [idParam], responses: { 200: ok(), 422: err } } },
    '/admin/stats': { get: { tags: ['Admin'], security: bearer, responses: { 200: ok() } } },
    '/admin/reports/top-events': { get: { tags: ['Admin'], summary: 'Top 5 events by revenue', security: bearer, responses: { 200: ok() } } },
    '/admin/bookings': { get: { tags: ['Admin'], security: bearer, responses: { 200: ok() } } },
    '/admin/audit-logs': { get: { tags: ['Admin'], security: bearer, responses: { 200: ok() } } },
  },
};
