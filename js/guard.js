import { isSupabaseConfigured, requireSupabase } from './supabase-client.js';

export async function requireSession() {
  if (!isSupabaseConfigured()) {
    document.body.innerHTML = `
      <main style="min-height:100vh;display:grid;place-items:center;padding:24px;font-family:system-ui;background:#F6F3E9;color:#17211D">
        <section style="max-width:620px;background:#fff;padding:28px;border-radius:18px;border:1px solid #D9DED8">
          <h1>Conexão pendente</h1>
          <p>Informe a chave pública <strong>anon/publishable</strong> do Supabase no arquivo <code>js/env.js</code>. A URL do projeto já está configurada.</p>
          <a href="/" style="color:#086647;font-weight:700">Voltar para a página inicial</a>
        </section>
      </main>`;
    throw new Error('Supabase não configurado.');
  }

  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    window.location.replace('/entrar');
    throw new Error('Sessão não encontrada.');
  }
  return data.session;
}
