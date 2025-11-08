import http, { IncomingMessage, ServerResponse } from 'node:http';

const port = Number(process.env.PORT ?? 8080);

const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('uws-gateway placeholder running\n');
});

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[uws-gateway] listening on ${port}`);
});




