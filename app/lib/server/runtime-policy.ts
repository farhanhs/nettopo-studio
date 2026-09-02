export type RuntimeProfile = "development" | "test" | "production" | "pilot";
export type AuthMode = "demo" | "oidc" | "disabled" | "pilot";

export type RuntimePolicy = {
  profile: RuntimeProfile;
  authMode: AuthMode;
  capabilities: {
    demoAuth: boolean;
    devIdentityOverride: boolean;
    demoSeed: boolean;
    pilotAuth: boolean;
    pilotFullExport: boolean;
  };
};

export const DEV_IDENTITY_ALLOWLIST = [
  { email: "sean.sie@dus.local", label: "sean.sie / Demo Engineer" },
  { email: "manner@company.local", label: "manner / Boss" },
  { email: "north1.manager@company.local", label: "North 1 Manager" },
  { email: "north2.manager@company.local", label: "North 2 Manager" },
  { email: "engineer@company.local", label: "Engineer" },
  { email: "sales@company.local", label: "Sales / Purchasing" },
] as const;

const PROFILE_VALUES = new Set(["development", "test", "production", "pilot"]);
const AUTH_MODE_VALUES = new Set(["demo", "oidc", "disabled", "pilot"]);
const PILOT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function runtimeProfile(value: string | undefined): RuntimeProfile {
  if (value && PROFILE_VALUES.has(value)) return value as RuntimeProfile;
  return "production";
}

function authMode(value: string | undefined): AuthMode {
  if (value && AUTH_MODE_VALUES.has(value)) return value as AuthMode;
  return "disabled";
}

function flag(value: string | undefined) {
  return value === "1";
}

function validatePilotAllowlist(raw: string | undefined) {
  if (!raw || raw.trim() === "") throw new Error("Invalid RuntimePolicy: pilot auth requires NETTOPO_PILOT_USERS allowlist.");
  const seen = new Set<string>();
  for (const entry of raw.split(",")) {
    const parts = entry.split(":").map((part) => part.trim());
    if (parts.length !== 3) throw new Error("Invalid RuntimePolicy: NETTOPO_PILOT_USERS entries must be email:role:version.");
    const [email, role, version] = parts;
    const normalizedEmail = email.toLowerCase();
    if (!PILOT_EMAIL_PATTERN.test(normalizedEmail)) throw new Error("Invalid RuntimePolicy: NETTOPO_PILOT_USERS contains an invalid email.");
    if (seen.has(normalizedEmail)) throw new Error("Invalid RuntimePolicy: NETTOPO_PILOT_USERS contains duplicate emails.");
    seen.add(normalizedEmail);
    if (role !== "admin" && role !== "engineer") throw new Error("Invalid RuntimePolicy: NETTOPO_PILOT_USERS role must be admin or engineer.");
    if (!version) throw new Error("Invalid RuntimePolicy: NETTOPO_PILOT_USERS version is required.");
  }
}

export function isLoopbackHost(host: string | undefined) {
  const value = (host || "127.0.0.1").toLowerCase().split(":")[0].replace(/^\[|\]$/g, "");
  return value === "localhost" || value === "127.0.0.1" || value === "::1";
}

export function getRuntimePolicy(env: NodeJS.ProcessEnv = process.env): RuntimePolicy {
  const profile = runtimeProfile(env.NETTOPO_RUNTIME_PROFILE);
  const mode = authMode(env.NETTOPO_AUTH_MODE);
  const nonProduction = profile === "development" || profile === "test";
  const pilot = profile === "pilot" && mode === "pilot";

  return {
    profile,
    authMode: mode,
    capabilities: {
      demoAuth: nonProduction && mode === "demo",
      devIdentityOverride: nonProduction && flag(env.NETTOPO_ENABLE_DEV_IDENTITY_HEADER),
      demoSeed: nonProduction && flag(env.NETTOPO_ENABLE_DEMO_SEED),
      pilotAuth: pilot,
      pilotFullExport: pilot && flag(env.NETTOPO_PILOT_ALLOW_FULL_EXPORT),
    },
  };
}

export function validateRuntimePolicy(env: NodeJS.ProcessEnv = process.env, host = env.HOST) {
  const policy = getRuntimePolicy(env);
  const requestedDevCapability =
    flag(env.NETTOPO_ENABLE_DEV_IDENTITY_HEADER) ||
    flag(env.NETTOPO_ENABLE_DEMO_SEED) ||
    policy.authMode === "demo";

  if (policy.profile === "production" && requestedDevCapability) {
    throw new Error("Invalid RuntimePolicy: production cannot enable demo auth, dev identity override, or demo seed.");
  }
  if (policy.profile === "production" && policy.authMode !== "oidc" && policy.authMode !== "disabled") {
    throw new Error("Invalid RuntimePolicy: production auth mode must be oidc or disabled.");
  }
  if (policy.profile === "pilot") {
    if (requestedDevCapability) {
      throw new Error("Invalid RuntimePolicy: pilot cannot enable demo auth, dev identity override, or demo seed.");
    }
    if (policy.authMode !== "pilot" && policy.authMode !== "oidc" && policy.authMode !== "disabled") {
      throw new Error("Invalid RuntimePolicy: pilot auth mode must be pilot, oidc, or disabled.");
    }
    if (policy.capabilities.pilotAuth) {
      if (!env.NETTOPO_PILOT_SESSION_SECRET || env.NETTOPO_PILOT_SESSION_SECRET.length < 32) {
        throw new Error("Invalid RuntimePolicy: pilot auth requires NETTOPO_PILOT_SESSION_SECRET with at least 32 characters.");
      }
      if (!env.NETTOPO_PILOT_SITE_ID || env.NETTOPO_PILOT_SITE_ID.trim() === "") {
        throw new Error("Invalid RuntimePolicy: pilot auth requires NETTOPO_PILOT_SITE_ID.");
      }
      validatePilotAllowlist(env.NETTOPO_PILOT_USERS);
    }
  }
  if ((env.NETTOPO_RUNTIME_PROFILE === "production" || env.CI === "true") && !env.MIGRATION_DATABASE_URL) {
    throw new Error("Invalid RuntimePolicy: production/CI requires MIGRATION_DATABASE_URL.");
  }
  if (policy.capabilities.devIdentityOverride && !isLoopbackHost(host)) {
    throw new Error("Invalid RuntimePolicy: dev identity override is only allowed on 127.0.0.1 or localhost.");
  }
  return policy;
}

export function runtimePolicySummary(policy = getRuntimePolicy()) {
  return {
    profile: policy.profile,
    authMode: policy.authMode,
    capabilities: { ...policy.capabilities },
  };
}
