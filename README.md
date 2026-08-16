# juntos

Finanças a dois, no seu servidor. Versão leve e privada do juntos.cash para um
home server: **um lar, dois usuários, zero SaaS**.

- Primeiro boot seguro: cria somente **Admin** com senha temporária `Admin@123`.
- Um assistente autenticado define o administrador e cria o segundo usuário; a senha provisória do segundo usuário é trocada no primeiro login.
- Despesas divididas **proporcionalmente pela renda** de cada um (ou 50/50, ou individual).
- Parcelas simples (sem SAC/Price), gráficos, exportação CSV.
- Agentes de IA (MCP ou API REST) registram despesas **em linguagem natural**.
- Tudo em um container: Node + SQLite. Sem Postgres, sem Stripe, sem Supabase, sem CDN.

## Stack

| Camada | Escolha |
|---|---|
| Frontend | Vite + JavaScript puro (servido pelo próprio backend em produção) |
| Backend | Node 22.18 + Fastify 5 |
| Banco | SQLite (`node:sqlite`, stdlib) — um arquivo `data/juntos.db` |
| Deploy | Docker Compose com 1 serviço, `restart: unless-stopped` |

## Desenvolvimento

```bash
cp .env.example .env
# em desenvolvimento use APP_PORT=3001 (o Vite usa a 3000 e encaminha /api)
npm install
npm run dev:server   # backend em :3001
npm run dev          # frontend em http://localhost:3000
```

## Execução local sem Docker

```bash
cp .env.local.example .env
npm install
npm run build
npm start
```

Acesse `http://localhost:4205`. O banco local fica em `./data-local`.

## Produção no home server

```bash
cp .env.example .env
docker compose up -d --build

# smoke test (opcional; com token também valida a API do agente)
JUNTOS_SMOKE_URL=http://localhost:4205 ./scripts/smoke.sh
```

Acesse `http://localhost:4205`. O banco fica no volume `juntos-data`; os
backups em `./backups` (montado no host). Para HTTPS (Tailscale/reverse
proxy), mude `APP_ORIGIN` e `COOKIE_SECURE=true`.

### Coolify

No Coolify, selecione este repositório e o arquivo `docker-compose.yml`. Não é
necessário versionar `.env`: configure no serviço as variáveis `APP_ORIGIN`,
`APP_HOST=0.0.0.0`, `APP_PORT=3000`, `TZ`, `TRUST_PROXY`, `COOKIE_SECURE`,
`SESSION_DAYS` e `HOST_PORT` conforme o domínio/proxy. O Compose passa essas
variáveis explicitamente ao container e não depende de um `env_file` presente
no repositório.

O Compose publica `127.0.0.1:4205` por padrão para impedir que a senha
temporária seja usada remotamente durante o primeiro boot. Depois de concluir
o assistente, um proxy pode publicar o serviço definindo `HOST_BIND` (por
exemplo, `0.0.0.0`) e configurando HTTPS/autenticação da rede.

No primeiro boot, entre com usuário `admin` e senha `Admin@123`. O assistente
pede o novo nome, usuário e senha definitiva do administrador, além do nome,
usuário e senha provisória do segundo usuário. O segundo usuário será obrigado
a trocar essa senha no primeiro login. A senha `Admin@123` deixa de funcionar
após a configuração inicial.

## Backup e restauração

```bash
docker compose exec app ./scripts/backup.sh
# ou fora do container:
./scripts/backup.sh

# restaurar (pare o app antes):
JUNTOS_RESTORE_CONFIRMED=1 ./scripts/restore.sh backups/juntos-20260808-123456.db
# em Docker, pare/suba o compose; localmente, reinicie `npm start`
```

Retenção: os últimos 14 backups (configurável via `JUNTOS_BACKUP_RETENTION`).

## Agente de IA (MCP / API)

Crie o token único em **Configurações → API do agente** (aparece uma única vez).

### MCP (linguagem natural)

O servidor MCP expõe `get_context`, `create_expense` e `list_expenses` para
Claude Desktop, pi, Cursor etc. Você fala "paguei 287,43 no supermercado
ontem com o Nubank" e o agente registra — data, categoria, divisão e pagador
têm padrões sensatos, e `dry_run` valida antes de gravar.

Para instruções prontas de comportamento do agente, veja
[`docs/agent-prompt.md`](./docs/agent-prompt.md).

```bash
npm --prefix mcp install
JUNTOS_URL=http://localhost:4205 JUNTOS_API_TOKEN=jl_live_... node mcp/server.js
```

Configuração para o Claude Desktop:

```json
{
  "mcpServers": {
    "juntos": {
      "command": "node",
      "args": ["/caminho/para/juntos/mcp/server.js"],
      "env": { "JUNTOS_URL": "http://localhost:4205", "JUNTOS_API_TOKEN": "jl_live_..." }
    }
  }
}
```

### API REST

`POST /api/v1/agent/expenses` com `Authorization: Bearer jl_live_...` e
`Idempotency-Key` (replay seguro; conflito = 409). Veja [`docs/agent-api.md`](./docs/agent-api.md).

## Comandos

```bash
npm run check   # testes + build
npm test
npm run build
```
