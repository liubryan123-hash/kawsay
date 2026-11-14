// Reuse the real TypeScript engine without npm or a separate implementation.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
export function engineSource() {
  const dir = new URL('../src/core/', import.meta.url);
  const types = stripTypeScriptTypes(readFileSync(new URL('types.ts', dir), 'utf8'));
  const engine = stripTypeScriptTypes(readFileSync(new URL('engine.ts', dir), 'utf8')).replace(/^import .*?;\s*$/gm, '');
  return (types + '\n' + engine).replace(/^export /gm, '');
}
export const { evaluate } = new Function(engineSource() + '\nreturn { evaluate };')();
