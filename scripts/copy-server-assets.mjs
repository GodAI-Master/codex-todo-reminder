import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const source = path.resolve("server/db/migrations");
const destination = path.resolve("dist/server/db/migrations");
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
