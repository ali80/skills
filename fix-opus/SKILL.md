---
name: fix-opus
description: Delegate fixes for issues this session already identified to Opus subagents at medium effort, one batch at a time, each committing its own work.
argument-hint: <which issues to fix>
disable-model-invocation: true
---

# Fix with Opus, orchestrate here

<issues>
$ARGUMENTS
</issues>

If this is empty, use the request the user just made. If the conversation holds no identified issues to fix, ask what to fix and stop.

You already understand the problems; Opus does the fixing. Your tokens cost far more than its tokens, so spend them only on short briefs. Do not fix anything yourself, and do not review or re-check the agents' work.

## 1. Batch

Group the issues so that those touching the same files or area share a batch, and order the batches so that a fix another one depends on comes first. Prefer a few batches over one per issue: every new agent pays to read the code again. Tell the user the batches in a few lines and continue.

## 2. Delegate one batch at a time

The agents share this checkout, with no worktrees, so start the next only after the previous one has reported.

For each batch, call Agent with `subagent_type: "general-purpose"`, `model: "opus"`, `effort: "medium"`. The brief contains:

- For each issue: the problem, where it is if you know, what fixed looks like, and how to verify it if it needs verifying. Where the findings are already written in a file, point to it instead of restating them. Do not dictate the edits.
- Paths of the project's instruction files (`CLAUDE.md`, `AGENTS.md`) to read and follow.
- To verify its own work, then commit it on the current branch: only the files it changed, following the project's commit conventions, with no push and no new branch or worktree. If this is not a git repository, it skips the commit.
- To report in a few lines: what it fixed, the commit hash, and anything it did not fix or could not verify.
- For the last batch only: to also run the project's full test suite and checks, fix failures these fixes caused, and report any others.

## 3. Between batches

Take each report as given. If an agent left something unfixed, send it on to a new agent only when you can add information that would help; otherwise keep it for the final report.

## 4. Report

One line per batch: what was fixed and its commit. Then anything left unfixed or unverified, and the result of the final test run.
