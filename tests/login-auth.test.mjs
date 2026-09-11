import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { DEMO_LOGIN_PROFILE } from "../app/lib/login-auth.ts";

test("login auth exposes a passwordless demo profile only", async () => {
  assert.deepEqual(DEMO_LOGIN_PROFILE, {
    name: "本機 Demo",
    employeeId: "DEV-DEMO",
  });

  const source = await readFile(new URL("../app/lib/login-auth.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /LOGIN_PASSWORD|validateLogin|sean002002dus/);
});
