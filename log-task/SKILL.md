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

It returns `tool` (`claude` or `codex`), `sessionId`, `activeMinutes` and the work `blocks` (start and end of each stretch of activity). Gaps longer than 10 minutes are treated as time away and not counted.

- If this session covered several tasks and only the latest is being logged, add `--since <ISO instant>` for where this task began.
- If the script fails for another reason, do not guess a duration: ask the user how long it took.
- Drop blocks shorter than one minute.

## 2. Check whether this session was logged before

A session that carries on after being logged adds its new time to the same task; it does not get a second one.

Look for the earlier task: a task id from an earlier log-task run in this conversation, otherwise `tasks.list({ scope, search: "<sessionId>" })` for the scopes `done` and `my` (each logged task's description names its session). If the user says this is a different piece of work, treat it as new and use `--since` instead.

When there is an earlier task, read it with `tasks.get` and run the script again with `--since <the latest endedAt among its work sessions>`, so only the time after the last log is counted. If nothing is left, say so and stop.

## 3. Draft the task

Draft these from the conversation, not from the script:

- **Title**: what was done, as an outcome, under 80 characters ("Add call tasks panel to Caller Desk"), not "AI session".
- **Description** (Markdown, in the language the user worked in):
  - two or three sentences on what was done and why;
  - what is left or not verified, if anything;
  - for code work: the repository, the commit hashes or branch, and the released version if there was one;
  - a last line: `Done with <Claude Code or Codex> · <N> min active over <M> work blocks · session <sessionId>`, with N the active minutes rounded up to a whole minute.
- **Owner**: the person the AOps token acts as (`you.user` from `aops_catalog()`), unless the user names someone else. Either way that is a username: look up its user id in `tasks.listUsers`, because the task needs the id.
- **Related record**: only when the work was about one specific AOps record (a customer, sales order, work order, ticket, item). Find it with `aops_find` and pass it as `relatedTarget: { entityType, entityId }`. Code changes have no related record.
- **Tag**: the tool's name, `claude` or `codex`. Do not create it yet; that is a write and belongs to step 5.

For an earlier task, draft the update instead: keep its title and text, add a short paragraph on what was done since, and rewrite the last line with the new totals (earlier minutes plus the new ones, all blocks).

Never put secrets, tokens, passwords or customer phone numbers and addresses in the title or description.

## 4. Confirm with the user

Show the draft once: title, description, owner, related record, total minutes and the blocks in the company time zone (`you.timeZone` from `aops_catalog()`). For an earlier task, say which task is being updated and how many minutes are being added. Ask whether to save it. Apply any correction they give, including a different duration, and do not write anything to AOps before they agree.

## 5. Save it

Use one `idempotencyKey` prefix for the whole run, `log-task:<sessionId from the script>:<first block start>`, with a suffix per call (`:tag`, `:create`, `:time-1`, …), so a retry never creates a second task. Give every write a `reason` such as "Logging finished <tool> work: <title>".

**A new task:**

1. `tasks.createTag({ name })` with the tool's name. It returns the existing tag when there is one; keep its id.
2. `tasks.create` with `title`, `descriptionMarkdown`, `assigneeUserId`, `estimateMinutes` (the same whole minutes as the description line, at least 1), `tagIds`, and `relatedTarget` when there is one.
3. Tracked time, one call per block (see below).
4. `tasks.changeStatus({ id, status: "done" })`.

**An earlier task:**

1. Tracked time, one call per new block (see below).
2. `tasks.update({ id, descriptionMarkdown, estimateMinutes })` with the new text and the new total. If the update is refused, add the new paragraph with `tasks.addNote` instead. Leave the status as it is.

**Tracked time** always belongs to the person the token acts as. If the owner is someone else, skip it: the time stays in the description and the estimate only. Say so.

- Check `aops_catalog({ procedure: "tasks.logFocusSession" })`. When it exists, record each block with `tasks.logFocusSession({ taskId, startedAt, endedAt, note: "<tool> session time" })`. It runs at once and works on a finished task. It refuses times that overlap a session already on the task; that means the stretch was logged before, so do not retry it with shifted times.
- When it does not exist (an older AOps): for each block `tasks.startFocus({ taskId })`, then `tasks.stopFocus({ id })` with the returned session id, then `tasks.correctFocusSession({ id, startedAt, endedAt, note })`. The correction waits for a person's approval; send every block's correction with the same `groupKey` (the key prefix) so the user approves them once. `startFocus` needs an open task, so on a finished earlier task skip tracked time and say so.

## 6. Report

Give the task link (`/tasks/<task id>` on the AOps host; no response carries it), the minutes recorded and the task's new total. If corrections are waiting for approval, give the link (`batchUrl` when the response has one, otherwise `approvalUrl`) and say tracked time shows as near zero until it is approved. If any call failed, say which and what was saved.
