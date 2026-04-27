# Handoff — Home (Direction C) implementation

**Date paused:** 2026-04-27
**Branch:** `home-direction-c` (worktree at `/Users/dlucca/Projects/novapatchv2-home-c`)
**Reason for pause:** Long-running session approaching context budget; resuming in a fresh session will be more efficient than continuing.

## Status

| # | Task | Status | Commit |
|---|---|---|---|
| 0 | Design spec | ✅ | `4eef00a` |
| 0 | Implementation plan (17 tasks) | ✅ | `81cb503` |
| 1 | Setup — deps, assets, products data, anchors helper | ✅ | `bd36d2b` |
| 2 | Cart store (TDD) | ✅ | `2e938d4` |
| 3 | Cart button (nav badge with hydration safety) | ✅ | `480852c` |
| 4 | Cart drawer (shadcn Sheet) | ⏳ next |
| 5 | Mount cart drawer in root layout | ⏳ |
| 6 | Navbar — variant=transparent + cart button | ⏳ |
| 7 | Footer rewrite (FooterC + newsletter) | ⏳ |
| 8 | Hero section (Client + animations) | ⏳ |
| 9 | HowItWorks section | ⏳ |
| 10 | Absorption + SkinDiagramC | ⏳ |
| 11 | Comparison section (responsive) | ⏳ |
| 12 | ProductGrid + ProductCard | ⏳ |
| 13 | SubscriptionTeaser | ⏳ |
| 14 | FinalCTA | ⏳ |
| 15 | Wire `/[locale]/page.tsx` | ⏳ |
| 16 | E2E Playwright happy path | ⏳ |
| 17 | Update ROADMAP.md | ⏳ |

## Context for the next session

### Project conventions discovered during implementation

These are real, validated against the codebase — apply to every remaining task:

- **Test runner:** `bun:test` (NOT vitest). Existing tests import from `"bun:test"`. The plan template still says `vitest` in some places — adapt imports.
- **No DOM testing library installed.** Tests for components use `bun:test` and assert via the cart store state or by inspecting plain return values, not via `@testing-library/react`. See `apps/web/test/components/cart/cart-button.test.ts` for the established pattern.
- **No eslint installed.** `bun run lint` will fail; do not add it as a verify step. `bun run typecheck` works.
- **Lazy localStorage adapter:** `cart-store.ts` uses a `lazyLocalStorage` adapter (not the spec's literal `createJSONStorage(() => localStorage)`) because zustand's factory swallows the throw on Node module load. SSR-safe. Reference this pattern if any other store is added.
- **No remote configured for the novapatchv2 repo** — pushes won't work. All commits stay local on the worktree branch.
- **Pre-existing fix in Task 1 commit:** `apps/web/src/components/ui/input.tsx` was missing (imported by `country-gate.tsx`); Task 1 implementer added a standard shadcn Input component. Out-of-scope but unblocks typecheck.

### Source-of-truth files (read first in next session)

1. `docs/superpowers/specs/2026-04-27-home-direction-c-design.md` — design spec
2. `docs/superpowers/plans/2026-04-27-home-direction-c.md` — implementation plan (each task is a self-contained section)
3. This file (`docs/superpowers/HANDOFF-home-direction-c.md`) — current state

### Resume instructions for the next session

Drop this prompt verbatim into a fresh Claude Code session:

```
I'm resuming the Novapatch v2 Home (Direction C) implementation in the worktree
at /Users/dlucca/Projects/novapatchv2-home-c on branch home-direction-c.

Tasks 1-3 are done (commits bd36d2b, 2e938d4, 480852c). The implementation plan
at docs/superpowers/plans/2026-04-27-home-direction-c.md has 17 tasks total.

Read docs/superpowers/HANDOFF-home-direction-c.md first for project conventions
discovered so far (bun:test not vitest, no eslint, no DOM testing library, lazy
localStorage adapter, etc.).

Continue from Task 4 using superpowers:subagent-driven-development. Dispatch one
implementer subagent per task with brief prompts that reference the plan file,
spot-verify each commit, and proceed task-by-task. Run a final code review
subagent after Task 17.

Task 4 starts at line 586 of the plan file. Begin with that one.
```

### Open notes / decisions deferred

- **Plan #4 vs Plan #4b:** Per the spec, this Home plan replaces the original "Plan #4 = Tienda + Cart + PDP". Tienda + PDP become a follow-up Plan #4b. The ROADMAP.md update (Task 17) records this shift. Don't forget.
- **CartButton i18n keys** were added in Task 3 to `apps/web/messages/es.json` under `components.cart`. Other tasks (drawer, footer, navbar, home sections) will add their own namespaces — let each task own its keys to avoid merge conflicts.
- **next-intl pluralization:** `components.cart.button_aria` uses ICU plural format `{count, plural, =0 {Bolsa, vacía} one {Bolsa, # parche} other {Bolsa, # parches}}`. Verify next-intl is configured to handle ICU; if not, fall back to a simple ternary in the component.
- **Spec/code reviewer subagents skipped during this session** in favor of spot-verifying diffs after each commit. The next session should run a final spec compliance + code quality review subagent after all 17 tasks land, before merging.

### Verification of where we are

```bash
cd /Users/dlucca/Projects/novapatchv2-home-c
git log --oneline -5
# Expected:
# 480852c feat(cart): add nav cart button with hydration-safe count badge
# 2e938d4 feat(cart): add Zustand cart store with localStorage persistence
# bd36d2b chore(home): scaffold products data, assets, and anchor helper
# 81cb503 docs: add Home (Direction C) implementation plan
# 4eef00a docs: add Home (Direction C) design spec

cd apps/web && bun test
# Expected: 17 pass, 0 fail
```
