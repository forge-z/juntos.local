# MCP — agente em linguagem natural

O servidor MCP (`mcp/server.js`) expõe o lar a clientes MCP (Claude Desktop,
pi, Cursor...). Ele é uma camada fina por cima da [API REST](./agent-api.md):
o agente (LLM) interpreta a linguagem natural e o servidor valida e grava.

## Tools

| Tool | Descrição |
|---|---|
| `get_context` | Membros, categorias, divisões, moeda e data de hoje. |
| `create_expense` | Registra despesa. Só `description` e `amount` são obrigatórios; `date` hoje, `category` outros, `split_type` proportional, `paid_by` o administrador. Consulte `get_context` para os usernames disponíveis. `dry_run` valida sem gravar; para gravar, `operation_id` é obrigatório e deve ser estável nos retries. |
| `list_expenses` | Consultas como "quanto gastamos em agosto?" (filtro por mês/limite/cursor). |

## Instalar

```bash
npm --prefix mcp install
```

## Rodar

```bash
JUNTOS_URL=http://localhost:4205 JUNTOS_API_TOKEN=jl_live_... node mcp/server.js
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
> **Claude:** consulte `get_context` e então use `create_expense(description="Supermercado", amount="287,43", date="2026-08-07", category="alimentação", paid_by="admin-configurado", payment_method="Cartão principal", operation_id="compra-2026-08-07-001")` → confirma e grava.

## Idempotência

O servidor MCP usa `operation_id` como `Idempotency-Key` em toda gravação. Se
uma chamada falhar no meio, repita com o mesmo `operation_id`; para uma nova
despesa, gere outro. Chamadas de gravação sem esse campo são rejeitadas para
evitar duplicação após timeout; `dry_run` pode omiti-lo.

`list_expenses` retorna `pagination.next_cursor` quando há mais resultados;
informe esse valor em `cursor` para continuar a consulta.
