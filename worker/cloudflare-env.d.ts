/** Minimal binding used by the local Cloudflare/Vite worker entry point. */
interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
