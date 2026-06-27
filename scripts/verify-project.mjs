import { access, readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const errors = [];

const requiredFiles = [
  'index.html',
  'login.html',
  'cadastro.html',
  'cadastro-sucesso.html',
  'recuperar-senha.html',
  'redefinir-senha.html',
  'convite.html',
  'app/dashboard.html',
  'app/lancamentos.html',
  'app/metas.html',
  'app/termometro.html',
  'app/configuracoes.html',
  'js/app-shell.js',
  'js/panel-permissions.js',
  'js/dashboard.js',
  'js/lancamentos.js',
  'js/metas.js',
  'js/termometro.js',
  'js/configuracoes.js',
  'scripts/build-pages.mjs',
  'sql/014_restore_create_financial_space.sql',
  'sql/015_verificacao_fluxos_painel.sql'
];

for (const file of requiredFiles) {
  try {
    await access(path.join(root, file));
  } catch {
    errors.push(`Arquivo obrigatório ausente: ${file}`);
  }
}

const jsDirectories = ['js', 'scripts'];
for (const directory of jsDirectories) {
  const files = await readdir(path.join(root, directory));
  for (const name of files.filter((file) => file.endsWith('.js') || file.endsWith('.mjs'))) {
    const filePath = path.join(root, directory, name);
    try {
      const source = await readFile(filePath, 'utf8');
      execFileSync(
        process.execPath,
        ['--input-type=module', '--check'],
        { input: source, stdio: ['pipe', 'pipe', 'pipe'] }
      );
    } catch (error) {
      errors.push(`JavaScript inválido em ${directory}/${name}: ${String(error.stderr || error.message).trim()}`);
    }
  }
}

const navigationRoutes = ['/painel', '/lancamentos', '/metas', '/termometro', '/configuracoes'];
for (const file of requiredFiles.filter((name) => name.startsWith('app/') && name.endsWith('.html'))) {
  const content = await readFile(path.join(root, file), 'utf8');
  for (const route of navigationRoutes) {
    if (!content.includes(`href="${route}"`)) {
      errors.push(`Rota ${route} ausente na navegação de ${file}`);
    }
  }
}

const buildContent = await readFile(path.join(root, 'scripts/build-pages.mjs'), 'utf8');
for (const route of ['/cadastro-sucesso', '/convite', ...navigationRoutes]) {
  if (!buildContent.includes(`['${route}'`)) {
    errors.push(`Rota ${route} ausente no build do GitHub Pages`);
  }
}

const envContent = await readFile(path.join(root, 'js/env.js'), 'utf8');
if (envContent.includes('__INFORME_A_CHAVE_ANON_PUBLICA__')) {
  errors.push('A chave pública do Supabase ainda está com o marcador de configuração.');
}
if (/service_role/i.test(envContent)) {
  errors.push('js/env.js não pode conter uma chave ou referência service_role.');
}

if (errors.length) {
  console.error('\nFalhas de verificação:\n- ' + errors.join('\n- '));
  process.exit(1);
}

console.log('Verificação concluída: estrutura, JavaScript, navegação e rotas estão consistentes.');
