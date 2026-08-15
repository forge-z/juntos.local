#!/usr/bin/env bash
# Smoke test operacional do app já iniciado.
# Uso: JUNTOS_SMOKE_URL=http://localhost:4205 JUNTOS_API_TOKEN=... ./scripts/smoke.sh
set -euo pipefail

URL="${JUNTOS_SMOKE_URL:-http://127.0.0.1:3000}"
TOKEN="${JUNTOS_API_TOKEN:-}"

node --input-type=module - "$URL" "$TOKEN" <<'NODE'
const [url, token] = process.argv.slice(2);
async function check(path, headers = {}) {
  const response = await fetch(`${url}${path}`, { headers });
  if (!response.ok) throw new Error(`${path} respondeu ${response.status}`);
  return response.json();
}
await check('/healthz');
if (token) await check('/api/v1/agent/context', { authorization: `Bearer ${token}` });
console.log(token ? 'smoke: healthz + agent context ok' : 'smoke: healthz ok');
NODE
