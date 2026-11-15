# skills

Two Claude Code skills for splitting work between models so the expensive one does less. Fable decides what to do; Opus does the editing.

| Skill | Run it in | What it does |
| --- | --- | --- |
| [`plan-fable`](plan-fable/SKILL.md) | an Opus session | Borrows Fable to plan a task, then implements the plan in the main session. |
| [`fix-opus`](fix-opus/SKILL.md) | a Fable session | Hands work the session already understands to Opus subagents, one batch at a time. |

Both use medium effort for the subagent, and both run only when you type the command; Claude never starts them on its own.

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

## Install

Copy a skill's folder into your user skills directory, then start a new Claude Code session:

- macOS and Linux: `~/.claude/skills/`
- Windows: `%USERPROFILE%\.claude\skills\`

You need access to the Fable and Opus models in Claude Code.
