import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repository = await readFile(new URL("../db/topology-postgres.ts", import.meta.url), "utf8");
const scope = await readFile(new URL("../db/topology-scope.ts", import.meta.url), "utf8");

function exportedBody(name) {
  const start = repository.indexOf(`export async function ${name}`);
  const end = repository.indexOf("\nexport async function ", start + 1);
  assert.notEqual(start, -1, `${name} should exist`);
  return repository.slice(start, end === -1 ? repository.length : end);
}

test("active user loader fails closed for disabled accounts", () => {
  assert.match(scope, /where lower\(u\.email\) = lower\(\$\{email\}\) and u\.disabled_at is null/);
});

test("security-sensitive mutations recheck active actor and locked resources in transaction", () => {
  const expectations = {
    createTopology: [/loadActiveUser\(tx/, /loadSite\(tx/, /loadCustomer\(tx/, /canUseCustomerForTopologyCreate\(tx/],
    saveTopologyProject: [/loadActiveUser\(tx/, /loadTopology\(tx, topologyId, true/],
    upsertDeviceCredential: [/loadActiveUser\(tx/, /loadTopology\(tx, input\.topologyId, true/, /hasPermission\(tx/],
    deleteDeviceCredential: [/loadActiveUser\(tx/, /loadTopology\(tx, credential\.topology_id, true/, /hasPermission\(tx/],
    renameCustomer: [/loadActiveUser\(tx/, /loadCustomer\(tx, customerId, true/, /assertCanWriteCustomer\(txUser/],
    deleteCustomer: [/loadActiveUser\(tx/, /loadCustomer\(tx, customerId, true/, /assertCanWriteCustomer\(txUser/],
    renameTopology: [/loadActiveUser\(tx/, /loadTopology\(tx, topologyId, true/],
    deleteTopology: [/loadActiveUser\(tx/, /loadTopology\(tx, topologyId, true/],
  };
  for (const [name, patterns] of Object.entries(expectations)) {
    const body = exportedBody(name);
    assert.match(body, /\.begin\(async \(tx\)/, `${name} should use a transaction`);
    for (const pattern of patterns) assert.match(body, pattern, `${name} is missing ${pattern}`);
  }
});

test("duplicateCustomer reloads source topology snapshots inside its transaction", () => {
  const body = exportedBody("duplicateCustomer");
  const transaction = body.slice(body.indexOf("await sql.begin"));
  assert.match(transaction, /from topologies[\s\S]*where customer_id = \$\{customerId\}/i);
});

test("API routes map authentication, authorization, invisible resources and schema failures safely", async () => {
  const paths = ["topology", "credentials", "audit-logs", "session"];
  for (const path of paths) {
    const source = await readFile(new URL(`../app/api/${path}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /PostgresSchemaNotReadyError/);
    assert.match(source, /safePostgresSchemaError/);
    assert.match(source, /status:\s*503/);
    assert.match(source, /Permission denied/);
    assert.match(source, /status:\s*403|\? 403/);
    assert.doesNotMatch(source, /stack|DATABASE_URL.*json|sql.*json/i);
  }
});
