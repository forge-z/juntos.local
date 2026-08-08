# API do agente

Agentes (MCP ou integrações diretas) registram despesas com **um único token**
criado em Configurações → API do agente (exibido uma única vez; o banco guarda
só o hash). O token é do lar: tanto faz se foi Alexandre ou Priscila quem criou.

Base: `http://localhost:4205/api/v1/agent` (em produção, use a mesma origem do app).

## Autenticação

```http
Authorization: Bearer jl_live_<prefixo>_<segredo>
```

Todas as rotas de agente exigem o Bearer. Revogar o token em Configurações
invalida na hora.

## Contexto (monte chamadas válidas)

```bash
curl http://localhost:4205/api/v1/agent/context \
  -H 'Authorization: Bearer jl_live_...'
```

```json
{
  "timezone": "America/Sao_Paulo",
  "currency": "BRL",
  "today": "2026-08-08",
  "members": [
    { "slug": "alexandre", "name": "Alexandre" },
    { "slug": "priscila", "name": "Priscila" }
  ],
  "categories": ["alimentação", "moradia", "transporte", "saúde", "lazer", "educação", "assinaturas", "vestuário", "outros"],
  "split_types": ["equal", "proportional", "individual"],
  "payment_method": "texto livre — informe o nome do cartão/conta se quiser, ou omita"
}
```

## Criar despesa

```bash
curl -X POST http://localhost:4205/api/v1/agent/expenses \
  -H 'Authorization: Bearer jl_live_...' \
  -H 'Idempotency-Key: agente-2026-08-08-001' \
  -H 'Content-Type: application/json' \
  -d '{"description":"Supermercado","amount":"287,43","category":"alimentação","split_type":"proportional","paid_by":"alexandre","payment_method":"Nubank Alexandre"}'
```

Corpo (tudo opcional exceto `description` e `amount`):

| Campo | Padrão | Observação |
|---|---|---|
| `description` | — | obrigatório, 1–160 caracteres |
| `amount` | — | obrigatório, decimal com até 2 casas ("287,43" ou "287.43") |
| `date` | hoje | `YYYY-MM-DD` |
| `category` | `outros` | enum do contexto; valor inválido = 422 |
| `split_type` | `proportional` | enum do contexto; valor inválido = 422 |
| `paid_by` | `alexandre` | slug do contexto; valor desconhecido = 422 |
| `payment_method` | null | texto livre |
| `dry_run` | `false` | `true` = valida/normaliza e não grava (não precisa de Idempotency-Key) |

Respostas:

- `201` primeira criação; `200` replay idempotente (mesma chave + mesmo corpo);
- `409 idempotency_conflict` mesma chave com corpo diferente;
- `422 invalid_payload` campos inválidos;
- `401 invalid_api_key` token inválido/revogado.

```json
{
  "data": {
    "id": "uuid",
    "description": "Supermercado",
    "amount": "287.43",
    "date": "2026-08-08",
    "category": "alimentação",
    "split_type": "proportional",
    "paid_by": "alexandre",
    "payment_method": "Nubank Alexandre",
    "source": "agent"
  },
  "idempotent_replay": false
}
```

## Listar despesas

```bash
curl 'http://localhost:4205/api/v1/agent/expenses?month=2026-08&limit=50' \
  -H 'Authorization: Bearer jl_live_...'
```

## Recomendações para agentes

1. Chame `get_context` (ou o tool MCP) quando precisar de membros/categorias válidos.
2. Antes de gravar, rode com `dry_run: true` e confirme os valores normalizados.
3. Na gravação, use uma `Idempotency-Key` estável por operação lógica — retries
   com a mesma chave nunca duplicam a despesa.
