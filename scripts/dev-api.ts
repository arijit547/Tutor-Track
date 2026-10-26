import { createServer } from 'node:http';
import testHandler from '../api/push/test.js';
import remindersHandler from '../api/push/reminders.js';
import type { ApiResponse } from '../server/httpHandlers.js';

// Bind locally: this runner is for development, not deployment.
const server = createServer(async (request, response) => {
  const reply: ApiResponse = {
    setHeader: (name, value) => response.setHeader(name, value),
    status: code => { response.statusCode = code; return reply; },
    json: body => {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end(JSON.stringify(body));
    },
  };
  const path = new URL(request.url || '/', 'http://localhost').pathname;
  const handler = path === '/api/push/test' ? testHandler
    : path === '/api/push/reminders' ? remindersHandler : undefined;
  if (!handler) { reply.status(404).json({ error: 'Not found.' }); return; }
  try {
    const parts: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size <= 2048) parts.push(bytes);
    }
    if (size > 2048) { reply.status(413).json({ error: 'Request is too large.' }); return; }
    await handler({ method: request.method, headers: request.headers, body: Buffer.concat(parts).toString('utf8') }, reply);
  } catch {
    if (!response.writableEnded) reply.status(503).json({ error: 'Local notification API is unavailable.' });
  }
});
server.requestTimeout = 15_000;
server.headersTimeout = 15_000;
server.listen(3001, '127.0.0.1', () => console.log('TutorTrack API: http://127.0.0.1:3001'));
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
