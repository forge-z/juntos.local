# MCP — agente em linguagem natural

O servidor MCP (`mcp/server.js`) expõe o lar a clientes MCP (Claude Desktop,
pi, Cursor...). Ele é uma camada fina por cima da [API REST](./agent-api.md):
o agente (LLM) interpreta a linguagem natural e o servidor valida e grava.

## Tools

| Tool | Descrição |
|---|---|
| `get_context` | Membros, categorias, divisões, moeda e data de hoje. |
| `create_expense` | Registra despesa. Só `description` e `amount` são obrigatórios; `date` hoje, `category` outros, `split_type` proportional, `paid_by` alexandre. `dry_run` valida sem gravar. |
| `list_expenses` | Consultas como "quanto gastamos em agosto?" (filtro por mês/limite). |

## Instalar

```bash
cd mcp && npm install
```

## Rodar

```bash
JUNTOS_URL=http://localhost:4205 JUNTOS_API_TOKEN=jl_live_... npx juntos-mcp
```

Sem token, o servidor sai com erro explicando onde criá-lo (Configurações →
API do agente).

## Configurar no Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "juntos": {
      "command": "node",
      "args": ["/caminho/para/juntos/mcp/server.js"],
      "env": {
        "JUNTOS_URL": "http://localhost:4205",
        "JUNTOS_API_TOKEN": "jl_live_..."
      }
    }
  }
}
```

Reinicie o Claude Desktop. A partir daí a conversa flui natural:

> **Você:** Paguei 287,43 no supermercado ontem com o Nubank.
> **Claude:** `create_expense(description="Supermercado", amount="287,43", date="2026-08-07", category="alimentação", paid_by="alexandre", payment_method="Nubank Alexandre")` → confirma e grava.

## Idempotência

O servidor MCP deriva a `Idempotency-Key` dos argumentos (em memória, 15 min):
se uma chamada falhar no meio (timeout de rede) e o agente repetir com os
mesmos argumentos, a despesa não duplica — a API responde replay. Legítimas
repetições idênticas na mesma janela são tratadas como replay (ver `ponytail:`
no código).
