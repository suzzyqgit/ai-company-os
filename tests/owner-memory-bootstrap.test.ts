import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { loadOwnerMemory } from "../scripts/load-owner-memory.mjs";

function fixture(content = "# Synthetic Owner\nAnonymous test context.\n") {
  const bytes = Buffer.from(content);
  return JSON.stringify({ type: "file", path: "OWNER_MEMORY.md", encoding: "base64",
    size: bytes.length, content: bytes.toString("base64"),
    sha: createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex") });
}
const mock = (value: string) => (() => value) as unknown as typeof execFileSync;

test("loads complete private context from the default branch without caching", () => {
  let calls = 0;
  const run = ((command: string, args: string[], options: { timeout: number }) => {
    assert.equal(command, "gh");
    assert.deepEqual(args, ["api", "repos/suzzyqgit/owner-memory-private/contents/OWNER_MEMORY.md"]);
    assert.equal(options.timeout, 15000);
    return fixture(`# Synthetic revision ${++calls}`);
  }) as unknown as typeof execFileSync;
  const first = loadOwnerMemory(run);
  const next = loadOwnerMemory(run);
  assert.equal(first.status, "OWNER_MEMORY_LOADED");
  assert.equal(next.content, "# Synthetic revision 2");
  assert.notEqual(first.sha, next.sha);
  assert.equal(calls, 2);
});

test("missing auth, CLI, network and timeout discard errors and permit continuation", () => {
  for (const reason of ["401 synthetic secret", "404", "ENOENT", "ETIMEDOUT"]) {
    const result = loadOwnerMemory((() => { throw new Error(reason); }) as typeof execFileSync);
    assert.equal(result.status, "OWNER_MEMORY_UNAVAILABLE");
    assert.equal(result.content, undefined);
    assert.ok(!JSON.stringify(result).includes(reason));
    assert.match(result.warning!, /Continue v3.0 bootstrap/);
  }
});

test("empty, malformed, partial and mismatched responses are unavailable", () => {
  const partial = JSON.parse(fixture());
  partial.size += 1;
  const badSha = JSON.parse(fixture());
  badSha.sha = "0".repeat(40);
  for (const response of ["bad json", "null", "{}", fixture(""), JSON.stringify(partial), JSON.stringify(badSha)]) {
    assert.equal(loadOwnerMemory(mock(response)).status, "OWNER_MEMORY_UNAVAILABLE");
  }
});

test("CLI missing gh warns without failing bootstrap or emitting private data", () => {
  const output = spawnSync(process.execPath, ["scripts/load-owner-memory.mjs"], {
    env: { ...process.env, PATH: "" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(output.status, 0);
  assert.equal(output.stdout, "");
  assert.match(output.stderr, /OWNER_MEMORY_UNAVAILABLE/);
});

test("Codex and current Manifest reach the same context bootstrap", () => {
  for (const path of ["AGENTS.md", "docs/bootstrap/kavora-runtime-manifest-v3.0.md"]) {
    assert.match(readFileSync(path, "utf8"), /owner-context-bootstrap\.md/);
  }
  assert.match(readFileSync("docs/bootstrap/owner-context-bootstrap.md", "utf8"), /OWNER_MEMORY_UNAVAILABLE/);
});
