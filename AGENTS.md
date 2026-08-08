# Instruções para o projeto `juntos`

Versão leve do juntos.cash: um lar, dois usuários (Alexandre admin, Priscila
member), despesas com divisão proporcional pela renda, parcelas simples,
gráficos, exportação e agentes (MCP/API) em linguagem natural.

## Limites

- Trabalhe somente em `/workspace/juntos`.
- `/workspace/juntos.cash` e `/workspace/juntos.local` são referência de
  leitura; não edite nem copie credenciais deles.
- Sem Postgres, sem SaaS, sem CDN, sem SAC/Price. Banco é SQLite
  (`node:sqlite`) em `data/juntos.db`.
- Um único token de agente (hash em `meta`); segredo exibido uma vez.
- Dinheiro sempre em **centavos inteiros**; a API converte na borda.

## Segurança (não cortar)

- Senhas com scrypt; sessão em cookie HttpOnly + SameSite=Strict.
- Mutações por cookie exigem `Origin` igual a `APP_ORIGIN` (CSRF); Bearer passa direto.
- Rate limit no login e global; CSP e headers de segurança no `onSend`.
- `Idempotency-Key` obrigatória para escritas do agente (replay = 200, corpo diferente = 409).

## Verificação

- Rode `npm run check` (testes + build) ao final de cada mudança.
- Docker/Compose: valide estaticamente aqui; o teste real acontece no Mac.
- Porta candidata para publicação: **4205** (faixa 4200-4219 do `/workspace/PORTAS.md`).
  Não registre em `PORTAS.md` até o usuário confirmar no navegador.
- Commits pequenos, identidade `forge-z`, sem push.

## Estrutura

- `server/` — Fastify + SQLite (config, db, security, app, index).
- `mcp/` — servidor MCP stdio que chama a API REST (pacote separado).
- `src/` — frontend Vite (adaptado do juntos.local).
- `scripts/` — backup.sh / restore.sh (SQLite: checkpoint + cópia).
- `docs/` — agent-api.md, mcp.md.
