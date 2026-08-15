#!/usr/bin/env node
/* Servidor MCP do juntos: expõe o lar a agentes em linguagem natural.
   Fala com a API REST do próprio juntos (Bearer + Idempotency-Key). */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = process.env.JUNTOS_URL || 'http://localhost:4205';
const TOKEN = process.env.JUNTOS_API_TOKEN || '';

if (!TOKEN) {
  console.error('JUNTOS_API_TOKEN não definido. Crie um token em Configurações > API do agente no juntos.');
  process.exit(1);
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${BASE_URL}/api/v1${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
        ...(options.headers || {}),
      },
    });
    let payload = null;
    try { payload = await response.json(); } catch { /* corpo vazio */ }
    if (!response.ok) throw new Error(payload?.error?.message || `Erro ${response.status}`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

// operation_id explícito mantém a mesma Idempotency-Key entre retries;
// sem ele, cada chamada é deliberadamente uma operação nova.
function idemKey(operationId) { return `mcp-operation:${operationId}`; }

const server = new McpServer({ name: 'juntos', version: '1.0.0' });

server.tool(
  'get_context',
  'Dados do lar para registrar despesas: membros, categorias, tipos de divisão, moeda e data de hoje.',
  {},
  async () => {
    const ctx = await api('/agent/context');
    return { content: [{ type: 'text', text: JSON.stringify(ctx, null, 2) }] };
  },
);

server.tool(
  'create_expense',
  'Registra uma despesa do lar em linguagem natural. Só description e amount são obrigatórios: date padrão hoje, category padrão "outros", split_type padrão proportional, paid_by padrão o administrador. Consulte get_context para os usuários disponíveis. Use dry_run=true para validar antes de gravar.',
  {
    description: z.string().describe('O que foi pago, ex.: "Supermercado"'),
    amount: z.string().describe('Valor em reais, ex.: "287,43" ou "287.43"'),
    date: z.string().optional().describe('Data YYYY-MM-DD (padrão hoje)'),
    category: z.enum(['alimentação', 'moradia', 'transporte', 'saúde', 'lazer', 'educação', 'assinaturas', 'vestuário', 'outros']).optional().describe('Categoria válida'),
    split_type: z.enum(['equal', 'proportional', 'individual']).optional().describe('Tipo de divisão'),
    paid_by: z.string().min(3).max(32).optional().describe('Username de quem pagou; consulte get_context'),
    payment_method: z.string().optional().describe('Nome do cartão/conta'),
    operation_id: z.string().min(8).max(128).optional().describe('Obrigatório ao gravar: ID estável para retry idempotente; opcional em dry_run'),
    dry_run: z.boolean().optional().describe('true = valida e normaliza sem gravar'),
  },
  async (args) => {
    const dryRun = args.dry_run === true;
    const body = { ...args };
    delete body.dry_run;
    const operationId = body.operation_id;
    delete body.operation_id;
    if (dryRun) body.dry_run = true;
    if (!dryRun && !operationId) {
      throw new Error('operation_id é obrigatório para gravar uma despesa; use dry_run=true para apenas validar');
    }
    const result = await api('/agent/expenses', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: dryRun ? {} : {
        'idempotency-key': idemKey(operationId),
      },
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  'list_expenses',
  'Lista despesas recentes do lar, para consultas como "quanto gastamos no mês?" ou "o que foi pago na padaria?".',
  {
    month: z.string().optional().describe('Mês no formato YYYY-MM, ex.: "2026-08"'),
    limit: z.number().optional().describe('Quantidade máxima (padrão 20)'),
    cursor: z.string().optional().describe('Cursor retornado por uma página anterior'),
  },
  async ({ month, limit, cursor }) => {
    const q = new URLSearchParams();
    if (month) q.set('month', month);
    q.set('limit', String(limit || 20));
    if (cursor) q.set('cursor', cursor);
    const result = await api(`/agent/expenses?${q}`);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
