// Loads Playwright from the project or, failing that, from the global npm root.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

export async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const globalRoot = execSync("npm root -g").toString().trim();
    const require = createRequire(import.meta.url);
    return require(require.resolve("playwright", { paths: [globalRoot] }));
  }
}
