// tsc only emits .js — copy each add-on's addon.json beside it in dist/addons.
import fs from 'fs';
import path from 'path';
const src = 'addons', out = 'dist/addons';
let n = 0;
for (const name of fs.readdirSync(src)) {
  const manifest = path.join(src, name, 'addon.json');
  if (!fs.existsSync(manifest)) continue;
  fs.mkdirSync(path.join(out, name), { recursive: true });
  fs.copyFileSync(manifest, path.join(out, name, 'addon.json'));
  n++;
}
console.log(`copied ${n} add-on manifest(s) to ${out}`);
