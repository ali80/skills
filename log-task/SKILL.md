---
name: log-task
description: Record the work just finished in this session as a completed task in AOps, with a short description, who did it and how long it took. Use only when the user runs log-task or asks to log, record or add this session's work to AOps tasks.
argument-hint: "[title, owner, duration or other corrections]"
disable-model-invocation: true
---

# Log this session's work as an AOps task

Record what this session did as a finished task in AOps. This works the same in Claude Code and in Codex. Only run it when the user asks; never log a session on your own.

The user may add corrections when calling it: a title, a different owner, a duration, or "only the last part".

## 0. Check AOps is reachable

Use the `aops` MCP tools (`aops_catalog`, `aops_find`, `aops_query`, `aops_mutate`). If this session has none, use the command-line client from an AOps checkout instead (`pnpm aops --help` in `stockmng-front`; `pnpm aops mutate <procedure> <json> --key <key> --reason <why> [--group <groupKey>]`). If neither is available, say so and stop.

## 1. Measure the time

`session-time.mjs` sits in the same folder as this file. Run it by its full path, with a marker you make up for this run (the word `log-task-` plus 8 random letters and digits):

```bash
node <this skill's folder>/session-time.mjs --marker log-task-<8 random characters>
```

The marker is how the script finds this session's transcript: your own command line is written to it. If the script answers that the marker is not in any transcript yet, run the exact same command once more.

It returns `tool` (`claude` or `codex`), `activeMinutes` and the work `blocks` (start and end of each stretch of activity). Gaps longer than 10 minutes are treated as time away and not counted.

- If this session covered several tasks and only the latest is being logged, or an earlier part was already logged, add `--since <ISO instant>` for where this task began.
- If the script fails for another reason, do not guess a duration: ask the user how long it took.
- Drop blocks shorter than one minute.

## 2. Draft the task

Draft these from the conversation, not from the script:

- **Title**: what was done, as an outcome, under 80 characters ("Add call tasks panel to Caller Desk"), not "AI session".
- **Description** (Markdown, in the language the user worked in):
  - two or three sentences on what was done and why;
  - what is left or not verified, if anything;
  - for code work: the repository, the commit hashes or branch, and the released version if there was one;
  - a last line: `Done with <Claude Code or Codex> · <N> min active over <M> work blocks`.
- **Owner**: the person the AOps token acts as (`you.user` from `aops_catalog()`), unless the user names someone else; then take the id from `tasks.listUsers`.
- **Related record**: only when the work was about one specific AOps record (a customer, sales order, work order, ticket, item). Find it with `aops_find` and pass it as `relatedTarget: { entityType, entityId }`. Code changes have no related record.
- **Tag**: the tool's name, `claude` or `codex` (`tasks.createTag({ name })` returns the existing tag when there is one).

Never put secrets, tokens, passwords or customer phone numbers and addresses in the title or description.

## 3. Confirm with the user

Show the draft once: title, description, owner, related record, total minutes and the blocks in the company time zone (`you.timeZone` from `aops_catalog()`). Ask whether to save it. Apply any correction they give, including a different duration, and do not write anything to AOps before they agree.

## 4. Save it

Use one `idempotencyKey` prefix for the whole run, `log-task:<session id>:<first block start>`, with a suffix per call, so a retry never creates a second task. Give every write a `reason` such as "Logging finished <tool> work: <title>".

1. `tasks.create` with `title`, `descriptionMarkdown`, `assigneeUserId`, `estimateMinutes` (the active minutes, rounded up, at least 1), `tagIds`, and `relatedTarget` when there is one.
2. Tracked time, only when the owner is the person the token acts as (timers always belong to that person). For each block:
   1. `tasks.startFocus({ taskId })`, then `tasks.stopFocus({ id })` with the returned session id.
   2. `tasks.correctFocusSession({ id, startedAt, endedAt, note: "<tool> session time" })` with the block's instants. This write waits for a person's approval: send every block's correction with the same `groupKey` (the key prefix), so the user approves them once.
3. `tasks.changeStatus({ id, status: "done" })`.

If the owner is someone else, skip step 2: the time stays in the description and the estimate only. Say so.

## 5. Report

Give the task link, the minutes recorded, and the approval link (`batchUrl` or `approvalUrl`) for the time correction, saying that tracked time shows as near zero until it is approved. If any call failed, say which and what was saved.
