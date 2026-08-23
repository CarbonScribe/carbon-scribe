import express from "express";
import { env } from "./config/env.js";
import { router } from "./routes/index.js";
import { errorHandler } from "./shared/middleware/error-handler.js";

const app = express();

app.use(express.json());
app.use(router);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`agent-service listening on :${env.port}`);
});
