import { app } from "./index";
import { readEnv } from "./env";

const env = readEnv();

const server = Bun.serve({
  port: env.PORT,
  fetch: (req) => app.fetch(req),
});

console.log(`api listening on http://localhost:${server.port}`);
