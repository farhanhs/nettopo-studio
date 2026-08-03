import assert from "node:assert/strict";
import test from "node:test";

import {
  LOGIN_ACCOUNT,
  LOGIN_PASSWORD,
  LOGIN_PROFILE,
  validateLogin,
} from "../app/lib/login-auth.ts";

test("accepts the configured employee login", () => {
  assert.equal(validateLogin("sean.sie", "sean002002dus"), true);
  assert.equal(LOGIN_ACCOUNT, "sean.sie");
  assert.equal(LOGIN_PASSWORD, "sean002002dus");
  assert.deepEqual(LOGIN_PROFILE, {
    name: "謝慶宣",
    employeeId: "140901",
  });
});

test("rejects incorrect account and password combinations", () => {
  assert.equal(validateLogin("sean.sie", "incorrect"), false);
  assert.equal(validateLogin("other.user", "sean002002dus"), false);
  assert.equal(validateLogin("", ""), false);
});
