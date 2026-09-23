# Formulas — the "edit formulas here" index

All of the app's math lives in `assets/js/formulas/`, as plain classic-script
files (no imports/exports — the shared global scope is the module system).
Each file opens with a plain-English header: what the rule is, the literature
behind it, and a worked example. **Tune training behavior here, not in the
view files** — the pages and the progression engine call these; they don't
reimplement them.

| File | What it owns | Key functions |
|---|---|---|
| `units.js` | Canonical weight units (store lb, display converts) | `displayWeight`, `storageWeight`, `weightUnit`, `isMetric`, `LB_TO_KG` |
| `volume.js` | Set tonnage + muscle-volume attribution | `setVolume`, `displayVolume`, `SECONDARY_MUSCLE_WEIGHT` |
| `rpe.js` | RPE↔RIR, blank-RPE handling, rep jumps | `rpeToRir`, `rirToRpe`, `blankRpeToNull`, `rpeRepJump`, `fmtRpe` |
| `e1rm.js` | Epley 1RM, RPE-adjusted e1RM, "Back into range" | `estimate1RM`, `epley1RM`, `epleyLoadForReps`, `backIntoRange` |
| `increments.js` | Increment-grid snapping, RPE-scaled increments, warm-up ladder | `roundedIncrement`, `scaledLoadIncrement`, `snapToIncrement`, `snapUpToIncrement`, `warmupLadderRows`, `warmupAnchorLb` |
| `prs.js` | PR detection (e1RM / heaviest / bodyweight / timed) | `detectExercisePRs`, `detectTimedPRs`, `detectBodyweightPRs`, `PR_E1RM_TOLERANCE` |
| `program-math.js` | Weekly % waves, deload weeks, %1RM clamps | `programPctForWeek`, `isDeloadWeek`, `clampPct1RM`, `clampDeloadPct` |
| `progression-analysis.js` | Top-set selection, fatigue estimation, stale-basis age cap | `topSetForSession`, `fatigueForBasis`, `SUGGESTION_BASIS_WEEKS` |

## Rules for editing

1. **Keep them pure.** A formula takes inputs and returns a value — no DOM,
   no `workoutState`, no network. (The documented exceptions read settings
   like `progressionSetup.units` at *call* time; never at load time.)
   **Tech debt:** `formulas/` also calls *upward* into `workout/` at call time
   (`isWarmupSet()` from `workout/set-tags.js` in `increments.js` and
   `progression-analysis.js`; `isNonVolumeExercise()` from
   `workout/exercise-metrics.js` in `volume.js`, guarded by `typeof`). The
   long-term fix is parameter injection (e.g. `topSetForSession(log,
   {isWarmup})`) with thin state-reading wrappers in `workout/` — until then,
   do not add new upward calls.
2. **Keep outputs exact.** Every formula is pinned by unit tests
   (`tests/formulas-extracted.test.js` plus the suites that consume them). Change the
   math → update the tests in the same commit, and note the behavior change
   in `RELEASES.md` — formula changes are user-visible by definition.
3. **Literature first.** New training math needs a citation in the file header
   (Epley 1985, Zourdos et al. 2016, NSCA tables are the current canon here)
   plus a worked example with real numbers.
4. **Snap on the grid.** Suggested loads snap to the increment grid
   (`snapToIncrement`), never to plates — user call, #246. Don't reintroduce
   plate snapping.
5. **Store canonical.** Weights are pounds in storage, always. Metric is a
   display/input lens (`units.js`).

## Where the formulas are used

- `workout/progression.js` — the suggestion engine (calls everything above)
- `workout/workout-editor.js` — live PR + effort display
- `pages/exercise-detail.js` — history charts, PR lists
- `pages/dashboard-stats.js` — volume and muscle aggregation
- `lib/utilities.js` — shared helpers that compose formulas
