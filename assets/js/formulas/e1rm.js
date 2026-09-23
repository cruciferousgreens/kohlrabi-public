/* ===== module: formulas/e1rm.js ===== */
    /** Estimated-1RM math and the "Back into range" load correction.
        Plain-English rules:
        - Epley (1985): 1RM = w × (1 + r/30). Epley, B. Poundage chart.
          Boyd Epley Workout. 1985.
        - The app's estimate1RM folds RPE in through RIR: rir = 10 − RPE
          (Zourdos et al., JSCR 2016 — RPE 10 = 0 reps in reserve, each
          point ≈ 1 RIR), so e1RM = w × (1 + (reps + rir)/30). No RPE
          logged → plain Epley (rir = 0).
        - Cross-check: Epley lands within ~2% of the NSCA %1RM-by-reps table
          (Essentials of Strength Training and Conditioning): 5 reps 85.7% vs
          87% (1.5%); 9 reps 76.9% vs ~77%; 12 reps 71.4% vs 70%.
        - "Back into range" (QA batch, user 2026-09-21): a linear top set
          logged BELOW the rep range must not become "add the increment and
          clamp the reps" (245×2 → 250×6 — the range would be decorative, and
          the increment must not mint off a below-floor set). The rep deficit
          (min − reps) converts into a load adjustment through the published
          load↔reps relationships, targeting the mid-range rep count: when
          the lifter's true capacity (reps + RIR) reaches the floor, the load
          is right for the range — hold it and build reps; otherwise rebase
          from the RPE-adjusted e1RM onto the mid-range count at the SAME RPE
          (effort held constant, only the rep target moves into the range).
        Depends on: snapToIncrement/snapUpToIncrement (increments.js) — read
        at CALL time. estimate1RM takes the logged load as-is; dumbbell
        entries are the combined total, never a per-hand value (callers
        normalize per-dumbbell → total via dbEntryMode()).
        Called from: workout/progression.js → progressionForExercise (suggestion
        pipeline) and pages/exercise-detail.js (PROJECTED 1RM label).
        Worked example: backIntoRange(245, 2, 7, 6, 12, 'fixed', 5):
        rir = 3, capacity = 5 < 6 → e1 = 245×(1+5/30) = 285.8,
        target 9 @7 → 285.8/(1+12/30) = 204.2 → snapped 205 → 205×9,
        kind 'backrange'. Strength anchor: backIntoRange(245, 2, 7, 3, 5,
        'fixed', 5): capacity = 5 ≥ 3 → hold → 245×5, kind 'reps'. */
    /* Epley (1985): 1RM = w × (1 + (reps + rir)/30). rir defaults to 0 (plain Epley). */
    function epley1RM(weight,reps,rir){
      const w=Number(weight);
      if(!Number.isFinite(w)||w<=0)return 0;
      return w*(1+(Number(reps)+Number(rir||0))/30);
    }
    /* Inverse of epley1RM: the load whose 1RM at the given reps/RIR equals e1rm. */
    function epleyLoadForReps(e1rm,reps,rir){
      return Number(e1rm)/(1+(Number(reps)+Number(rir||0))/30);
    }
    /* Estimates e1RM from a logged set via epley1RM, folding RPE into RIR (RPE 10 = 0 RIR); 0 when the load is invalid. */
    function estimate1RM(set) {
      // Use the logged load as-is; dumbbell entries are the combined total, not a per-hand value.
      const weight = Number(set.w);
      if (!Number.isFinite(weight) || weight <= 0) return 0;
      const rir = set.rpe == null || set.rpe === '' ? 0 : Math.max(0, 10 - Number(set.rpe));
      return epley1RM(weight,Number(set.r),rir);
    }

    /* QA batch (user 2026-09-21, #11): "Back into range" — a linear top
       set logged BELOW the rep range must not become "add the increment
       and clamp the reps" (245×2 → 250×6): the range would be decorative,
       and the increment must not mint off a below-floor set. The guard is
       a general, range-aware mechanism — no hardcoded hypertrophy
       special-case. When the top set falls below the floor, the rep
       deficit (min − reps) is converted into a load adjustment through
       the published load↔reps relationships, targeting a sensible point
       back inside the range:
         Epley (1985): 1RM = w(1 + r/30), inverted for the target load.
           Epley, B. Poundage chart. Boyd Epley Workout. 1985.
         RPE/RIR (Zourdos et al., JSCR 2016): the RPE scale is anchored
           so RPE 10 = 0 reps in reserve and each point ≈ 1 RIR — so
           RIR = 10 − RPE folds the set's RPE into the e1RM estimate
           (the app's estimate1RM already does exactly this).
         NSCA %1RM-by-reps table (Essentials of Strength Training and
           Conditioning) as cross-check: Epley lands within ~1% of the
           table (5 reps: 85.7% vs 87%; 9 reps: 76.9% vs ~77%;
           12 reps: 71.4% vs 70%).
       The RPE reveals the lifter's true rep capacity at this load
       (reps + RIR). When that capacity reaches the range floor, the
       load is appropriate for the range — the set just ended early —
       so hold the load and build reps toward the top (strength anchor:
       245×2 @7, 3–5 → 245×5, no cut). When capacity falls short of the
       floor, the load is too heavy for the range: rebase from the
       RPE-adjusted e1RM onto the mid-range rep count at the SAME RPE
       (the demonstrated sustainable effort — effort is held constant,
       only the rep target moves into the range). The cut scales
       naturally with the range: narrow low ranges yield small or no
       cuts, wide middle ranges moderate cuts, high ranges larger cuts.
       Hypertrophy anchor: 245×2 @7, 6–12 → e1RM = 245(1+5/30) = 285.8,
       target 9 @7 → 285.8/(1+12/30) = 204.2 → 205×9 "Back into range"
       (the literature formula lands on the anchor; no tuned constants).
       Snapped to the increment grid; the #394 guard rounds up to the
       next grid multiple rather than dropping to a finer grain. */
    /* "Back into range" — pure core lifted out of computeFromBasis
       (progression.js) in the v1.878 restructure. Given a below-range top
       set, returns {kind, nextWeight, nextReps, estimated1RM}; kind is 'reps'
       (hold the load, build toward the top of the range) or 'backrange'
       (cut the load so the mid-range count lands at the same RPE). Returns
       null when reps are not below the floor — no correction needed.
       Reason strings stay with the caller (display, not math). */
    function backIntoRange(weight,reps,rpe,min,max,incrementType,incrementValueLb){
      if(!(reps<min))return null;
      const rir=rpe==null||rpe==='' ? 0 : Math.max(0,10-Number(rpe));
      const capacityReps=reps+rir;
      const targetReps=Math.round((min+max)/2);
      if(capacityReps>=min)
        return {kind:'reps',nextWeight:weight,nextReps:max,estimated1RM:null};
      const e1=estimate1RM({w:weight,r:reps,rpe});
      const rawTarget=epleyLoadForReps(e1,targetReps,rir);
      const snappedLoad=snapToIncrement(rawTarget,incrementType,incrementValueLb);
      return {kind:'backrange',nextReps:targetReps,estimated1RM:e1,
        nextWeight:Math.max(0,snappedLoad<weight?snapUpToIncrement(rawTarget,incrementType,incrementValueLb):snappedLoad)};
    }
