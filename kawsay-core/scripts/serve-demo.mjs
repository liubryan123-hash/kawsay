import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const html = new URL("../demo/kawsay-screens-preview.html", import.meta.url);
createServer(async (req, res) => {
  if (req.url !== "/" && req.url !== "/index.html") { res.writeHead(404); res.end("Not found"); return; }
  try {
    const body = await readFile(html);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Build the demo first: npm run demo");
  }
}).listen(4173, "127.0.0.1", () => console.log("KAWSAY demo: http://127.0.0.1:4173"));
