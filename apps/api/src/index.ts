import { Hono } from "hono";
import { healthRoutes } from "./routes/health";
import { catalogRoutes } from "./routes/catalog";

// Root application. Route modules live in ./routes/*.ts and are mounted below.
// Convention: the mount prefix lives HERE; route modules use bare paths internally.
// e.g. `app.route("/catalog", catalogRoutes)` + `catalogRoutes.get("/", ...)` → `/catalog`.
// This gives us a single routing table of contents in this file.
export const app = new Hono();

app.route("/", healthRoutes);
app.route("/catalog", catalogRoutes);
