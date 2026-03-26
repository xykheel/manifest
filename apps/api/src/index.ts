import { createServer } from "node:http";
import { createApp } from "./app";
import { assertEnv, env } from "./lib/env";

assertEnv();
const app = createApp();
const server = createServer(app);

server.listen(env.apiPort, env.apiHost, () => {
  console.log(`API listening on http://${env.apiHost}:${env.apiPort}`);
});
