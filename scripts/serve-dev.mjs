import { createServer } from 'vite';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { port: { type: 'string' }, mode: { type: 'string' } } });
const port = 5173;
if (values.port !== undefined && values.port !== String(port)) {
  throw new Error('PocPet 本地测试固定使用 http://127.0.0.1:5173，请复用已有服务。');
}
const server = await createServer({
  mode: values.mode,
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
  },
});

await server.listen();
server.printUrls();

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});

