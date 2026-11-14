# skills

Claude Code skills.

## Skills

- `plan-fable`: Have a Fable subagent decide the approach at medium effort, then implement and validate it in the main session.
- `fix-opus`: Delegate fixes for issues this session already identified to Opus subagents at medium effort, one batch at a time, each committing its own work.

## Install

Copy a skill's folder into `~/.claude/skills/`, then run it in Claude Code with:

```
/plan-fable <task>
/fix-opus <which issues to fix>
```
