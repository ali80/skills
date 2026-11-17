# skills

Skills for Claude Code. `plan-fable` and `fix-opus` split work between models so the expensive one does less: Fable decides what to do; Opus does the editing. `log-task` records a finished session as a task in AOps, and also works in Codex.

| Skill | Run it in | What it does |
| --- | --- | --- |
| [`plan-fable`](plan-fable/SKILL.md) | an Opus session | Borrows Fable to plan a task, then implements the plan in the main session. |
| [`fix-opus`](fix-opus/SKILL.md) | a Fable session | Hands work the session already understands to Opus subagents, one batch at a time. |
| [`log-task`](log-task/SKILL.md) | any session, at the end of a task | Records the session's work in AOps as a finished task, with who did it and how long it took. |

`plan-fable` and `fix-opus` use medium effort for the subagent. All three run only when you type the command; Claude never starts them on its own.

## plan-fable

```
/plan-fable <task>
```

Use it when you are working on Opus and the task needs a better plan than Opus would make alone.

1. A Fable subagent reads the code and returns an approach, what it assumed, what to validate, and any questions for you. It is asked for direction, not line-by-line edits.
2. You see the plan and approve it. Add "no approval needed" to the command to skip the wait; it still stops for questions and for destructive steps.
3. The main session works out the edits, implements them and runs the validation.
4. It goes back to the planner only if the approach turns out to be wrong.

## fix-opus

```
/fix-opus <which issues to fix>
```

Use it when you are on Fable and the session already knows what needs doing, for example after a code review: `/fix-opus 3, 4, 5 and all the medium issues`.

1. The session groups the items into batches by the files they touch.
2. One Opus subagent at a time works in the same checkout, with no worktrees. Each one verifies its own work, commits only the files it changed, and reports back. Nothing is pushed unless you ask for it.
3. The session relays each report and does not re-check the work. The last batch runs the full test suite.

To keep your own order, say so: `/fix-opus do steps 1 to 6 in this order, one batch per step`.

## log-task

```
/log-task [corrections]
```

Use it at the end of a task done in Claude Code or Codex, when the work should also show up in AOps tasks.

1. `session-time.mjs` reads the session's own transcript and adds up the stretches of activity. Gaps longer than 10 minutes count as time away.
2. The session drafts a title, a short description, the owner, a related AOps record if there is one, and a tag for the tool used.
3. You see the draft and can correct anything, including the duration. Nothing is written before you agree.
4. It creates the task, records one work session per stretch of activity, and marks the task done. Setting past times on a work session needs your approval in AOps; the corrections arrive as one batch.

It needs Node.js and a connection to the AOps agent gateway: the `aops` MCP server, or `pnpm aops` in an AOps checkout. In Codex, ask for it by name ("use the log-task skill").

## Install

Copy a skill's folder into your user skills directory, then start a new Claude Code session:

- macOS and Linux: `~/.claude/skills/`
- Windows: `%USERPROFILE%\.claude\skills\`

For Codex, copy `log-task` into `~/.codex/skills/` (`%USERPROFILE%.codexskills` on Windows) and start a new session.

`plan-fable` and `fix-opus` need access to the Fable and Opus models in Claude Code.
