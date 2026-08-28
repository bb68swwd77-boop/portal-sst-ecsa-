import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`ECSA SST backend escuchando en puerto ${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string) {
  console.log(`Recibida señal ${signal}, cerrando servidor...`);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
