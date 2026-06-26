import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
const basePath = '/dinheiro-meu-dinheiro-nosso';

const staticEntries = [
  'assets',
  'app',
  'css',
  'js',
  'index.html',
  'login.html',
  'cadastro.html',
  'recuperar-senha.html',
  'redefinir-senha.html',
  'convite.html',
  'termos.html',
  'privacidade.html',
  'manifest.webmanifest',
  'sw.js'
];

const routeMap = new Map([
  ['/entrar', `${basePath}/login.html`],
  ['/cadastro', `${basePath}/cadastro.html`],
  ['/recuperar-senha', `${basePath}/recuperar-senha.html`],
  ['/redefinir-senha', `${basePath}/redefinir-senha.html`],
  ['/convite', `${basePath}/convite.html`],
  ['/termos', `${basePath}/termos.html`],
  ['/privacidade', `${basePath}/privacidade.html`],
  ['/painel', `${basePath}/app/dashboard.html`],
  ['/lancamentos', `${basePath}/app/lancamentos.html`],
  ['/termometro', `${basePath}/app/termometro.html`],
  ['/configuracoes', `${basePath}/app/configuracoes.html`]
]);

const assetPrefixes = ['/assets/', '/css/', '/js/'];
const exactAssets = new Map([
  ['/manifest.webmanifest', `${basePath}/manifest.webmanifest`],
  ['/sw.js', `${basePath}/sw.js`],
  ['/index.html', `${basePath}/index.html`],
  ['/login.html', `${basePath}/login.html`],
  ['/cadastro.html', `${basePath}/cadastro.html`],
  ['/convite.html', `${basePath}/convite.html`]
]);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const entry of staticEntries) {
  await cp(path.join(root, entry), path.join(out, entry), { recursive: true });
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}

function replaceQuotedValue(content, from, to) {
  for (const quote of ['"', "'", '`']) {
    content = content.replaceAll(`${quote}${from}${quote}`, `${quote}${to}${quote}`);
  }
  return content;
}

function rewriteText(content, filePath) {
  for (const [from, to] of routeMap) {
    content = replaceQuotedValue(content, from, to);
    content = content.replaceAll(`href=\"${from}\"`, `href=\"${to}\"`);
    content = content.replaceAll(`href='${from}'`, `href='${to}'`);
  }

  for (const [from, to] of exactAssets) {
    content = replaceQuotedValue(content, from, to);
  }

  for (const prefix of assetPrefixes) {
    content = content
      .replaceAll(`href=\"${prefix}`, `href=\"${basePath}${prefix}`)
      .replaceAll(`href='${prefix}`, `href='${basePath}${prefix}`)
      .replaceAll(`src=\"${prefix}`, `src=\"${basePath}${prefix}`)
      .replaceAll(`src='${prefix}`, `src='${basePath}${prefix}`)
      .replaceAll(`\"${prefix}`, `\"${basePath}${prefix}`)
      .replaceAll(`'${prefix}`, `'${basePath}${prefix}`)
      .replaceAll(`\`${prefix}`, `\`${basePath}${prefix}`);
  }

  content = content
    .replaceAll('href=\"/\"', `href=\"${basePath}/\"`)
    .replaceAll("href='/'", `href='${basePath}/'`)
    .replaceAll("window.location.replace('/entrar')", `window.location.replace('${basePath}/login.html')`)
    .replaceAll("window.location.replace('/painel')", `window.location.replace('${basePath}/app/dashboard.html')`)
    .replaceAll("window.location.replace('/')", `window.location.replace('${basePath}/')`)
    .replaceAll("`${window.DMDN_ENV.APP_URL}/painel`", "`${window.DMDN_ENV.APP_URL}/app/dashboard.html`")
    .replaceAll("`${window.DMDN_ENV.APP_URL}/redefinir-senha`", "`${window.DMDN_ENV.APP_URL}/redefinir-senha.html`");

  if (filePath.endsWith(path.join('js', 'env.js'))) {
    content = content.replace(
      'APP_URL: window.location.origin,',
      `APP_URL: window.location.origin + '${basePath}',`
    );
  }

  if (filePath.endsWith('sw.js')) {
    content = replaceQuotedValue(content, '/', `${basePath}/`);
  }

  return content;
}

for (const file of await walk(out)) {
  if (!/\.(html|js|css|webmanifest|json)$/i.test(file)) continue;
  const original = await readFile(file, 'utf8');
  const rewritten = rewriteText(original, file);
  await writeFile(file, rewritten, 'utf8');
}

const manifestPath = path.join(out, 'manifest.webmanifest');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.start_url = `${basePath}/app/dashboard.html`;
manifest.scope = `${basePath}/`;
manifest.icons = (manifest.icons ?? []).map((icon) => ({
  ...icon,
  src: icon.src.startsWith(basePath) ? icon.src : `${basePath}${icon.src}`
}));
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

await writeFile(path.join(out, '.nojekyll'), '', 'utf8');
await writeFile(
  path.join(out, '404.html'),
  `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${basePath}/"><title>Redirecionando...</title><p>Redirecionando para <a href="${basePath}/">Dinheiro Meu é Dinheiro Nosso!</a></p></html>`,
  'utf8'
);

console.log(`GitHub Pages preparado em ${out}`);
