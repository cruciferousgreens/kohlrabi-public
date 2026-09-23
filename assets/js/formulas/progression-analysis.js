/* ===== module: formulas/progression-analysis.js ===== */
    /** Basis analysis for the progression engine: which set counts as the
        top set, and how fatigued the session was.
        Plain-English rules: topSetForSession picks the heaviest work set of a
        session — warm-up sets never compete (#185); ties break by reps/
        seconds; time-tracked sessions compare seconds. fatigueForBasis
        estimates accumulated fatigue from the work sets behind the top set
        (heavier back-off volume = higher effective RPE), capped at +1.5 RPE.
        Depends on: isWarmupSet (workout/set-tags.js), blankRpeToNull
        (rpe.js) — all read at CALL time.
        Worked example: topSetForSession({sets:[{w:135,r:8},{w:185,r:5}]})
        → {w:185,r:5} (the 185×5 top set drives the next suggestion).
        Stale-basis age cap (user 2026-09-22): SUGGESTION_BASIS_WEEKS — how
        many weeks back a session may be and still drive a progression
        suggestion. Hard-baked here (the Settings pills were removed); tune
        it in this file, like the other training constants. Worked example:
        at 8, a 100-day-old session is memory, not advice — the engine
        rejects it as a basis. */

    /* Stale-basis age cap in weeks (user 2026-09-22): a session older than
       this stops driving progression suggestions. The Settings UI for this
       was removed — change the constant here. */
    const SUGGESTION_BASIS_WEEKS = 8;

    /* → assets/js/formulas/rpe.js: blankRpeToNull — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/rpe.js: rpeRepJump — moved here in the v1.878 restructure (no behavior change). */
    function topSetForSession(session) {
      if (!session?.sets?.length) return null;
      const mode=session.tracking==='time'||session.sets.some(set=>set.seconds!=null)?'time':'reps';
      /* #185 (user 2026-09-13): warm-up sets never trigger a progression
         suggestion, so they sit out the top-set race. Every other tag is
         still label-only — all non-warmup sets compete on equal terms:
         heaviest weight wins, ties broken by reps/seconds. */
      const candidates=session.sets.filter(set=>!isWarmupSet(set));
      if(!candidates.length)return null;
      const top=candidates.reduce((best,set,index) => {
        const weight=Number(set.w)||0, reps=Number(set.r)||0, seconds=Number(set.seconds)||0;
        const performance=mode==='time'?seconds:reps;
        const rpe=blankRpeToNull(set.rpe);
        /* #550: identical sessions must not produce different suggestions
           depending on set order. Heaviest weight wins, ties broken by
           reps/seconds — and when load AND performance tie, the better
           (lower) RPE wins: it is the better performance. A logged RPE
           beats a missing one (more signal); all-missing keeps the old
           first-set-wins order. */
        if(!best)return {weight,reps,seconds,performance,mode,rpe,index};
        if(weight>best.weight)return {weight,reps,seconds,performance,mode,rpe,index};
        if(weight===best.weight&&performance>best.performance)return {weight,reps,seconds,performance,mode,rpe,index};
        if(weight===best.weight&&performance===best.performance&&rpe!=null&&(best.rpe==null||rpe<best.rpe))return {weight,reps,seconds,performance,mode,rpe,index};
        return best;
      },null);
      /* Chaos sweep finding 4: a non-finite or negative top-set weight is no
         basis — a negative weight would prescribe "progress" at −50 lb and
         Infinity breaks reason strings (the weight vanishes mid-sentence).
         Same as the no-candidates path: no top set, no suggestion.
         Bodyweight 0 stays legitimate. */
      if(!top||!Number.isFinite(top.weight)||top.weight<0)return null;
      return top;
    }

    /* #490 (user 2026-09-16): RPE-driven suggestions account for accumulated
       fatigue across the basis session's work sets — two sets of 8 @ RPE 8
       is not the same fatigue state as one set of 8 @ RPE 8. RPE is already
       effort-normalized (a back-off set logged at RPE 8 cost the lifter as
       much relative effort as the top set at RPE 8), so each additional work
       set beyond the top set adds 0.25 of effective RPE, scaled by that
       set's own RPE; a set with no RPE assumes the top set's effort.
       Warm-up sets never count — they are submaximal by design (#185).
       The penalty caps at +1.5 so very long sessions don't spiral. Returns
       the penalty, the fatigue-adjusted effective RPE (null when the top
       set has no RPE), and the work-set count for reason text. */
    function fatigueForBasis(basisSets,top){
      const topRpe=top&&top.rpe!=null?Number(top.rpe):null;
      const none={penalty:0,effectiveRpe:topRpe,workSets:0};
      /* #497 (trigger hold removed, user 2026-09-19): RPE 0 still accrues no
         fatigue — a trivially-easy top set adds no accumulated-fatigue
         penalty to the basis accounting. */
      if(!(topRpe>0))return none;
      const sets=basisSets||[];
      const topIdx=Math.max(0,Math.min(Number(top&&top.index)||0,Math.max(0,sets.length-1)));
      let load=0,workSets=0;
      sets.forEach((s,i)=>{
        if(!((Number(s.w)||0)>0||(Number(s.r)||0)>0||(Number(s.seconds)||0)>0))return;
        workSets++;
        if(i===topIdx)return;
        const rpe=blankRpeToNull(s.rpe);
        load+=0.25*((rpe!=null&&rpe>0?rpe:topRpe)/10);
      });
      if(workSets<=1)return {penalty:0,effectiveRpe:topRpe,workSets};
      const penalty=Math.min(1.5,Math.round(load*100)/100);
      return {penalty,effectiveRpe:Math.round((topRpe+penalty)*10)/10,workSets};
    }
