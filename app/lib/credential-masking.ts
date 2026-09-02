export const MASKED_SECRET = "********";

export function maskCredentialUsername(value?: string) {
  const username = value?.trim();
  if (!username) return undefined;
  const at = username.indexOf("@");
  if (at > 0) {
    const local = username.slice(0, at);
    return `${local.slice(0, 1)}***@${username.slice(at + 1)}`;
  }
  if (username.length === 1) return "*";
  return `${username.slice(0, 1)}***${username.slice(-1)}`;
}

export function isMaskedCredentialUsername(value?: string) {
  const username = value?.trim();
  if (!username) return true;
  if (username === "*") return true;
  if (!username.includes("***")) return false;
  if (username.includes(" ")) return false;
  const [local, domain] = username.split("@");
  if (domain !== undefined) return local.length >= 4 && local.endsWith("***") && domain.length > 0;
  return username.length >= 5 && username.indexOf("***") > 0 && username.endsWith(username.slice(-1));
}
