import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const endpoint = "repos/suzzyqgit/owner-memory-private/contents/OWNER_MEMORY.md";
const unavailable = "OWNER_MEMORY_UNAVAILABLE: Continue v3.0 bootstrap; Owner personal facts remain UNKNOWN. Do not infer or reuse cached context.";

// No disk cache, credentials, private fixtures, or raw error output.
export function loadOwnerMemory(run = execFileSync) {
  try {
    const response = JSON.parse(run("gh", ["api", endpoint], {
      encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    }));
    if (response.type !== "file" || response.encoding !== "base64" ||
        response.path !== "OWNER_MEMORY.md" || typeof response.content !== "string") {
      throw new Error("Invalid file response");
    }
    const bytes = Buffer.from(response.content, "base64");
    const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const sha = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    if (!content.trim() || response.size !== bytes.length || response.sha !== sha) {
      throw new Error("Incomplete or unverifiable file");
    }
    return { status: "OWNER_MEMORY_LOADED", sha, content };
  } catch {
    return { status: "OWNER_MEMORY_UNAVAILABLE", warning: unavailable };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = loadOwnerMemory();
  if (result.status === "OWNER_MEMORY_LOADED") {
    process.stdout.write(`${result.status} sha=${result.sha}\nOwner personal context only; not governance or authority.\n\n${result.content}\n`);
  } else {
    process.stderr.write(`${result.warning}\n`);
  }
  // Unavailable personal context must not fail the existing runtime bootstrap.
}
