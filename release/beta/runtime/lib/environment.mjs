export const ORIGIN = 'http://127.0.0.1:4317';
export const CONTROL_HEADER = 'x-nettopo-beta-control';
export function betaEnvironment(source = process.env) {
  const env = Object.fromEntries(Object.entries(source).filter(([key]) => /^(systemroot|windir|path|pathext|comspec|temp|tmp|userprofile|localappdata|appdata)$/i.test(key)));
  return { ...env, NODE_ENV: 'production', NETTOPO_RUNTIME: 'node', NETTOPO_RUNTIME_PROFILE: 'local-beta', NETTOPO_AUTH_MODE: 'disabled', NETTOPO_STORAGE_MODE: 'indexeddb', NEXT_PUBLIC_TOPOLOGY_STORAGE: 'local', NEXT_PUBLIC_LOCAL_BETA: '1', HOST: '127.0.0.1', PORT: '4317', NETTOPO_ENABLE_DEV_IDENTITY_HEADER: '0', NETTOPO_ENABLE_DEMO_SEED: '0', NEXT_TELEMETRY_DISABLED: '1', VITE_TELEMETRY_DISABLED: '1', NO_UPDATE_NOTIFIER: '1' };
}
