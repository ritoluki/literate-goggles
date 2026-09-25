import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 9000);
const server = createServer((request, response) => {
  if (request.url === '/health/live') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, mode: process.env.APP_MODE ?? 'demo' }));
    return;
  }
  if (request.url === '/health/ready') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, dependencies: { medusa: 'not_connected', postgres: 'not_connected', redis: 'not_connected' } }));
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(port, '127.0.0.1', () => console.log(`Bàn Gọn backend listening on 127.0.0.1:${port}`));
