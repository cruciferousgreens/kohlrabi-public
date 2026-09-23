# Major releases

Newest first. Only user-facing milestones.

## v1.888 (2026-09-22)

Signing in during setup is smarter, and progression suggestions are hardened:

- If you sign in with an existing account on the setup page, the rest of the setup is skipped — your settings and data sync down and you go straight into the app. Brand-new accounts still get the full setup flow.
- Workout start screen: the stray divider line above the program card is gone, and the Blank workout / Repeat last rows now carry the same chevron as other tappable rows so they read as buttons.
- Progression engine: a cleared or zeroed weight increment now falls back to the 5-lb default instead of leaking raw estimated-1RM math onto suggestion cards; a max-effort set (RPE above the trigger) holds steady on a rep-range change even with "Advance on completion" on; a bodyweight (0-lb) exercise at its rep ceiling holds instead of suggesting a meaningless "Add weight"; per-dumbbell suggestions always land on whole per-hand loads.
- Exercise cards: the "Last:" history line lost its grey pill — it now reads in plain dark ink, no background.

## v1.887 (2026-09-22)

Dark mode is calmer and screens breathe:

- Dark theme (Macchiato): the jarring peach/orange accent is gone — Start button, muscle pills, and accents are now green, cohesive with the light theme. The muscle heat map is a green ramp instead of brown/orange.
- Every screen: the ~135px of dead space above the bottom tab bar is gone — content now ends ~30px above the nav.

## v1.886 (2026-09-22)

Collapsed workout cards are cleaner:

- The circled info icon is gone from collapsed exercise cards in the live workout and the saved-workout builder — the header shows just the title (and the Warm-up pill when the card is open).

## v1.885 (2026-09-22)

Reorder-dialog checkboxes, superset picker removal, progression placement fix, and Settings spacing polish:

- The reorder dialog no longer has a Select button — every row carries a checkbox on the left alongside the reorder arrows. Ticking a box swaps the footer from Done to the group/delete actions; grouping needs at least two blocks, and selecting a single group offers Ungroup.
- The old per-exercise superset member picker is gone. Superset management lives in the reorder dialog's checkboxes; the group outline's Edit button opens that dialog.
- The workout-page progression summary now sits under Exercise options (nested inside the disclosure), matching the saved-workout builder — it was rendering above the options.
- Settings spacing rhythm: every section label hugs its own control row, with even section breaks throughout (UX audit).

## v1.884 (2026-09-22)

Superset workflow redesign, Home calendar restored, and a Settings label fix:

- The reorder dialog gains a Select mode: tap Select in the header, tick exercises, then group them as a superset or delete them in one step. Grouping applies immediately (undoable by ungrouping); deleting asks for confirmation naming the exercises and warning that their sets go with them.
- The Home calendar is back — the month grid of workout days returns under the streak row.
- Settings → Progression: the fixed-weight increment option reads "Weight (lb)" again instead of just "Weight".

## v1.883 (2026-09-22)

Persona-sweep bug fixes, RPE trigger restoration, rest-day removal, and Settings/UX polish:

- fix [#79](https://github.com/cruciferousgreens/kohlrabi/issues/79): reverted an unapproved %1RM bypass of the no-change suppression — identical weight-and-reps suggestions are suppressed again; the approved %1RM rep preservation is unchanged.
- fix [#499](https://github.com/cruciferousgreens/kohlrabi/issues/499): rest-day logging removed for now — the mark/clear control, rest-day calendar chips, and progression filtering are gone; old backups still validate with the legacy key ignored on restore.
- "Add saved workout" no longer reports success when the program reference went stale — it reads the live program at commit time and errors honestly when there is no active program.
- Completing a set with an invalid weight or RPE is now blocked with a clear message instead of silently clamping the stored value.
- Inverted rep-range inputs (min above max) are cross-clamped and the stored values are written back into the fields.
- The RPE threshold setting is back in Settings → Progression (shown in RPE-based mode); per-exercise 7/8/9/Off trigger pills now appear for timed exercises too and preselect the effective default when no per-exercise override is set.
- Fixed-weight increment options read "Weight (lb)" in both the program form and Settings.
- Settings reorganization: new Display section (split from Units), "Exercise defaults" (renamed from "Defaults", warm-up settings merged in), "Progression" (renamed from "Progression defaults"), post-workout sign-in reminder moved to Account, Account card collapses when signed out.
- UX polish: RPE header aligned with its input column, selected pills keep identical outer dimensions (inset ring), Data actions stack full-width, Workout landing cards flattened to divider rows, toast clears sticky action bars, blind-spot chips reuse the Home chip with counts, single search-clear and custom-exercise CTA, Settings gear no longer shows active state on Settings, higher-contrast chevrons in dark mode.

## v1.882 (2026-09-22)

%1RM rep preservation and hidden-calendar hardening:

- %1RM suggestions now keep the latest top-set reps (clamped to the rep range) — 270x5 applies as 270x5, not 270x1 — including on manual-deload weeks.
- Hidden Home calendar can no longer invisibly filter Home's recent, summary, or upcoming content.
- Exercise options %1RM percentage now reflects the program's current weekly-wave percent.

## v1.881 (2026-09-22)

Progression and Home cleanup:

- Suggestion basis age cap is gone from Settings — the cap is now fixed at 8 weeks (changeable in one documented place in the formulas layer if ever needed).
- Home calendar/date selector is hidden for now (kept in the code, easy to bring back).
- Program progression engine summary is cleaner — one plain "Hypertrophy · 6–12 reps" chip instead of two, no more "Tap a card to apply".
- Fixed the %1RM percentage shown in Exercise options when a program runs a weekly % wave — it now shows the current week's percent (e.g. 85%), not the 75 default.
- Template editor now shows set tags (Warm-up, etc.) as visible chips under each row.

## v1.880 (2026-09-22)

%1RM progression fix + PR/Stats polish from phone QA:

- Fixed %1RM progression dropping reps to the range minimum — 270×5 now stays 270×5, not 270×1. The prescription preserves the latest top-set reps (clamped to the rep range).
- PRs are prettier and more descriptive — the summary now shows the actual PR value (e.g. "200 lb", "75 sec", "12 reps") instead of just the PR type.
- Stats defaults to Heaviest (was estimated 1RM). The Volume chart has a Weight|Sets toggle.
- Stats number cards are slightly smaller (26px) for consistency across the row.

## v1.879 (2026-09-22)

Progression-engine QA batch from phone testing:

- Fixed dumbbell increments suggesting impossible weights — a 5 lb increment on 15 lb dumbbells now suggests 20 lb per dumbbell, never 18 lb. The suggestion reason names the per-dumbbell step.
- Accepting a progression suggestion now applies each set's own target (not just the top set) and rescales warm-up ladder hints to the new top weight. The All-sets toggle is retired — per-set targets are the only path.
- Advance-on-completion is now the fourth RPE-threshold choice ("On completion") instead of a standalone toggle. The suggestion no longer waits on an RPE entry.
- Automatic every-N-weeks deload is removed. Manually flagged deload weeks still work.
- The set column header always reads "WEIGHT" — the per-DB/total/bodyweight conditional is gone.
- RPE/RIR fields show bare "RPE"/"RIR" placeholders and labels — no "Target" qualifier. The RPE "?" help button is removed.
- Info buttons use the cleaner circle-i icon from the trainer work.
- "Apply set 1 to all" is removed; "+ Add set" shows the previous set's values as placeholders.
- "Vary rep ranges by week" is now a toggle — week controls appear only while enabled.
- Increment type's fixed-weight option is labeled "Weight".
- Default focus moved above Increment type in Settings.
- Progression-scheme label styling fixed (was accent pink, now normal ink).

## v1.878 (2026-09-22)

Internal restructure — **no user-facing changes**. The codebase was
reorganized for maintainability: modules moved into domain folders
(`core/`, `data/`, `formulas/`, `lib/`, `components/`, `pages/`, `share/`,
`sync/`, `workout/`), pure training math extracted into `assets/js/formulas/`
with a formula map (`FORMULAS.md`), and the shared empty-state fragment
extracted to `assets/js/components/empty-states.js`. Two dead functions
removed (`snapPlateLoad`, `ordinalShortLabel`). Every formula is now covered
by direct unit tests; the full suite (255 files, ~2300 assertions) is green.

## v1.877 (2026-09-22)

Regression fixes from phone QA on v1.876:

- Home empty state ("No workouts yet") stacks vertically again — a trainer style rule that leaked into the shared hero register and forced a flex row is gone.
- The workout-page Progression card is now its own collapsed-by-default disclosure sitting directly above "Exercise options" (not buried inside the already-collapsed options).
- The exercise picker in saved-workout edit mode no longer shows a grey rounded panel — it's clean/white like the Add-exercise picker. Mode controls (red × remove buttons) are unchanged.
- Home now paints a loading skeleton on first boot and never renders cards until persistence has hydrated — no more stale/wrong cards flashing before real data loads.
- Trainer feature plumbing removed for now (tabled to v3): training-link module, trainer prototype, training settings/views/routes, coach badges/attribution, and all associated styles are out. History remains recoverable from git.

## v1.876 (2026-09-22)

Phone-QA batch:

- The Workout landing now offers a small bold "or start a new workout" link under the Continue card when a session is already active.
- Exercise search shows a Recents section (in the workout add-sheet and the swap sheet), so recently-logged movements stay one tap away.
- Set rows always prefill: when an exercise has no progression profile, the placeholder falls back to the default rep range instead of leaving the row blank.
- Exercise search results are compact rows on phone — a single sparse result no longer renders as a tall empty card.
- Effort display (RPE vs RIR) is now a setting under Settings → Units; the set column follows it. It no longer lives on the set header.
- Assigning set tags no longer flashes the layout — the dialog close updates the one row in place, keeping focus and scroll position.
- The per-exercise progression info (scheme, target, basis) now sits behind its own collapsible "Progression" card inside Exercise options.
- Rep-range placeholders stay put: filling sets or adding tags no longer changes the ghost rep range.
- Exercise library cleanup: "Underhand Cable Pulldown" is now "Reverse lat pull-down" (keeping its correct muscle mapping), and "Dumbbell Raise" merges into "Lateral Raise" — old saved references keep working.
- Progression engine: a top set at RPE 10 now surfaces an informational "Held at RPE 10" notice instead of the suggestion card silently vanishing; a linear top set logged below the rep range no longer mints the blind increment — a general range-aware "Back into range" guard converts the rep deficit into a load adjustment via the literature relationships (Epley 1RM with the RPE folded in as reps-in-reserve, targeting mid-range at the same effort): e.g. 245 × 2 @7 in a 6–12 suggests 205 × 9, while 245 × 2 @7 in a 3–5 holds 245 and builds to 245 × 5.
- The live-workout pill now appears on exercise pages opened from an active workout, so there's always a way back.
- Fixed horizontal side-scrolling at phone width (a flex child that could push past 393px).
- The "15+" rep preset is gone everywhere — AMRAP replaces it; custom rep ranges still allowed, and old "15+" data keeps working.

## v1.875 (2026-09-21)

- Info icons across the app now use the circled "i" glyph from the trainer design instead of the plain italic "i" — same 32px circular buttons and placement, just the better icon.

## v1.874 (2026-09-21)

- fix [#582](https://github.com/cruciferousgreens/kohlrabi/issues/582): the trainer can now surface a short note to the client — it renders under the "Training with Coach Sam" card on Home, labeled "Note from Coach Sam", with a dismiss control. The note lives on the training link record (dismissing clears it); the mock join seeds an example note so the placement is visible in QA.

## v1.873 (2026-09-21)

- fix [#582](https://github.com/cruciferousgreens/kohlrabi/issues/582): joining a trainer now includes an intake step before landing in the app — goals, training experience, injuries/limitations, equipment access, days per week available, plus an "anything else" field. Answers are stored on the training link record (the trainer side will display them later); skipping stores an empty flagged response. The trainer configures which questions are asked — all are on in the mock.

## v1.872 (2026-09-21)

- fix [#582](https://github.com/cruciferousgreens/kohlrabi/issues/582): the client-side training link is live (mock, no backend): linking with a trainer is one tap plus a confirm, with no account needed — join from Settings → Training or a trainer link. A slim "Training with Coach Sam" card sits at the top of Home and opens a Training page (also reachable from Settings) showing the trainer's name and tagline, what's included, assigned programs, and a Leave training action. Leaving takes two confirms; the assigned programs stay saved. Mock state is local-only until the backend exists.
- fix [#583](https://github.com/cruciferousgreens/kohlrabi/issues/583): trainer-assigned programs now land in a "From Coach Sam" section above your own saved programs. They're saved locally and editable exactly like your other programs — edits you make are yours, the trainer's template stays canonical. Leaving training drops the "From" badge and the programs become plain personal copies.
- fix [#584](https://github.com/cruciferousgreens/kohlrabi/issues/584): a clients-only trainer link opened before joining now shows an opt-in page — "Train with Coach Sam to get access to this program" — instead of the program preview. Joining from it unlocks and saves the program with the trainer badge; already-linked clients go straight to the preview. The mock link never touches the network.

## v1.871 (2026-09-20)

- fix [#579](https://github.com/cruciferousgreens/kohlrabi/issues/579): a linear suggestion card could prescribe the raw increment as the target weight ("Apply suggestion 5 lb") when the in-zone basis session's top set had no weight — tapping it wrote 5 lb into every set. A weightless basis is now no basis for linear: the engine falls through to the fresh most-recent log (which rebases into the range as usual), and with no weighted history at all there is no suggestion card. Timed work is unaffected — unweighted timed sets are normal there.

## v1.870 (2026-09-20)

- fix [#575](https://github.com/cruciferousgreens/kohlrabi/issues/575): tapping a suggestion card now writes the suggestion into your sets — filled-but-unchecked sets take the target too (the tap is an explicit apply). Completed sets and warm-up rows are never touched; with All sets on, each row gets its own per-set target, and a position with no history is never invented.
- fix [#576](https://github.com/cruciferousgreens/kohlrabi/issues/576): linear progression now respects the rep range — a top set logged outside the range is pulled back inside (150 × 6 in an 8–12 range suggests 155 × 8), and the reason says when reps or seconds were pulled into range. Same for timed work.
- fix [#577](https://github.com/cruciferousgreens/kohlrabi/issues/577): linear progression is now the default scheme for new setups, programs, and exercises. Explicitly stored RPE or %1RM choices are unchanged.
- fix [#578](https://github.com/cruciferousgreens/kohlrabi/issues/578): the Settings "All sets" default is now live — turning it on applies per-set targets to every program unless that program sets its own value, and the setting copy explains what the toggle changes. Under linear, back-off sets take the load step from their own baselines with their own range-clamped reps (never a reset to the range floor, and RPE never gates a linear step).

## v1.869 (2026-09-20)

- fix [#574](https://github.com/cruciferousgreens/kohlrabi/issues/574): a stale same-zone session no longer drives progression — old sessions are memory, not advice. A session older than the age cap never forms the basis of a suggestion: the engine falls through to the fresh most-recent log when one exists, and shows no suggestion card when every usable session is stale (last-session targets still show).
- New Settings → Progression defaults option "Suggestion basis age cap" — choose how far back the engine looks for advice: 4, 8 (default), or 12 weeks, or no cap.

## v1.868 (2026-09-20)

- Suggestion cards are leaner — the "Suggestion ·" prefix is gone and the applied state just reads "Applied ✓"; the kind label ("Add weight", "Add reps") now stands on its own.

## v1.867 (2026-09-20)

- Trainer workspace prototype — a tappable UI mock inside the app (Settings → About → Trainer prototype, or open `#trainer` directly) exploring a future separate trainer product. Review inbox for completed client sessions, client list with plain X-of-Y adherence and last-active state, per-exercise planned-vs-logged with deviation flags and comments, set-next-targets, a program builder (details, workouts, progression choices, review), an assignment flow (client, program or one-off, start date), shareable invite links with pending/revoke, and a "view as client" preview where assigned sessions show the coach's target with no app progression prompts. All data is fictional and marked as such — no backend, no real accounts.

## v1.866 (2026-09-20)

- RPE-scaled load increments — on the RPE double-progression add-load-and-reset paths, the load step now scales with RPE headroom (trigger minus RPE): half a step per RPE under the trigger, capped at double (RPE 7 → 1.5×, RPE 6 or lower → 2×). Always on, no new setting; %1RM, linear, reps-only, and distance modes are unchanged, and the reason states the scaled jump when one applies.

## v1.865 (2026-09-20)

- fix [#551](https://github.com/cruciferousgreens/kohlrabi/issues/551): revert — distance mode advances on RPE 0 again (RPE 0 is fine to advance on; the blank-RPE reads-as-missing handling is kept).
- fix [#497](https://github.com/cruciferousgreens/kohlrabi/issues/497): removed — a top set logged at RPE 0 no longer holds progression; it now advances like any RPE at or below the trigger, with the jump clamped to the conservative trigger-sized step (never the 10-rep headroom jump).
- [#565](https://github.com/cruciferousgreens/kohlrabi/issues/565): new Settings → Progression defaults option "Advance on completion" — progression suggestions advance when you finish your sets even without RPE; RPE never blocks a suggestion and steps use the conservative trigger-sized jump. New programs inherit the default.
- Home streak element on the Home tab — consecutive training days, shown in the At-a-glance header when the streak is 2 days or more.

## v1.864 (2026-09-20)

- fix [#549](https://github.com/cruciferousgreens/kohlrabi/issues/549): the progression reason now states the actual weight change after grid snapping, not the prescribed increment — the reason used to promise "+5 lb" when the snapped bar math only moved 2.5.
- fix [#550](https://github.com/cruciferousgreens/kohlrabi/issues/550): identical sessions no longer get different suggestions depending on set order — an exact weight/performance tie now breaks toward the lower logged RPE, and a logged RPE beats a missing one.
- fix [#551](https://github.com/cruciferousgreens/kohlrabi/issues/551): distance mode no longer progresses on RPE 0 — an RPE of 0 is not a work set, so it can't trigger a load jump.
- fix [#552](https://github.com/cruciferousgreens/kohlrabi/issues/552): %1RM with reps-only progression no longer prescribes a load — it holds the latest top set instead of computing a percentage-based weight the user ruled out.
- fix [#553](https://github.com/cruciferousgreens/kohlrabi/issues/553): destructive buttons (Delete, etc.) now render their text in the on-accent token — white-on-red was unreadable in dark themes.
- fix [#554](https://github.com/cruciferousgreens/kohlrabi/issues/554): the saved-workout filter-count badge now uses the on-accent token for the same reason.
- fix [#555](https://github.com/cruciferousgreens/kohlrabi/issues/555): the light-theme warning color is darkened to #9a5515 so it meets WCAG AA.
- fix [#556](https://github.com/cruciferousgreens/kohlrabi/issues/556): the onboarding selected-option checkmark now uses the on-accent token — it was invisible in dark themes.
- fix [#557](https://github.com/cruciferousgreens/kohlrabi/issues/557): switching workout focus across rep zones no longer goes silent — when the top set can't rebase into the new range, the card shows a "New rep range" notice explaining why, instead of no suggestion at all.
- fix [#558](https://github.com/cruciferousgreens/kohlrabi/issues/558): an unweighted timed exercise at its time ceiling no longer gets a fabricated load suggestion — it holds the ceiling.
- fix [#559](https://github.com/cruciferousgreens/kohlrabi/issues/559): starting a program workout from the Upcoming card on a future calendar date now inherits that date's program week — the ranges and progression context used to come from the current week even when the card showed a future week.
- fix [#560](https://github.com/cruciferousgreens/kohlrabi/issues/560): the Upcoming card no longer offers Start on a marked rest day — it says "Marked as a rest day" instead.
- fix [#561](https://github.com/cruciferousgreens/kohlrabi/issues/561): restoring a backup with malformed nested data (bad exercises, sets, program workouts, rest days) is now rejected at the validation boundary instead of poisoning state and crashing screens.
- fix [#562](https://github.com/cruciferousgreens/kohlrabi/issues/562): a malformed URL hash (e.g. a lone %) no longer aborts routing — the hash decode falls back to the raw hash.
- fix [#563](https://github.com/cruciferousgreens/kohlrabi/issues/563): custom exercises imported from a share link now resolve immediately — the exercise map cache is invalidated on import instead of staying stale until reload.
- fix [#564](https://github.com/cruciferousgreens/kohlrabi/issues/564): set fields are canonically sanitized everywhere (live logging, finish, CSV import) — reps round to whole numbers, weights/RPE/seconds/distance clamp to sane bounds, and distance is no longer dropped when finishing a workout.
- fix [#565](https://github.com/cruciferousgreens/kohlrabi/issues/565): a missing RPE no longer silently removes all progression suggestions — the card shows a "No RPE logged" notice explaining why there's no suggestion.
- fix [#566](https://github.com/cruciferousgreens/kohlrabi/issues/566): the RPE column header now carries a tappable "?" that defines RPE in plain words ("how hard the set felt, 0–10") and says why logging it matters — onboarding skippers never saw the definition.
- fix [#567](https://github.com/cruciferousgreens/kohlrabi/issues/567): AMRAP is now defined where beginners meet it — every AMRAP pill carries a title and accessible label, and the workout focus help line spells out "AMRAP = as many reps as possible."
- fix [#568](https://github.com/cruciferousgreens/kohlrabi/issues/568): suggestion cards now speak plainly — "Add weight", "Add reps", "Add time", "New range" instead of the insider shorthand "Load +", "Rep +", "Time +", "Week range". Applied rows say targets are "shown faded" rather than "ghosted".
- fix [#569](https://github.com/cruciferousgreens/kohlrabi/issues/569): the finish-review copy now reads complete — "2 sets aren't finished. Finishing now deletes those sets — your completed sets are kept."
- fix [#570](https://github.com/cruciferousgreens/kohlrabi/issues/570): v2 program share links no longer drop the schedule — it round-trips through the compact payload.
- fix [#571](https://github.com/cruciferousgreens/kohlrabi/issues/571): the sign-in share dialog and the link-preview worker now say "program" for program shares instead of calling everything a "workout".
- fix [#572](https://github.com/cruciferousgreens/kohlrabi/issues/572): the repo's share-unfurl worker source is refreshed to the current deployed copy (per-share /card.png, crawler SEO variant, Browser Rendering) so a future redeploy from the repo can't regress to the stale version. The worker itself is not redeployed in this release.

## v1.863 (2026-09-19)
- fix [#548](https://github.com/cruciferousgreens/kohlrabi/issues/548) (security audit): stored XSS — a custom exercise name containing quote characters (e.g. `\" autofocus onfocus=\"alert(1)`) broke out of quoted HTML attributes in the finish-workout review dialog, workout history, and set-tag dialogs. The shared `escapeHtml()` used a DOM trick (`div.textContent` → `innerHTML`) that does not escape quotes; it now escapes `\"` and `'` explicitly. Includes a regression test pinning quote-escaping.

## v1.862 (2026-09-19)
- fix [#547](https://github.com/cruciferousgreens/kohlrabi/issues/547) (user): tapping a workout focus pill (Strength/Hypertrophy/Endurance) now updates the suggestion rows too — the suggestions were already being recomputed for the new rep range, but the visible cards kept showing the old targets until something else re-rendered the page. Only the suggestion rows refresh; the rest of each card (sets, scroll position) is untouched.

## v1.861 (2026-09-19)
- fix [#546](https://github.com/cruciferousgreens/kohlrabi/issues/546) (user): the app is snappy again — the Logs page and workout editor were each doing hundreds of thousands of redundant exercise lookups per render (a lookup accidentally nested inside another lookup in the recent exercise-name consolidation), so opening Logs or the editor could hang for a second or more on a big history. Exercise lookups are now cached, and the delayed progression suggestion cards were the same slowdown, not a separate bug.

## v1.860 (2026-09-19)
- Onboarding (user): the "Verify code" button on the sign-in code screen now sits closer to the code boxes instead of stretching to the bottom of the screen, matching the other onboarding screens.

## v1.859 (2026-09-19)
- Onboarding cleanup (user): the first-run flow drops the crossed-out copy — no more "You're ready to lift" heading or "Days per week" row on the done screen, no duplicate title/subtitle on the How-it-works screen (the cards carry it), and no small Kohlrabi wordmark above "Want to sign in?". The green buttons on the done, import, setup-choice, and sign-in screens now sit closer to the content instead of stretching to the bottom of tall screens.
- Onboarding (user): the sign-in code-step marketing checkbox now reads "Receive emails about app updates?" (already live on prod).

## v1.858 (2026-09-17)
- fix [#545](https://github.com/cruciferousgreens/kohlrabi/issues/545) (user): the shared workout landing no longer shows two Start buttons — the green Start pill at the top right of the card header is gone, leaving the full-width "Start workout" button below the meta chips as the single Start. The signed-in bookmark icon stays, and shared program landings are untouched (their header Share + Start pair remains, since a program landing has no footer Start). Shipped straight to prod per the reporter's call.

## v1.857 (2026-09-17)
- fix [#538](https://github.com/cruciferousgreens/kohlrabi/issues/538) (user): single-dumbbell sets no longer overcount volume 2x — Exercise options on a dumbbell exercise (in per-dumbbell entry mode) gains a "Dumbbells used: One | Pair" toggle next to the weight-entry control. "One" skips the per-mode doubling at storage and the halving at display, so a Bulgarian split squat with one 25 lb dumbbell logs 25 × 20 = 500 lb instead of 1,000 lb. The choice persists per exercise (item profile + Settings prefs) so it sticks in future workouts; "Pair" keeps today's behavior everywhere. The per-dumbbell "2 × … = … total" readout hides for single-dumbbell sets, and the even-total suggestion/warmup snaps are gated off (they would corrupt e.g. 25 into 26).

## v1.856 (2026-09-17)
- Usage analytics (user): Plausible custom events with no script tag — the app posts tiny fire-and-forget events (~300 bytes each, cookieless, no personal data) straight to Plausible's events API: share views/clicks (template vs program), workout starts, workout finishes, and onboarding flow steps for drop-off measurement. Nothing runs at page load, so there is zero load-time cost. The Plausible site domain is configurable via PLAUSIBLE_DOMAIN in assets/js/analytics.js.

## v1.855 (2026-09-17)
- fix [#511](https://github.com/cruciferousgreens/kohlrabi/issues/511) (user): marketing UI is now signed-in only — the Settings → Marketing section hides while signed out, the onboarding code-step opt-in renders only once signed in, and the opt-in checkboxes are off the signed-out sign-in screens (Settings → Account, the post-workout nudge, the empty-home hero). The subscription prefs themselves are untouched and still default on.

## v1.854 (2026-09-17)
- fix [#539](https://github.com/cruciferousgreens/kohlrabi/issues/539) (user QA): three more close-grip variants folded in — Close-Grip Front Lat Pulldown -> Lat Pulldown, Close-Grip Dumbbell Press -> Dumbbell Bench Press, Close-Grip EZ-Bar Press -> EZ-Bar Skullcrusher. 131 variants now resolve to 63 canonical exercises; Close-Grip Barbell Bench Press and Smith Machine Close-Grip Bench Press stay as their own entries per the user's call.

## v1.853 (2026-09-17)
- fix [#527](https://github.com/cruciferousgreens/kohlrabi/issues/527): evaluated and closed — no single-tab loss path exists in the persist code (settings mutations hit memory synchronously, schedulePersist coalesces rapid changes into one debounced write, and the pagehide safety net carries unwritten changes). The rapid-change reload loss traced to the test Chromium's broken cross-reload storage. New regression pins in tests/persist-settings-coalescing-527-528.test.js: the exact repro pair (Units→Kilograms + Dumbbell entry→Total) coalesces into one write carrying both values, a change landing mid-write survives, and the unload net carries never-debounced changes.
- fix [#528](https://github.com/cruciferousgreens/kohlrabi/issues/528): evaluated and closed — the program muscle-card default view is persisted wholesale with progressionSetup and restored via Object.assign + normalizeProgression at boot; the reload loss was the same broken-storage test environment. Pinned by a round-trip regression test (set heatmap → collectPersistable → JSON → boot restore → still heatmap).

## v1.852 (2026-09-17)
- fix [#539](https://github.com/cruciferousgreens/kohlrabi/issues/539): exercise database consolidated — 128 duplicate/variant exercises (extra squat, curl, row, press, bench variants) now resolve to 62 canonical exercises. Variants are invisible: nothing was deleted (all 876 records stay in the database), old workouts and history logged under a variant name now show under the canonical exercise, and history, PRs, progression suggestions, and stats all merge under the canonical. The library, workout picker, search, and similar-exercises only ever show canonical exercises.

## v1.851 (2026-09-17)
- fix [#543](https://github.com/cruciferousgreens/kohlrabi/issues/543) (user): the workout editor no longer returns as a blank grey screen after tapping Back from an exercise's info page — scroll restoration is now fully manual (iOS Safari's native pass raced the app's own restore and could park the viewport past the content), saved positions are clamped into the document, and the completed-log return path scrolls to top explicitly.
- fix [#541](https://github.com/cruciferousgreens/kohlrabi/issues/541) (user): audited every exercise's muscle assignments — prime movers are now primary (deadlift family: glutes/hamstrings, not lower back), stabilizers demoted to secondary. 499 of 876 exercises corrected.
- fix [#535](https://github.com/cruciferousgreens/kohlrabi/issues/535) (user correction): the missing-values finish dialog is back to exactly two options — "Finish anyway" + "Keep editing" — as before the v1.806 extension. "Log incomplete sets" is offered only for the valid-but-unmarked variant (complete values, never marked); no set with missing weight/reps is ever logged with nulls.

## v1.811 (2026-09-17)
- fix [#537](https://github.com/cruciferousgreens/kohlrabi/issues/537): the v1.810 done-flag reset wasn't enough — the #520 wipe plants an emptied payload at PERSIST_KEY (so peer tabs can't resurrect data) and the first-run gate read any stored blob as a "returning profile". Wipe plants are now stamped with wipedAt and the gate's local-data probes (localStorage copy, migration backup, IndexedDB) ignore stamped plants, so the onboarding flow truly resurfaces after "Delete all data", sign-out, and delete-account. Real (unstamped) payloads still count as local data.

## v1.810 (2026-09-17)
- fix [#537](https://github.com/cruciferousgreens/kohlrabi/issues/537): the onboarding flow resurfaces after "Delete all data", sign-out, and delete-account — wipeLocalUserData() now resets the first-run gate (clearOnboardingDone()) along with the wiped profile, instead of leaving the done-flag behind.

## v1.809 (2026-09-17)
- fix [#544](https://github.com/cruciferousgreens/kohlrabi/issues/544) (user): Home's "Recent workouts" list now orders by the workout date, not by when the entry was saved — a workout performed Sep 2 but logged Sep 13 sits with Sep 2 (the #274 rule, completedAt only breaks same-day ties). Repeat-last keeps completion order.
- fix [#525](https://github.com/cruciferousgreens/kohlrabi/issues/525) (user): the code-expired message on the "Check your email" screen now says "Send a code" (not "Email me a code"), and the resend button it names reads "Send a code" to match.

## v1.808 (2026-09-17)
- fix [#542](https://github.com/cruciferousgreens/kohlrabi/issues/542): the home screen no longer flashes before the onboarding flow on a fresh start — a pre-paint gate hides the app chrome until the onboarding decision resolves, so new users land directly on onboarding.

## v1.807 (2026-09-17)
- fix [#524](https://github.com/cruciferousgreens/kohlrabi/issues/524) (accessibility follow-up): deleting a set renumbered the visible set buttons 1..N but left the screen-reader names stale — the weight/reps/RPE inputs still announced the old set number ("Set 3 weight in pounds" on the row now labeled 2), and both delete controls kept the old "Delete set N" name. All row names now follow the row's position after a deletion; frozen sets keep their "Mark set N incomplete" unlock name.

## v1.806 (2026-09-17)
- fix [#536](https://github.com/cruciferousgreens/kohlrabi/issues/536): the Add-exercise sheet works Hevy's way — the beige selected-rules box is gone; tapping a result selects it inline with a checkmark, and the sticky bottom button reads "Add N exercises" and commits the selection with default sets/reps. Sets/reps are configured in the workout after adding. (The template editor keeps its rules UI.)
- fix [#535](https://github.com/cruciferousgreens/kohlrabi/issues/535): "Log incomplete sets" now appears in the missing-values finish dialog too — it keeps every typed partial value (missing fields log as null, unchecked), drops only wholly empty sets, and prunes exercises left with none. It sits second, right under "Finish anyway".
- fix [#529](https://github.com/cruciferousgreens/kohlrabi/issues/529): partial — program creation: the progression-rules info button moved under the expansion — it only appears after expanding "Progression rules", so the collapsed header stays clean.

## v1.805 (2026-09-17)
- fix [#533](https://github.com/cruciferousgreens/kohlrabi/issues/533): the Home empty-state card ("No workouts yet") now has rounded corners to match the rest of the UI — the shared `.training-hero` register (also used by the Workout tab's no-data card) carries the app's card radius instead of straight edges.

## v1.804 (2026-09-17)
- fix [#530](https://github.com/cruciferousgreens/kohlrabi/issues/530): exercise names drop the stale grip qualifiers — "Barbell Bench Press - Medium Grip" is now "Barbell Bench Press", "Barbell Incline Bench Press - Medium Grip" is now "Barbell Incline Bench Press", "Wide-Grip Lat Pulldown" is now "Lat Pulldown". Stable exercise IDs are unchanged, so history and progression keep resolving.
- fix [#531](https://github.com/cruciferousgreens/kohlrabi/issues/531): the plain barbell/dumbbell variant of a lift ranks first even for broad queries — "bench" now opens Barbell Bench Press, Dumbbell Bench Press (not 8th/9th), and "row" opens barbell/dumbbell rows (not Rowing, Stationary). Favorites still float within the group.
- fix [#532](https://github.com/cruciferousgreens/kohlrabi/issues/532): Settings refinements — the Account section stays always expanded, privacy/subscription controls move into a collapsed Marketing card, the Desktop layout toggle hides on mobile viewports, and a stored Desktop preference never alters the phone UI (it only takes effect at desktop widths).
- fix [#533](https://github.com/cruciferousgreens/kohlrabi/issues/533): Home's no-workout state now speaks the Workout tab's no-data card register ("No workouts yet" + Start blank workout + Create a program), and the anatomical muscle map stays visible on Home and Stats with no activity — empty periods render the blank map with the empty note beside it.
- fix [#534](https://github.com/cruciferousgreens/kohlrabi/issues/534): the Add-exercise sheet's selected-rules block no longer squash-squeezes into a ~45px scroll-slice — it never shrinks below its rows (the max-height cap still gives it its own scroller when many exercises are selected).
- fix [#535](https://github.com/cruciferousgreens/kohlrabi/issues/535): the finish dialog's "Log incomplete sets" is the second button (it logs every set's usable values with unchecked flags intact), a hairline "or" separator sits above "Keep editing", which is now a quiet text link in every variant.
- Program creation: the progression rules now start collapsed (full cleanup deferred to #529).

## v1.803 (2026-09-17)
- fix [#520](https://github.com/cruciferousgreens/kohlrabi/issues/520): "Delete all data" is now final — a wipe generation clock defeats the cross-tab resurrection. Every wipe bumps a monotonic generation (persisted to localStorage and stamped on every saved blob); a tab that sees a newer generation clears its own memory instead of union-merging, because the union treated the emptied state as a no-op and kept (then re-wrote) the "deleted" records. The v1.801 plant fixed the empty-storage window but not the union: a peer holding the full state merged the empty plant into its records and wrote them back. Pre-wipe blobs are now ignored everywhere — in the read-before-write merge, in the merge helper itself, and at boot.

## v1.801 (2026-09-17)
- fix [#520](https://github.com/cruciferousgreens/kohlrabi/issues/520): "Delete all data" no longer resurrects when a second app tab is open — the wipe now synchronously plants the emptied state to localStorage (before the first await, and again after the IndexedDB delete verifies), so no tab ever sees momentarily-absent storage. Instrumented diagnostics proved the v1.800 delete itself was durable; the resurrection came from a hidden peer tab whose autosave fired in the empty window, saw nothing to merge with, and blind-wrote its stale copy back. A peer now always finds an explicit empty state and adopts it.

## v1.800 (2026-09-16)
- fix [#520](https://github.com/cruciferousgreens/kohlrabi/issues/520): "Delete all data" now wipes even when this session fell back to localStorage — the IndexedDB delete is attempted unconditionally (never gated on the per-session probe result), an unreachable IDB counts as unverified rather than success, and the emptied-state localStorage fallback still trump-cards any surviving copy at boot. The v1.798 repair only deleted from IDB when the probe had succeeded that session; a failed probe left the full IDB blob behind for the next boot to resurrect. Also hardened `wipeLocalUserData` against a null options argument.

## v1.799 (2026-09-16)
- fix [#512](https://github.com/cruciferousgreens/kohlrabi/issues/512): the mailing-list worker now talks to the real mailing-list API (correct host + auth scheme) — the wrong endpoint it used before made every signup fail. End-to-end confirmed: a signed-in beta user lands on the mailing list with the right tags.

## v1.798 (2026-09-16)
- fix [#520](https://github.com/cruciferousgreens/kohlrabi/issues/520): "Delete all data" now wipes durably — IndexedDB writes and deletes resolve on transaction commit (not request success), the delete is verified and retried once, and if IndexedDB still won't let go, the emptied state is written to localStorage with a fresh timestamp so boot picks the empty copy.

## v1.797 (2026-09-16)
- fix [#490](https://github.com/cruciferousgreens/kohlrabi/issues/490): the RPE progression trigger now uses the raw top-set RPE — accumulated fatigue no longer blocks suggestions. 3×5 @ RPE 8 at trigger 8 now suggests (was held on an effective RPE of 8.4). The fatigue accounting still runs and is reported, but it no longer gates or appears in suggestion reasons.

## v1.796 (2026-09-16)
- fix [#520](https://github.com/cruciferousgreens/kohlrabi/issues/520): "Delete all data" now actually wipes — the IndexedDB delete is awaited before the reload, so data can no longer resurrect after the wipe.
- fix [#521](https://github.com/cruciferousgreens/kohlrabi/issues/521): deleted or discarded items no longer resurrect on reload — a new pagehide safety net synchronously stashes unwritten changes, and boot takes the newest copy.
- fix [#522](https://github.com/cruciferousgreens/kohlrabi/issues/522): the onboarding Done screen no longer shows an invalid typed email as the account — unverified addresses stay out of the summary ("Local only" unless a code was verified).
- fix [#523](https://github.com/cruciferousgreens/kohlrabi/issues/523): reloading on #program no longer pops the "Start a new program?" dialog — that prompt is for external deep links only.
- The Exercise-options explanation for a deliberate RPE hold now names cumulative fatigue (e.g. 3×5 @ RPE 8 → effective RPE 8.4 exceeds the trigger) instead of "not enough valid data".

## v1.795 (2026-09-16)
- fix [#512](https://github.com/cruciferousgreens/kohlrabi/issues/512): subscription prefs now sync to the mailing list — App updates, Marketing newsletter, and App tips map to mailing-list tags via a server-side worker that holds the API key (the key never ships in client JS). Only signed-in users sync (verified session email); prefs chosen while signed out sync on sign-in; a failed sync never blocks the local change and retries later.

## v1.794 (2026-09-16)
- fix [#454](https://github.com/cruciferousgreens/kohlrabi/issues/454): tappable muscles and dedicated muscle pages are out — muscle names on the exercise detail page are static labels again, and the muscle-page route, back handling, and styles are gone. Parked for 2.0; the anatomical heat map and the Stats muscle drilldowns are untouched.

## v1.793 (2026-09-16)
- fix [#519](https://github.com/cruciferousgreens/kohlrabi/issues/519): the marketing opt-in now appears on regular sign-in too — Settings → Account, the post-workout sign-in nudge, and the empty-home hero sign-in all carry the same all-or-nothing checkbox as the onboarding sign-in step (checked opts App updates, Marketing newsletter, and App tips all in; unchecked opts all out). The box reflects the current prefs each time the form appears.

## v1.792 (2026-09-16)
- Subtle view transitions: switching tabs now crossfades (opacity + a 6px rise over 160ms) instead of snapping — transform/opacity only, so no layout jank; disabled for prefers-reduced-motion.

## v1.791 (2026-09-16)
- fix [#518](https://github.com/cruciferousgreens/kohlrabi/issues/518): archived programs can be deleted again — the removal function was nested where the delete-confirmation handler couldn't reach it, so confirming silently did nothing; it now lives at module scope.

## v1.790 (2026-09-16)
- fix [#469](https://github.com/cruciferousgreens/kohlrabi/issues/469): the builder's Configure dialog now writes only the range onto an exercise's progression profile — no more preset rep numbers typed into the set rows. The range shows as a ghost placeholder (per the #353 convention) and only the range minimum auto-saves when a set is finished untouched; explicitly typed per-set targets are never clobbered.
- fix [#467](https://github.com/cruciferousgreens/kohlrabi/issues/467): the live-workout exercise picker now resolves the workout's focus pill through the rep-range presets — exercises added after tapping Strength inherit Strength's 1–5 range instead of falling back to the global Settings default (the saved-workout builder already did this via #100).
- fix [#487](https://github.com/cruciferousgreens/kohlrabi/issues/487): closed as already resolved — the Kohlrabi arrow icon set verified live on the QA build (byte-identical to prod, served by beta.kohlrabi.us).

## v1.789 (2026-09-16)
- fix [#517](https://github.com/cruciferousgreens/kohlrabi/issues/517): the Delete account button now lives in Settings → Data (shown only while signed in; it opens the existing delete-account confirmation); the info (i) button is gone from the Settings → Progression defaults card.

## v1.788 (2026-09-16)
- fix [#98](https://github.com/cruciferousgreens/kohlrabi/issues/98): the desktop layout now wears the marketing site's chrome — a sticky blurred header with the Kohlrabi brand mark, the five tabs as header links (the bottom tab bar is gone in desktop mode), and the settings gear; the slim top bar drops below it as the contextual strip, and cards get the marketing treatment (white, hairline border, soft shadow) on the pale-green paper background.

## v1.787 (2026-09-16)
- fix [#3](https://github.com/cruciferousgreens/kohlrabi/issues/3): removed the user-choosable exercise-detail info blocks and closed the issue as wontfix — the Settings → Exercise detail section is gone, the detailBlocks pref is removed from persistence/sync state, and every detail page shows all info blocks (the previous default).

## v1.786 (2026-09-16)
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506): onboarding follow-ups from phone QA — removed the crossed-out "I already have an account" link from the welcome screen; the sign-in code entry is now 8 digits (not 6) and uses a single autofill-friendly input behind the visual boxes so iOS one-time-code autofill fills the whole code instead of just the first digit; toggling between the two Setup cards updates the selection ring in place instead of re-rendering the screen (no more flash).

## v1.785 (2026-09-16)
- fix [#98](https://github.com/cruciferousgreens/kohlrabi/issues/98): optional desktop layout — a new Settings toggle (off by default; the phone layout stays the default, no automatic breakpoint) widens the app into a multi-column desktop shell in the marketing site's design language. The choice syncs with the account's appearance settings.

## v1.784 (2026-09-16)
- fix [#501](https://github.com/cruciferousgreens/kohlrabi/issues/501): finish workout — sets with data entered but never marked complete now get an explicit choice: "Mark all complete" or "Leave unchecked" (finishes with the data and the unchecked flag intact, nothing silently completed or discarded), with per-set toggles naming each set in the review dialog.
- fix [#406](https://github.com/cruciferousgreens/kohlrabi/issues/406): the progression suggestion UI now lives inside each exercise card — every card shows its own tap-to-apply suggestion row that fills the set fields without wiping typed values; the separate suggestion banner is retired.

## v1.783 (2026-09-16)
- fix [#514](https://github.com/cruciferousgreens/kohlrabi/issues/514) (user): onboarding Options screen defines its jargon — "RPE threshold" gets a one-line sublabel ("How hard your top sets should feel, on a 1–10 scale") and the Rep range group explains "AMRAP = as many reps as possible".
- fix [#515](https://github.com/cruciferousgreens/kohlrabi/issues/515) (user): the How-it-works detail cards define terms on first use — RPE as "rate of perceived exertion … how hard the set felt, on a 1–10 scale", estimated 1RM as "one-rep max — the heaviest weight the app thinks you could lift once".
- fix [#516](https://github.com/cruciferousgreens/kohlrabi/issues/516) (user): the done-screen summary reads "Import: Started" instead of the ambiguous "Import: Opened" after the importer is opened.

## v1.782 (2026-09-16)
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): done screen — the exclamation-mark illustration is removed entirely, and the "Setup: Defaults" row is gone from the summary card (the card IS the setup).
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): empty Home drops the giant faded "Ready?" and the arrow mark — the hero now speaks the app's shared empty-state register: a 22px "No workouts yet" heading, the value sub, then the key-task cards.

## v1.781 (2026-09-16)
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): onboarding Import screen — the two skips switch: "Skip for now" (continue the flow past import) is now the primary green action, and "Skip to the app" (exit onboarding) is the quiet link.
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): done screen — the checkmark illustration becomes an exclamation mark, the Units row reads Imperial/Metric instead of lb/kg, and a new Account row shows the account email when signed in or "Local only" otherwise.
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): the empty Home ("Ready?") wears the onboarding look — the Kohlrabi arrow mark sits centered above the headline.

## v1.780 (2026-09-16)
- fix [#511](https://github.com/cruciferousgreens/kohlrabi/issues/511) (user): the onboarding marketing opt-in is a master switch — all or nothing: checked opts all three prefs in, unchecked opts out of all three including app updates and tips (reverses the v1.778/v1.779 "marketing-only" behavior per his call).

## v1.779 (2026-09-16)
- Renumbered from 1.778: a parallel same-numbered build reached QA first, so this build takes 1.779 to keep the QA build unambiguous. Contents are the v1.778 round-2 batch below.

## v1.778 (2026-09-16)
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): onboarding Import screen — "Import workouts" opens the real file picker at once (the import overlay now paints above the flow), and the hierarchy flips: "Skip to the app" is the primary green action, Import is the white secondary button.
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): welcome screen is vertically centered, with a white "Take me to the app" button below Get started (the "I already have an account" link stays).
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): sign-in screen asks "Want to sign in?" with new copy — "Signing in saves your data to the cloud and lets you share workouts. Enter your email and we'll send you a code, no password needed."
- fix [#511](https://github.com/cruciferousgreens/kohlrabi/issues/511) (user): the marketing opt-in checkbox moves off the email page onto the code-entry page.
- fix [#511](https://github.com/cruciferousgreens/kohlrabi/issues/511) (user): the onboarding marketing checkbox now writes ONLY the Marketing newsletter pref — unchecking it no longer broadcasts to App updates or App tips.

## v1.777 (2026-09-16)
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): "Receive marketing updates on new releases?" moves off "Tune your setup" to the sign-in step, right after sign-up/sign-in.
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): every onboarding screen now has a primary Next/continue action plus a "Skip to the app" affordance; the setup-choice cards are selectable with a primary Next button.
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): "How it works" cards are tappable — tapping reveals a detail card drawn from the marketing site's getting-started page (one open at a time), with the full page linked at the bottom.
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): "You're ready to lift" now carries the Kohlrabi logo mark and bold app name at the top.
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): onboarding fires on fresh-profile deep-link landings other than Home; `/s/` and `#share=` share links keep their no-onboarding behavior, and the deep-link destination is restored when the flow finishes.
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): a newly created account gets the post-sign-up onboarding flow (the sign-in screen is skipped since it just happened).
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): Import is one "Import workouts" button plus a plain list of the supported sources (Hevy exports, MacroFactor history/program files, CSV files, Kohlrabi backups); the real importer opens when the flow finishes.
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): Settings → Data → Privacy gains a hairline divider above the Privacy subsection.
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): welcome screen tightened — Get started sits higher beneath the tagline instead of riding a full-height spacer.

## v1.776 (2026-09-16)
- fix [#471](https://github.com/cruciferousgreens/kohlrabi/issues/471) (user): prescribed per-set reps in the saved-workout builder no longer get lost — the builder writes set targets on every keystroke (like the live editor) instead of only on blur, so tapping Save with a field still focused can't silently drop the prescription.
- fix [#459](https://github.com/cruciferousgreens/kohlrabi/issues/459) (user): saved (inactive) programs can now be shared — a Share button on the saved-program preview builds the link with the same payload machinery as the active program.
- fix [#461](https://github.com/cruciferousgreens/kohlrabi/issues/461) (user): archived programs can now be deleted — each archived row carries a quiet Delete pill behind the same two-step confirm as saved programs.
- fix [#460](https://github.com/cruciferousgreens/kohlrabi/issues/460) (user): program cover tightened — the gap between the program name and the rotation info is reduced, and the "Sets per muscle across all program workouts" caption under the muscle chart is removed (chart stays).

## v1.775 (2026-09-16)
- fix [#511](https://github.com/cruciferousgreens/kohlrabi/issues/511) (user): marketing opt-in — the onboarding Options step gains a "Receive marketing updates on new releases?" checkbox (checked by default, "(you can change this later)"); toggling it sets all three subscription prefs on/off at once.
- fix [#511](https://github.com/cruciferousgreens/kohlrabi/issues/511) (user): new Settings → Data → Privacy subsection with three checkboxes — App updates, Marketing newsletter, App tips — each toggling independently, all default ON; prefs persist to the account and sync across devices (local-only when signed out). Preference storage only — no email backend exists.

## v1.774 (2026-09-16)
- fix [#509](https://github.com/cruciferousgreens/kohlrabi/issues/509): program builder gains a secondary "Save to library" button next to "Create active program" — parks the draft in the saved-programs library instead of making it active (mirrors the #432 share-page pattern).
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506) (user): QA-only "Replay onboarding" trigger in Settings → About (shown on non-prod hosts only — never on prod) so the first-run flow can be tested on QA builds; it clears the completion marker and restarts the flow.
- [#493](https://github.com/cruciferousgreens/kohlrabi/issues/493) / [#134](https://github.com/cruciferousgreens/kohlrabi/issues/134) (user): exercise variations work (angle chooser, movement families) removed from the v1.8 builds and moved to the v2 milestone; #498 distance metrics stay in v1.8.
- fix [#502](https://github.com/cruciferousgreens/kohlrabi/issues/502) / [#408](https://github.com/cruciferousgreens/kohlrabi/issues/408) (user): Settings sections now expand independently — opening one no longer collapses the others; each section's expansion state persists to the account and syncs across devices (local-only when signed out).
- fix [#510](https://github.com/cruciferousgreens/kohlrabi/issues/510) (user): add-exercise modal no longer moves the page behind it — the background is scroll-locked while the modal is open and the exact position is restored on close; the modal itself is now a fixed size with internal scrolling for the results list instead of growing/shrinking with the result count.

## v1.773 (2026-09-16)
- fix [#493](https://github.com/cruciferousgreens/kohlrabi/issues/493): selectable exercise angle — stamped on new items (bare incline presses default to the conventional 30°), selectable 15°/30°/45° in Exercise options, preserved through clones/share/templates/programs, tracked separately in history, stats, charts, and progression (exact-angle → exact-variation priority; legacy angleless sessions stay angleless).
- fix [#134](https://github.com/cruciferousgreens/kohlrabi/issues/134): movement families — multi-member families collapse into expandable rows in the library and exercise picker (base exercise first); custom exercises can join a family via "Variation of"; family history rolls up by default in detail/stats; a new Variations card on exercise detail lists sibling variations.
- fix [#498](https://github.com/cruciferousgreens/kohlrabi/issues/498): distance metrics for sled pushes, carries, and similar — per-set distance field alongside load, DIST (M) editor column, load × meters ghosts/suggestions/PRs, RPE-gated load progression at a held longest distance; non-volume work (curated list plus any positive-distance set) is excluded from standard weight × reps volume everywhere.

## v1.772 (2026-09-16)
- fix [#490](https://github.com/cruciferousgreens/kohlrabi/issues/490): cumulative-fatigue RPE accounting — each work set beyond the top adds 0.25×(setRPE/10) effective RPE (capped at +1.5); warm-ups excluded, RPE-less sets assume the top set's effort; the effective RPE feeds the trigger gate, the rebase gate, and the rep jump, with the reason text labeling the adjustment.
- fix [#406](https://github.com/cruciferousgreens/kohlrabi/issues/406): progression suggestions now render inline in the exercise card under the Last: line (kind chip · target · basis · "tap to apply…"); tapping applies through the existing path (typed values intact), then a surgical card swap replaces just that card and lands focus on the applied row.
- fix [#118](https://github.com/cruciferousgreens/kohlrabi/issues/118): looping periodization schedule — the "Vary rep ranges by week" toggle becomes an Off/4/6/8/12-week cycle picker in program setup and Settings; week N maps to ((N-1) mod length)+1; legacy undulating blobs keep their schedule.
- fix [#454](https://github.com/cruciferousgreens/kohlrabi/issues/454): muscle pills on the exercise detail page open dedicated muscle pages listing primary and secondary exercises, with #muscle-<name> routes and Back returning to the opening exercise.
- fix [#391](https://github.com/cruciferousgreens/kohlrabi/issues/391): muscle-data audit — corrected 14 of 876 catalog exercises (swapped/wrong primaries, contradictory primary/secondary duplications removed, missing secondaries added).
- fix [#3](https://github.com/cruciferousgreens/kohlrabi/issues/3): exercise-detail info blocks are user-choosable via a new Settings → Exercise detail section (stats, muscle map, movement, progress, how-to, similar, history), persisted and synced across devices.
- fix [#508](https://github.com/cruciferousgreens/kohlrabi/issues/508): exercise search ranks standard-equipment matches (barbell, dumbbell, body only) above specialty-equipment matches within the same relevance tier.

## v1.771 (2026-09-16)
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506): onboarding flow v2 for first-time visitors — Welcome → optional sign-in ("No thanks" continues without an account) → setup choice ("Give me the defaults" vs "I want more options") → options → import (CSV/Hevy/MacroFactor, skippable) → how-it-works → Done summary landing on the Home empty state.
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506): the flow shows only for fresh profiles — never for signed-in users, persisted profiles, share links, auth callbacks, or deep links; the recorded import choice opens the existing CSV importer after entering the app.
- fix [#506](https://github.com/cruciferousgreens/kohlrabi/issues/506): Home empty-state hero is now "Ready?" with training-week value copy; the days-per-week answer is stored as progressionSetup.trainingDays (default 3).

## v1.770 (2026-09-16)
- fix [#502](https://github.com/cruciferousgreens/kohlrabi/issues/502): Settings page restructured into labeled accordion sections on the pinned 8-section grouping (Account, Appearance, Units, Progression defaults, Defaults, Warm-up sets, Data, About) — each header shows the title, its short description, and a disclosure chevron; every control, id, and behavior preserved.
- fix [#408](https://github.com/cruciferousgreens/kohlrabi/issues/408): Settings sections auto-collapse — all start collapsed, opening one closes the others (single-open accordion), and entering the Settings tab resets to all-collapsed.

## v1.769 (2026-09-16)
- fix [#505](https://github.com/cruciferousgreens/kohlrabi/issues/505): reverted the live-dot return-flight animation from v1.765 — leaving the live workout restores the exact pre-v1.765 instant chip/title-dot swap, per the user's call.

## v1.768 (2026-09-16)
- Layout fix (user): the About card is back inside Settings — it was rendering on every tab.
- [#507](https://github.com/cruciferousgreens/kohlrabi/issues/507) (user): exercise Photos prototype removed — held for v2.

## v1.767 (2026-09-16)
- fix [#488](https://github.com/cruciferousgreens/kohlrabi/issues/488) (user): tapping Settings no longer jumps — background workout-screen renders no longer force the page to the top while Settings is visible.
- fix [#501](https://github.com/cruciferousgreens/kohlrabi/issues/501): finishing a workout now offers to complete sets that have data but were never checked — per-set toggles, Mark all complete, Leave unchecked, or Keep editing; the unchecked state persists with an "unchecked" chip and survives edit/re-finish.
- fix [#499](https://github.com/cruciferousgreens/kohlrabi/issues/499): rest/off days — mark any calendar day as a rest day from the day summary; rest-day logs are excluded from progression and RPE suggestion calculations but stay in history.
- fix [#353](https://github.com/cruciferousgreens/kohlrabi/issues/353): saved-draft focus pills now set the rep range as a ghost placeholder instead of stamping the range floor into every set as a typed value; exercises hand-tuned in per-exercise Configure keep their own range (announced, never silently clobbered).
- fix [#504](https://github.com/cruciferousgreens/kohlrabi/issues/504): friendlier empty states — "No workouts yet" on Home, "No workout in progress" on the Workout tab, first-use and filtered-void states in Logs, zero-results reset in the exercise library, "No active program" / "No saved programs" on the Program tab, and a first-use state on Stats.
- Share headline restored to "Track a new personal best." (the v1.766 push had silently reverted the 2026-09-16 copy change).

## v1.766 (2026-09-16)
- fix [#507](https://github.com/cruciferousgreens/kohlrabi/issues/507): exercise detail gains a Photos prototype — a collapsed-by-default section (after How to) that lazy-loads reference photos from free-exercise-db only when expanded; broken images hide gracefully, aspect-ratio boxes prevent layout shift.

## v1.765 (2026-09-16)
- fix [#505](https://github.com/cruciferousgreens/kohlrabi/issues/505): leaving the live workout now mirrors the Live chip's dot flight on the way back — the dot flies from the title back to the chip (same 420 ms, same easing) while the chip fades in underneath, instead of the chip popping in with no motion.

## v1.764 (2026-09-16)
- fix [#473](https://github.com/cruciferousgreens/kohlrabi/issues/473) (user): percent-increment suggestion targets now snap to the same increment grid as fixed-lb increments — 125 lb @ 9% suggests 135 (nearest 5 lb), never 136 and never a decimal. Warmup ladder rungs use the same grid.
- fix [#503](https://github.com/cruciferousgreens/kohlrabi/issues/503) (user): switching programs (shared-program Start, or starting a new program from a deep link) now moves the outgoing active program into Saved programs — it is no longer archived. Only explicit user archive/delete lands in Archived.
- fix [#472](https://github.com/cruciferousgreens/kohlrabi/issues/472) (user): suggestion-card set lines render in numeric order (Set 1, Set 2, Set 3) — a stalled top set's line no longer leads the card; stale drafts get their cards rebuilt by the current build when the workout opens.
- fix [#500](https://github.com/cruciferousgreens/kohlrabi/issues/500): editing a completed workout now updates the log in place — finishing an edit replaces the existing entry (keeping its completion time and program attribution) instead of creating a duplicate.
- fix [#497](https://github.com/cruciferousgreens/kohlrabi/issues/497): RPE 0 is now accepted as a valid RPE (warmups, trivially easy work) — it no longer trips the finish-review "unfilled sets" check.
- fix [#489](https://github.com/cruciferousgreens/kohlrabi/issues/489): new "Default set count" setting — adding an exercise creates that many set rows (1–10, default 3).
- fix [#495](https://github.com/cruciferousgreens/kohlrabi/issues/495): new "Hide total-weight option" toggle for dumbbell exercises — hides the per-exercise total-weight toggle for a clean per-dumbbell UI.
- fix [#492](https://github.com/cruciferousgreens/kohlrabi/issues/492): warmup ladder weights snap to the increment grid (and even whole totals for per-dumbbell display) — no more ugly decimals like 32.675 lb.
- fix [#491](https://github.com/cruciferousgreens/kohlrabi/issues/491) / [#496](https://github.com/cruciferousgreens/kohlrabi/issues/496): workout/program/exercise cards no longer jump on tap, and adding a set tag keeps the page scroll position.
- Robustness: poisoned history (null workouts, garbage dates, non-array sets) no longer throws in stats/history renders; null period entries are skipped; runaway volumes degrade to 0 instead of rendering "Infinity".
- Sync: tag loop, cross-tab null, sign-out push ordering, and garbage sync items hardened.
## v1.763 (2026-09-15)
- fix [#473](https://github.com/cruciferousgreens/kohlrabi/issues/473) (user): suggestions are computed once when a workout starts and kept with the draft — a workout started before updating kept the old build's rounding after the update, so 136 lb kept showing on phones already running the fixed build. Drafts are now stamped with the computing build and a stale draft's suggestions are recomputed once per build when the workout opens (never touching applied cards, typed values, or completed sets).
- fix [#472](https://github.com/cruciferousgreens/kohlrabi/issues/472) (user): the same stale-draft recompute covers the set-order fix — a draft carried over from an older build now gets its suggestion cards rebuilt by the current build when the workout opens.
## v1.762 (2026-09-15)
- Share link previews: the home share card now shows the Kohlrabi arrow app icon with the "Kohlrabi" wordmark on the cream background — replacing the text-only "Cruciferous Greens." card.
## v1.761 (2026-09-15)
- fix [#473](https://github.com/cruciferousgreens/kohlrabi/issues/473) (user): percent-increment suggestion targets snapped to the nearest whole pound, landing off any practical grid (136 lb) — they now snap to the nearest 2.5 lb, so formula-derived loads stay on the 2.5/5 lb grid (136 → 135) with no decimals.
- fix [#472](https://github.com/cruciferousgreens/kohlrabi/issues/472) (user): suggestion-card set lines render in numeric order — a stalled top set's "Hold" line no longer leads the card (Set 3, Set 1, Set 2); this build's cache refresh guarantees phones fetch the fixed script.
- fix [#487](https://github.com/cruciferousgreens/kohlrabi/issues/487) (user): the app icon is now the Kohlrabi arrow icon — new favicon in the browser tab, new home-screen icon (192/512 via the manifest), and new apple-touch-icon (180).
- Share link previews: the home share card is now just "Cruciferous Greens." stacked in the site typeface on the cream background — no logo, URL, metrics, pills, or body map.
## v1.760 (2026-09-15)
- fix [#462](https://github.com/cruciferousgreens/workout-app/issues/462) (user): the program creation page's "All sets" toggle moved to the bottom, under Auto Deload — matching the ordering already shipped in Settings → Progression defaults.
- fix [#463](https://github.com/cruciferousgreens/workout-app/issues/463) (user): the Settings → About version line ("Kohlrabi · vX") is now a link to the release notes, so users can see what changed in the build they are on; the build stamp writes into the link so it survives the version render.
- fix [#464](https://github.com/cruciferousgreens/workout-app/issues/464) (user): the "Last updated" stamp moved to directly under the "Check for updates" button in Settings → About.
## v1.759 (2026-09-15)
- fix [#485](https://github.com/cruciferousgreens/workout-app/issues/485): verified the kettlebell option is already in the equipment vocabulary — 56 bundled exercises are tagged kettlebells and the library filter, picker filter, and custom-exercise pills all derive from the live catalog; regression tests now pin the vocabulary so it can't be silently dropped, and kettlebell stays weight-required (weighted implement).

- Rebrand: the app is now **Kohlrabi** — the home-screen name, share links, link previews, and metadata moved from app.cruciferousgreens.com to kohlrabi.us (the app is still free, by Cruciferous Greens).
## v1.758 (2026-09-15)
- fix [#476](https://github.com/cruciferousgreens/workout-app/issues/476): the glossary is re-synced with the code — deload rules for timed work, fractional-RPE rounding, the new similar-exercise formula, the canonical "Failure" tag, per-dumbbell entry, and the real increment-rounding rules.
- fix [#478](https://github.com/cruciferousgreens/workout-app/issues/478): per-week Deload flags in the wave panel went inert when the %1RM wave toggle was off — they no longer deload workouts or light the program week bar after the wave is switched off (Auto Deload's own every-N-weeks rule is unaffected).
- fix [#479](https://github.com/cruciferousgreens/workout-app/issues/479): similar-exercise scoring now counts movement pattern — same force (push/pull/static) adds 2 and same exercise category adds 1, so a pressing movement no longer ranks a row above another press when muscles tie.
- fix [#480](https://github.com/cruciferousgreens/workout-app/issues/480): per-program setup now mirrors the #420 wave-vs-Auto-Deload rule — turning the %1RM wave on forces Auto Deload off and disables its toggle; turning the wave off re-enables the toggle without restoring Auto Deload.
- fix [#481](https://github.com/cruciferousgreens/workout-app/issues/481): switching an exercise's tracking between Reps and Seconds now recomputes its suggestion immediately, and a stale suggestion card can never revert the switch (typed values are preserved).
- fix [#482](https://github.com/cruciferousgreens/workout-app/issues/482): on IndexedDB devices, the first "Keep both" sync could lose long-standing local settings — the first-sync baseline now reads the persisted blob through storage instead of localStorage-only, so older remote scalar settings no longer beat them.
- fix [#484](https://github.com/cruciferousgreens/workout-app/issues/484): the CSV column template used the renamed "To failure" tag — it now uses the canonical "Failure", and the importer still accepts the old literal as an alias for backward compatibility.

## v1.757 (2026-09-15)
- fix [#285](https://github.com/cruciferousgreens/workout-app/issues/285) (user): scheduled deloads no longer reduce bodyweight timed targets — unweighted timed work (planks, hangs, etc.) holds its seconds steady through a deload week instead of dropping to the deload %. No suggestion card appears (the target is unchanged); the workout keeps the latest target. Bodyweight rep work still scales reps to the deload %, and the All-sets back-off path holds bodyweight seconds too.

## v1.756 (2026-09-15)
- fix [#99](https://github.com/cruciferousgreens/workout-app/issues/99) (critical sync finding C1): `markSyncDirty` rebuilt the sync key meta on the re-mark path without the per-item hash map — the next dirty check fell back to a JSON-parse seed that throws on hash snapshots, so *every* item got stamped `updatedAt=now` and this device's whole collection systematically beat the other device's genuine edits in cross-device merges. The map is now preserved across re-marks (regression-tested).
- fix [#483](https://github.com/cruciferousgreens/workout-app/issues/483): fractional RPE (the RPE field accepts 0.5 steps) produced fractional rep targets — RPE 7.5 suggested "90 lb x 8 reps -> 90 lb x 10.5 reps" with reason text "add 2.5 reps", and timed work printed "add 17.5 seconds" / 57.5s targets. The RPE-headroom jump now resolves to the nearest whole rep (half up, never below the #387 floor of 2) in the top set, open-top, all-sets cascade, and all-sets independent paths; timed jumps resolve to whole seconds. So RPE 7.5 → +3 reps, and reason/card text never shows fractions.

## v1.755 (2026-09-14)
- (user): the CSV import page now has a "Download the column template" link — a ready-to-fill spreadsheet with the exact columns the importer expects, plus example rows.

## v1.754 (2026-09-15)
- fix [#466](https://github.com/cruciferousgreens/workout-app/issues/466): follow-up to v1.753 — the Clear button still never appeared for an equipment-only filter because the equipment dropdown's change handler didn't refresh the button's visibility. It now does, so Clear shows whenever any picker filter is active.

## v1.753 (2026-09-15)
- fix [#465](https://github.com/cruciferousgreens/workout-app/issues/465): the magic-link resend cooldown could hijack the sign-in button — a stale cooldown key from an earlier/abandoned flow showed a disabled "Resend in M:SS" button with no way to sign in. The cooldown now only replaces the button within the send-code flow that started it (tracked per tab); a fresh sign-in, a reopened dialog, or a post-sign-out sign-in always shows "Email me a code".
- fix [#466](https://github.com/cruciferousgreens/workout-app/issues/466): the exercise picker's Clear button only cleared the muscle pills — the equipment type stayed applied. Clear now resets every filter (muscles, equipment, favorites, custom), and the button appears whenever any filter is active, not just muscles.
- fix [#472](https://github.com/cruciferousgreens/workout-app/issues/472): progression suggestion cards listed sets out of order — a stalled top set's "Hold" line led the card regardless of position (Set 3, Set 1, Set 2). Set lines now render in numeric order.
- fix [#473](https://github.com/cruciferousgreens/workout-app/issues/473): suggestion loads could show decimals in per-dumbbell display — a whole-unit canonical total still halved into ".5" (109 → "54.5 lb"). New prescription loads for per-dumbbell exercises now snap to an even whole total so the shown weight stays whole.

## v1.752 (2026-09-15)
- (user): exercises with no equipment recorded are now treated like bodyweight — added weight is optional when logging (placeholder reads "Optional", and completing a set no longer requires a weight).

## v1.751 (2026-09-15)
- fix [#445](https://github.com/cruciferousgreens/workout-app/issues/445): opening a `#program` deep link (e.g. the marketing site's "Create program" button) with an active program no longer drops into the active program — a modal now offers starting a new program anyway (the active program is archived, never deleted; saved programs are untouched) or keeping the active program.
- fix [#453](https://github.com/cruciferousgreens/workout-app/issues/453): signing in on an empty device closed the sign-in dialog and painted the empty-device hero before the silent account adopt finished — the view could stick there instead of showing the adopted workouts/programs/data. The dialog now waits for the login transition to settle (bounded), then closes into a full re-render, so the account's data paints immediately with no manual refresh.
- fix [#448](https://github.com/cruciferousgreens/workout-app/issues/448): the exercise reorder dialog now renders one row per superset block instead of one row per member — a group shows its Superset N tag plus member names with a single arrow pair, so the row you see is the unit that moves.
- fix [#449](https://github.com/cruciferousgreens/workout-app/issues/449): the empty-data screen (fresh account, no program yet) gains a "Set up your first program" card styled like the active-program next-workout card; tapping it opens the program builder.

## v1.75 (2026-09-15)
- (user): the "All sets" toggle in Settings → Progression defaults moved below Auto Deload, at the bottom of the section.

## v1.714 (2026-09-14)
- fix [#405](https://github.com/cruciferousgreens/workout-app/issues/405): the global progression switch is now a master kill — with an active program, the program's own progression config used to shadow the Settings switch, so suggestions kept showing after phone QA turned it off. Both engine gates now check the global flag first; the program cover shows the "Progression off" tag when either the global or the program switch is off.
- fix [#409](https://github.com/cruciferousgreens/workout-app/issues/409): the loading skeletons only paint until the first real render — repeat visits to Stats re-render synchronously over the existing content, and re-opening the same exercise hydrates its detail view synchronously, so the shimmer no longer flashes on every tab open.

## v1.713 (2026-09-14)
- fix [#455](https://github.com/cruciferousgreens/workout-app/issues/455): activating a share-imported program with no progression data blanked the Program tab — `programRangeLabel(undefined)` threw and killed the cover render. It now falls back to the standard 6–12 rep label.

## v1.712 (2026-09-14)
- fix [#458](https://github.com/cruciferousgreens/workout-app/issues/458): follow-up — the tap scroll-anchoring in the exercise picker shifted the *dialog's* scroll with every selection, which still buried the dialog header above the viewport once several exercises were picked. The anchoring now shifts the exercise list's own inner scroller instead, so the tapped row stays pinned without the header, search, or Done button ever moving.

## v1.710 (2026-09-14)
- fix [#458](https://github.com/cruciferousgreens/workout-app/issues/458): the blank-workout exercise picker could strand its header and first selected-exercise cards above the viewport once several exercises were picked — the selected tray grew without bound and the native dialog centering parked the box off-screen, unreachable by any scroll gesture. The dialog box is now pinned to the viewport (explicit top/bottom) so a tall picker anchors at the top and scrolls internally, and the selected tray is capped at 32vh with its own scroll.

## v1.709 (2026-09-14)
- fix [#400](https://github.com/cruciferousgreens/workout-app/issues/400): new "All sets" progression toggle (Settings → Progression defaults, and per-program in setup/edit — off by default, inherited by new programs). When on, back-off sets progress from their own baselines instead of only the top set moving: they cascade the top set's step when it progresses, and are evaluated independently against their own RPE when the top set stalls. Missing back-off RPE holds conservatively, no history at a set position means no target there, and back-off loads never exceed the top-set load. Suggestion cards show one line per moving set ("Set 2: 90 × 8 → 90 × 10"), with a Hold line when the top set stalls.
- fix [#405](https://github.com/cruciferousgreens/workout-app/issues/405): the progression off-switch copy now says last-session targets still show when progression is off (prescriptions disappear; the last-session ghost placeholders stay as memory).

## v1.708 (2026-09-14)
- fix [#405](https://github.com/cruciferousgreens/workout-app/issues/405): progression can now be turned off entirely — a master switch in Settings → Progression defaults (the default for new programs) and a per-program switch in the program setup, plus the per-exercise off row. While off, no suggestion cards or prescription ghosts — the last-session targets still show as memory; the rest of the progression sections dim. The program cover shows a single "Progression off" tag instead of the prescription tags.
- fix [#387](https://github.com/cruciferousgreens/workout-app/issues/387): rep jumps now scale with RPE headroom — +2 reps at RPE 8, +3 at RPE 7, +4 at RPE 6, never a token +1. When the jump would overshoot the range top, the engine advances the load instead (one increment, reset to the range bottom). Timed exercises scale the time step by the same jump.
- fix [#246](https://github.com/cruciferousgreens/workout-app/issues/246): suggested loads snap to the configured increment step (the increment setting is what it's there for — not a plate snap), so no more decimal weights; suggestion cards read "1 rep" not "1 reps"; strength-like builder ranges (max 5 or fewer) now require at least 2 sets.

## v1.707 (2026-09-14)
- fix [#409](https://github.com/cruciferousgreens/workout-app/issues/409): loading skeletons and render speedups. Stats and exercise-detail views now paint fixed-size skeleton placeholders first (no layout shift) and hydrate after two animation frames; a cloud sync while Stats is open skeleton-swaps instead of flashing. Render work is faster: Stats aggregation runs in a single pass over completed workouts (was ~10 repeated scans), recent-PR detection walks newest-first and stops after the 6 shown PRs (800-workout history: ~1.1 s → ~6 ms in the common case), per-exercise history lookups are memoized, and date formatting reuses shared Intl formatters (constructing them per call was the single biggest hotspot measured).

## v1.706 (2026-09-14)
- fix [#455](https://github.com/cruciferousgreens/workout-app/issues/455): the Saved programs list now mirrors the Archived programs card — same rows and separators, program name with a "N weeks · N workouts" meta line, and a "Set active" pill (not "Restore") on the right. Tapping a row opens a read-only preview — program header, muscle map, and workout list (each workout opens read-only too) — with "Set as active" and Delete actions. Setting a saved program active follows the same confirmation flow as shared programs ("Set as active program? Your current program moves to your archive — nothing is deleted."); with no active program it activates directly. "Save to library" keeps routing to Saved programs; the archive stays reserved for programs that were active and got replaced.

## v1.704 (2026-09-14)
- fix [#360](https://github.com/cruciferousgreens/workout-app/issues/360): the saved-workout Configure dialog now carries the full per-exercise progression overrides below min/max: an "Increase reps only" toggle, load-increment type (lb/kg | %) + value, time-step pills (timed exercises only), and a Progression on/off row that stores the per-exercise off switch. Apply writes all five fields; share links round-trip them.

## v1.694 (2026-09-14)
- fix [#89](https://github.com/cruciferousgreens/workout-app/issues/89): the program cover "Muscles in this program" card no longer has its own toggle — Settings → Units → "Program muscle card" is the only control (Chart | Heat map, default Chart), and the card renders exactly the chosen view. The Settings row now matches the neighboring Units pill rows exactly (same 44px pills and selected state), fixing the unstyled buttons.
- fix [#457](https://github.com/cruciferousgreens/workout-app/issues/457): with an active program and a suggested next workout, Home's empty-state hero shows the Continue-program card directly under "Ready?", above the Start-workout card: Ready? → Continue program → Start workout → Sign in → Getting started.
- (user): the Home "Ready?" heading is now a big faded headline — 55px at 0.48 opacity.

## v1.693 (2026-09-14)
- fix [#89](https://github.com/cruciferousgreens/workout-app/issues/89): the program cover "Muscles in this program" card now has a Chart | Heat map toggle. Chart is the default and is unchanged; Heat map reuses the Stats anatomical front/back body map, heat-graded by weekly sets per muscle with the same "N sets" legend. Settings → Units has a "Program muscle card" row (Chart | Heat map, default Chart) that sets the card's initial view and persists across reloads through the account sync; the card toggle overrides it for the session. (Superseded in v1.694 — the card toggle was removed; Settings → Units is the only control.)

## v1.692 (2026-09-14)
- fix [#204](https://github.com/cruciferousgreens/workout-app/issues/204): exercise detail → History → expanded per-workout sessions got a visual polish. Each session is now a clean card: the header row carries only the date + "View workout" (the best-estimate/longest-hold headline moved to its own sub-line, so nothing wraps awkwardly), set rows are hairline-separated lines instead of inset mini-cards, and the stray right-hand dash is gone when a set has no RPE/tags. "View workout" and per-set detail work as before.

## v1.691 (2026-09-14)
- fix [#450](https://github.com/cruciferousgreens/workout-app/issues/450): signing in on a device with no local data no longer pops the "What should we keep?" dialog — it loads the account directly. Root cause: the tag lists seed with 8 defaults each at boot, so the sign-in check always saw "data" on a fresh device. Seed-only tag lists now count as empty for the sign-in transition (merge/sync guards unchanged).

## v1.690 (2026-09-14)
- fix [#452](https://github.com/cruciferousgreens/workout-app/issues/452): exercise ball, foam roll(er), and "other" equipment are now weight-optional like bodyweight/bands.

## v1.689 (2026-09-14)
- fix [#368](https://github.com/cruciferousgreens/workout-app/issues/368): Settings → Import now accepts an app backup (`.json`) alongside CSV/MacroFactor. Picking a backup validates it strictly first — anything that isn't the app's own backup format is rejected and nothing changes — then shows what's in it and asks twice before replacing all current data with the backup (wholesale replace; removals propagate to sync).

## v1.688 (2026-09-14)
- (user): on the getting-started screen, a live draft replaces the Blank-workout starter card with the Workout-in-progress card (same green card; the standalone card below is hidden so it doesn't show twice).
- (user): the Continue-program quick jump moved out of the Active program card to the top of Home (below the week strip).
- fix [#448](https://github.com/cruciferousgreens/workout-app/issues/448): filed — reorder dialog should use one up/down arrow pair per superset group (v1.8).
- fix [#449](https://github.com/cruciferousgreens/workout-app/issues/449): filed — "Set up your first program" card on the empty-data screen (v1.8).

## v1.687 (2026-09-14)
- fix: the Home "Workout in progress" card shows the program line again ("Program · Workout"), identical to the Workout tab. Root cause: Home gated the line on a `getActiveProgram()` helper that no longer exists, so it silently never rendered. Both pages now share one `draftProgramLine` resolver (the draft's own program, via `findProgramById`).

## v1.686 (2026-09-14)
- (user): the Workout-in-progress card is the green continue card again — identical on Home and the Workout start screen, with the program line for program workouts. (v1.684 briefly put the wrong rose card on both pages; v1.683 had it right.)

## v1.685 (2026-09-14)
- #447 (user): the "+" buttons on the Past sessions tab of the "add saved workout to program" dialog actually add the workout now — they were passing the exercises array to a helper that expects the whole workout, so every tap silently threw and added nothing.

## v1.684 (2026-09-14)
- (user): the Workout-in-progress card is the prod rose card again — identical on Home and the Workout start screen, with the program line for program workouts. (v1.683 briefly put the wrong green card on both pages.)

## v1.683 (2026-09-14)
- (user): the long-standing green "Workout in progress" card is back on both Home and the Workout start screen — the v1.679 unification had replaced the Workout tab's green card with the rose Home-style card. Both pages render the same shared card again (kicker, title, program line, set counts, arrow).

## v1.682 (2026-09-14)
- (user): the Home tab shows the classic Workout-in-progress card again — eyebrow, title, set counts, chevron, no program line. The Workout tab keeps the program line.

## v1.681 (2026-09-14)
- #446 (user): the shared link card no longer jumps up when it hydrates — it was vertically centered, so the short skeleton rendered centered while the taller real card snapped to the top. The card is now top-aligned and hydrates in place.

## v1.680 (2026-09-14)
- #444 (user): the superset dialog no longer has an "anchor" exercise — every exercise is an equal member of the group. The dialog now lists all exercises as toggles (the one it was opened from starts selected), and its title reads "Edit superset" when editing an existing group instead of always saying "Create a superset".

## v1.679 (2026-09-14)
- (user): Home and the Workout start screen now render the exact same "Workout in progress" card from one shared builder — the two had drifted (Home's X/N sets line never counted completed sets), so the counts disagreed between pages. The saved-workout draft card stays Workout-page-only.

## v1.678 (2026-09-14)
- #443 (user): the Home "Workout in progress" card now surfaces for any live draft, even an empty one — an untouched blank workout still counts as in progress.

## v1.677 (2026-09-14)
- #409 (user): fixed the layout jump on open — the Home At-a-glance body map's loading placeholder now reserves exactly the same box as the map itself, so the page no longer shifts when the map finishes loading.
- (user): the superset group outline is subtler — tighter box, muted label.
- (user): reordering now moves a whole superset as one block, so reordering can never split a group apart.
- (user): adding exercises to a superset no longer jumps the page — the exercise list re-renders once when the superset dialog closes, and the tapped row keeps focus instead of dropping it to the page.
- (user): tapping a completed set's field (e.g. adding weight to a bodyweight set after checking it off) now explains the set is complete and points at the set-number button to edit it, instead of silently doing nothing.

## v1.676 (2026-09-14)
- #438 (user): superset groups now render inside one subtle outline instead of a "Superset N" band on every exercise card — the outline carries a single "Superset N" label and one Edit superset button for the whole group, in both the live workout editor and the saved-workout builder. Create/Edit in Exercise options is unchanged.

## v1.675 (2026-09-14)
- (user): Home now shows a "Workout in progress" card whenever a live session is active — tap it to jump straight back into the workout.

## v1.671 (2026-09-14)
- (user): Home → At a glance now defaults to Week instead of Today (existing Today preference migrates once; a later deliberate Today choice is preserved).
- (user): signing in from the fresh-account Ready? hero now loads account data immediately — no manual refresh needed.

## v1.670 (2026-09-14)
- #437 (user): the Ready? hero now owns the whole Home screen on fresh accounts — the calendar strip and the dashboard cards below stay hidden until the first workout is logged. The Sign in button opens a sign-in modal (email/code, no trip to Settings) instead of routing to Settings.

## v1.669 (2026-09-14)
- #115 (user): superset creation moved off the exercise card into the Exercise options menu — Create/Edit superset now sits with the other exercise tools in both the live workout editor and the saved-workout builder.
- #170 (user): bodyweight stats — unweighted bodyweight work ranks and displays by sets in Volume mode (its volume is 0 and no longer vanishes from Top exercises); bodyweight with added load counts real volume and ranks like any weighted exercise.
- #351 (user): an update Refresh / future-version Reload now puts the user back on their workout-tab sub-screen — live editor draft, builder, saved-workout detail, or log list — instead of dropping to the Workout start screen.
- (user): fresh accounts see a "Ready?" hero at the top of Home — a Start-workout card in the same program-next styling as the Active-program quick jump, a Sign-in button while signed out, and a bold Getting-started link to the site guide.

## v1.668 (2026-09-14)
- #399 (user): warm-up ladder weights no longer anchor on a PR — the anchor is now the filled-in top set (heaviest entered weight on a working set), else the auto-filled suggestion target; with neither, the ladder rows come out blank but editable instead of percentages off last session's heaviest set.
- #237 (user): progression ghosts never land on warmup-tagged sets — tapping a suggestion fills only working sets; warm-up rows keep their own ladder placeholders, so completing a warmup set untouched logs the warmup weight, not the working weight.

## v1.667 (2026-09-14)
- #436 (user): the Home tab's Active program quick-start is now the same program-next card as the Workout tab's program button (CONTINUE PROGRAM kicker, workout title, week · exercises · range meta, chevron) instead of the solid-green pill; the #417 outline ring is retired.

## v1.666 (2026-09-14)
- #217 (user): Back from a live workout started via a shared link now returns to the shared link landing instead of the Workout start screen — the landing is stashed when the session starts and restored on Back (chevron or system Back); a Workout-tab tap still goes home, and finishing or discarding the workout clears the return.

## v1.665 (2026-09-14)
- #375 (user): first pass of the middle-dot audit — dot-joined meta strings now use chips or own-line text where the dot read as clutter: the program cover's range renders as two chips ("Hypertrophy" + "6–12 reps"), saved-program cards show "N weeks" / "N workouts" pills, archived programs put the date on its own muted line, empty program workouts show "Empty shell" with the "tap to add exercises" hint below it, and the dashboard program card and log summaries use commas instead of three-fact dot chains.
- #244 (user): the "never x" absolutes in Settings are rewritten in plain language — the warm-up note now reads "It only appears when you tap the button, and warmup sets count toward volume like any other set", and the set-tags note reads "Tags are just labels — they don't hide sets from history or stats". No other never/always absolutes remain in UI copy.

## v1.664 (2026-09-14)
- #212 (user): on the shared-workout landing, the descriptive action buttons ("Add to my library" pill + "or start the workout" link + note) now sit directly under the workout title and meta chips — above "Muscles worked" — instead of at the bottom of the page. The header icons are unchanged, and program landings keep the footer treatment.

## v1.663 (2026-09-14)
- #434 (agent): finishing a program workout still lands on the completed log, but Back from that log now returns to the Program page instead of the Workout tab — the program context survives the finish.
- #435 (agent): the one-day progress-chart copy now states the real threshold — "Log a session on another day…" — since same-day sessions aggregate to one point per day.

## v1.662 (2026-09-14)
- #387 (user): if +2 reps would overshoot the range top, advance the load instead of prescribing reps outside the range.

## v1.661 (2026-09-14)
- #387 (user): rep progression jumps at least 2 reps instead of a token +1.

## v1.660 (2026-09-14)
- #108 (agent): the program setup's RPE trigger is now the same 7/8/9 square-box row as Settings (the inconsistent spinbutton is gone). The time-step pills stay circular per the user's #316 "pills stay pills" call — the remaining square-vs-circle tension is parked for his decision.
- #116 (agent): the edit-superset flow is now covered by regression tests — grouping two exercises, adding a third, removing a partner (down to one clears the group), and reorder survival.

## v1.659 (2026-09-14)
- #433 (user): Back from a drilled-in program workout now returns to the program page instead of dropping to the Workout tab. Same fix class applied to exercise detail: Back from an exercise opened mid-workout (live editor, builder, saved workout) restores that screen instead of the start screen.

## v1.658 (2026-09-14)
- #349 (user): the program-workout page and the share landing card now use the same chip summary as the saved-workout detail header ("N exercises", "M sets" / "N workouts" pills) instead of the old "N exercises · M sets" text line; custom exercises get their own chip, and the loading skeleton mirrors the chips.

## v1.657 (2026-09-14)
- #106 (agent): set-row controls are no longer announced twice by screen readers — the swipe-delete rail starts hidden from assistive tech and joins the accessibility tree only while its row is swiped open; the inline × covers the closed state (workout editor, builder, and card rows).

## v1.656 (2026-09-14)
- #432 (user): the shared-program Share is now the standard Share button used elsewhere in the app, instead of a bare icon.
- #433 (user): workouts on the shared-program page are tappable — tapping one opens it as the standard shared-workout card, with a back chevron (and system Back) returning to the program list.

## v1.655 (2026-09-13)
- #432 (user): shared programs get a Start button at the top, with a Share icon on its left. With no active program, Start sets the shared program active directly; with an active program, a modal offers "Set as active program" or "Save to library" (× closes it), and setting it active asks are-you-sure first — confirming archives the current program to your archive instead of deleting it.

## v1.654 (2026-09-13)
- #430 (user): suggestion cards now honor the per-dumbbell display mode like the set cards do — a dumbbell suggestion shows the per-dumbbell weight (55 lb, not the 110 lb combined total).
- #431 (user): opening a program workout no longer shows suggestions for the wrong focus — the program week's range now governs the draft from the start, so the suggestion cards match the workout-focus pill immediately instead of only after re-tapping it.
- Settings → About has a "Report a bug" link next to the version info, opening the beta page.

## v1.653 (2026-09-13)
- #424 (user): the RECOMMENDED badge on the "What should we keep?" sign-in dialog now follows account-data logic — a minimal account recommends "Keep both" instead of "Use account data", and "Use this device" is never the recommended option.
- #423 (user): Settings → account has an Edit email button — the new address is validated and sent through the standard Supabase email-change flow (confirmation link to the new address; the change completes when it is tapped).

## v1.652 (2026-09-13)
- #428 (user): the week-range e1RM rebase no longer mints 1-rep max-test cards — the load was computed for the range's rep target, so the card now prescribes those same reps (110x10 → 130x5 instead of 130x1).
- #429 (user): when a suggestion's headline change is a load increase, the chip reads "Load +" instead of burying the jump under "New range"/"Week range".

## v1.651 (2026-09-13)
- #240 (user): a completed log saved as a template IS a saved workout — the completed-log detail now shows the Share icon next to Start once a template exists for it (immediately after tapping "Save as template", and on re-render). Plain logs still have no Share.

## v1.650 (2026-09-13)
- #410 (user): the Settings → Units "Per dumbbell"/"Total" pills shipped without any pill styling — they rendered as unstyled gray buttons with no visible selected state, so taps looked dead. They now share the standard pill look and show the selected state like the other Units rows.

## v1.649 (2026-09-13)
- #338 (user): fixed a crash that broke the workout picker — rendering a program-workout card referenced `swipeOn` before its declaration, throwing "Cannot access 'swipeOn' before initialization"; this single error broke starting a workout from a program, the program + button, and adding exercises.
- #240 (user): Share stays on saved workouts only — the Share button added to the completed-log view in v1.648 is removed per his correction.

## v1.648 (2026-09-13)
- #420 (user): the %1RM wave section now sits directly below the "Vary % of 1RM by week" toggle; while the wave default is on, Auto Deload is forced off and its toggle is disabled and dimmed (it re-enables when the wave goes off, staying off until the user turns it back on).
- #411 (user): opening an existing workout with no saved focus now falls back to a default pill — program workouts use the program's current-week default (then the program default), everything else uses the app Settings default.
- #240 (user): the completed workout view has a Share button next to Start, using the same share flow as saved workouts.
- #410 (user): dumbbell weight entry can be per-dumbbell (new default) or total, set in Settings → Units and overridable per exercise in Exercise options; stored weight stays total combined, so volume and estimated 1RM are unchanged, and PRs/heaviest set/projected 1RM/history render in the chosen mode.

## v1.647 (2026-09-13)
- #415 (user): the Recommended pill now carries an inline white color on the badge element itself — bulletproof even if a cached older stylesheet is in play.

## v1.646 (2026-09-13)
- #420 (user): the Settings wave section now only displays when the "Vary % of 1RM by week" default is toggled on in Settings — flipping the default shows/hides it immediately.

## v1.645 (2026-09-13)
- #415 (user): the Recommended pill text is finally white — the real cause was a higher-specificity `.choice-option span` rule overriding the badge rule, fixed with a stronger selector plus `!important`.
- #420 (user): discarding the program editor now drops the draft, so a toggled-on %1RM wave can't leak into the next new program when the Settings default is off.
- #235 (user): opening a share link over a saved workout (or the logs list, or the saved builder) no longer strands you — the landing suppresses those screens instead of wiping them, so dismissing it takes you right back to where you were, not "Saved workout not found."

## v1.644 (2026-09-13)
- #415 (user): the Recommended pill text is now plain white.
- #417 (user): the highlight ring moved off the Workout tab program button and onto the Home page workout quick-start button.
- #420 (user): Settings → progression defaults has a new "Vary % of 1RM by week" default toggle, mirroring the vary-rep-ranges default — new programs inherit it.

## v1.643 (2026-09-13)
- #415 (user): the Recommended pill text now uses the theme page-background color on the darkened accent wash — legible in every theme including dark mode.
- #415/#424 (user): the sign-in conflict dialog now recommends based on your account data — full accounts recommend "Use account data", smaller accounts recommend "Keep both", the cloud option hides entirely when the account has no saved workouts, and "Use this device" is never recommended. Choosing "Use account data" now truly replaces everything local, including saved programs, and can't leave the editor pointing at a wiped workout.
- #417 (user): the Workout tab program button keeps its lighter accent highlight ring but drops the outer glow shadow.
- #420 (user): program-form toggles no longer pretend to save live state — the discard-changes dialog now offers a real "Save changes" action instead of only Keep editing / Discard.
- #425 (user): signing out resets the post-workout sign-in reminder, and Settings → Data has a toggle to re-enable it after "Don't show again".
- #414: a saved-data blob from a newer app build is no longer quarantined as corrupt — the app forces a service-worker update check and prompts you to reload into the newer build instead. Local saves are held (never overwritten) until the reload, and the blob is left untouched. Older blobs run the migration pipeline; only unreadable data is quarantined.

## v1.641 (2026-09-13)
- #415 (user): the Recommended pill now uses explicit white text on a darkened accent wash (Rosé Pine was 4.04:1 — too low for small caps) plus a soft text shadow, so it stays legible in every theme.
- #415 (user): the destructive "are you sure" confirmation's Back button is now smallish bold link text reading "Nevermind, don't sign in." below the destructive button — same behavior, clearer presentation.
- #417 (user): removed the Workout tab program card's outer drop-shadow glow — "halo" means the wrap's lighter accent wash/outline, which is kept, so the Workout card now matches the Home card exactly (the wrap keeps margin:0; Home's negative margins would break the start-options grid).
- #420 (user): the Settings weekly %1RM section now renders for any active %1RM program even when its weekly percentages were never persisted — the arrays are normalized before the visibility check instead of hiding the section.
- #425 (user): the post-workout sign-in reminder now shows reliably after every signed-out finish — the single synchronous showModal() in a silent try/catch could fail transiently and swallow the nudge; it now retries once after paint when the first show doesn't stick. No completed-workout count gate.
- #426 (user): Settings' "Sign in to back them up" no longer opens the empty account summary dialog — it focuses Settings' own inline sign-in form, the normal populated sign-in flow.
- #427 (user): fixed false "can't reach the network" sign-in errors — a single failed Supabase CDN import latched permanently, so every later tap misreported on a healthy connection; an explicit sign-in tap now retries the import. Network failures also no longer start the email cooldown, and the sign-in error state now has an immediate "Resend code" button with no navigation (Settings and the post-workout nudge; the share modal's "Email me a code" button already re-sends in place).

## v1.640 (2026-09-13)
- #422 (user): first-time signup no longer sees the "What should we keep?" dialog — an account created within the last minute skips straight to uploading local data, same as the remote-empty path. Returning sign-ins are unchanged.
- #417 (user): the Workout tab's Continue-program card now carries the same glowing halo as the Home Active-program card — an accent-tinted outer glow on the card wrap (the negative-margin extension Home uses would break the start-options grid). Follows the theme accent.
- #420 (user): the active program's weekly %1RM wave is now visible in Settings → progression defaults — read-only rows in the same pretty design as the program builder, with an "Edit in program" button. Hidden when there is no active %1RM program.

## v1.639 (2026-09-13)
- #415 (user): "What should we keep?" cleanup — the Recommended pill is now readable and sits badge-style on the option's top-right border edge; "Not now" is gone (forced choice between the three data options, Esc blocked); choosing "Use this device" opens an "are you sure" screen first (it overwrites account data) with the other two options offered again plus an explicit "Yes, I'm sure" confirm and an easy Back.
- #419 (user): redesigned the create-program commit area — the length/start-week guidance now lives inline under each field, and the button sits in a natural-width actions row instead of a full-width blob under a text wall. Validation behavior unchanged.

## v1.638 (2026-09-13)
- #252 (user): reverted — the completed-workout view's top-row Edit button was unwanted; Edit is back at the bottom next to Delete, where it used to be.
- #274 (user): suggestions and exercise-history "latest" now key off most-recently-DONE (workout date), not most-recently-logged — a backfilled past-date session no longer hijacks the suggestion basis.
- #338 (user): saved-workout function parity — the program workout detail page gains Duplicate (copy the shell inside the program) and Archive (promote to a saved workout, remove from the program); program cards in the unified saved-workout list get the same swipe-delete rail / inline x as saved-workout rows.
- #286 (user): fixed the v1.637 regression that gated the post-workout sign-in nudge on 20+ logged workouts — the modal fires after every signed-out finish again; the separate 20+ nudge is dropped; the Settings backup line moves to the top of Settings, under the sign-in section.
- #415 (user): the "What should we keep?" dialog now leads with "Use account data" (renamed from "Use cloud data"), visually recommended with an accent border and Recommended pill, separated from the destructive choices by an "or" hairline.
- #416 (user): trimmed the duplicative copy on the Workout tab's Active Program card — the title is just the workout name (the kicker already says "Continue program").
- #417 (user): the Workout tab's program quick-jump card gets the same halo/glow as the Home card's Start button.
- #255 (user): reworked the weekly %1RM wave rows — range labels no longer ellipsize ("6..."); they stack under the week with room to wrap, beside the standard bordered inputs with focus rings.
- #418 (user): the exercise detail History card dropped the duplicative "3 logs" line — the count lives only in the "Show all 3 sessions · latest …" toggle label.

## v1.637 (2026-09-13)
- Storage: the workout blob now lives in IndexedDB (async writes, larger capacity, better write-failure events) instead of localStorage. One-time migration runs on first boot: the old blob is copied, read back byte-identical, and only then is the localStorage copy renamed to a backup kept until a later build removes it. If IndexedDB is unavailable the app keeps working on localStorage exactly as before.
- Storage: sync snapshots are now content hashes instead of full JSON — the sync metadata blob shrinks ~90%, and the first-sync adoption check only counts real data keys (workouts, templates, programs, custom exercises) instead of UI preferences.
- Storage: the signed-out backup nudge now fires for users with 20+ logged workouts, after finishing a workout or saving a template, with a "Don't show again" checkbox — plus a permanent backup line in Settings → Data while signed out.
- #178: fixed a crash when finishing an empty workout with the explicit "finish anyway" choice (a duplicate guard referenced a variable before its declaration).

## v1.636 (2026-09-13)
- #330 (user): logs opened from the Stats completed-workouts card now filter to the Stats tab's selected period instead of Home's last-selected range — same as the dashboard card.
- #333: the swap-exercise picker now shows similar exercises first (reusing the exercise similarity scorer), capped at eight, before favorites and recents.
- Removed the stale test pinning #259's reverted footer — the issue was closed per phone QA with the Add-as-saved-workout footer action dropped.

## v1.635 (2026-09-13)
- #254 (user): the Continue Program card border now follows the theme accent — pink under Rosé, instead of the hardcoded teal/blue.
- #252 (user): the completed-workout view has an Edit button in the title row (top, next to Start/Save as template); the bottom row keeps just Delete.
- #255 (user): the "Vary % of 1RM by week" rows use the standard input components — bordered inputs with focus rings, grid-aligned rows, ellipsized range labels.

## v1.634 (2026-09-13)
- #257 (user): archiving a program no longer hides its workouts from the saved-workouts list — program-only workouts are promoted to real saved workouts on archive (workouts already linked to a live saved workout are untouched).

## v1.633 (2026-09-13)
- #339: saved-workout builder set rows now swipe to delete, matching the live workout — the rail and the inline x share one removal path.

## v1.632 (2026-09-13)
- #412 (user): quiet routine sync — small background merges no longer toast. Feedback preserved for tapped Sync now (always, with "Up to date." when quiet), first-ever syncs, long-running cycles, and meaningful merges (a delete, or 4+ changed items); while a sync error is recent the error UI owns feedback. Merge convergence audited: the success path converges (dirty keys push, then pull sees matching timestamps).

## v1.631 (2026-09-13)
- #233 (user): Home Active Program card gains a quick jump into the next workout — a primary "Start <workout>" action beside Open program, shown only when no live draft exists.

## v1.630 (2026-09-13)
- Share links (user): opening a short link no longer dies on a single transient network/Supabase failure — the resolve retries once before giving up. Also single-flighted the Supabase client creation so concurrent boot callers stop spawning duplicate GoTrue clients (#228 console warning).

## v1.629 (2026-09-13)
- #91 (user): tightened the spacing in Settings → Units — the "Stats default metric" label and Volume/Sets pills now sit snug against the Pounds/Kilograms pill row so the two controls read as one group.
- #286 (user): restored the "Keep the workout I just finished" option on the sign-in step (a concurrent edit had moved it back to the nudge step).

## v1.628 (2026-09-13)
- #286 (user): the "Keep the workout I just finished" option moved from the nudge step to the sign-in step, next to the action it affects.

## v1.627 (2026-09-13)
- #286 (user): the post-workout sign-in nudge now signs you in right inside the dialog — email + code, no trip to Settings — and a checked-by-default "Keep the workout I just finished" option guarantees that workout survives the sign-in: even if you pick "Use cloud data" at the "What should we keep?" step, the just-finished workout is kept and synced up.
- Auth hardening: network failures while requesting or verifying a sign-in code could surface Safari's raw "Load failed" — every auth error message now translates network-type failures into "Can't reach the network — check your connection and try again."

## v1.626 (2026-09-13)
- #288 (user): signing in no longer silently discards this device's data when the account already has data — a "What should we keep?" dialog offers Keep both (merge, with a warning that duplicates may appear), Use cloud data (the old discard path), or Use this device (local wins). Dismissing it changes nothing, so a later sign-in asks again.
- #392 (user): the Program tab gets a "Saved programs" section above Archived — shared programs land there as cards (with a Shared badge) instead of auto-archiving, each with Start and Delete. Starting one makes it the active program; the previous active program archives as before.

## v1.625 (2026-09-13)
- #411 (user): a brand-new saved workout now opens with your Settings default focus pill already highlighted, and a brand-new program workout highlights the program's own default — the same default-focus behavior the live workout got in #95. Editing an existing workout keeps its saved focus, and tapping a highlighted pill still clears it.

## v1.624 (2026-09-13)
- #407 (user): opening an exercise from Stats (or a workout, or a program) now shows "Exercises" in the top bar — the title names the page you're on, not the tab you came from. Back still returns you to where you were.

## v1.623 (2026-09-13)
- #337 (user): tapping + on the program cover now opens the builder with an empty name field (the "Workout" placeholder) instead of the pre-filled "Workout N" — the auto name only sticks if you leave the field blank when saving. Discarding a never-saved new program workout also removes its empty shell from the program instead of leaving an orphan "Workout N" row.

## v1.622 (2026-09-13)
- #259 (user): reverted the live-workout footer to the production layout — the "Add as saved workout" footer action is gone and Finish is back to the primary button next to Discard. The v1.620 footer restyle didn't land.
- #307 (user): the Warm-up pill in the exercise card header now matches the info icon's 32px height, so the two sit level.

## v1.621 (2026-09-13)
- #208 (user): the saved-workout builder gets per-exercise rep-range pills — Strength · 1–5, Hypertrophy · 6–12, Endurance · 12–20, 15+, AMRAP — the same presets as program setup. Tapping one writes the range onto that exercise (sets retarget to the range floor); tapping it again clears back to fixed reps. The range rides with the template into the live workout as the target range, and suggestion cards respect it like program rep ranges. The Configure dialog stays for custom/time ranges.
- #165 (user): exercise progress charts now show one point per day — same-day sessions aggregate (best e1RM/heaviest/longest-hold of the day; volume sums the day) with plain date labels, so the "Sep 2 (2)" ordinals are gone. The history list below keeps its per-session entries.

## v1.620 (2026-09-13)
- #390 (user): the favorite star on exercise detail is bigger (30px) and aligned with the title's first line instead of floating small in the corner.
- #393 (user): the sign-out dialog's "Sign out" button now carries the primary-danger style, matching the delete-account dialog.
- #398 (user): flipping the reps-only toggle now uses the same surgical card swap as the Reps/Seconds toggle — no focus loss, no scroll jank.
- #401 (user): the Logs list now sorts by workout date — a backfilled entry sits by when the workout happened, not when it was saved; completedAt only breaks same-day ties. Home's recent-4 and repeat-last keep their recency order.
- #404 (user): deleting a saved workout keeps your scroll position instead of jumping.
- #259 (user): the live workout footer now stacks "Add as saved workout" under Discard, and Finish reads as bold text instead of a button. Tapping "Add as saved workout" saves the in-progress draft as a template without finishing the session.
- #280 (user): cardio exercises now default to time tracking — a conditioning movement opens on the Seconds segment, not Reps.
- #337 (user): a session started from a program workout now opens with a blank name (the "Workout" placeholder) — you name the session yourself.
- #231 (user): the saved-workout filter dialog gains a Shared toggle — shared templates can now be filtered alongside the In-a-program toggle; the filter badge count and Clear-all cover it.
- #383 (user): CSV, Hevy, and MacroFactor importers now canonicalize failure set tags to the renamed "Failure" tag.
- #258 (user): deleting a saved workout from its editor now lands back on the saved-workouts list section instead of the top of the Workouts page; deleting from the list itself keeps your scroll position.

## v1.619 (2026-09-13)
- #394 (user): range-change rebases now snap to 5 lb / 2.5 kg like the %1RM, deload, and warm-up prescriptions — 100 lb x 8 rebased into Strength 1–5 suggests 110 lb x 1 instead of 108.5 lb. The snap never drops below the lifter's current top set (7.5 lb x 12 into 15+ still suggests 7.5 lb x 15).

## v1.618 (2026-09-13)
- #402 (user): progression suggestions no longer auto-apply when a program workout starts — the banner now always shows tap-to-apply cards and each suggestion waits for the user to pick it, like the freeform flow. The program cover's "Auto-applied on start" tag is gone.

## v1.617 (2026-09-13)
- #395 (user): when the same-zone session can't produce a suggestion (e.g. its top set beat the RPE trigger) but newer history exists in another zone, the engine now rebases from the most recent log instead of going silent — the "not enough valid data" dead end with visible history is gone.
- #396 (user): adding warm-ups rebuilt the exercise card without re-attaching swipe listeners, freezing swipe-to-delete on every set of the exercise (the Reps/Seconds switch had the same hole) — the surgical card swap now re-wires swipe, plus the %1RM inputs and reps-only toggle it also rebuilds.
- #397 (user): the Warm-up pill now sits snug against the info icon at the right edge of the card header instead of floating mid-header wherever the title ends.

## v1.616 (2026-09-13)
- #395 (user): Exercise options now explains every silent hold — RPE above the trigger ("Latest top set was RPE 9 — above your RPE 8 trigger, so the app holds") and missing RPE, alongside the reps-only explanation.

## v1.615 (2026-09-13)
- #395 (user): "Increase reps only" is now a toggle under Exercise options (live workout + saved-workout builder), not just in the add-exercise picker — flipping it recomputes suggestions on the spot.

## v1.614 (2026-09-13)
- #395 (user): when "Increase reps only" suppresses a suggestion card, Exercise options now says why — "Increase reps only is on — past the top of 1–5 reps, the app holds your 70 lb top set" — instead of the generic "not enough valid data" copy.

## v1.613 (2026-09-13)
- #185 (user): warm-up header refinements — the Warm-up pill hides when the exercise card is collapsed; the info icon moved into the header row, in line with the title and the Warm-up pill (reverting the absolute corner-icon rule); the "Last …" chip sits a touch closer to the header.

## v1.612 (2026-09-13)
- #185 (user): the "Remove warm-ups" bulk control is gone from the live workout and the saved-workout builder — the Warm-up button simply hides while warm-up rows exist, and warm-up rows delete individually like any other set. The staggered insertion animation stays.
- Progression rebase (user): range-change suggestions now round to the 0.5-lb granularity every other suggestion uses — no more "7.7 lb" or "20.1 lb" targets (7.5×12 into 15+ suggests 7.5×15; 18×6 into 1–5 suggests 20×1). The rebase also respects "Increase reps only": with reps-only on, a range change holds the top set instead of prescribing a load increase.

## v1.611 (2026-09-13)
- #185 (user): warm-up refinements — the Warm-up control now sits in the exercise-card header left of the info icon and reads "Remove warm-ups" once rows exist; adding/removing rows animates subtly (260ms, staggered; skipped under prefers-reduced-motion) with no scroll jump (the card is replaced surgically in place); generated ladder values are ghost placeholders, not entered values — they commit only when a set is completed. Reps/Seconds switching uses the same surgical card replacement.
- #380 (user): progression suggestions now refresh when synced history arrives after a workout starts — starting a workout before the cloud sync lands no longer leaves exercise cards without their progression cards.
- #381 (user): range changes no longer regress the suggestion when the last top set is already inside the new range — 110×10 moving within 6–12 keeps double progression (110×11) instead of dropping to 110×6; genuine out-of-zone moves still rebase, and the rebase path now refuses lower loads or fewer reps at the same load.
- #329 (user): set-tag toggles no longer re-render the exercise list behind the open dialog — changes apply when the dialog closes, so the list stops jumping while tagging.
- #382 (user): banded exercises treat weight as optional, like bodyweight — the weight field shows "Optional" and completing a set doesn't demand a weight.
- #383 (user): the "To failure" set tag is now "Failure" — existing tagged sets in logs, templates, drafts, and programs are migrated.

## v1.61 (2026-09-13)
- #185 (user): manual warm-up ladder beta — a Warm-up button beside + Add set inserts the configured ladder (default 40%×5, 60%×3; optional 80%×2 third rung) once per exercise, pre-filled from the heaviest target in the exercise, last session's top set, or blank. Weights round to 5 lb (2.5 kg); timed exercises ladder seconds to 5 s. Warm-up sets carry the Warmup tag, count in volume/PRs/e1RM, never trigger progression suggestions, and never show suggestion ghosts. Settings → Warm-up sets edits the ladder. Also fixes a stray-backslash syntax error in app-bootstrap.js (shipped in the marathon batch) that broke script parsing on dev/main.

## v1.6 (2026-09-13)
- #307 (user): share-link cold open no longer flashes the empty home dashboard — the share boot is detected pre-paint, so the first paint already shows the loading skeleton with the Workout title and tab lit. No × during loading for anyone (v1.51).

## v1.51 (2026-09-13)
- #307 (user): no × on the share-link loading skeleton for anyone — signed-in included. If a resolve hangs, system Back exits via the pushed history entry.

## v1.50 (2026-09-13)
- #307 (user): the share-link landing no longer shows the weird "Loading…" intermediate page — it renders the real card layout immediately with shimmer skeleton placeholders (title, muscles, exercise rows, action buttons) that hydrate in place when the payload resolves.

## v1.49 (2026-09-13)
- (user): the two built-in StrongLifts 5×5 saved workouts (Workout A / Workout B) are deleted — the saved-workout list now shows only the user's own templates.

## v1.48 (2026-09-13)
- #336 (user): deleted saved workouts no longer come back — the cross-tab blob merge is now tombstone-aware, so a stale tab's autosave can't resurrect a just-deleted workout, log, or program (it used to, and the zombie then permanently defeated the sync tombstone).

## v1.47 (2026-09-13)
- #315 (pre-prod caution, resolved): the shared-workout-chip boot migration no longer collapses legacy names — "Leg Day (shared)" + "Leg Day (shared 2)" become "Leg Day" + "Leg Day (2)" instead of two "Leg Day"s. Version renumbered from 1.047 → 1.47 for the production push.

## v1.047 (2026-09-13)
- #317 (user): reverted the v1.046 checkbox-slide attempt — it didn't fix the report, so checkbox-start gestures are tap-only again (v1.045 behavior). The checkbox-origin swipe is filed as #331 for a later release. The ?swipediag=1 diagnostic overlay stays deleted.

## v1.046 (2026-09-13)
- #317 (user): a drag starting on the checkbox slides the row again like prod (v1.045 wrongly killed the visual slide; the rail still never opens from the checkbox — release snaps back to a tap, per the standing rule). Also deleted the ?swipediag=1 diagnostic overlay outright — it never worked on the phone.

## v1.045 (2026-09-13)
- #317 (user): swipe-to-delete fixed for real. Two frontend experts converged on the mechanism: the mid-gesture keyboard blur (v1.041's lock-time blur, v1.042's pointerdown blur) dismissed the keyboard, iOS resized the viewport mid-touch, and WebKit killed the gesture with pointercancel — and separately, iOS Safari's caret-drag recognizer reclaims horizontal drags that start on a focused input, which a PointerEvent preventDefault can't stop. The fix: no focus changes anywhere near the gesture, plus a non-passive touchmove claim layer that takes the gesture from WebKit the moment the swipe locks. Also tightened: the vertical-abort predicate (diagonal drifts no longer hijack the row), the rail now snaps fully open with animation, and a swipe ending over the rail can't instant-delete anymore.

## v1.044 (2026-09-13)
- #317 (user): REVERTED the v1.042 swipe changes — the touch-down keyboard dismiss and the pinned set number are gone, back to the v1.041 baseline. The v1.042 swipe work made things actively worse on the phone, so the keyboard-race theory is under re-evaluation by frontend experts before anything new ships. The swipe diagnostics (?swipediag=1) and the delete renumber guard stay.

## v1.043 (2026-09-13)
- #329 (user): toggling set tags no longer re-renders the exercise list behind the open tag dialog — the jumping/expanding animations are gone. Tag changes save immediately; the list does one catch-up render when the dialog closes. Same fix applied to the exercise-tag dialog.

## v1.042 (2026-09-13)
- #320 (user): the saved-workout detail header shows the summary as chips ("3 exercises", "9 sets", "Focus: Legs") instead of the old "N exercises · M sets" text line.
- #316 (user): the Settings numeric fields actually match the workout set-input styling now — a more-specific Settings override (48px/14px/12px) was silently winning over the v1.040 fix; it's corrected to 44px / 9px padding / radius-sm / raised surface.
- #317 (user): swipe-to-delete — the keyboard now dismisses the instant the finger touches down (touch only) instead of at horizontal lock, so iOS can't take the gesture over with its text-drag; taps still focus normally. The ?swipediag=1 diagnostic button works through the hash routes too. Also, the set number stays pinned at the left while the delete rail opens (it used to slide off with the row), and deleting a middle set renumbers the survivors.
- (user): workout set-input placeholders are back to the old 10px shrink on mobile.

## v1.041 (2026-09-13)
- (user): reverted the v1.039 all-caps set-row placeholders — back to "Weight", "Reps", "Seconds", "Optional" (the caps read too big). RPE stays uppercase.

## v1.040 (2026-09-13)
- #315 (user): shared workouts no longer carry "(shared)" in the name — they render a SHARED chip in the saved-workout list and detail header, matching the existing Built-in/Program badges. Existing "(shared)" names are migrated to the chip.
- #316 (user): Settings numeric fields now match the workout set-input styling — 44px, radius-sm, raised surface, 16px text, theme-matched caret, accent border and focus ring. Pills, switches, and step controls are untouched.
- #317 (user): swipe-to-delete regression — the weight field wrapper is now a span instead of a label (iOS was swallowing the gesture when the swipe started on the label-wrapped field). A hidden gesture-event log (?swipediag=1) is available if the repro persists.

## v1.039 (2026-09-13)
- (user): the workout set-row fallback placeholders are now all caps — "WEIGHT", "REPS", "SECONDS", "OPTIONAL" — matching the existing "RPE" placeholder and the column headers.

## v1.038 (2026-09-13)
- (user): workout set-input placeholders now render at the same 16px size as entered values — the old 10px shrink on touch made hints like "100" and "RPE" unreadably tiny next to real text.
- (user): fixed the dead space under the home muscle map — the pre-hydration aspect-ratio reserve never released because `data-hydrated` was never set on inject; the host now hugs the SVG on every map (home, stats, exercise, workout).

## v1.037 (2026-09-13)
- #262 (user): the review-sets dialog is now two buttons — "Finish anyway" and "Keep editing". The copy reads "{N} sets are missing… Clicking Finish will delete your sets." The old middle "Delete N unfinished sets" button ran the identical operation and is gone.
- #305 (user): sign-out now kills the Supabase session even when the logout network call fails — it signs out with local scope (no network call) and the wipe removes any lingering sb-*-auth-token keys, so a dead session can no longer silently re-adopt the cloud copy after the reload.

## v1.036 (2026-09-13)
- #326 (user): after signing in inside the share dialog, the header now switches from "Sign in to share" to the regular share copy ("Share link" / "Send this shared workout with the link below.") instead of staying stuck on the signed-out text.

## v1.035 (2026-09-13)
- #322 (user): the set-count chips under the Stats muscle map are gone — the map stands alone.
- #323 (user): "Weight by muscle" is now "Volume by muscle" (it shows volume), and the volume option reads "Volume" — not "Weight" — on the muscle-map, by-muscle, and top-exercise toggles, plus the Settings default-tracking-metric pill.
- #324 (user): saved workouts get the same inline × delete as program rows when swipe-to-delete is off (desktop always), opening the same confirmation; hovering the × tints that part of the card the swipe-rail red.
- #318 refinement (user): the 1RM/Heaviest toggle now centers against the whole kicker+headline block instead of floating on the kicker row alone.
- #325 (user): the Workout tab no longer stays accent-colored while a session is live — it reads active only on its own page (the header Live chip remains the way back).

## v1.034 (2026-09-13)
- #321 (user): deloads are now an **Auto Deload toggle** — it sits at the bottom of the program setup screen and in Settings → progression defaults (new programs inherit it). Turning it on reveals the "every N weeks" and "deload intensity" fields; it's off by default, and existing programs that had a deload schedule keep it.

## v1.033 (2026-09-13)
- #314: exercise-add mode no longer shows the "Tap to add · N selected" hint — it's fully hidden so it leaves no empty space (swap mode keeps its "Tap an exercise to swap it in" hint); the tapped exercise row no longer jumps when the rule content changes.
- #318: the exercise chart's kicker/headline block sits higher, beside the 1RM/Heaviest toggle, with a hairline above the volume chart.
- #319: the muscle map gets its own independent Weight/Sets toggle (it used to follow the chart's), and "Volume" is now called "Weight" on the map, muscle, and top-exercise toggles.
- #244 revision (user): the share-link screen now reads "Send this shared workout with the link below." above the link, and Copy link is the first of the two centered buttons.

## v1.032 (2026-09-13)
Easy-win UX batch (user):
- #313: the top-bar "Workout" title is now always dead-center — the live-session dot used to sit in the layout flow and nudge the title left of center on the live workout screen.
- #308: the volume-per-session bar chart no longer shows the day ordinal ("Sep 2 (2)") — same plain session labels as the heaviest-set chart (#249).
- #309: the 1RM / Heaviest toggle now sits on the chart's own header line ("Estimated 1RM" / "Heaviest weight"), right-justified, instead of up in the section head.
- #310: saved-workout cards get their corners back — same iOS wrapper fix the program cards received.
- #311: the logs list count note shows just the count for the period ("7 sessions"), never "7 of 24 sessions".
- #312: adding a saved workout to a program no longer shows it twice in the saved list — the template card already carries the program chip, so the program copy doesn't render as a second card.

## v1.031 (2026-09-13)
Phone QA follow-ups:
- #254: the Continue-program card's shadow also follows the Rosé accent — the last element still glowing blue.
- #305: signing out now actually signs out — local workout data is wiped from the device (the cloud copy comes back on the next sign-in).
- #244: share modal per the user's pick — no copy on the share screen, no Done button (the × closes it), two centered buttons; the sign-in prompt reads "Sharing needs an account. It’s free to sign up."
- #232: the "clearing the search" link is now plain text (regular color, not bold, not underlined); clearing scrolls the list into view instead of jumping; filter "Clear all" drops the modal, then scrolls.
- #238: the filter dialog's PROGRAM chip row now has breathing room below the muscle chips.
- Signed-out share landings show a clean first-run header — just the Start button, no bookmark ribbon, no ×.
- #306: boot no longer pre-renders the Stats tab (it renders on first visit instead).
Fixes found in the v1.029 browser QA pass:
- #295: the program form's "% of 1RM" row no longer flashes visible on first load with RPE-based selected.
- #254: the Continue-program card's halo around the card also follows the Rosé accent (pink) under the Rosé theme.
- #301: the completed-workout summary card now reads "1 exercise" / "1 completed set" for a single exercise/set.
- #283: the exercise Configure dialog now rejects an inverted range (e.g. Min sec 90 / Max sec 60) with an error instead of saving it.

## v1.029 (2026-09-12)
Easy-win batch 2:
- #249: the heaviest-weight chart's labels no longer show the day ordinal in parentheses.
- #238: removed the duplicative Less/More heatmap legend.
- #254: the Continue-program card's border/glow follows the Rosé accent (pink) under the Rosé theme.
- #234: numeric set inputs have a light, theme-matched caret again.
- #232: "clearing the search" in the saved-workouts empty state is now a tappable link that clears the search and filters.
- #295: the program form's "% of 1RM" row and help text show only for the %1RM scheme; the saved percent value now loads into the field.
- #301: singular "1 set" in recent workouts (also fixed in muscle-stat pills, exercise stats, and the continue-workout card).
- #302: timed-only workout summaries show total time instead of a meaningless "total volume: 0 lb".
- #303: cold-opening a share link keeps the /s/<slug> deep link in the address bar.

## v1.028 (2026-09-12)
- #296: opening a shared workout link now lands directly on the share landing (with a loading state) instead of flashing the home tab first.
- #297: the share landing's header start control is a green Start button, not a bare play icon.

## v1.027 (2026-09-12)
Batch 1 of post-v1.1 fixes (14 small, safe changes):
- #269: the completed-workout view's Start button now asks first when a workout is in progress (it used to silently replace the live draft).
- #264: the share sign-in cooldown timer no longer leaks if the dialog is dismissed with Esc.
- #268: sets with no RPE recorded (legacy/imported) no longer trip the review-sets check — RPE is optional.
- #271: the saved-workouts empty state now names the real button ("Save as template on a completed workout").
- #272: deleting an exercise no longer leaves a stale superset tag behind.
- #273: Home's recent workouts are sorted by recency, matching the Logs list.
- #275: finishing an edit from the Logs list returns to the Logs list, not the Workout page.
- #283: time-based rules can't be saved with Min sec above Max sec anymore.
- #292: old sync delete-records are pruned after 90 days.
- #260: saved-workout rows can be swiped to delete (with the usual confirmation).
- #261: already in place — the saved-workout page has Share to the left of Start.
- #266: the PR toast fires once per exercise per workout, not once per set.
- #270: the inline set-delete × now asks for confirmation (the swipe delete stays instant).
- #285: suggestion cards no longer show a "0 sec" old target for exercises just flipped to time tracking.

## v1.026 (2026-09-12)
- #242 (corrected): a completed set's checkbox is tappable again — tapping it un-checks (uncompletes) the set. The set's other fields (weight, reps, RPE) stay frozen while it is complete.

## v1.025 (2026-09-12)
- #240: after "Save as template" on a completed workout, the completed view's button now becomes "Start" — it launches the new template right away, and reopening the workout still offers Start instead of saving another copy.
- #242: a completed set's checkbox is no longer tappable — it shows checked and disabled, and the set's inputs stay frozen. To deliberately edit a completed set, tap its set number: that un-checks the set and restores editing.
- #241: the PR toast now uses an opaque gold-tinted background so it stays readable over the app.
- #243: the "Sign in to share" helper note renders in muted text (it was picking up a red accent under the Rosé theme).
- Review sets (follow-up to #199; corrected per phone QA): the dialog always shows three actions when sets need review — primary "Finish anyway", secondary "Delete N unfinished sets" (with the count; deletes the unfinished sets and finishes in one tap), and "Keep editing" as the quiet text link last. The explanation copy is short and plain ("14 sets are missing reps, seconds, or weight.") with no dropped-sets lecture.
- #256: program sharing is temporarily removed — no Share action on the active program or program workouts (programs still can't mint short links). Workout sharing is unchanged.

## v1.024 (2026-09-12)
- #250: progression targets can no longer regress. When a rep-range change rebases the target from estimated 1RM, the suggested weight is floored at the lifter's current top set — a top set above the RPE trigger now yields no card instead of a lighter "New range" suggestion (e.g. 245x1 @ RPE 9 no longer suggests 224 lb).
- Settings → About: removed the "Release notes" link (user direction); version and Last-updated text stay.

## v1.023 (2026-09-12)
- #199: the "Review sets" dialog now explains the situation in a plain sentence ("8 sets are missing reps, seconds, or weight. Finish without them — they'll be dropped, nothing is saved half-filled — or keep editing.") and gives the actions a clear visual hierarchy: exactly one primary button (the recommended finish — the one that destroys nothing entered), the other finishing action as a secondary button, and "Keep editing" as a quiet text link. "Finish anyway" is flagged with danger styling whenever it would drop sets with user-entered values, and its label stays honest when empty sets are mixed in ("drop 3 sets", not "3 incomplete").
- #198: confirmed fixed — deleting a live-workout set no longer flashes, jumps the scroll, or changes exercise expansion (the v1.015 surgical-delete replaced the old full list rebuild; the user's report predated that fix). Added a regression test pinning the delete path so a full re-render can't sneak back in.
- #145 (live-workout variant): tapping "+ Add set" in a live workout no longer jumps the scroll. It was the same full-rebuild mechanism as the old #198 — the new set's row is now appended in place with identical markup and only the new row's listeners wired.

## v1.022 (2026-09-12)
- #211: link-preview metadata, static tier. Shared links now preview with the headline "Cruciferous Greens Workout — 800+ exercises, free forever" (matching the approved share-card copy) and the approved home share card image at an absolute prod URL; a `<meta name="description">` was added in sync with og:description. Per-share workout/program names still need a server piece — tracked separately for after prod.

## v1.021 (2026-09-12)
- #222: the Rosé theme works again. A leftover stray `}` from an earlier cleanup was silently killing the whole rose palette — tapping Rosé now turns the app's accents rose as intended.
- #218: live-workout set inputs now render their values bold in the exercise-name shade, and the blinking text caret is gone from the numeric weight/reps/RPE fields. Placeholders stay light.
- #224: the inline sign-in form in the "Sign in to share" modal has breathing room — the "Email me a code" / "Sign in" pills no longer sit jammed against the fields above them.
- #225: the share-info step now leads with "Copy link" (primary), then "Share…" with the share icon, then "Done" as a quiet single-line text link.
- #226: the "Share link copied." toast now appears above the share modal instead of hiding underneath it.

## v1.020 (2026-09-12)
- #215: the "Sign in to share" prompt is now a self-contained flow inside one modal — no more trip to Settings. "Sign in" is the first, primary button; tapping it reveals the sign-in form right in the modal (email field + "Email me a code", reusing the Settings card's magic-link/OTP logic), including the code step. Once signed in, the modal mints the share (server short link first, long-link fallback) and shows the link with Copy link / Share… / Done — all without leaving the modal. Dismissing early mints nothing; sign-in errors show inline with a retry.

## v1.019 (2026-09-12)
- #210: saved workouts can now tag sets. In the saved-workout editor, tapping a set number opens the tag popup (warmup, dropset, custom tags, etc.), tagged sets get the same accent as live workouts, tags persist with the template, and starting the workout carries them into the live sets. Deleting a global tag also removes it from saved templates.
- #211: link-preview metadata fixed (static). Homepage shares now preview with the "Cruciferous Greens" headline, the approved share card image, and a proper description on iMessage/X/etc. Dynamic per-share workout/program names still need a server piece — tracked separately.
- #212/#213/#214: share landings always open as a full page (no modal), even while a live workout draft is open — the draft stays intact underneath and is restored on dismiss. New layout per user feedback: compact bookmark (save) + play (start) icon buttons sit in the header next to the ×, one tap away without scrolling; the full descriptive buttons live at the bottom of the landing in the approved pattern — big primary pill + green text link + quiet grey note. Signed-in workout landing: "Add to my library" leads, "or start the workout" secondary; signed-out: "Start workout" leads, "or just save it to my library" secondary; program landing: "Add to my library" only, with a note that programs open per-workout. The corner primary pill is gone.
- #209 follow-up: the delete × on each set row in the saved-workout editor is now danger red (the actual control uses `.builder-x`, not the `.rule-remove` class pinned in v1.018).

## v1.018 (2026-09-12)
- #209: the delete × on each exercise in the saved-workout editor now renders in danger red (color + ring), matching the app's destructive-control convention. Visual only — behavior unchanged.

## v1.017 (2026-09-12)
- #206: the %1RM progression-defaults block in Settings no longer renders garbled — the notched-label CSS was catching every span inside a field, floating the inputs over truncated labels ("LT", "TY DEFAULT", "0 = NO SCHEDULED DELOADS."). The % of 1RM / deload rows now use the same clean label-above-input pattern as the other settings fields, and the notch rule only targets the label. The program-builder's %1RM rows got the same treatment.
- #206 follow-up: "Deload every N weeks" now explains itself — the help reads "E.g. 4 = every 4th week is a deload. 0 = off." (in Settings and the program builder).
- #207: sharing now requires an account. Tapping Share while signed out shows a short "Sign in to share" prompt (Sign in / Not now) instead of minting a link; the Sign in button lands on Settings → Account with the email field focused. Signed-in sharing is unchanged — server short link first, long link fallback. Recipient-side link opening is untouched.
- #207 drive-by: fixed a ReferenceError in the no-deflate share fallback — `SHARE_LEGACY_VERSION` is module-scoped inside share-codec.js and invisible to share.js, so the v1 path broke on browsers without CompressionStream. The version is now inline with a comment.
- Filed, not in this batch: #201 (hide the progress chart until 2+ sessions), #204 (exercise-history layout polish pass).

## v1.016 (2026-09-12)
- #205: in Settings → Progression defaults, tapping a Progression mode pill now shows only that mode's one-paragraph description (the old combined block described all three at once), and swapping descriptions no longer nudges the scroll position.

## v1.015 (2026-09-12)
- #197: saved-workout exercise rows are full-width and uniform — the detail rows no longer shrink-wrap to ragged widths.
- #198: deleting a set mid-workout no longer flashes, jumps the scroll, or changes exercise expansion — only the deleted row is removed; surviving sets are renumbered in place and everything else on the page is untouched.
- #199: the Review-sets dialog now always offers a way out — "Finish anyway" appears whenever any set is invalid (not just when all are empty) and says exactly what it drops; "Delete N empty sets" still only touches fully-empty sets, and exactly one dialog is ever shown. Partial values are dropped, never saved half-filled.
- #200: the exercise Progress card now shows an explicit "1RM | Heaviest" segmented toggle — the headline tap still flips the metric, but the control makes the toggle discoverable.
- #202: removed the "Notes" card from the exercise detail page (per-exercise notes inside workouts are untouched; it may return as a future feature).
- #203: "Similar exercises" now sits below "How to" on the exercise detail page.
- #177 follow-up: any `/s/<segment>` route — malformed, unknown, or corrupt — now shows the friendly invalid-link message instead of silently opening Home.
- Filed, not in this batch: #201 (hide the progress chart until 2+ sessions), #204 (exercise-history layout polish pass).

## v1.014 (2026-09-12)
- Server short links for shares (#177): when signed in, sharing a workout or program now mints a short `https://app.cruciferousgreens.com/s/<slug>` link backed by a new `share_links` table (the SQL migration ships in `supabase/migrations/` and is run separately); signed-out sharing — and any failure — keeps the existing long links, so sharing never breaks. Opening a short link decodes through the same v2 path and lands on the same share preview, and a `404.html` fallback makes `/s/<slug>` work on static hosting.

## v1.013 (2026-09-12)
- New app icon (user-approved): the Ballpark-style icon — diagonal mowed-grass stripes, white banner, cream medallion with the leafy-green mark and a BETA ribbon — now serves as the app icon, apple-touch-icon, and browser favicon (192/512/180 px generated from the approved artwork).
- New home link share card (user-approved): shared links now preview with the branded home card — "Cruciferous Greens · Workout Tracker" with the 800+ exercises / FREE-forever tiles and the anatomical muscle heat map — via absolute prod URLs.

## v1.012 (2026-09-12)
- #187: the logs list now opens over a live workout — the draft keeps running untouched underneath, and backing out (chevron or the Live chip) returns to the editor with the draft intact. Bottom-tab taps still land on the start screen with the Continue card.
- #192: adding an exercise mid-workout no longer snaps the viewport to the new card — the picker restores the exact scroll position from when it opened.
- #194: bodyweight work now lights the muscle map — muscles with no dedicated SVG region (adductors, abductors, middle back, neck) map to the closest region, and blind spots no longer list muscles that got bodyweight sets.
- #195: the At-a-glance Workouts card is now tappable and opens the logs list filtered to the selected period.
- #196: workout home with no program — the "Next in program" card is gone; the blank-workout card becomes the highlighted hero card at the top, a "Create a program" card (›) takes its old slot, and the Repeat last card only appears once there's a completed workout.


## v1.011 (2026-09-12)
- Removed the chevron from the "Logs" top-bar title (user feedback: didn't fit the design and the title-tap is a shortcut, not navigation).


## v1.010

- **Deleting a workout from the logs list keeps you on the logs list** (#188).
  The delete confirmation used to drop you on the workout home screen no
  matter where you started; now it returns to the logs when you came from
  there. Deleting from anywhere else behaves as before.
- **One confirmation when finishing with empty sets** (#189). Tapping Finish
  with empty sets showed the Review-sets dialog, and choosing "Finish and
  delete empty sets" could pop the same dialog up a second time for the sets
  that were left. Now deleting the empties finishes directly when everything
  remaining has valid values — the dialog only reappears if a set still has
  genuinely missing values that need your eyes.

## v1.009

- **Completed sets freeze** — checking a set now locks its weight, reps,
  seconds, RPE, and tags. To change a value, un-check the set first; the
  checkbox and delete stay available. Applying set 1 to all no longer touches
  completed sets.

## v1.008

- **Account buttons fixed** — a build regression had left every account
  control (Email me a code, verify code, sign out, sync now) unwired; boot
  now starts sync again.
- **Cleaner Logs page** — the top header reads "Logs" and the duplicate
  "Workout logs" subheader is gone.
- **Shared links for new users** — opening a shared workout link without an
  account now shows a Start workout action in the corner instead of a dead-end
  ×; already-open links still pop the modal with the open-or-save choice.
- **Smarter workout imports** — generic names like Deadlift, Squat, Bench,
  and OHP map straight to their barbell exercises, and ambiguous names like
  Lateral Raise pick the first database variant instead of asking.
- **Linear progression confirmed** — it stays selectable per program and in
  Settings defaults; RPE double progression remains the default.
- **Quieter empty states** — shorter, friendlier placeholder text across
  Home, the library, saved workouts, exercise history, and programs.

## v1.007

- **Harmonized delete color** — the swipe-to-delete red is now mixed toward
  each theme's accent instead of a flat danger red, so it reads destructive
  without clashing with the theme.
- **Consistent buttons and labels** — buttons now follow three sanctioned
  styles (pill CTAs, 14px rounded dialog/tool buttons, toggles), and tiny
  labels across the app use exactly two sizes, so nothing looks off-scale.
- **Toasts sit higher** — success, error, and PR toasts now float clearly
  above the bottom tab bar instead of hugging it.
- **Bodyweight work lights the muscle map** — sets with no added weight now
  highlight their muscles on the Home and Stats maps (volume totals are
  unchanged; bodyweight volume stays out of the lb counts).
- **Share cards** — shared workout links now show a branded preview card when
  pasted into messages.
- **No more double dot** — tapping the "Live" chip no longer flashes two
  dots while the dot moves to the title.
- **Under-the-hood cleanup** — deleted ~120KB of unused exercise-image data
  and other dead code, shrinking the app.

## v1.006

- **Under-the-hood: code documentation** — every module in the app now carries
  a header describing what it owns and what it depends on, and the tricky
  parts (progression engine, sync merging, share links, imports) got inline
  explanations. There's also a new `docs/ARCHITECTURE.md` one-pager covering
  how the app is layered, how sync merging works, and how builds ship. Nothing
  looks different; this is for the humans who maintain the app.

## v1.005

- **Under-the-hood: automated tests** — the app now carries its own test
  suite (119 checks) covering workout math, progression suggestions, sync
  merging, share links, and data imports. Nothing looks different; it just
  means regressions get caught by the build before they can reach your phone.

## v1.004

- **Tighter copy everywhere** — helper text across the app says the same thing
  in fewer words: rep-range scope, PR empty states, import, share notes, set
  prompts, program session notes, and the delete-all confirm (now one sentence).
- **Error toasts are visible** — error messages now get the red treatment
  instead of looking like a regular toast.
- **Stat cards pluralize correctly** — "1 Workout" and "1 Set" instead of
  "1 Workouts" / "1 Sets".
- **Workout focus options match the RPE style** — square option boxes instead
  of pills, consistent with the RPE threshold picker.
- **The Log title shows it's tappable** — a chevron now marks the title button
  that jumps to the full workout log list.
- **Set rows can't overlap on phone** (#183) — the check + delete buttons get
  a full-width action column when swipe-delete is off, so they never collide.
- **Long exercise names stay on their card** — suggestion cards ellipsize the
  name instead of pushing the kind pill off-screen.
- **Dialog buttons in a consistent order** — safe action first, destructive
  action last (update prompt, focus confirm, review-sets).
- **Program cover shows the real session count** — no more hardcoded "three
  sessions per week".

## v1.003

- **Swap an exercise without losing your sets** (#142) — Exercise options now
  has "Swap exercise": pick a replacement from the library and the set
  structure (counts, entered values, tags) carries over. The new movement
  gets a fresh prescription and its progression suggestions re-run.
- **Finish anyway** (#178) — when every unfinished set is completely blank,
  the review dialog offers "Finish anyway": it drops the empty sets, finishes
  the workout, and marks the log "Finished with unlogged sets." It never
  appears when a set has partial values — those still need a fix, so nothing
  you typed can silently become empty.
- **Add past sessions to a program** (#64) — the add-workout dialog on a
  program now has Saved / Past sessions tabs. Pulling in a past session
  copies its exercises, set counts, rep/time ranges, and progression rules
  (last session's numbers become targets, the way "save as template" already
  worked).
- **Same-day sessions are distinguishable** (#165) — two sessions in one day
  now read "Sep 12" and "Sep 12 (2)" across charts, tooltips, and history.
- **Clearer dumbbell logging** (#146) — dumbbell exercises label the weight
  column TOTAL and show a live "per-hand × 2 = total" readout, so it's
  obvious the number is both dumbbells combined. Entered values are untouched.
- **Tapping exercises takes you somewhere** (#181) — exercise rows in saved
  workouts and program workouts now open the exercise detail page, and Back
  returns you to exactly where you were.
- **New muscles to pick** (#136) — rhomboids and front/side/rear delts (plus
  common aliases) are now selectable muscles for custom exercises, and the
  body heatmap lights up for them.
- **Favorites first in the exercise picker** (#144) — favorites lead the
  browse list, then recents, then everything else; search still ranks by
  relevance.
- **The picker tells you what to do** (#167) — a live hint under the picker
  title reads "Tap to add · N selected", or "Tap an exercise to swap it in"
  when swapping.
- **New exercises don't lose your place** (#143) — adding exercises
  mid-workout now lands you on the newly added card, expanded.
- **Saved workouts open in the right place** (#135) — opening a saved
  workout always lands on the Workout tab first, so the header and tab can
  never disagree about where you are.
- **Program save is explicit** (#173) — program setup says plainly that
  nothing saves until you tap save; the edit heading reads "Edit your active
  program."
- **No ghost suggestions while editing history** (#148) — progression
  suggestions and their explanations stay hidden while you're editing a past
  workout.
- **Share landing cleanup** (#179) — opening a shared link now says what
  happened, with one clear primary action instead of two competing buttons,
  and no dead space under the card.
- **Heatmap hugs its content** (#182) — the muscle heatmap no longer leaves
  a big empty gap before the legend.
- **Bigger delete targets on sets** (#94) — the inline set-delete button is
  now a real 44px tap target that can't overlap the complete checkbox.
- **Calmer card animation** (#88) — exercise cards still expand smoothly but
  collapse instantly; reduced-motion users get the instant toggle both ways.
- **Overflow fix** (#145) — action button rows now wrap instead of spilling
  off the phone screen.

## v1.002

- **Smarter workout imports** — when you import a spreadsheet of workouts,
  the app now recognizes more exercise names on its own (things like
  "Bicep curl" or "Deadlift" map to the right library exercise instead of
  asking you). Anything it isn't sure about, it still asks — and now you
  can point an unmatched exercise at an existing one from your library
  instead of only creating a new custom entry.
- **Skip really skips** — choosing "Skip" for an exercise during import now
  actually leaves it out, even when that exercise shows up in more than one
  workout in the file.

## v1.001

- **%1RM programming is back** — programs and exercises can run on percent
  of 1RM again: set a default percent per program (or per week with the
  optional weekly % wave), a training max per exercise, and each session's
  load is computed from the percent, snapped to plates. When no training
  max is entered, the engine uses your best estimated 1RM from same-zone
  top sets and says so.
- **Scheduled deloads** — programs can schedule a deload every N weeks at
  a chosen intensity, or flag individual weeks in the % wave panel. Deload
  weeks are marked on the program cover and the engine reduces the
  prescription instead of progressing it. The engine still never deloads
  on its own — only weeks you schedule.
- Share links now carry the %1RM settings (scheme, percent, training max)
  so a shared program keeps its programming.

## v1.000

- **Your numbers are right now** — a full pass over wrong-number bugs:
  metric autofill no longer shows pounds in a kilogram field; target RPE
  (what the plan calls for) is separated from the RPE you actually felt;
  bodyweight exercises count their sets properly in stats; same-day PRs and
  workout order work correctly; program weeks follow the calendar;
  imported exercises can't collide with existing ones; and share links are
  validated before they're opened.
- **Your data is safer** — if the phone can't save, the app now says so
  instead of failing silently; a corrupted save is quarantined with a
  recovery option instead of being overwritten; syncing two devices now
  resolves conflicts by recency (newest edit wins) and reports what
  actually happened; deleting a workout, template, or exercise on one
  device now deletes it on the other too; and "delete all data" really
  deletes everywhere.
- **Small annoyances fixed** — "Start a workout" works again after wiping
  data; exercise search puts exact matches first; helper text wraps;
  typing a weight no longer silently un-marks a completed set; the sticky
  header no longer covers buttons; the app explains why there's no
  progression suggestion; "Save as template" says what it means; and
  repeating a workout carries your last weight as a starting point.
- **Under the hood** — the sync engine and the app's internal structure
  were reworked so conflicts, deletions, and future features behave
  predictably. No visible changes from this part.

## v0.99ao

- **At a glance labels fit their cards** — the stat cards now read
  "Workouts", "Sets", and "Volume (lb)" on one line each. The longer
  labels overflowed the cards on phone widths; the meaning is unchanged.

## v0.99an

- **Share links are much shorter** — shared workouts and programs now
  travel in a compressed link (a typical workout link went from ~2,700
  characters to under 200), so they survive being texted. Opening a share
  link while the app is already open now pops it up over your current
  screen instead of yanking you away, and a broken link tells you it's
  broken instead of failing silently.
- **Exercise Progress headline is tappable** — tap the Estimated 1RM
  headline to flip it (and the line chart) to Heaviest weight per session;
  tap again to flip back. Your pick sticks while you browse exercises.
- **Program workout edit → Discard returns to that workout's page** —
  backing out of the builder (Discard or Back) lands on the program
  workout you came from, not the program cover or the Workout tab.
- **Editing a workout log opens the editor** — tapping Edit on a completed
  workout now actually opens it for editing. If a live workout is already
  in progress, the app asks first: editing replaces the current session.
- **Program workouts land on the log when finished** — completing a program
  workout now stays on the completed workout log, like every other workout,
  instead of jumping straight to the Program page.

## v0.99am

- **Shared workouts open full-screen** — opening a share link now shows the
  actual workout (exercises, sets, muscles) instead of a small dialog, with
  the actions right on it. **Start workout** is the primary button when
  you're signed out (no account needed); it saves the workout to your
  library too. The "Not now" button is gone.

## v0.99al

- **Hold weeks read right** — when the progression engine holds (top set over
  the RPE trigger, so no suggestion fires), set rows now ghost your latest top
  set (100 lb × 6) instead of the range minimum (100 × 1).
- **Saved-workout filters stick** — the muscle pills and "In a program" toggle
  on the saved list are remembered across reloads.

## v0.99ak

- **Program workout cards** — the chevron gets the same spacing as the
  saved-workout cards instead of sitting jammed against the card edge.

## v0.99aj

- **Program list stops jumping around** — adding a saved workout to a program
  keeps you on the program page (no more getting yanked into the added
  workout), and deleting a workout from the program list keeps your scroll
  position instead of jumping to the top.

## v0.99ai

- **Stat cards fixed** — tapping an abbreviated card (like "1M+") shows the
  exact total with the font shrinking to fit instead of cutting off; the
  number stays in line with the other cards and the label below never moves.
- **Share, repositioned and visible** — the Share button now sits next to
  Start at the top of saved workouts, and program workouts can be shared too
  (they're template-shaped, so they share the same way). Tapping Share shows
  the link itself with a copy button; the system sheet shares the bare link
  with no workout name prepended.
- **Quieter charts** — the left-axis numbers are gone (gridlines stay) and
  fewer date labels crowd the bottom.
- **Favorites lead the Exercises list** — favorites get their own section at
  the top, Recents follow after a hairline divider.

## v0.99ah

- **Hevy-style charts** — exercise charts are rebuilt: a fixed headline (value +
  date, like Hevy) updates in place when a point is tapped, so the chart never
  jumps; the phone-first plot fills the card with no dead bands; every
  gridline gets a labeled nice-number tick instead of the old max/min-only
  axis.
- **Tappable "Log" header** — on the log list and completed logs, the header
  title is a hidden button (looks identical) that jumps to the full log list.

## v0.99ag

- **Compact stat numbers** — the 3-card row stays 3-across at every width: huge
  totals abbreviate instead of bursting the card (volume shows "1M+" at a
  million, "250K+" style below that; sets show "10K+"). Tapping an abbreviated
  card reveals the true total in smaller text; tapping again restores it.

## v0.99af

- **Navigation state rebuild** — the three systematic defects are fixed: the
  Workout tab always lands home (no more resurrecting stale log lists or old
  completed reviews), workout sub-screens are mutually exclusive, and the
  in-app back chevron and the system/swipe back now agree with each other.
- **Logs are their own page** — the log list and completed logs no longer
  highlight the Workout tab; nothing highlights while a log is open.
- **Swipe back from a log** — opening a log pushes a page, so swiping back
  returns to the log list instead of skipping to the screen before it.
- **Program swipe-to-delete** — swiping a program workout row now opens its
  delete rail; previously every swipe died because the row's tap target
  covered it, leaving only the ×.
- **Tab press animation removed** — the split-second shrink on tab taps is
  gone; the highlight pill is the tap feedback.

## v0.99ae

- **Log navigation fixed** — tapping a workout in the log list opens it as its
  own page; the detail no longer renders inline under the list.
- **"Log" titles** — the log list and completed-workout views show "Log" in
  the top bar, not "Workout". Completed workouts are logs.
- **At-a-glance overflow** — on narrow screens the stat tiles go two-plus-one
  so a seven-digit lifetime volume fits its tile instead of bursting it.

## v0.99ad

- **Tappable exercise charts** — tap a dot on the 1RM line or a volume bar to
  see that session's date and value; tap again to dismiss.
- **Muscle map first:** on the exercise page the Muscles worked map now sits
  above the Progress charts.
- **Favorites float in search** — starred exercises rank above the rest when
  searching, in the Exercises tab and the workout builder picker.

## v0.99ac

- **Workout logs get period pills** — Today / Week / Month / Year / All time,
  matching Home and Stats — and the list now uses the same row layout as
  Home's Recent workouts. Search covers exercise names too.
- **Completed workout, one back button:** the extra in-page Back pill is gone —
  the top-bar chevron is the way back, and it returns to wherever you came
  from. The save button moved into the header next to the title, like the
  program page's Start button, and just says "Save".
- **Share links are visible:** sharing opens the system share sheet when
  available, otherwise a dialog shows the full link with Copy and Done.
- **Program cards:** deleting a workout no longer jumps the page, the divider
  before the × is subtler, and the "Swipe to delete" setting now covers
  program cards as well as sets.
- **Smoother tab switches:** the app now clears focus when changing tabs and
  reserves the body map's space before it loads, so async content can't shift
  the page.

## v0.99ab

- **"Upper back" is now a muscle option** everywhere muscles are picked —
  exercise library filter, workout builder, and custom exercises — and it
  lights the traps region on the anatomical body map.

## v0.99aa

- **Sync failures are actionable:** a failed sync no longer shows Safari's
  cryptic "TypeError: Load failed" — it says the network couldn't be reached,
  offers a "Try sync again" button, and retries once automatically.
- **Exercise history is collapsible and cleaner:** the History section on an
  exercise page starts collapsed (toggle shows the session count and latest
  date), and each set is one compact line — weight × reps with RPE/tags
  right-aligned.

## v0.99z

- **Share links (#32):** saved workouts and programs now have a Share button —
  copy a link and anyone opening it gets an import preview to add it to
  their library (custom exercises referenced by the share come along too).
- **Saved workouts are one filterable list:** search by name or exercise,
  plus a filter for primary muscles and program membership. Program
  workouts carry their program chip in the same list.
- **Program workouts get a visible delete button** on each card (swipe still
  works), and the card corners render correctly.
- **Workout logs:** the dashboard's Recent workouts card has a right-justified
  "See all", and the Stats tab's Completed workouts stat jumps to the full
  log list (now titled "Workout logs").

## v0.99y

- **Under-the-hood cleanup:** removed the dead legacy program exercise picker
  (program workouts use the shared saved-workout builder now), centralized
  navigation (tab taps always land home, Back restores context), and unified
  duplicate helpers for PR detection, muscle pills, and data wiping. No
  visible changes — this is reliability work ahead of v1.0.

## v0.99x

- **Import matching got much smarter:** obvious MacroFactor exercise matches
  now auto-resolve (59 of 113 names in testing, up from 7) — "Barbell Back
  Squat" → Barbell Squat, "Seated Neutral Grip Dumbbell Overhead Press" →
  Seated Dumbbell Press — while genuinely ambiguous names stay manual.
  MacroFactor's `∈ SS1` / `∈ C1` superset tags are stripped so they no
  longer break matching.
- **Import review hides perfect data:** auto-matched exercises collapse
  behind a per-workout "✓ N auto-matched" toggle, and the summary tells you
  exactly how many exercises need your review — no more scrolling past rows
  that need zero decisions.

## v0.99w

- **Start sits inline with the workout name:** on saved-workout and
  program-workout pages the big full-width button is gone — a compact "Start"
  pill sits top-right next to the name.
- **Reps/Seconds toggle fixed in the builder:** tapping Seconds now actually
  switches the exercise to seconds (it silently did nothing before) and no
  longer jumps the page.
- **Program "+" goes straight to the builder:** adding a workout to a program
  opens the workout editor immediately, with a dashed "Part of \<program\>"
  chip beside the Saved workout signifier.
- **Program workouts in the saved-workout list:** active-program workouts show
  under "From \<program\>" with a program-name chip, styled exactly like the
  saved-workout cards; tapping one opens its program-workout page.
- **Program chip on completed workouts:** Home (and history) rows for
  program-completed workouts show a Built-in-style chip with the program name.
- **Program workout cards fixed:** they now fill the row exactly like
  saved-workout cards (width bug from phone QA).
- **Program tab always lands on the program home:** tapping the tab clears
  any program-workout sub-page (a dirty program edit still asks first).

## v0.99v

- **Program edit gets a back button + discard-changes modal:** the title-bar
  chevron now shows while editing a program; backing out with unsaved edits
  asks first.
- **Program workouts look like saved workouts:** the list is now chevron cards
  (name, exercise count), and tapping one opens its own page — stats, muscle
  map, Start workout on top, Edit, delete — mirroring the saved-workout page.
- **One builder for everything:** Edit on a saved workout or a program workout
  opens the creation page in edit mode (pre-filled, saves in place). Exercise
  adds inside a program-workout edit default to the program's rep range.
- **Saved-workout page reworked:** Start workout moved to the top; bottom row
  is now Edit + Duplicate; Archive is a dashed button; built-in templates show
  Edit as disabled (duplicate one to customize it).
- **Dashed "+ Add saved workout" on the program page:** pulls an existing
  saved workout into the program as a new workout, copying its exercises.

## v0.99u

- **"No focus" pill removed:** tapping the selected focus pill again clears it,
  in the live editor and the saved-workout builder.
- **Plus buttons unified:** plain (non-green) circular buttons with a perfectly
  centered SVG plus, in the live editor, saved-workout builder, and program
  workouts.
- **Live chip → title dot:** tapping the "Live" pill flies its dot to a pulsing
  dot next to the Workout title (respecting reduced-motion); the Workout tab's
  duplicate dot badge is gone (tint kept).
- **Autosave note deleted:** the "Changes are saved on this device" line is
  gone — saving stays silent and instant.
- **Saved-workout builder finished:** focus actually applies, Configure opens a
  target-range dialog, Save workout persists and opens the saved page, supersets
  and reordering work through the same shared dialogs as the live editor, and
  options gain the progression summary, exercise tags, and Apply-set-1-to-all.
- **Saved-workout page enriched:** focus, set totals, muscle map + muscle pills,
  and a cleaner Start / Edit / Rename / Archive / delete button stack.
- **Exercise info Back fixed:** Back from an exercise opened inside the
  builder/editor/saved-workout page returns there, not to the workout start
  screen.

## v0.99t

- **"Live" chip placement fixed:** it now truly renders top-right next to the
  settings gear (v0.99s's cluster collapsed left), and its visibility refreshes
  on every tab switch and on opening Settings.

## v0.99s

- **Saved-workout builder rework:** the builder now mirrors the live editor
  exactly (same cards, set rows, notes, options — no checkboxes), marked with
  a "Saved workout" pill. Drafts autosave: backing out keeps the draft on a
  dashed "Saved workout draft" card; only Discard deletes it. "+ Add saved
  workout" with a draft open asks to keep or delete it.
- **"Live" chip** moved next to the settings gear (was top-left "Live workout").
- **Back buttons live in the title bar** on every workout sub-screen.

## v0.99r

- **Live-workout chip:** a pulsing "Live workout" chip in the top-left header
  appears whenever a session is live and you're not on the live editor page;
  tapping it jumps straight back into the session.

## v0.99q

- **MacroFactor .xlsx import fixed:** the spreadsheet reader could stall
  forever on "Reading spreadsheet…" in some browsers (it wrote all compressed
  data before reading any decompressed output, which some browsers never
  finish). It now reads and writes at the same time, with a timeout so a stall
  surfaces as an error instead of hanging.

## v0.99p

- **Saved-workout builder page:** the hero's "New saved workout" button is
  gone; a dashed "+ Add saved workout" under the saved list opens a full-page
  creator (name, focus pills, per-set targets, Discard / Save workout, no
  checkboxes). The saved list stays visible under the Continue card during a
  live session.
- **"Workout in progress" conflict is now one reusable modal,** now also guarding
  program-tab starts instead of silently overwriting.


## v0.99o

- **MacroFactor imports:** the importer (Settings → Data, and first-run
  onboarding) now accepts two MacroFactor formats. A MacroFactor
  program/workout spreadsheet (.xlsx) imports as **saved workouts** — rep
  ranges become progression targets, RIR becomes set RPE, warmup sets become
  Warmup tags. A MacroFactor **workout-history CSV** (one row per set)
  imports as completed history like Hevy exports do. The old "MacroFactor
  can't be imported" note only ever applied to their bulk data export.

## v0.9998

- **#93 fixed (the checkbox/red-rail bug):** tapping a set's checkbox no longer
  reveals the red delete rail behind it. Root cause was CSS, not gestures —
  `.log-set.is-complete { background: transparent; }` made checked rows
  see-through, exposing the rail underneath. Checked swipe rows now keep an
  opaque background. Also hardened the gesture code: checkbox clicks
  unconditionally clear swipe state, and checked rows refuse the drag.

## v0.91

- Swipe can now start anywhere on a set row, including the checkbox and
  set-number (user's explicit ask). The v0.89 exclusion that made those
  two tap-only turned out to be the actual blocker: the row is densely
  packed with no bare background, so the checkbox and set-number are the
  two most natural places to grab, and a deliberate swipe starting on
  either visibly did nothing — the lab proved the v0.90 gesture engine
  itself is sound from field starts. Tap vs swipe is still decided at
  release by travel (≥24px = swipe), so plain taps still check the box,
  focus fields, and open the set tag dialog. A swipe that starts on the
  set-number no longer ends in a click that pops the tag dialog open.

## v0.90

- Fixed swipe being 100% dead (lab-proven): the v0.86 keyboard-blur line
  referenced `isSetSwipe` inside the pointermove handler, but the variable
  was only declared inside the pointerdown handler — a ReferenceError on
  every swipe start killed the gesture before it began. Hoisted to per-item
  scope. Combined with v0.89's pointer-capture removal, swipes should now
  actually engage on iPhone. Note: red rails in screenshots taken before this
  fix came from a stale service-worker-cached copy on the phone, not from
  the shipped code — a true hard refresh is required.

## v0.89

- Fixed the real swipe-killer (user's "swiping not working at all"):
  removed the explicit `setPointerCapture` call entirely. On iOS Safari,
  WebKit yanks that capture back ~1ms later and fires `lostpointercapture`,
  which was canceling every swipe one event after the direction lock — and
  letting thumb-drift on taps pop the rail open. Touch already captures
  implicitly, so nothing was lost. The checkbox/set-number swipe-start
  exclusion is back (small controls + thumb drift = accidental rails), and
  the vertical-vs-horizontal decision waits for ~12px so slightly arcing
  swipes aren't killed in their first samples.

## v0.88

- Fixed the stuck-open rail (user's screenshot): tap-vs-swipe is now
  decided at release by actual finger travel (≥ 24px), not at the 7px
  direction lock. A tap with finger jitter can no longer pop the rail open
  or get it stuck open — the checkbox just checks, fields just focus, and a
  tap on an open row dismisses it. Deliberate swipes work from anywhere on
  the row, including starting on the checkbox.

## v0.87

- Tapping the set checkbox just checks the box now (user's screenshot):
  taps starting on the checkbox or set-number button can no longer drift
  into a swipe from finger jitter — those stay pure tap. Swipe still starts
  from the weight/reps/RPE fields and the rest of the row.

## v0.86

- Toolbar cleanup (user's screenshot): the reorder/add icon buttons were
  stretching into giant full-width pills on phones — they're compact and
  right-aligned again. The reorder button also hides when there's only one
  exercise (it did nothing there).
- Swipe now starts from anywhere on a set row, including the weight/reps/RPE
  fields (user's guess was right — the fields were swallowing every swipe).
  A tap still focuses the field; only a horizontal drag swipes, and the
  keyboard dismisses as the swipe locks.

## v0.85

- Re-reconciled: the main-chat agent's "bump 0.84" was pushed from the stale
  tree again and reverted the v0.84 merge. Restored the merged tree and kept
  their one real change since (dashboard scroll restoration now waits for the
  body-map SVG hydration).

## v0.84

- Reconciliation (user's call — their changes take precedence): merged the
  main-chat line's real work that stale-tree pushes had been dropping — the
  at-a-glance period-tab scroll fix, the progression summary under Exercise
  options, and the hairline separator above Remove exercise — on top of the
  v0.83 swipe/checkbox/scroll work, which is all intact.

## v0.83

- Fixed the "stuck open" delete rails (user's screenshot): the red action
  sits behind the row, and set rows are transparent — so the red bled through
  and every row looked half-swiped. Rows are opaque now, only one rail can be
  open at a time, and tapping an open row dismisses its rail.
- Merged the other agent's in-flight work (their push was built from a stale
  tree and had reverted v0.81–v0.83): %1RM loads snap to 5 lb plates, AMRAP
  suggestion cards, and a reorder-exercises modal (up/down arrows) in the
  workout toolbar.

## v0.82

- Fixed the sideways page scroll on mobile (user's "major issue"): the root
  touch rule explicitly allowed horizontal panning (`pan-x pan-y`); it's now
  vertical-only. Nothing in the app needs horizontal page panning, and the
  set-row swipe is JS-driven with its own touch rule, so it keeps working.

## v0.81

- Set rows: the complete toggle is an open checkbox now (user's Strong
  inspiration) instead of the check-circle, and the input fields are wider —
  the old 93px action column left dead space on the right.
- Swipe-to-delete redo (user's feedback + Strong inspiration): only the
  trailing 72px end is red now — the row slides left over it, iOS-Mail style.
  The delete affordance is an icon-only minus-circle, no text.
- Swipe gesture fixes: pointer capture now engages only after horizontal
  intent is locked (vertical page scroll stays native and never fights the
  row), and tapping anywhere outside an open row closes it — no more stuck
  rails.
- Home Screen app note (user's status-bar report): iOS caches the system
  status-bar tint at launch, so Settings → Appearance now notes that the
  status bar tint refreshes after closing and reopening the app.

## v0.80

- Exercise cards are no longer swipe-to-delete — only set rows swipe (user).
  Removing an exercise still goes through the "Remove exercise" button.
- Sticky-hover fix (user): on touch devices, `:hover` styles that matched the
  selected look no longer stick after a tap (exercise picker, suggestion cards,
  period options, calendar). Hover styling now only applies on hover-capable
  devices.

## v0.79

- Swipe to delete sets (user): on touch devices, swipe a set row left to
  reveal Delete. New Settings → Appearance toggle (on by default), saved to
  the account and synced across devices. Desktop keeps the × button.

## v0.78

- Removed the Liquid Glass theme (user's call — parked as
  [workout-app#78](https://github.com/cruciferousgreens/workout-app/issues/78)
  for maybe-later). Header refinements from v0.76 re-applied on the latest
  tree: 22px page titles, chevron-only back button.

## v0.76

- Header refinement (user's pick, mockup C): page titles 22px, and the
  back button is now just a chevron — same 44px footprint as the gear, so
  the bar is symmetrical.

## v0.75

- The iOS status-bar strip now wears the top bar's background (white in
  light mode) instead of the cream page background, and page titles in the
  top bar are a touch bigger (17px → 20px).

## v0.74

- The no-zoom / no-scrollbar treatment now covers mobile browser tabs too,
  not just the installed app — the line is touch vs. desktop
  (`pointer: coarse`), so desktop stays exactly as it is.

## v0.73

- The installed iPhone app also hides its scrollbars now, and the
  no-pinch-zoom lock is scoped to the installed app only — desktop and
  in-browser tabs are completely unaffected.

## v0.72

- The iPhone home-screen app no longer pinch-zooms by accident — it stays
  at app scale like a native app.

## v0.71

- Sign in with a code from the email, not just the magic link — the
  code is the reliable way into the iPhone home-screen app, whose storage
  iOS keeps separate from Safari. The link still works as before, and the
  email now leads with the code.

## v0.7

- Settings → About has a "Check for updates" button, and the app now checks
  for new versions on its own when foregrounded — no more stale builds stuck
  on your phone. An "Update ready" prompt offers Refresh now / Later, and
  never interrupts a live workout.

## v0.5 — Accounts & sync (in testing)

- Sign in with a magic link; workouts sync across devices.
- Editable display name on the account. Everything is still free.

## v0.6

- Public beta begins: the accounts build takes over app.cruciferousgreens.com
  (production). Plus is free for everyone during the beta.

## v0.56

- Settings → Account: breathing room between the email field and the
  "Email me a sign-in link" button.

## v0.55

- Exercise detail page shows the exercise name as the page title again (it
  was hidden along with the old breadcrumb header).

## v0.54

- Card icons are consistent: the workout exercise card's info button moved to
  the top-right corner, matching the library card's star.

## v0.53

- "This week." now sits right under the week dates in the calendar header,
  between the arrows, instead of below the day chips.

## v0.52

- Exercise detail header no longer shows a breadcrumb — just the parent
  page name; the exercise name lives in the detail body.
- Blind spots are now a proper section: divider, "Blind spots" label, pills.

## v0.51

- Scroll state: the Workout tab's start screen, live editor, and completed
  review each remember their own scroll position; starting or finishing a
  workout always lands at the top, with no visible jump.
- Workout Focus pills now ask before replacing rep ranges set per exercise.
- The Workout tab's continue-program card shows the workout's actual rep
  range(s) instead of the program default.
- Finish-review delete only removes fully-empty sets (never sets with
  partial values).
- Program Progression rules restyled to match Settings → Progression
  defaults (default rep range moved inside, same notch-field styling).

## v0.50

- Exercise picker: the top rules section only shows exercises added during
  that picker opening; the All list still shows everything (in-workout
  exercises marked ✓, tap to remove).
- Program cover: tighter header, no focus note, compact Edit program button;
  Workouts get an inline + button (auto-named Workout 1, 2, …) instead of the
  name field + Add workout button.
- Settings → About shows the app version and a "Last updated" build stamp.
- Undulating weekly range pills use bare ranges (1–5, 6–12, 12–20, 15+, AMRAP).
- The progression card hides entirely when there are no suggestions.

## v0.49

- New navigation: five fixed tabs, settings behind the top-right gear.
- Color themes (Cruciferous plus Catppuccin and Rosé Pine flavors).
- Progression engine: tap-to-apply suggestion cards, per-program defaults,
  stall detector, time-based progression, AMRAP support.
- Opt-in sample data, StrongLifts 5×5 template, anatomical body map.
