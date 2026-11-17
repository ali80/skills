#!/usr/bin/env node
// Measures how long the current Claude Code or Codex session was actively worked on, from
// the timestamps in its transcript. Gaps longer than the idle cap split the work into
// blocks and are not counted, so a session left open over lunch does not count as work.
//
// Usage: node session-time.mjs --marker <unique text> [--since <ISO instant>] [--idle-cap <minutes>]
//        node session-time.mjs --session <session id> [...]
//
// --marker finds the session that ran this very command: the agent's own command line is
// written to its transcript, so a unique word in it identifies the right file even when
// several sessions run side by side.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

const MARKER_NOT_FOUND = 2;
/** A session that just ran this command wrote to its transcript moments ago. */
const RECENT_MS = 30 * 60_000;

function fail(message, code = 1) {
  console.error(`session-time: ${message}`);
  process.exit(code);
}

const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (value === undefined) fail(`${name} needs a value.`);
  return value;
}

const idleCapMinutes = Number(option("--idle-cap") ?? 10);
if (!Number.isFinite(idleCapMinutes) || idleCapMinutes <= 0) {
  fail("--idle-cap must be a positive number of minutes.");
}
const sinceText = option("--since");
const since = sinceText ? Date.parse(sinceText) : null;
if (sinceText && Number.isNaN(since)) {
  fail(`--since is not a valid instant: ${sinceText}`);
}
const marker = option("--marker");
if (marker !== undefined && marker.length < 8) {
  fail("--marker must be at least 8 characters so it cannot match by accident.");
}

function listDir(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Claude Code keeps one <session id>.jsonl per session under a folder per project. */
function claudeTranscripts() {
  const root = join(
    process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"),
    "projects",
  );
  return listDir(root)
    .filter((entry) => entry.isDirectory())
    .flatMap((project) =>
      listDir(join(root, project.name))
        .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
        .map((entry) => join(root, project.name, entry.name)),
    );
}

/** Codex keeps sessions/<year>/<month>/<day>/rollout-<time>-<session id>.jsonl. */
function codexTranscripts() {
  const root = join(
    process.env.CODEX_HOME ?? join(homedir(), ".codex"),
    "sessions",
  );
  const found = [];
  const walk = (dir, depth) => {
    for (const entry of listDir(dir)) {
      const path = join(dir, entry.name);
      if (entry.isDirectory() && depth < 3) walk(path, depth + 1);
      else if (entry.isFile() && /^rollout-.*\.jsonl$/.test(entry.name)) {
        found.push(path);
      }
    }
  };
  walk(root, 0);
  return found;
}

const isCodex = (path) => basename(path).startsWith("rollout-");

function findBySessionId(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) fail(`Not a session id: ${id}`);
  const lower = id.toLowerCase();
  return [...claudeTranscripts(), ...codexTranscripts()].filter((path) =>
    basename(path).toLowerCase().endsWith(`${lower}.jsonl`),
  );
}

function findByMarker(text) {
  const cutoff = Date.now() - RECENT_MS;
  return [...claudeTranscripts(), ...codexTranscripts()].filter((path) => {
    try {
      if (statSync(path).mtimeMs < cutoff) return false;
      return readFileSync(path, "utf8").includes(text);
    } catch {
      return false;
    }
  });
}

function resolveTranscript() {
  const explicit = option("--session");
  if (explicit) {
    const matches = findBySessionId(explicit);
    if (matches.length === 1) return matches[0];
    fail(
      matches.length === 0
        ? `No transcript found for session ${explicit}`
        : `Session ${explicit} matches several transcripts.`,
    );
  }
  if (marker) {
    const matches = findByMarker(marker);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      fail(
        `The marker appears in ${matches.length} sessions. Use a new, unique marker.`,
      );
    }
  }
  // Claude Code names its session in the environment; Codex does not.
  const fromEnv = process.env.CLAUDE_CODE_SESSION_ID;
  if (fromEnv) {
    const matches = findBySessionId(fromEnv).filter((path) => !isCodex(path));
    if (matches.length === 1) return matches[0];
  }
  if (marker) {
    fail(
      "The marker is not in any recent transcript yet. Run the exact same command once more.",
      MARKER_NOT_FOUND,
    );
  }
  fail("Pass --marker <unique text> or --session <id>.");
}

const transcript = resolveTranscript();
const tool = isCodex(transcript) ? "codex" : "claude";

/** Whether a transcript line is a moment of work in the main conversation. */
function countsAsWork(entry) {
  if (tool === "codex") {
    return entry.type === "response_item" || entry.type === "event_msg";
  }
  return (
    (entry.type === "user" || entry.type === "assistant") && !entry.isSidechain
  );
}

const instants = [];
for (const line of readFileSync(transcript, "utf8").split("\n")) {
  if (!line) continue;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    continue;
  }
  if (!countsAsWork(entry)) continue;
  const at = Date.parse(entry.timestamp);
  if (Number.isNaN(at)) continue;
  if (since !== null && at < since) continue;
  instants.push(at);
}
if (instants.length === 0) {
  fail("The transcript has no conversation turns in that range.");
}
instants.sort((a, b) => a - b);

const capMs = idleCapMinutes * 60_000;
const blocks = [];
let start = instants[0];
let previous = instants[0];
for (const at of instants.slice(1)) {
  if (at - previous > capMs) {
    blocks.push([start, previous]);
    start = at;
  }
  previous = at;
}
blocks.push([start, previous]);

const minutes = (ms) => Math.round(ms / 6000) / 10;
const activeMs = blocks.reduce((sum, [from, to]) => sum + (to - from), 0);
const sessionId = basename(transcript).match(/([0-9a-f-]{36})\.jsonl$/i)?.[1];

console.log(
  JSON.stringify(
    {
      tool,
      sessionId: sessionId ?? null,
      idleCapMinutes,
      since: since === null ? null : new Date(since).toISOString(),
      firstTurnAt: new Date(instants[0]).toISOString(),
      lastTurnAt: new Date(previous).toISOString(),
      wallMinutes: minutes(previous - instants[0]),
      activeMinutes: minutes(activeMs),
      blocks: blocks.map(([from, to]) => ({
        startedAt: new Date(from).toISOString(),
        endedAt: new Date(to).toISOString(),
        minutes: minutes(to - from),
      })),
    },
    null,
    2,
  ),
);
