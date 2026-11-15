---
name: plan-fable
description: Have a Fable subagent decide the approach at medium effort, then, once you approve, implement and validate it in the main session.
argument-hint: <task description>
disable-model-invocation: true
---

# Plan with Fable, implement here

<task>
$ARGUMENTS
</task>

If the task is empty, use the request the user just made; if there is none, ask what to plan and stop.

Fable decides the approach; you work out the edits. Fable's tokens cost far more than yours, so ask it for direction, not detail, and do not duplicate its investigation before or while it runs.

## 1. Delegate planning

Your first tool call is Agent with `subagent_type: "general-purpose"`, `model: "fable"`, `effort: "medium"` (not `fork`, which ignores `model`). If the call fails, tell the user and stop.

Its prompt contains:

- The task, verbatim, leaving out only instructions meant for you, such as whether to wait for approval. No summary, hypothesis or preferred solution of yours.
- Facts from this conversation the planner cannot see: constraints, errors, files the user named, earlier decisions.
- Paths of the project's instruction files (`CLAUDE.md`, `AGENTS.md`) to read and follow.
- That it is read-only: it modifies nothing.
- The return format below.

Return format: the plan is for a capable implementer who will work out the edits. Give direction, not instructions for each change.

1. **Approach**: the design and why, plus any alternative that was a close call, if there was one.
2. **Assumed**: anything the approach depends on that was not confirmed by reading.
3. **Validation**: what must be shown to work and what must not regress.
4. **Questions for the user**: if any, only those whose answer would change the approach, each with the assumption made meanwhile.

## 2. Show the plan

Give the user the plan, with any questions it has for them, and wait for their approval. If the user said to implement without approval, continue, unless the plan has questions for them or a destructive or irreversible step; ask about those first.

If their answer or feedback changes the approach, send it to the planner with SendMessage for a revised plan; apply smaller changes yourself.

## 3. Implement and validate here

Explore as needed and design the edits yourself. The user's and project's instructions outrank the plan. Small deviations are your call; note them. Choose how to run the validation, and cover everything the plan lists.

If you find the approach itself is wrong or cannot be implemented, stop and send the planner a short summary of the problem with SendMessage, asking for a revised approach. If it cannot be continued, start a new planner with the plan and the summary.

## 4. Report

What changed, what was validated and how, and where you deviated from the plan.
