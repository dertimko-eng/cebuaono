// Kleiner statischer Server zum lokalen Testen: node scripts/serve.mjs [port] [--icons]
// --icons erlaubt PUT /icons/<name>.png (nur PNG, nur in icons/) – genutzt von scripts/icons.html, um die App-Icons aus dem Adler-SVG zu rendern.
import { createServer } from "node:http";
import { readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, extname, normalize } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = parseInt(process.argv.find((a) => /^\d+$/.test(a)) || "8080");
const allowIcons = process.argv.includes("--icons");
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".md": "text/markdown; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (req.method === "PUT") {
      if (!allowIcons || !/^\/icons\/[a-z0-9-]+\.png$/.test(p)) { res.writeHead(403); return res.end("PUT nicht erlaubt (Server mit --icons starten)"); }
      const chunks = []; for await (const c of req) chunks.push(c);
      await writeFile(join(root, p), Buffer.concat(chunks));
      res.writeHead(200, { "Content-Type": "text/plain" }); return res.end("ok " + p);
    }
    if (p.endsWith("/")) p += "index.html";
    const file = normalize(join(root, p));
    if (!file.startsWith(root)) throw new Error("forbidden");
    const s = await stat(file);
    if (s.isDirectory()) { res.writeHead(301, { Location: p + "/" }); return res.end(); }
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 " + req.url);
  }
}).listen(port, () => console.log(`Cebuano-App läuft: http://localhost:${port}/`));
