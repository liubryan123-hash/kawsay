// Bundles the development preview into one self-contained HTML file (works offline).
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const out = await build({
  entryPoints: ["demo/main.tsx"],
  bundle: true,
  minify: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
const js = out.outputFiles[0].text.replace(/<\/script/g, "<\\/script");
const css = readFileSync("src/ui/kawsay.css", "utf8");
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KAWSAY check-in, triage and evaluation - development preview</title>
<style>
body { margin: 0; background: #f3f5f7; }
.demo-banner { background: #3b2f00; color: #fff; padding: 0.5rem 1rem; font: 600 0.85rem system-ui, sans-serif; text-align: center; }
.demo-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; padding: 0.75rem; }
.demo-tabs button { font: inherit; padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid #8a99a8; background: #fff; cursor: pointer; }
.demo-tabs button[aria-pressed="true"] { background: #16202a; color: #fff; }
${css}
</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`;
writeFileSync("demo/kawsay-screens-preview.html", html);
console.log(`demo/kawsay-screens-preview.html written (${Math.round(html.length / 1024)} kB)`);
