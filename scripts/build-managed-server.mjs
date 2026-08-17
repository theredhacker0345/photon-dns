import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(projectRoot, "server", "managed-web-server.cjs");
const destination = resolve(projectRoot, "dist", "index.js");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log("Created managed server entry: dist/index.js");
