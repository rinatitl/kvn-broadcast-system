// Run explicitly with Internet access; normal startup uses only committed files.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '../bundles/kvn-file-upload/shared/vendor');
const cdn = 'https://cdn.jsdelivr.net/npm/';
const files = {
  'bootstrap/bootstrap.min.css': 'bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'bootstrap/bootstrap.bundle.min.js': 'bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'bootstrap/LICENSE': 'bootstrap@5.3.0/LICENSE',
  'bootstrap-icons/bootstrap-icons.min.css': 'bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  'bootstrap-icons/fonts/bootstrap-icons.woff2': 'bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff2',
  'bootstrap-icons/fonts/bootstrap-icons.woff': 'bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff',
  'bootstrap-icons/LICENSE': 'bootstrap-icons@1.11.3/LICENSE',
  'vue/vue.global.prod.js': 'vue@3.5.13/dist/vue.global.prod.js',
  'vue/LICENSE': 'vue@3.5.13/LICENSE',
  'lodash/lodash.min.js': 'lodash@4.17.21/lodash.min.js',
  'lodash/LICENSE': 'lodash@4.17.21/LICENSE',
  'gsap/gsap.min.js': 'gsap@3.12.5/dist/gsap.min.js',
  'gsap/README.md': 'gsap@3.12.5/README.md',
  'split-type/index.umd.js': 'split-type@0.3.4/umd/index.js',
  'split-type/README.md': 'split-type@0.3.4/README.md',
  'split-type/package.json': 'split-type@0.3.4/package.json',
};
async function download(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36' },
  });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
async function main() {
  const manifest = {};
  async function save(file, url, data) {
    data ??= await download(url);
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), data);
    manifest[file] = { url, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') };
    console.log(`${file}: ${data.length} bytes`);
  }
  for (const [file, source] of Object.entries(files)) await save(file, cdn + source);
  const fontURL = 'https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap';
  let css = (await download(fontURL)).toString();
  const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]))];
  for (const [i, url] of urls.entries()) {
    const file = `open-sans/font-${i}${new URL(url).pathname.match(/\.[^.]+$/)[0]}`;
    await save(file, url);
    css = css.split(url).join(`./${path.basename(file)}`);
  }
  await save('open-sans/open-sans.css', fontURL, Buffer.from(css));
  await save('open-sans/OFL.txt', 'https://raw.githubusercontent.com/google/fonts/main/ofl/opensans/OFL.txt');
  await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
