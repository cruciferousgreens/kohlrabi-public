/* ===== module: formulas/increments.js ===== */
    /** Load-increment snapping and the warm-up ladder.
        Plain-English rules (#246, user 2026-09-14): the increment setting
        defines the weight grid — suggested loads snap to it, never decimals
        and never plates. Fixed-lb increments snap the incremented load to the
        nearest step multiple (5 lb → 108.6 becomes 110). Percent increments
        are multiplicative, so the load snaps to the same 5 lb grid (#473,
        user 2026-09-15: 125 lb × 1.09 → 135, never 136). Metric users get the
        2.5 kg grid converted to canonical lb. snapUpToIncrement rounds UP
        (used when snapping down would regress below the handled top set).
        RPE-scaled increments (user 2026-09-19): the add-load-and-reset paths
        scale the base increment by m = 1 + headroom/2, capped at 2×
        (headroom = trigger − RPE); the scaled step still snaps on the same grid.
        Warm-up ladder (#185): one row per rung — weight = anchor × pct
        snapped to the #473 formula grid, reps = the rung's reps, timed
        exercises ladder seconds snapped to 5 s. Per-dumbbell display snaps
        the rung total to an even whole total (#492).
        Depends on: isMetric/LB_TO_KG (units.js), isWarmupSet
        (workout/set-tags.js) — all read at CALL time.
        Worked example: roundedIncrement(100,'fixed',5) → 105;
        snapToIncrement(136.25,'percent',9) → 135;
        warmupLadderRows(140,'reps') → [{w:70,r:5},{w:105,r:3},...]. */

    /* fmtRpe lives in assets/js/formulas/rpe.js (not moved here). */

    /* #246 (user 2026-09-14): the increment setting defines the weight grid —
       suggested loads snap to it, never decimals and never plates. Fixed-lb
       increments snap the incremented load to the nearest step multiple;
       percent increments round to whole units. */
    function roundedIncrement(weight,type,value) {
      if(type==='percent') return snapToIncrement(weight*(1+Number(value)/100),type,value);
      return snapToIncrement(weight+Number(value),type,value);
    }

    /* RPE-scaled load increments (user 2026-09-19, approved as proposed): the
       add-load-and-reset paths of the RPE-scheme double progression scale the
       base increment by m = 1 + headroom/2, capped at 2× (headroom = trigger
       − RPE). The scaled step still snaps on the existing increment grid —
       the #246 grid for lb increments, the #473 5-lb grid for percent —
       so only the step grows; snapping, unit conversion, and guards are
       unchanged. Percent increments scale the percentage itself. */
    function scaledLoadIncrement(weight,type,valueLb,multiplier){
      if(!(multiplier>1))return roundedIncrement(weight,type,valueLb);
      if(type==='percent')return snapToIncrement(weight*(1+Number(valueLb)*multiplier/100),'percent',valueLb);
      return snapToIncrement(weight+Number(valueLb)*multiplier,type,valueLb);
    }


    /* #246 (user 2026-09-14): formula-derived suggestion loads snap to the
       configured increment step — the increment setting exists for this, it
       is not a plate snap. Fixed-lb increments snap to the nearest multiple
       of the step (5 lb → 108.6 becomes 110, never a decimal). Percent
       increments are multiplicative, so the load snaps to the same 5 lb
       increment grid instead (#473, user 2026-09-15: 125 lb × 1.09 → 135,
       never 136) — still never a decimal. */
    function snapToIncrement(rawLb,type,valueLb){
      if(!(rawLb>0))return 0;
      /* #473 (user 2026-09-15, corrected 23:39 EDT): percent-increment
         targets snap to the SAME increment grid as fixed-lb increments —
         nearest multiple of the increment step (5 lb), never 136 and never
         a decimal. 125 lb @ 9% → 136.25 → 135. Metric uses the 2.5 kg grid
         (the plate convention), converted to canonical lb. */
      if(type==='percent'){const grid=isMetric()?2.5/LB_TO_KG:5;return Math.round(rawLb/grid)*grid;}
      if(!(valueLb>0))return Math.round(rawLb);
      return Math.round(rawLb/valueLb)*valueLb;
    }

    /* Round UP to the next increment multiple (same grid as snapToIncrement).
       Used when snapping down would regress below the handled top set. */
    function snapUpToIncrement(rawLb,type,valueLb){
      if(!(rawLb>0))return 0;
      if(type==='percent'){const grid=isMetric()?2.5/LB_TO_KG:5;return Math.ceil(rawLb/grid)*grid;}
      if(!(valueLb>0))return Math.ceil(rawLb);
      return Math.ceil(rawLb/valueLb)*valueLb;
    }

    /* #185 (user 2026-09-13): pure warm-up ladder math — one row per rung:
       weight = anchor × pct snapped to the #473 formula grid (5 lb in
       canonical lb — the 2.5 kg grid for metric users, exactly how
       the #473 percent-increment grid already snaps for both units); reps =
       the rung's reps; timed exercises ladder seconds snapped to 5 s. No
       usable anchor → blank weight (the row stays editable).
       #492: the old plate snap (5 lb / 2.5 kg) bypassed the #473 grid — an
       odd anchor (109 lb) halved into ugly per-dumbbell decimals. When the
       exercise displays per-dumbbell (evenTotal), the rung total also snaps
       to an even whole total (the #473 even-total rule) so the halved
       placeholder stays whole. */
    function warmupLadderRows(anchorLb,tracking,evenTotal){
      const n=Math.min(3,Math.max(1,Math.round(Number(progressionSetup.warmupRungs)||2)));
      const ladder=(progressionSetup.warmupLadder||[]).slice(0,n);
      const time=tracking==='time';
      return ladder.map(rung=>{
        const pct=Number(rung.pct)||0;
        let w='';
        if(anchorLb>0&&pct>0){
          /* #492: the #473 grid — snapToIncrement's percent path snaps to
             the 5 lb increment grid in canonical lb (2.5 kg for metric). */
          let snapped=snapToIncrement(anchorLb*pct/100,'percent',0);
          if(evenTotal)snapped=Math.round(snapped/2)*2;
          if(snapped>0)w=String(snapped);
        }
        const perf=time
          ? String(Math.max(5,Math.round(Number(rung.reps)/5)*5))
          : String(Math.max(1,Math.round(Number(rung.reps))));
        return {pct,w,reps:time?null:perf,seconds:time?perf:null};
      });
    }

    /* #399 (user 2026-09-14): the ladder anchors to the filled-in top set
       (heaviest entered weight on a non-warmup set), else the auto-filled
       suggestion target — never a PR. The old third fallback (last
       session's top set) is gone: a PR session's top set is a ceiling, not
       the day's working weight, and percentages off it overshoot the
       warm-up. Warm-up rows never count as the anchor. No anchor anywhere
       → 0 → the rows come out blank but editable. */
    function warmupAnchorLb(item){
      let best=0;
      (item.sets||[]).forEach(s=>{if(isWarmupSet(s))return;const w=Number(s.w)||0;if(w>best)best=w;});
      if(best>0)return best;
      const target=Number(item.suggestedTarget?.w)||0;
      if(target>0)return target;
      return 0;
    }
