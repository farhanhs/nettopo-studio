import vinext from "vinext";
import { defineConfig } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const packageRoots = new Set<string>();
export default defineConfig({
  plugins: [vinext(), {
    name: "beta-dependency-evidence",
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;
        for (const id of Object.keys(chunk.modules)) {
          const path = id.replaceAll("\\", "/").replace(/^\0/, "");
          const marker = path.lastIndexOf("/node_modules/");
          if (marker < 0) continue;
          const parts = path.slice(marker + 14).split("/");
          const count = parts[0].startsWith("@") ? 2 : 1;
          packageRoots.add(path.slice(0, marker + 14) + parts.slice(0, count).join("/"));
        }
      }
      const packages = [...packageRoots].sort().map(path => {
        const pkg = JSON.parse(readFileSync(resolve(path, "package.json"), "utf8"));
        return { name: pkg.name, version: pkg.version, license: pkg.license, path };
      });
      writeFileSync(resolve("../dependency-inputs.json"), JSON.stringify(packages, null, 2) + "\n");
    },
  }],
  define: { "process.env.NEXT_PUBLIC_LOCAL_BETA": JSON.stringify("1"), "process.env.NEXT_PUBLIC_TOPOLOGY_STORAGE": JSON.stringify("local") },
  build: { sourcemap: false },
});
