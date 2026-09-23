    /* → assets/js/formulas/progression-analysis.js: topSetForSession — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/progression-analysis.js: fatigueForBasis — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/program-math.js: clampPct1RM — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/program-math.js: clampDeloadPct — moved here in the v1.878 restructure (no behavior change). */

    /* The suggestion engine's entry point: from one exercise's real completed history +
       its progression profile, returns the next-session target (weight/reps/seconds) or
       a hold. Suggestions are hints only — see applyProgressionSuggestion.
       ROADMAP (#99 C9 — this is the app's most complex function; the numbered
       Phase comments inside follow this order):
       1. Resolve config: off-switch (#405), scheme, increment, rep/time range —
          program config wins, falls back to the global Settings default.
       2. Pick the basis log: same-zone history first (most-recently-DONE, #274),
          with a most-recent-log fallback when the in-zone log yields nothing.
          A basis older than the age cap (#574) is rejected as stale.
       3. computeFromBasis: freestyle "follow the lifter" zone retarget.
       4. %1RM prescription (#54): fixed % of training max (entered, else auto
          from best same-zone e1RM) — resolves before the deload.
       5. Scheduled-deload override (never inferred — "the engine never auto-deloads").
       6. Scheme dispatch: %1RM → linear → range-change rebase → standard RPE
          double progression (rep jumps scale with RPE headroom, #387).
       7. All-sets expansion (#400): per-set targets cascade the top set's step shape.
       8. No-change suppression (#79): a suggestion that changes nothing is null. */
    function progressionForExercise(exerciseId, profile, config=null, hasStoredZone=false) {
      /* Phase 1: resolve config — the program's config wins, else the global
         Settings default (progressionSetup). */
      const programConfig=config || workoutState.activeProgram?.progression || progressionSetup;
      /* QA batch (user 2026-09-22): "Advance on completion" is now the fourth
         RPE-threshold choice ("On completion") — finishing the sets is the
         progression trigger and RPE never blocks a suggestion. Missing RPE
         reads as the trigger-sized (conservative) step. The legacy
         advanceOnCompletion flag is still honored for program configs that
         never migrated. The all-sets back-off cascade below is unchanged. */
      const advanceOnCompletion=profile?.threshold==='completion'||programConfig.threshold==='completion'||!!programConfig.advanceOnCompletion;
      /* #405: progression off-switch — global default, per-program flag, or
         per-exercise scheme 'off'. Returns null: no prescriptions. The
         last-session ghost (holdPerf) is memory, not a prescription, and stays.
         The global flag is a master kill: programConfig resolves program-first,
         so without this an active program's config would shadow the Settings
         switch (phone QA 2026-09-14). */
      if(progressionSetup.progressionOff||programConfig?.progressionOff||profile?.scheme==='off')return null;
      /* #498: the scheduled-deload week is read by BOTH the main deload
         branch (inside computeFromBasis) and the distance branch
         (distanceSuggestionFrom early-returns before computeFromBasis
         declares anything), so it lives here in the shared function scope. */
      const week=Number(programConfig.currentWeek)||null;
      // Progression scheme: 'linear' is the default (user 2026-09-20,
      // #577); 'rpe' is the RPE-gated double progression; 'linear' adds the
      // increment every session with no RPE gate (per-program setting,
      // stamped onto each exercise at program start so repeats stay linear);
      // 'onerm' prescribes load as a percentage of the training max (#54).
      const scheme=profile?.scheme||programConfig?.scheme||'linear';
      /* #549: the nominal increment is a lie after the grid snap — 102 lb +
         a 5 lb increment snaps to 105, an actual +3. Reason strings must
         state the ACTUAL prescribed delta (nextWeight minus the base), not
         the nominal setting. Percent increments report the actual rounded
         percent. Returns null when there is no positive base to measure
         against — call sites fall back to the nominal incrementLabel. */
      function actualStepLabel(newW,baseW,incrementType){
        const d=newW-baseW;
        if(!(d>0)||!(baseW>0))return null;
        if(incrementType==='percent')return `${Math.round(d/baseW*100)}%`;
        /* QA batch (user 2026-09-22): for per-DB entry the canonical delta
           counts both dumbbells — report the per-dumbbell step the lifter
           actually sees. */
        return `${displayWeight(_perDbInc?d/2:d)} ${weightUnit()}`;
      }
      /* QA batch (user 2026-09-22): the increment setting is in the lifter's
         entry unit, but the store holds BOTH dumbbells for a paired per-DB
         exercise — so a fixed 5 lb increment applied to the combined total
         produced unachievable per-DB targets (15 per DB + 5 → 35 total →
         the even-total snap showed "18 lb"). Doubling the fixed-lb step in
         canonical space makes each dumbbell step the configured amount
         (15→20 per DB). Percent increments are multiplicative and need no
         adjustment; single-dumbbell (#538) and total-mode entry are already
         1:1 with the store. */
      const _perDbEx=resolveExercise(exerciseId);
      const _perDbItem=workoutState.draft?.exercises?.find(row=>row.exerciseId===exerciseId);
      const _perDbInc=_perDbEx?.equipment==='dumbbell'&&dbEntryMode(exerciseId,_perDbItem)==='per'&&!dbSingleDumbbell(exerciseId,_perDbItem);
      /* QA batch (user 2026-09-22): "the all-sets toggle seems unnecessary, we
         should always progress all sets when we progress." The toggle is
         retired — per-set targets are computed for every suggestion now.
         (Was #400.) */
      /* Phase 2: pick the basis log — same-zone history first (most-recently-DONE,
         #274), with a most-recent-log fallback so a stale in-zone log that yields
         nothing never leaves the lifter with no suggestion. */
      const logs=getExerciseLogs(exerciseId).sort(sortByWorkoutDateDesc); /* #274: most-recently-done, not most-recently-logged */
      // %1RM with an entered training max needs no history at all.
      // trainingMax is the v1.001 rename of manual1RM — read the old key as a
      // fallback for one cycle so legacy profiles keep working.
      const trainingMax=Number(profile?.trainingMax ?? profile?.manual1RM)||0;
      if(!logs.length&&!(scheme==='onerm'&&trainingMax>0))return null;
      const targetMode=profile?.mode || 'reps';
      /* #498: distance-tracked exercises (sled, carries) — resolved from the
         catalog, not the item profile. They skip rep/time double progression;
         the RPE trigger gates load at a held distance instead. */
      const _distEx=(typeof exercises!=='undefined'?exercises:[]).find(x=>x.id===exerciseId);
      const isDistanceExercise=(typeof setPerfField==='function')&&setPerfField(null,_distEx)==='distance';
      /* QA batch (user 2026-09-22): threshold:'completion' is the "On
         completion" choice — the numeric threshold only sizes the
         conservative step, so it falls back to the default 8. */
      let threshold=Number(profile?.threshold ?? programConfig.threshold ?? 8);
      if(!(threshold>=1&&threshold<=10))threshold=8;
      // AMRAP has no upper rep bound: a blank max means "as many as possible" from an
      // optional floor (blank min defaults to 1). Normalize both sides the same way so
      // a blank max matches a blank max (not 0, not the 8 fallback) in zone comparisons.
      const normMin=p=>p?.amrap?(Number(p?.min)||1):Number(p?.min ?? 5);
      const normMax=p=>p?.amrap?null:Number(p?.max ?? 8);
      const min0=normMin(profile), max0=normMax(profile);
      let min=min0, max=max0;
      let timeMin=Number(profile?.timeMin ?? 30), timeMax=Number(profile?.timeMax ?? 60);
      const timeStep=Number(profile?.timeStep)||5;
      // Suggest from the most recent log in the SAME rep/time zone as the target.
      // Basing the suggestion on the latest log regardless of zone produced invented
      // loads (e.g. a Friday 4s e1RM interpolated into a Monday 8s target); the
      // program's own zone history is the honest basis. Falls back to the latest log.
      // Zone is matched first by the stored progression profile, then by the actual
      // logged top-set reps/seconds, because older logs (e.g. blank-logged sessions)
      // may carry no stored profile at all.
      const inStoredZone=log=>{
        const p=log.progression; if(!p)return false;
        if((p.mode||'reps')!==targetMode)return false;
        if(targetMode==='time'){if(!(Number(p.timeMin)===timeMin&&Number(p.timeMax)===timeMax))return false;}
        // For AMRAP the max is open, so stored logs match on the amrap flag and the
        // floor (blank min normalizes to 1 on both sides) rather than on a max.
        else if(!((profile?.amrap?normMin(p)===min:Number(p.min)===min)&&(profile?.amrap||normMax(p)===max)&&!!p.amrap===!!profile?.amrap&&!!p.openTop===!!profile?.openTop))return false;
        // A matching stored target range is not enough on its own: the actual
        // logged top set must have landed inside that zone. Blank-logged
        // sessions get the default range stamped on them, so the profile alone
        // can't tell zones apart — a 5–8 target logged as 255×4 belongs to the
        // 4s zone, not the 5–8 zone.
        const top=topSetForSession(log); if(!top)return false;
        if(targetMode==='time')return top.mode==='time'&&top.seconds>=timeMin&&top.seconds<=timeMax;
        return top.mode==='reps'&&top.reps>=min&&(profile?.openTop||profile?.amrap||top.reps<=max);
      };
      const inLoggedZone=log=>{
        const top=topSetForSession(log); if(!top)return false;
        if(targetMode==='time')return top.mode==='time'&&top.seconds>=timeMin&&top.seconds<=timeMax;
        return top.mode==='reps'&&top.reps>=min&&(profile?.openTop||profile?.amrap||top.reps<=max);
      };
      const zoneLog=logs.find(inStoredZone)||logs.find(inLoggedZone);
      /* User 2026-09-22: stale-basis age cap — a session older than the cap
         is memory, not advice. Hard-baked as SUGGESTION_BASIS_WEEKS
         (formulas/progression-analysis.js); the Settings pills are gone.
         A stale in-zone basis is rejected outright: fall through to the
         fresh most-recent log when one exists, and when ALL usable history
         is stale there is no suggestion at all (the last-session ghost
         still shows). Age is measured in whole days from the log's workout
         date (#274: most-recently-DONE). */
      const basisCapDays=SUGGESTION_BASIS_WEEKS*7;
      const basisAgeDays=log=>{
        const d=(log&&(log.isoDate||log.date))||'';
        const ms=Date.parse(d);
        if(!Number.isFinite(ms))return Infinity;
        return (Date.parse(localIsoDate())-ms)/86400000;
      };
      const isFreshBasis=log=>!!log&&basisAgeDays(log)<=basisCapDays;
      const freshZoneLog=isFreshBasis(zoneLog)?zoneLog:null;
      const freshLatest=isFreshBasis(logs[0])?logs[0]:null;
      /* Same-zone basis first — the program's own zone history is the honest
         basis, never an interpolated load. But when the in-zone session
         yields no suggestion (e.g. its top set beat the RPE trigger) and
         newer out-of-zone history exists, rebase from the most recent log
         instead of leaving the lifter with nothing (user 2026-09-13). */
      const bases=(freshZoneLog&&freshLatest&&freshZoneLog!==freshLatest)?[freshZoneLog,freshLatest]:[freshZoneLog||freshLatest];
      let holdNotice=null;
      for(const basisLog of bases){
        const suggestion=computeFromBasis(basisLog);
        if(suggestion){
          /* QA batch (user 2026-09-21, #11): a high-RPE hold notice is
             informational only — the old #79-null path fell through to newer
             history, so keep that fallback: prefer an actionable rebase from
             the most recent log, and keep the notice only if nothing better
             appears. Other notices (missing RPE) stay terminal. */
          if(suggestion.kind==='hold'&&suggestion.notice&&suggestion.latest&&suggestion.latest.rpe!=null&&Number(suggestion.latest.rpe)>threshold){holdNotice=suggestion;continue;}
          return suggestion;
        }
      }
      return holdNotice;
      /* Phase 3: compute one suggestion from a basis log. Sub-phases inside:
         freestyle retarget → %1RM prescription → scheduled deload → scheme
         dispatch → all-sets → #79 no-change suppression. */
      /* #498: suggestion for distance-tracked exercises (sled, carries).
         Rep/time double progression has no meaning here: the RPE trigger
         gates LOAD at a held distance (linear scheme adds the increment with
         no gate). Deload weeks hold steady — like #285 timed work — and the
         #79 no-change check below then suppresses the card. */
      function distanceSuggestionFrom(latestLog){
        const sets=(latestLog?.sets||[]).filter(st=>!isWarmupSet(st)&&Number(st.distance)>0);
        if(!sets.length)return null;
        const top=sets.reduce((a,b)=>Number(b.distance)>Number(a.distance)?b:a);
        const dist=Number(top.distance),weight=Number(top.w)||0;
        /* #551 (user 2026-09-19, revert): RPE 0 is fine to advance on — the
           RPE-0 hold added for #551 is reverted; the distance gate matches
           the trigger (RPE ≤ threshold). blankRpeToNull is kept: a blank or
           whitespace RPE still reads as missing (hold), like the standard
           path. */
        const rpe=blankRpeToNull(top.rpe);
        const distGateRpe=advanceOnCompletion?threshold:rpe;
        const incrementType=profile?.incrementType || programConfig.incrementType || 'lb';
        /* QA batch (user 2026-09-22): a resolved increment of 0 or less is
           never a real grid — 0 makes snapToIncrement silently fall back to
           whole-pound rounding, so a cleared/zeroed increment field minted
           raw e1RM math straight onto the card (51, 136, 18/db) and 0-lb
           "Add weight" cards. Floor to the 5-lb default. */
        const _incrementRaw=Number(profile?.incrementValue ?? programConfig.incrementValue ?? 5);
        const incrementValue=(_incrementRaw>0&&Number.isFinite(_incrementRaw))?_incrementRaw:5;
        const incrementValueLb=incrementType==='percent'?incrementValue:(isMetric()?incrementValue/LB_TO_KG:incrementValue);
        const incrementLabel=incrementType==='percent'?`${incrementValue}%`:`${incrementValue} ${weightUnit()}`;
        const repsOnly=!!profile?.repsOnly;
        let nextWeight=weight,kind='hold',reason='Top-set RPE is above the progression trigger.';
        /* #54/#285: scheduled deloads hold distance work steady — no load
           reduction, no progression. The #79 no-change check below then
           suppresses the card. (`week` lives in the shared progressionForExercise
           scope so this early-return branch can read it.) */
        const distanceDeload=!!week&&typeof isDeloadWeek==='function'&&isDeloadWeek(programConfig,week);
        if(distanceDeload){
          reason='Deload week — hold the distance target steady.';
        }else if(scheme==='linear'||(distGateRpe!=null&&distGateRpe<=threshold)){
          /* #565 (user 2026-09-19): with "Advance on completion" the RPE
             gate is bypassed — finishing the sets is the trigger. Say so
             when completion (not a low RPE) drove the suggestion. */
          const distCompletionDrove=advanceOnCompletion&&!(rpe!=null&&rpe<=threshold);
          if(repsOnly){reason=`Load progression is off, so hold ${displayWeight(weight)||0} ${weightUnit()} × ${dist} m.`;}
          else{nextWeight=roundedIncrement(weight,incrementType,incrementValueLb);kind='load';reason=`Top set was at or below RPE ${threshold}; add ${actualStepLabel(nextWeight,weight,incrementType)||incrementLabel} at ${dist} m.${distCompletionDrove?' Advancing on completion — RPE isn\u2019t gating this suggestion.':''}`;}
        }else if(rpe==null){reason='No RPE on the latest top set, so the engine holds the target.';}
        /* #79: no change → no card. */
        if(Math.abs(nextWeight-weight)<0.001)return null;
        const basis=topSetForSession(latestLog);
        return {exerciseId,latest:basis?{...basis,distance:dist}:null,mode:profile?.mode||'reps',isDistance:true,
          nextWeight,nextReps:0,nextSeconds:0,nextDistance:dist,kind,reason,notice:null,estimated1RM:0,
          sourceDate:latestLog?.isoDate,sourceWorkout:latestLog?.name,range:[dist,dist],timeStep:0,
          repsOnly,freeform:!!config?.freeform,scheme,amrap:false,pct:null,tmSource:null,
          setTargets:null,topIndex:0,
          basisSets:sets.map(st=>({w:Number(st.w)||0,r:0,seconds:0,distance:Number(st.distance)||0}))};
      }
      /* Computes the target suggestion from the latest logged session (the basis). */
      function computeFromBasis(latestLog){
      if(isDistanceExercise)return distanceSuggestionFrom(latestLog);
      const latest=latestLog?topSetForSession(latestLog):null;
      /* #472 (user 2026-09-15): the basis-set list is hoisted out of the
         All-sets block so the top-set card can list its sets in numeric
         order too — the suggestion object below carries a serializable
         copy. Empty when there is no basis log. */
      const basisSets=(latestLog&&latestLog.sets?latestLog.sets:[]).filter(s=>!isWarmupSet(s));
      /* #490 follow-up (user 2026-09-16): the RPE trigger gate and the #387
         rep jump below run on the top set's RAW RPE — accumulated fatigue
         no longer blocks progression. Null when the top set logged no RPE. */
      const gateRpe=(latest&&latest.rpe!=null&&isFinite(Number(latest.rpe)))?Number(latest.rpe):null;
      /* #565: with "Advance on completion" the trigger is finishing the
         sets — the gate reads as the trigger itself (conservative). */
      const gateRpeEff=advanceOnCompletion?threshold:gateRpe;
      /* The fatigue accounting still runs for basis transparency (carried
         on the suggestion object) but no longer gates or labels reasons. */
      const fatigue=fatigueForBasis(basisSets,latest);
      const fatigueClause='';
      const mode=profile?.mode || latest?.mode || 'reps';
      // Freestyle (out-of-program) with no explicit range: follow the lifter's
      // most recent zone instead of rebasing into the Settings default zone.
      // A program prescribes its zone; a freestyle session doesn't, so imposing
      // the default range via e1RM is the "weird" part. The retarget only
      // matters when the latest log landed outside the default zone (when it
      // matches, the zone logic above already applies). The lifter's zone is a
      // single number — their top set — so the suggestion becomes "same reps,
      // add load when the RPE trigger hits". Explicitly chosen ranges
      // (profile.custom, set in the exercise rule rows), AMRAP, and open-top
      // keep the existing behavior. A repeat or template-start whose draft item
      // carries a stored zone from a real workout also keeps its zone (#48):
      // collapsing it contradicted the program-start suggestion for identical
      // history.
      const followLifter=!!config?.freeform&&!profile?.custom&&!hasStoredZone;
      if(latest&&followLifter&&!profile?.amrap&&!profile?.openTop&&latest.mode===mode){
        if(mode==='time'){timeMin=Math.max(1,latest.seconds);timeMax=Math.max(1,latest.seconds);}
        else{min=Math.max(1,latest.reps);max=Math.max(1,latest.reps);}
      }
      const incrementType=profile?.incrementType || programConfig.incrementType || 'lb';
      /* QA batch (user 2026-09-22): a resolved increment of 0 or less is
         never a real grid — 0 makes snapToIncrement silently fall back to
         whole-pound rounding, so a cleared/zeroed increment field minted
         raw e1RM math straight onto the card (51, 136, 18/db) and 0-lb
         "Add weight" cards. Floor to the 5-lb default. */
      const _incrementRaw=Number(profile?.incrementValue ?? programConfig.incrementValue ?? 5);
      const incrementValue=(_incrementRaw>0&&Number.isFinite(_incrementRaw))?_incrementRaw:5;
      /* incrementValue is entered in the user's display units; convert to the
         canonical lb before applying it to stored weights. Per-DB dumbbells:
         the fixed-lb step doubles in canonical space (see _perDbInc above)
         so each dumbbell steps the configured amount. */
      const _incrementBaseLb=incrementType==='percent'?incrementValue:(isMetric()?incrementValue/LB_TO_KG:incrementValue);
      const incrementValueLb=incrementType==='percent'?_incrementBaseLb:_incrementBaseLb*(_perDbInc?2:1);
      const incrementLabel=incrementType==='percent'?`${incrementValue}%`:`${incrementValue} ${weightUnit()}`;
      const repsOnly=!!profile?.repsOnly;
      // Progression scheme: 'linear' is the default (user 2026-09-20,
      // #577); 'rpe' is the RPE-gated double progression; 'linear' adds the
      // increment every session with no RPE gate; 'onerm' prescribes load as
      // a percentage of the training max (#54, restored v1.001).
      const previousProfile=latestLog?.progression;
      const previousMin=normMin(previousProfile),previousMax=normMax(previousProfile);
      const hasStoredRange=Number.isFinite(Number(previousProfile?.min))&&(!!previousProfile?.amrap||Number.isFinite(Number(previousProfile?.max))),outsideNewRange=!!latest&&(latest.reps<min||(!profile?.openTop&&!profile?.amrap&&latest.reps>max));
      const repRangeChanged=!!latest&&mode==='reps'&&previousProfile?.mode!=='time'&&((hasStoredRange&&(previousMin!==min||previousMax!==max))||(!hasStoredRange&&outsideNewRange));
      /* #381 (user 2026-09-13): the lifter's latest top set already sits inside
         the new rep range — there is nothing to rebase onto it. Running the
         e1RM remap anyway mints a rep-regression card (110x10 → 110x6 at the
         same load). The rebase branch below skips these; the standard
         RPE-gated double progression picks the set up where it is. */
      const latestInNewZone=!!latest&&latest.reps>=min&&(profile?.openTop||profile?.amrap||latest.reps<=max);
      let nextWeight=latest?.weight??0,nextReps=latest?.reps??min,nextSeconds=latest?.seconds??timeMin,kind='hold',reason='Top-set RPE is above the progression trigger.',estimated1RM=0;
      /* #557/#565: an informational notice for holds the user would otherwise
         read as "broken" — a zone switch whose top set doesn't map onto the
         new range, or a top set with no RPE. The #79 no-change check below
         normally suppresses these holds to null; when a notice is set the
         suggestion survives as a non-tappable informational row instead. */
      let notice=null;
      let repJumpUsed=0; /* #400: the RPE-branch jump, reused by the back-off cascade. */
      /* B8 fix: the %1RM basis is the BEST same-zone top set's e1RM, not the
         heaviest set's. Reuses the same-zone selection above, extended to the
         max e1RM over the whole zone window. */
      const bestZoneE1RM=()=>{
        let best=0;
        for(const log of logs){
          if(!(inStoredZone(log)||inLoggedZone(log)))continue;
          const top=topSetForSession(log);
          if(!top||!(top.weight>0)||!(top.reps>0))continue;
          const e=estimate1RM({w:top.weight,r:top.reps,rpe:top.rpe});
          if(e>best)best=e;
        }
        return best;
      };
      /* %1RM prescription (#54, restored v1.001): the target load is a fixed
         percentage of the training max — no RPE gate, no rep ladder.
         Percent: per-exercise override → weekly % wave → program default → 75.
         Basis is TM-first: an entered training max wins; otherwise the best
         same-zone estimated 1RM. Time-based exercises fall through to the
         standard path — %1RM is a load prescription for rep work. */
      /* Phase 4: the %1RM prescription resolves here (see #54 comment below) —
         BEFORE the deload branch, so a scheduled deload still reduces it. */
      const onermRx=()=>{
        if(mode==='time')return null;
        const pct=clampPct1RM(Number(profile?.percentOf1RM)||programPctForWeek(programConfig,week)||Number(programConfig?.percentOf1RM)||75);
        let basis=0,basisNote='',tmSource=null;
        if(trainingMax>0){
          basis=trainingMax;tmSource='manual';
          basisNote=`your training max of ${displayWeight(trainingMax)} ${weightUnit()}`;
        }else{
          const auto=bestZoneE1RM();
          if(auto>0){basis=auto;tmSource='auto';basisNote=`an auto training max of ≈${displayWeight(Math.round(auto))} ${weightUnit()} from your best same-zone top set`;}
        }
        if(basis<=0)return null;
        /* #246: the %1RM prescription snaps to the configured increment step,
           not plates — the increment setting is what it's there for. */
        return {weight:snapToIncrement(basis*(pct/100),incrementType,incrementValueLb),pct,basis,basisNote,tmSource};
      };
      /* Scheduled deloads (#54, v1.001): this override runs BEFORE the scheme
         branches. A week is a deload week only when the user flagged it in
         the % wave panel — deloads are never inferred or scheduled
         automatically (QA batch 2026-09-22 removed Auto Deload), so the
         "engine never auto-deloads" rule stands. On a deload
         week the load is reduced and the linear +increment is skipped. */
      /* Phase 5: the scheduled-deload override (see #54 comment above for the
         "never inferred" rule) runs before the scheme branches below. */
      const deloadPct=clampDeloadPct(Number(programConfig.deloadPct ?? progressionSetup.deloadPct ?? 60));
      const deloadWeek=!!week&&isDeloadWeek(programConfig,week);
      let onermInfo=null;
      /* The %1RM prescription resolves before the deload branch: a manually
         entered training max is a valid basis with no history, so a scheduled
         deload still reduces it. No basis at all means no card, even on a
         deload week. */
      const rx=(scheme==='onerm'&&mode!=='time')?onermRx():null;
      if(scheme==='onerm'&&mode!=='time'&&!rx)return null;
      if(deloadWeek&&(latest||rx)){
        if(latest&&!(latest.weight>0)&&!rx){
          /* #359: bodyweight (weight-0) deloads — there is no load to reduce,
             so scale the effort instead: reps drop to the deload %, never
             below the range floor. Timed work is never reduced: unweighted
             timed targets hold steady through a deload week (#285, user
             call) — the #79 no-change check below then suppresses the card
             and the workout keeps the latest target. Without this branch the
             engine would prescribe progression during a deload week. */
          nextWeight=0;
          if(mode==='time'){
            nextSeconds=latest.seconds;
            kind='deload';
            reason=`Week ${week} is a scheduled deload — bodyweight timed work holds steady at ${latest.seconds} seconds.`;
          }else{
            nextReps=Math.max(min,Math.round(latest.reps*(deloadPct/100)));
            kind='deload';
            reason=`Week ${week} is a scheduled deload — ${deloadPct}% of your latest bodyweight top set (${latest.reps} reps); suggesting the reduced target.`;
          }
        }else{
          let normal=0,normalNote='';
          if(rx){onermInfo=rx;normal=rx.weight;normalNote=`the ${rx.pct}% prescription`;}
          else if(repRangeChanged&&latest.weight>0&&!followLifter){
            /* Deload wins on load, but the week-range rebase still applies to
               the normal prescription the deload % is taken from. */
            const e1=estimate1RM({w:latest.weight,r:latest.reps,rpe:latest.rpe});
            const targetReps=profile?.openTop?min:Math.max(min,max);
            normal=Math.max(0,Math.round(e1/(1+targetReps/30)*10)/10);normalNote='the rebased prescription';estimated1RM=e1;
          }
          else{normal=latest.weight;normalNote='your latest top set';}
          /* #246: deloads snap to the configured increment step, not plates. */
          nextWeight=snapToIncrement(normal*(deloadPct/100),incrementType,incrementValueLb);
          if(rx)nextReps=latest?Math.min(max,Math.max(min,latest.reps)):min; // %1RM deload: the reduced load keeps the latest rep target (clamped to range), not the range minimum.
          kind='deload';
          reason=`Week ${week} is a scheduled deload — ${deloadPct}% of ${normalNote}; suggesting ${displayWeight(nextWeight)} ${weightUnit()}.`;
        }
      }
      /* Phase 6: scheme dispatch — the if/else chain below: %1RM → linear →
         range-change rebase → standard RPE double progression (rep jumps
         scaled by RPE headroom, #387) → no-RPE hold. */
      else if(rx){
        /* #552: reps-only progression forbids load changes — and a %1RM
           prescription IS a load change. Hold the latest top set instead;
           the #79 no-change check below suppresses the card. With no
           history there is no baseline to hold, so there is no suggestion. */
        if(repsOnly){
          if(!latest)return null;
          nextWeight=latest.weight;nextReps=latest.reps;kind='hold';
          reason='Reps-only progression is on for this exercise, so the %1RM load prescription holds your latest top set instead of prescribing a new load.';
        }else{
          onermInfo=rx;
          nextWeight=rx.weight;
          /* User 2026-09-22: %1RM preserves the latest top-set reps (clamped
             to the rep range) instead of dropping to the range minimum.
             270x5 stays 270x5, not 270x1. */
          nextReps=latest?Math.min(max,Math.max(min,latest.reps)):min;
          kind='onerm';estimated1RM=rx.basis;
          reason=`${rx.pct}% of ${rx.basisNote}; suggesting ${displayWeight(nextWeight)} ${weightUnit()}${profile?.amrap?' at AMRAP':` at ${nextReps} rep${nextReps===1?'':'s'}`}.`;
        }
      }
      // The standard path needs real history.
      else if(!latest)return null;
      else if(scheme==='linear'){
        // Linear progression (user's call 2026-09-11): the increment applies
        // every session, even when reps were missed; only the load moves.
        // #576 (user 2026-09-20): the rep/time range still binds the
        // prescription — a top set outside the range is pulled back inside
        // instead of carried through, so the range is never decorative.
        // QA batch (user 2026-09-21): below the range floor the increment
        // does NOT mint — the general "Back into range" guard below fires
        // instead (weight correction or hold, per the rep deficit).
        if(repsOnly){reason='Linear progression is on, but load progression is off for this exercise.';}
        /* #579 (agent 2026-09-20): a linear load increment needs a real load
           to add to. A weightless basis top set (0 lb logged) turned the raw
           increment into the prescription — the card read "5 lb" and tapping
           it wrote 5 lb into every set. A basis with no load is no basis for
           linear: return null so the engine falls through to the next basis
           (usually the fresh most-recent log, which the existing rebase logic
           then handles). When every basis is weightless there is no
           suggestion — the last-session targets still show. Timed work is
           exempt: unweighted timed sets are normal (a 0-lb plank), and the
           linear time progression is the tested #576 behavior. */
        else if(mode!=='time'&&!(latest.weight>0))return null;
        /* QA batch (user 2026-09-21, #11): "Back into range" — the full
           literature grounding lives with the formula in formulas/e1rm.js
           (backIntoRange). The guard: a linear top set below the rep range
           must not become "add the increment and clamp the reps". */
        else if(mode!=='time'&&!profile?.amrap&&!profile?.openTop&&latest.reps<min){
          /* QA batch (user 2026-09-21, #11): the pure math lives in
             formulas/e1rm.js → backIntoRange(); this branch only maps the
             result onto the suggestion and writes the reason strings. */
          const bir=backIntoRange(latest.weight,latest.reps,latest.rpe,min,max,incrementType,incrementValueLb);
          nextWeight=bir.nextWeight;nextReps=bir.nextReps;kind=bir.kind;
          if(bir.kind==='reps'){
            reason=`Below the ${min}–${max} range, but at RPE ${latest.rpe} the ${displayWeight(latest.weight)} ${weightUnit()} load is right for it — holding the load and building from ${latest.reps} toward ${max} reps.`;
          }else{
            const deficit=min-latest.reps;
            estimated1RM=bir.estimated1RM;
            reason=`Back into range: your ${displayWeight(latest.weight)} ${weightUnit()} × ${latest.reps} top set is ${deficit} rep${deficit===1?'':'s'} short of the ${min}–${max} range. Suggesting ${displayWeight(bir.nextWeight)} ${weightUnit()} × ${bir.nextReps} from your estimated 1RM of ${displayWeight(Math.round(bir.estimated1RM))} ${weightUnit()} so the next session works the middle of the range at the same effort.`;
          }
        }
        else{
          nextWeight=roundedIncrement(latest.weight,incrementType,incrementValueLb);kind='load';
          let clampedNote='';
          if(mode==='time'){
            const c=Math.min(timeMax,Math.max(timeMin,nextSeconds));
            if(c!==nextSeconds)clampedNote=` Seconds pulled into the ${timeMin}–${timeMax}s range.`;
            nextSeconds=c;
          }else{
            const c=Math.min(max,Math.max(min,nextReps));
            if(c!==nextReps)clampedNote=` Reps pulled into the ${min}–${max} range.`;
            nextReps=c;
          }
          reason=`Linear progression: add ${actualStepLabel(nextWeight,latest.weight,incrementType)||incrementLabel} every session.${clampedNote}`;
        }
      }
      // Freestyle follow-the-lifter skips the e1RM rebase entirely: there is no
      // prescribed zone to rebase into, the lifter's own zone is the target.
      /* #381: ...&&!latestInNewZone — when the top set already sits inside the
         new range there is nothing to rebase onto it; the standard double
         progression below handles it. Without this the remap mints
         rep-regression cards (110x10 → 110x6 at the same load). */
      else if(repRangeChanged&&latest.weight>0&&!followLifter&&!latestInNewZone){
        /* #557: the cross-zone notice — a range switch whose top set can't be
           rebased must not vanish silently. Shared by the rebase holds below;
           the #79 check keeps the suggestion as an informational row. */
        const rangeNotice=()=>({title:'New rep range',
          body:`Your ${displayWeight(latest.weight)} ${weightUnit()} × ${latest.reps} top set doesn't map onto the new ${programRangeLabel(profile)} range yet — log a session in the new range to get a suggestion.`});
        /* #300: the RPE trigger gates the rebase too. A top set above the
           trigger earned no progression — rebasing it into a new range would
           mint a rep-regression card (e.g. 405x3 → 405x1 at the same weight)
           the lifter never earned, and the RPE gate must not be bypassed on
           range changes. Hold the top set instead (the defaults already equal
           it); the #79 no-change check below suppresses the card, which is
           the honest outcome. #490 follow-up (user 2026-09-16): the gate runs
           on the raw top-set RPE — fatigue no longer blocks.
           QA batch (user 2026-09-22): the rebase gates on the RAW RPE, not
           the effective gate. Under "Advance on completion" gateRpeEff reads
           as the trigger itself, so a max-effort set (RPE 10) rebased into
           the new range and minted a heavier prescription off it
           (50×6@10 → 51×5) — the exact rep-regression card #300 prevents.
           You never earned a heavier load off a max set; hold instead. The
           standard (non-rebase) path still advances on completion per #565. */
        /* #497 (removed, user 2026-09-19): RPE 0 used to mean "trivially easy
           — not a work set", so a range change never rebased a prescription
           off it. The user's call: you should always be able to advance —
           RPE 0 now flows through the normal trigger like any RPE ≤
           threshold. */
        if(latest.rpe!=null&&gateRpe!=null&&gateRpe>threshold){
          kind='hold';reason='Top-set RPE is above the progression trigger.';
        }else if(repsOnly){
          /* Reps-only progression forbids load changes — and a range-change
             rebase IS a load change. Hold the top set instead of prescribing
             a load the user ruled out; #79 then suppresses the no-change card. */
          kind='hold';reason='Reps-only progression is on for this exercise, so the range change holds the top-set load instead of re-basing it.';
          notice=rangeNotice();
        }else{
        estimated1RM=estimate1RM({w:latest.weight,r:latest.reps,rpe:latest.rpe});
        const targetReps=profile?.openTop?min:Math.max(min,max),rawTarget=estimated1RM/(1+targetReps/30);
        /* #246 (user 2026-09-14): the rebased load snaps to the configured
           increment step, not plates (reverses the #394 plate snap — the
           increment setting is what it's there for). #394's regression
           guard stands: the snap must never push the prescription below the
           top set the lifter already handles. When snapping down would
           regress, round UP to the next increment multiple instead of
           dropping to a finer grain — still a prescription, still on the
           grid, still never below the handled load. */
        const snappedLoad=snapToIncrement(rawTarget,incrementType,incrementValueLb);
        nextWeight=Math.max(0,snappedLoad<latest.weight?snapUpToIncrement(rawTarget,incrementType,incrementValueLb):snappedLoad);
        /* QA batch (user 2026-09-22): per-dumbbell achievability — the
           canonical total must stay a multiple of 2× the increment so each
           hand gets a real dumbbell, never a phantom 18.5/db. The snap above
           already runs on the doubled grid (incrementValueLb); this re-pins
           it so no path can leak an odd canonical total. Percent increments
           keep the #473 5-lb grid. */
        if(_perDbInc&&incrementType!=='percent'&&incrementValueLb>0){
          nextWeight=Math.round(nextWeight/incrementValueLb)*incrementValueLb;
        }
        /* #428 (user 2026-09-13): the load above was computed FOR targetReps —
           the prescription must use those same reps. nextReps=min minted
           1-rep max-test cards on range changes (110x10 → 130x1); the honest
           target is the load's own rep count (130x5). Never 1. */
        nextReps=targetReps;kind='range';
        const weekPrefix=config?.freeform?'This session is ':week?`Week ${week} is `:'This block is ';
        reason=`${weekPrefix}${programRangeLabel(profile)}; suggesting ${displayWeight(nextWeight)} ${weightUnit()} from your estimated 1RM of ${displayWeight(Math.round(estimated1RM))} ${weightUnit()} so the new rep target starts at a sensible load.`;
        /* #250: a rebased target must never regress below the lifter's current
           top set. When the computed load would drop (e.g. a high-RPE top set
           rebased into a lower-rep range), hold the top set instead — the #79
           no-change check below then suppresses the card, which is the honest
           outcome: a top set above the RPE trigger earns no progression.
           #381: the same guard covers a rep drop at an unchanged load
           (110x10 → 110x6) — fewer reps at the same weight is also a
           regression, never a suggestion. */
        if(nextWeight<latest.weight||(nextWeight===latest.weight&&nextReps<latest.reps)){
          nextWeight=latest.weight;nextReps=latest.reps;kind='hold';
          reason=`${weekPrefix}${programRangeLabel(profile)}, but the rebased target would regress your ${displayWeight(latest.weight)} ${weightUnit()} × ${latest.reps} top set — holding steady.`;
          notice=rangeNotice();
        }
        }
      /* #497 (removed, user 2026-09-19): RPE 0 used to mean "trivially easy —
         not a work set", holding the top set here so it never reached the
         #387 headroom formula (10−0 would have minted a +10 rep jump). The
         user's call: you should always be able to advance — RPE 0 now flows
         into the normal trigger below, with the jump clamped to the
         conservative trigger-sized step. */
      } else if(gateRpeEff!=null && gateRpeEff<=threshold){
        /* #387 (user 2026-09-14): rep jumps scale with RPE headroom (RIR) —
           the further under the trigger, the bigger the jump: RPE 8 → +2,
           RPE 7 → +3, RPE 6 → +4. Never a token +1. If the jump would
           overshoot the range top, advance the load instead (existing
           load-increase/reset path) — the jump is never faked down to stay
           inside the range. Timed work scales the time step by the same
           jump. The load step also scales with RPE headroom on the
           add-load-and-reset paths (user 2026-09-19, approved as proposed):
           m = 1 + headroom/2, capped at 2×.
           #490 follow-up (user 2026-09-16): the jump runs on the raw
           top-set RPE.
           #565 (user 2026-09-19): with "Advance on completion" the jump is
           the conservative trigger-sized step — never a 10-RIR jump off a
           missing RPE. #497 removal (user 2026-09-19): RPE ≤ 0 clamps to
           the trigger-sized step too — RPE 0 advances, never +10 reps.
           RPE-scaled load increments (user 2026-09-19, approved as proposed):
           the add-load-and-reset paths below scale the load step with RPE
           headroom too — m = 1 + headroom/2, capped at 2×. */
        const completionDrove=advanceOnCompletion&&!(gateRpe!=null&&gateRpe<=threshold)&&scheme!=='linear';
        const repJump=rpeRepJump(advanceOnCompletion||gateRpe<=0?threshold:gateRpe);repJumpUsed=repJump;
        /* RPE-scaled load increments (user 2026-09-19, approved as proposed):
           the load step scales with RPE headroom (trigger − RPE):
           m = 1 + headroom/2, capped at 2×. RPE 8 @ trigger 8 → 1×,
           RPE 7 → 1.5×, RPE 6 or lower → 2× cap; fractional RPEs work
           naturally (7.5 → 1.25×). Completion mode and RPE ≤ 0 read as the
           trigger itself (the same clamp as the rep jump), so they never
           scale. %1RM, linear, reps-only, distance, and the range-rebase
           path are untouched by construction — this runs only on the
           RPE-scheme add-load-and-reset paths. */
        const loadHeadroom=Math.max(0,threshold-(advanceOnCompletion||gateRpe==null||Number(gateRpe)<=0?threshold:Number(gateRpe)));
        const loadMult=Math.min(2,1+loadHeadroom/2);
        /* The one-line reason annotation for a scaled jump — only when the
           multiplier actually grew the step (m > 1). */
        const scaledJumpLine=nextW=>loadMult>1?` Top set was ${fmtRpe(loadHeadroom)} under the RPE trigger, so the jump is ${loadMult===2?'doubled':String(Math.round(loadMult*100)/100)+'×'} to ${actualStepLabel(nextW,latest.weight,incrementType)||incrementLabel}.`:'';
        if(mode==='time'){
          /* Seconds are discrete too: the time step itself can be fractional,
             so the whole jump resolves to whole seconds (#483). */
          const secJump=Math.round(timeStep*repJump);
          if(latest.seconds<timeMax){nextSeconds=Math.min(timeMax,Math.max(timeMin,Math.round(latest.seconds+secJump)));kind='time';reason=`Top set was at or below RPE ${threshold}; add ${secJump} seconds inside the ${timeMin}–${timeMax}s range.${fatigueClause}`;}
          else if(repsOnly){kind='hold';reason=`Time ceiling reached. Load progression is off, so hold ${timeMax} seconds.`;}
          /* #558: the add-load-and-reset path needs a real load to add to —
             an unweighted (0-lb) timed exercise at its ceiling has no load
             progression to offer, so prescribing one fabricates a weighted
             suggestion the lifter never asked for. Hold the ceiling instead;
             #79 suppresses the no-change card. */
          else if((Number(latest.weight)||0)>0){nextWeight=scaledLoadIncrement(latest.weight,incrementType,incrementValueLb,loadMult);nextSeconds=timeMin;kind='load';reason=`Time ceiling reached at RPE ${latest.rpe}; add ${actualStepLabel(nextWeight,latest.weight,incrementType)||incrementLabel} and reset to ${timeMin} seconds.${scaledJumpLine(nextWeight)}${fatigueClause}`;}
          else{kind='hold';reason=`Time ceiling reached at ${timeMax} seconds — holding steady.`;}
        } else if(profile?.amrap){nextReps=Math.max(min,latest.reps);kind='hold';reason=`AMRAP target: keep the load and take the set to the effort target (top-set RPE ${threshold} or below).${fatigueClause}`;}
        else if(profile?.openTop){nextReps=Math.max(min,latest.reps+repJump);kind='reps';reason=`Open-ended range: add ${repJump} reps while the top set stays at or below RPE ${threshold}.${fatigueClause}`;}
        else if(latest.reps+repJump<=max){nextReps=Math.max(min,latest.reps+repJump);kind='reps';reason=`Top set was at or below RPE ${threshold}; add ${repJump} reps inside the ${min}–${max} range.${fatigueClause}`;}
        else if(repsOnly){kind='hold';reason=`Rep range topped out — adding ${repJump} reps would exceed the ${min}–${max} range and load progression is off, so hold ${displayWeight(latest.weight)||0} ${weightUnit()}.`;}
        // A single-number zone (min===max, the freestyle follow-the-lifter retarget)
        // reads better as "add load at N reps" than "reset to N reps".
        /* QA batch (user 2026-09-22): the add-load-and-reset path needs a real
           load to add to — an unweighted (0-lb) exercise at its rep ceiling
           has no load progression to offer, so prescribing one fabricated the
           "Add weight · 1 rep" card off a 0-lb basis (the timed branch
           already holds via #558; this is the reps twin). Hold the ceiling
           instead; #79 suppresses the no-change card. */
        else if((Number(latest.weight)||0)<=0){kind='hold';reason=`Rep ceiling reached at bodyweight — there's no load to add, so holding ${latest.reps} reps.`;}
        else{nextWeight=scaledLoadIncrement(latest.weight,incrementType,incrementValueLb,loadMult);nextReps=min;kind='load';reason=min===max?`Top set was at or below RPE ${threshold}; add ${actualStepLabel(nextWeight,latest.weight,incrementType)||incrementLabel} at ${min} reps.${scaledJumpLine(nextWeight)}${fatigueClause}`:(latest.reps<max?`Top set was at or below RPE ${threshold}, but ${repJump} more reps would exceed the ${min}–${max} range; add ${actualStepLabel(nextWeight,latest.weight,incrementType)||incrementLabel} and reset to ${min} reps.${scaledJumpLine(nextWeight)}${fatigueClause}`:`Rep ceiling reached at RPE ${latest.rpe}; add ${actualStepLabel(nextWeight,latest.weight,incrementType)||incrementLabel} and reset to ${min} reps.${scaledJumpLine(nextWeight)}${fatigueClause}`);}
        /* #565: when completion (not a low RPE) drove the suggestion, say so
           — only on advancing kinds, never on holds. */
        if(completionDrove&&(kind==='reps'||kind==='load'||kind==='time'))reason+=' Advancing on completion — RPE isn\u2019t gating this suggestion.';
      } else if(latest.rpe==null){
        /* #565: a missing RPE used to vanish through the #79 no-change check
           — the beginner saw no suggestion and read it as broken progression.
           Surface an informational notice instead: RPE is optional, but the
           engine needs it to prescribe the next step. */
        reason='No RPE on the latest top set, so the engine holds the target.';
        notice={title:'No RPE logged',
          body:'Log RPE (0–10) on your sets — it\u2019s optional, but the engine needs it to suggest your next step.'};
      }
      /* QA batch (user 2026-09-22): a top set at RPE 10 (or otherwise above
         the trigger) used to vanish through the #79 no-change check — the
         user saw no card and read it as broken progression. Like the
         missing-RPE case above, surface an informational notice so the hold
         explains itself instead of disappearing. This lives BEFORE the
         All-sets expansion so the notice survives its early return. */
      if(!notice&&kind==='hold'&&latest&&latest.rpe!=null&&Number(latest.rpe)>threshold){
        notice={title:`Held at RPE ${latest.rpe}`,
          body:`The top set hit RPE ${latest.rpe} — above the RPE ${threshold} trigger. The target holds here; hit the reps with gas left to progress.`};
      }
      /* #400 (user 2026-09-14): "All sets" — per-set targets indexed by
         non-warmup set position in the basis log. The top set keeps the
         standard computation above; each back-off set either cascades the
         top set's step shape from its own baseline (top progressed) or is
         evaluated independently against its own RPE (top stalled). Missing
         back-off RPE holds conservatively; a position with no baseline gets
         no target — never invented. Back-off load never exceeds the top-set
         load (a baseline already above it is held, never cut). */
      /* Phase 7: "All sets" expansion (#400, user 2026-09-14) — per-set targets
         indexed by non-warmup set position in the basis log. The top set keeps
         the standard computation above; back-off sets cascade the top set's
         step shape from their own baseline (top progressed) or are evaluated
         independently against their own RPE (top stalled). Never invents
         targets; back-off load never exceeds the top-set load. */
      let setTargets=null,topIndex=0;
      /* basisSets is hoisted above the scheme branches (see above) for the
         top-set card and this per-set expansion. */
      if(latest){
        topIndex=basisSets.length?Math.max(0,Math.min(latest.index||0,basisSets.length-1)):0;
        const topProgressed=kind==='reps'||kind==='load'||kind==='time';
        const targets=[];let anyChange=false;
        const isChange=(t,bw,bp)=>!(Math.abs((t.w||0)-(bw||0))<0.001&&(mode==='time'?t.seconds===bp:t.r===bp));
        for(let i=0;i<basisSets.length;i++){
          const base=basisSets[i]||{};
          const bw=Number(base.w)||0,br=Number(base.r)||0,bs=Number(base.seconds)||0;
          const brpe=blankRpeToNull(base.rpe);
          /* Never invent a target without history: a blank slot at this
             position stays blank. */
          if(!(bw>0||br>0||bs>0)){targets.push(null);continue;}
          let t=null;
          if(i===topIndex){
            t={w:nextWeight,r:nextReps,seconds:nextSeconds,kind};
          }else if(kind==='deload'){
            /* Deload week: scale each back-off baseline by the same %.
               Unweighted timed work never deloads (#285) — hold the seconds. */
            if(bw>0)t={w:snapToIncrement(bw*(deloadPct/100),incrementType,incrementValueLb),r:br,seconds:0,kind:'deload'};
            else if(mode==='time')t={w:0,r:0,seconds:bs,kind:'deload'};
            else t={w:0,r:Math.max(min,Math.round(br*(deloadPct/100))),seconds:0,kind:'deload'};
          }else if(topProgressed){
            /* #578 (user 2026-09-20): linear keeps the scheme's contract on
               back-offs too — the load step applies to every set and reps
               stay inside the range (never a reset to the floor, and RPE
               never gates a linear step). */
            if(scheme==='linear'&&bw>0)t={w:Math.min(roundedIncrement(bw,incrementType,incrementValueLb),nextWeight),r:mode==='time'?0:Math.min(max,Math.max(min,br)),seconds:mode==='time'?Math.min(timeMax,Math.max(timeMin,bs)):0,kind:'load'};
            else if(brpe!=null&&(brpe>threshold||Number(brpe)<=0))t=null;
            else if(kind==='reps')t={w:bw,r:profile?.openTop?br+repJumpUsed:Math.min(max,br+repJumpUsed),seconds:0,kind:'reps'};
            else if(kind==='time')t={w:bw,r:0,seconds:Math.min(timeMax,Math.max(timeMin,Math.round(bs+timeStep*repJumpUsed))),kind:'time'};
            else if(kind==='load'&&bw>0){
              /* Load step + reset to min, mirroring the top set. Never above
                 the top set's new load. */
              t={w:Math.min(roundedIncrement(bw,incrementType,incrementValueLb),nextWeight),r:min,seconds:0,kind:'load'};
            }
          }else if(!profile?.amrap&&kind!=='range'&&kind!=='backrange'&&kind!=='onerm'&&brpe!=null&&Number(brpe)>0&&brpe<=threshold){
            /* Top set stalled: independent evaluation — the #387-sized step
               from this set's own baseline. AMRAP and range-rebase weeks
               hold back-offs; %1RM is a top-set prescription. #497: RPE 0 is
               not a work set — a trivially-easy back-off never reaches the
               headroom formula. */
            const jr=rpeRepJump(brpe);
            if(mode==='time'){
              if(bs<timeMax)t={w:bw,r:0,seconds:Math.min(timeMax,Math.round(bs+timeStep*jr)),kind:'time'};
              else if(!repsOnly&&bw>0)t={w:Math.min(roundedIncrement(bw,incrementType,incrementValueLb),nextWeight),r:0,seconds:timeMin,kind:'load'};
            }else if(profile?.openTop||br+jr<=max)t={w:bw,r:Math.max(min,br+jr),seconds:0,kind:'reps'};
            else if(!repsOnly&&bw>0)t={w:Math.min(roundedIncrement(bw,incrementType,incrementValueLb),nextWeight),r:min,seconds:0,kind:'load'};
          }
          /* Hold: the target is the baseline itself. */
          if(!t)t={w:bw,r:mode==='time'?0:br,seconds:mode==='time'?bs:0,kind:'hold'};
          /* Back-off load never exceeds the top-set load — but a baseline
             already above it is held, never cut. */
          if(i!==topIndex&&t.w>nextWeight)t.w=Math.max(nextWeight,bw);
          const moved=isChange(t,bw,mode==='time'?bs:br);
          if(moved)anyChange=true;
          targets.push({index:i,w:t.w,r:t.r,seconds:t.seconds,kind:t.kind,changed:moved,oldW:bw,oldR:br,oldSeconds:bs});
        }
        /* #79, per-set edition: no set actually moves → no suggestion at all —
           UNLESS a notice explains the hold (QA batch 2026-09-22). Swallowing
           the notice here is what made All-sets users read a held top set as
           broken progression — the "Held at RPE …" / "No RPE logged" card
           must survive. */
        if(!anyChange&&!notice)return null;
        setTargets=targets;
      }
      /* Phase 8: no-change suppression (#79) — see below. A suggestion that
         proposes no actual change from the latest top set is noise, not
         guidance, so it returns null here. (The held-above-threshold notice
         now lives above the All-sets expansion so it survives its early
         return.) */
      /* #79: suppress suggestions that propose no actual change from the latest
         top set (e.g. "25 lb · 6 reps → 25 lb · 6 reps"). A suggestion that
         changes nothing is noise, not guidance. With All sets on, the
         per-set computation above already returned null when no set moves.
         (v1.883: the %1RM bypass of this suppression is reverted — no user
         approval was found for it, and the approved %1RM rep-preservation
         flow does not depend on it.) */
      if(!setTargets&&latest){
        const weightSame=Math.abs((nextWeight||0)-(latest.weight||0))<0.001;
        const noChange=mode==='time'
          ? weightSame&&nextSeconds===latest.seconds
          : profile?.amrap ? weightSame : weightSame&&nextReps===latest.reps;
        /* #557/#565: a hold that carries an informational notice is not
           noise — the user would otherwise read the missing card as broken.
           Keep it; the card renderer shows it as a non-tappable row. */
        if(noChange&&!notice)return null;
      }
      /* #473 (user 2026-09-14): #246 promised never a decimal, but a whole-unit
         canonical total still halves into .5 in per-dumbbell display
         (109 → "54.5 lb"). When this exercise displays per-dumbbell, new
         prescription loads snap to an even whole total so the shown weight
         stays whole. History/hold baselines are untouched — only the new
         targets this suggestion prescribes. */
      const _suggIsDb=typeof exercises!=='undefined'&&(resolveExercise(exerciseId)||{}).equipment==='dumbbell';
      const _suggDbItem=workoutState.draft&&workoutState.draft.exercises?workoutState.draft.exercises.find(row=>row.exerciseId===exerciseId):null;
      /* #538: single-dumbbell exercises display the canonical weight as-is —
         the even-total snap would corrupt the prescription (25 → 26). */
      if(_suggIsDb&&dbEntryMode(exerciseId,_suggDbItem)==='per'&&!dbSingleDumbbell(exerciseId,_suggDbItem)){
        const _evenTotal=w=>w>0?Math.round(w/2)*2:w;
        if(kind!=='hold')nextWeight=_evenTotal(nextWeight);
        if(setTargets)setTargets.forEach(t=>{if(t&&t.changed&&t.kind!=='hold'&&t.w>0)t.w=_evenTotal(t.w);});
      }
      /* #472 (user 2026-09-15): serializable basis-set copy for the top-set
         card's per-set lines (suggestionCardMarkup below). Computed from the
         hoisted basisSets so it exists for the top-set case too. */
      const basisSetData=basisSets.map(s=>({w:Number(s.w)||0,r:Number(s.r)||0,seconds:Number(s.seconds)||0}));
      return {exerciseId,latest,mode,nextWeight,nextReps,nextSeconds,kind,reason,notice,estimated1RM,sourceDate:latestLog?.isoDate,sourceWorkout:latestLog?.name,range:mode==='time'?[timeMin,timeMax]:[min,max],timeStep,repsOnly,freeform:!!config?.freeform,scheme,amrap:!!profile?.amrap,pct:onermInfo?.pct??null,tmSource:onermInfo?.tmSource??null,setTargets,topIndex,basisSets:basisSetData,fatigue:{penalty:fatigue.penalty,effectiveRpe:fatigue.effectiveRpe,workSets:fatigue.workSets}};
      } /* end computeFromBasis */
    }

    /* HTML for one suggestion card: target vs basis, with an apply button when interactive. */
    function suggestionCardMarkup(suggestion,index,interactive=true) {
      const ex=resolveExercise(suggestion.exerciseId);
      /* #430 (user 2026-09-13): suggestion cards honor the dumbbell entry
         mode like the set cards do. Stored weights are canonical
         total-combined; 'per' displays half. The per-exercise override comes
         from the live draft item when this card renders in a live workout. */
      const isDb=ex?.equipment==='dumbbell';
      const draftItem=workoutState.draft?.exercises?.find(row=>row.exerciseId===suggestion.exerciseId);
      const dbW=w=>dbDisplayWeight(w,suggestion.exerciseId,draftItem,isDb);
      /* #246 (user 2026-09-14): "1 rep", not "1 reps" on the cards. */
      /* #498: distance suggestions render load × distance ("90 lb · 40 m"). */
      const isDist=!!suggestion.isDistance;
      const formatTarget=(weight,performance)=>`${weight ? `${dbW(weight)} ${weightUnit()} · ` : ''}${performance} ${isDist?'m':suggestion.mode==='time'?'sec':Number(performance)===1?'rep':'reps'}`;
      /* #285: flipping a reps-history exercise to time tracking leaves
         latest.seconds at 0 — "0 sec" as the old target is nonsense. Suppress
         the seconds when there is no timed history. */
      const oldPerf=isDist?(suggestion.latest&&suggestion.latest.distance>0?suggestion.latest.distance:null):suggestion.mode==='time'?(suggestion.latest.seconds>0?suggestion.latest.seconds:null):suggestion.latest.reps;
      const oldTarget=suggestion.latest?(oldPerf==null?(suggestion.latest.weight?`${dbW(suggestion.latest.weight)} ${weightUnit()}`:'—'):formatTarget(suggestion.latest.weight,oldPerf)):`1RM ${dbW(suggestion.estimated1RM)} ${weightUnit()}`;
      const nextTarget=suggestion.amrap&&suggestion.mode!=='time'?`${suggestion.nextWeight?`${dbW(suggestion.nextWeight)} ${weightUnit()} · `:''}AMRAP`:formatTarget(suggestion.nextWeight,suggestion.mode==='time'?suggestion.nextSeconds:isDist?suggestion.nextDistance:suggestion.nextReps);
      /* #429 (user 2026-09-13): when a range-rebase card's headline change is a
         load increase, the load wins the chip — "New range"/"Week range"
         buries the actionable information. A rebase that only moves reps
         keeps the range chip. */
      /* #568: same plain-language kind labels as the live cardSuggestionHtml
         above — this renderer is test-only, but if it's ever revived it must
         not ship the old insider shorthand. */
      const rangeLabel=(suggestion.nextWeight||0)>(suggestion.latest?.weight||0)?'Add weight':'New range';
      const kindLabel=k=>k==='hold'?'Hold':k==='load'?'Add weight':k==='onerm'?'%1RM':k==='deload'?'Deload':k==='range'?rangeLabel:k==='backrange'?'Back into range':k==='time'?'Add time':'Add reps';
      let label,changeHtml;
      if(suggestion.setTargets){
        /* #400: the change area becomes per-set lines. A stalled top set
           leads with "Hold"; every set that actually moves gets its own
           "Set N: old → new" line. Sets that hold stay quiet. */
        const topIdx=suggestion.topIndex||0;
        const topT=suggestion.setTargets[topIdx];
        const topKind=topT?.kind||suggestion.kind;
        const othersMove=suggestion.setTargets.some((t,i)=>t&&t.changed&&i!==topIdx);
        label=suggestion.applied?'Applied ✓':(topKind==='hold'&&othersMove?'Sets +':kindLabel(topKind));
        /* #472 (user 2026-09-14): set lines render in numeric order. The
           top-set Hold line used to lead regardless of position, so a
           stalled top set (e.g. Set 3) printed before Sets 1–2. Every line
           is collected with its set index and the card sorts them. */
        const lines=[];
        if(topT&&!topT.changed)lines.push({idx:topIdx,html:'<div class="suggestion-set-line is-hold"><span>Set '+(topIdx+1)+'</span><span>Hold</span></div>'});
        for(const t of suggestion.setTargets){
          if(!t||!t.changed)continue;
          const oldPerf=suggestion.mode==='time'?(t.oldSeconds>0?t.oldSeconds:null):t.oldR;
          const newPerf=suggestion.mode==='time'?t.seconds:t.r;
          const oldS=oldPerf==null?(t.oldW?(dbW(t.oldW)+' '+weightUnit()):'—'):formatTarget(t.oldW,oldPerf);
          lines.push({idx:t.index,html:'<div class="suggestion-set-line"><span>Set '+(t.index+1)+'</span><span>'+oldS+'</span><span>→</span><strong>'+formatTarget(t.w,newPerf)+'</strong></div>'});
        }
        lines.sort((a,b)=>a.idx-b.idx);
        changeHtml='<div class="suggestion-sets">'+lines.map(l=>l.html).join('')+'</div>';
      }else{
        label=suggestion.applied?'Applied ✓':kindLabel(suggestion.kind);
        /* #472 (user 2026-09-15): the top-set card lists every basis set in
           numeric order, one line per set. The card applies its target to
           every set on tap, so each line shows its own baseline → the same
           new target. Sets with no data are skipped; one or fewer non-blank
           basis sets keeps the single-line format. No is-hold line here —
           every set gets the new target, so there is no hold state. */
        const cardBasis=(suggestion.basisSets||[]).filter(b=>b&&((b.w||0)>0||(b.r||0)>0||(b.seconds||0)>0||(b.distance||0)>0));
        if(cardBasis.length>1){
          changeHtml='<div class="suggestion-sets">'+cardBasis.map((b,i)=>{
            const oldPerfB=isDist?(b.distance>0?b.distance:null):suggestion.mode==='time'?(b.seconds>0?b.seconds:null):b.r;
            const oldSB=oldPerfB==null?(b.w?dbW(b.w)+' '+weightUnit():'—'):formatTarget(b.w,oldPerfB);
            return '<div class="suggestion-set-line"><span>Set '+(i+1)+'</span><span>'+oldSB+'</span><span>→</span><strong>'+nextTarget+'</strong></div>';
          }).join('')+'</div>';
        }else{
          changeHtml='<div class="suggestion-change"><span>'+oldTarget+'</span><span>→</span><strong>'+nextTarget+'</strong></div>';
        }
      }
      // user 2026-09-11 (#44): cards stay lean — name, kind, and the target
      // change only. The reason/basis sentences were gratuitous.
      return `<${interactive?'button':'div'} class="suggestion-card ${suggestion.applied?'applied':''}" ${interactive?`type="button" data-demo-suggestion="${index}"`:''}><div class="suggestion-name"><span class="suggestion-exercise">${escapeHtml(ex?.name||'Exercise')}</span><span>${label}</span></div>${changeHtml}</${interactive?'button':'div'}>`;
    }

    /* #406 (user 2026-09-16): the suggestion UI lives inside each exercise
       card, merged with the history ("Last:") line — not in a separate
       banner. A compact tappable row: kind chip, the new target, and the
       basis it was computed from. Tapping applies through the existing
       applyProgressionSuggestion (ghost placeholders — typed values are
       never wiped); the applied row renders quiet and untappable. */
    function cardSuggestionHtml(item,suggestion){
      const ex=resolveExercise(suggestion.exerciseId);
      /* #430: the row honors the dumbbell entry mode like the set cards. */
      const isDb=ex?.equipment==='dumbbell';
      const dbW=w=>dbDisplayWeight(w,suggestion.exerciseId,item,isDb);
      const formatTarget=(weight,performance)=>`${weight?`${dbW(weight)} ${weightUnit()} · `:''}${performance} ${suggestion.mode==='time'?'sec':Number(performance)===1?'rep':'reps'}`;
      const nextTarget=suggestion.amrap&&suggestion.mode!=='time'
        ?`${suggestion.nextWeight?`${dbW(suggestion.nextWeight)} ${weightUnit()} · `:''}AMRAP`
        :formatTarget(suggestion.nextWeight,suggestion.mode==='time'?suggestion.nextSeconds:suggestion.nextReps);
      /* #568: plain-language kind labels — "Load +"/"Rep +"/"Week range" are
         insider shorthand. %1RM and Deload are real terms the app defines
         elsewhere, so they stay. */
      const kindLabel=suggestion.kind==='hold'?'Hold':suggestion.kind==='load'?'Add weight':suggestion.kind==='onerm'?'%1RM':suggestion.kind==='deload'?'Deload':suggestion.kind==='range'?'New range':suggestion.kind==='backrange'?'Back into range':suggestion.kind==='time'?'Add time':'Add reps';
      /* #557/#565: informational notices render as a muted non-tappable row —
         never a button, so there is no apply path and no ghosted targets. */
      if(suggestion.notice){
        return `<div class="suggestion-inline notice"><span class="suggestion-inline-kind">${escapeHtml(suggestion.notice.title)}</span><span class="suggestion-inline-basis">${escapeHtml(suggestion.notice.body)}</span></div>`;
      }
      if(suggestion.applied){
        return `<div class="suggestion-inline applied" data-card-suggestion-applied tabindex="-1"><span class="suggestion-inline-kind">Applied ✓</span><span class="suggestion-inline-basis">Targets are shown faded in the set fields below — type over any of them.</span></div>`;
      }
      /* Basis, kept short: "from 100 lb × 8 @ RPE 8 · Sep 10". */
      const basisBits=[];
      if(suggestion.latest){
        const lw=suggestion.latest.weight;
        const lp=suggestion.mode==='time'?suggestion.latest.seconds:suggestion.latest.reps;
        basisBits.push(`${lw?`${dbW(lw)} ${weightUnit()} × `:''}${lp==null||lp===''?'—':lp}${suggestion.mode==='time'?' sec':' reps'}${suggestion.latest.rpe!=null?` @ RPE ${suggestion.latest.rpe}`:''}`);
      }
      if(suggestion.sourceDate)basisBits.push(formatLogDate(suggestion.sourceDate));
      const basis=basisBits.length?`from ${basisBits.join(' · ')}`:'';
      /* #400: with All sets on, one tap applies each set's own target. */
      /* QA batch (user 2026-09-22): per-set targets are the only path now —
         every suggestion carries its own target per set. */
      const tapCopy='each set’s own target';
      return `<button class="suggestion-inline" type="button" data-card-suggestion="${escapeHtml(item.uid)}" aria-label="Apply suggestion ${escapeHtml(nextTarget)} to ${escapeHtml(ex?.name||'exercise')}"><span class="suggestion-inline-kind">${kindLabel}</span><strong class="suggestion-inline-target">${nextTarget}</strong><span class="suggestion-inline-basis">${basis?escapeHtml(basis)+' — ':''}tap to apply ${tapCopy}</span></button>`;
    }

    /* The effective progression config for a draft exercise: its own, else
       program or global defaults. */
    function progressionProfileForDraftItem(item) {
      const ex=resolveExercise(item.exerciseId),mode=exerciseTracking(item,ex);
      const config=workoutState.activeProgram?.progression||progressionSetup,range=config.defaultRange||progressionSetup.defaultRange;
      /* #99 B7: the draft fallback routes through the canonical factory. */
      return item.progression || defaultExerciseProgression({mode,min:range.min,max:range.max,openTop:range.openTop,amrap:range.amrap,timeStep:config.timeStep||5,incrementType:config.incrementType||'lb',incrementValue:config.incrementValue||5});
    }

    /* Out-of-program workouts: global defaults plus the freeform flag. */
    function freeformProgressionConfig() {
      // Out-of-program workouts: global defaults and the freeform flag so the
      // engine follows the lifter's last zone instead of rebasing into the
      // default range (see progressionForExercise).
      return {...progressionSetup,freeform:true};
    }

    /* Computes fresh suggestions for every draft exercise (skipped for edits
       and when progression is off). */
    function prepareDraftProgression(draft,programConfig) {
      if(!draft)return;
      /* #148: editing a previously completed workout is history, not a plan —
         no suggestion cards and no ghosted targets. Clear any stale
         suggestions so nothing session-planning leaks into the edit. */
      if(draft.editingId){draft.progressionSuggestions=[];draft.exercises.forEach(item=>{delete item.suggestedTarget;delete item.suggestedTargets;});draft.suggestionVersion=suggestionEngineVersion();return;}
      /* #405: progression off at the program/global level → no suggestions at
         all (per-exercise 'off' is handled inside progressionForExercise). */
      const effectiveConfig=programConfig||workoutState.activeProgram?.progression||progressionSetup;
      if(progressionSetup.progressionOff||effectiveConfig?.progressionOff){draft.progressionSuggestions=[];draft.suggestionVersion=suggestionEngineVersion();return;}
      draft.progressionSuggestions=draft.exercises.map(item=>{
        // #48: the draft item carries a prescribed zone when it was copied from
        // a real workout (repeat) or a zoned template — the freestyle
        // follow-the-lifter retarget must not collapse it.
        const p=item.progression,hasStoredZone=!!(p&&(p.min!=null||p.max!=null||p.amrap||p.openTop));
        return progressionForExercise(item.exerciseId,progressionProfileForDraftItem(item),programConfig,hasStoredZone);
      }).filter(Boolean);
      draft.suggestionVersion=suggestionEngineVersion();
    }
    /* #472/#473 follow-up (user 2026-09-15): suggestions are computed once at
       draft creation and the draft (with its cards and ghost targets) is
       persisted — a workout started under an older build kept that build's
       rounding and card data after updating, so fixed bugs kept showing on
       the phone (136 lb from the pre-#473 rounder). prepareDraftProgression
       stamps the computing build; maybeRefreshDraftSuggestions treats a
       version-mismatched draft as stale and recomputes it. */
    function suggestionEngineVersion(){
      try{
        const w=(typeof window!=='undefined'&&window)?window:globalThis;
        return String((w.BUILD_INFO&&w.BUILD_INFO.appVersion)||'');
      }catch(e){return '';}
    }
    /* #380 (user 2026-09-13): suggestions are computed exactly once at draft
       creation. If completed history isn't in memory yet at that moment (sync
       pull/adopt still in flight when Start is tapped, cross-tab merge), the
       draft keeps an empty suggestion list while the rest of the live editor
       (the Last chip, ghost placeholders) reads history live on every render
       — the UI contradicts itself: history visible, suggestions missing. This
       recomputes when history shows up, but ONLY when the draft has no
       suggestions and no applied targets: it never clobbers user-entered
       values, completed sets, or suggestions the user already saw. Runs at
       most once per build (suggestionsRefreshedFor). */
    function maybeRefreshDraftSuggestions(){
      const draft=workoutState.draft;
      if(!draft||draft.editingId)return false;
      if(typeof state==='undefined'||!state.workoutEditorOpen)return false;
      /* #472/#473 follow-up: a draft whose suggestions were computed by an
         older build is stale — recompute so fixed rounding/ordering reaches
         already-started workouts after an update. Otherwise (same build) the
         original #380 behavior holds: recompute only when the draft has no
         suggestions at all. Either way, at most one recompute per build, and
         never when the user has applied a card. Typed values and completed
         sets do NOT block the refresh: prepareDraftProgression only rewrites
         draft.progressionSuggestions and never touches set rows, so a stale
         draft with in-progress sets still gets current cards. An applied card
         does block it — suggestion.applied=true lives on the suggestion
         objects the recompute would replace, and losing the "Applied ✓"
         state would be a lie. */
      const ver=suggestionEngineVersion();
      const stale=!!ver&&draft.suggestionVersion!==ver;
      const empty=!(draft.progressionSuggestions||[]).length;
      if(!stale&&!empty)return false;
      if(draft.suggestionsRefreshedFor===ver&&ver)return false;
      if((draft.exercises||[]).some(item=>{const t=item.suggestedTarget||{};return !!(t.w||t.r||t.seconds||t.distance);}))return false;
      /* Don't spend the one retry until relevant history actually exists — an
         unrelated sync tick (or a genuinely empty history) must not consume
         it, or history arriving later would never trigger a recompute. */
      const hasHistory=(draft.exercises||[]).some(item=>getExerciseLogs(item.exerciseId).length>0);
      if(!hasHistory)return false;
      draft.suggestionsRefreshedFor=ver;
      const config=(draft.programId&&workoutState.activeProgram&&workoutState.activeProgram.id===draft.programId)
        ?{...workoutState.activeProgram.progression,currentWeek:programWeek(workoutState.activeProgram)}
        :freeformProgressionConfig();
      prepareDraftProgression(draft,config);
      /* #402 (user 2026-09-13): like a fresh start, refreshed suggestions
         wait for the user to tap each card — never auto-applied. */
      renderWorkoutProgression();
      renderWorkoutExercises();
      markDraftSaved();
      return true;
    }

    /* #481: a Reps↔Seconds switch invalidates the exercise's suggestion —
       it was computed for the old mode, and tapping it would revert the
       switch (applyProgressionSuggestion used to assign item.tracking from
       the stale card). Recompute just this exercise's suggestion for its
       current mode, so a stale row can never linger in the card. Returns
       the fresh suggestion (or null). */
    function refreshSuggestionForExercise(draft,item){
      if(!draft||!item)return null;
      const list=draft.progressionSuggestions||[];
      const idx=list.findIndex(s=>s&&s.exerciseId===item.exerciseId);
      if(idx<0)return null; // no card for this exercise — nothing stale
      const config=(draft.programId&&workoutState.activeProgram&&workoutState.activeProgram.id===draft.programId)
        ?{...workoutState.activeProgram.progression,currentWeek:programWeek(workoutState.activeProgram)}
        :freeformProgressionConfig();
      const p=item.progression,hasStoredZone=!!(p&&(p.min!=null||p.max!=null||p.amrap||p.openTop));
      const fresh=progressionForExercise(item.exerciseId,progressionProfileForDraftItem(item),config,hasStoredZone);
      if(fresh)list[idx]=fresh; else list.splice(idx,1);
      renderWorkoutProgression();
      return fresh||null;
    }

    /* Applies a suggestion card: writes suggested targets onto the exercise's
       sets without touching user-entered values. */
    function applyProgressionSuggestion(draft,suggestion,rerender=true) {
      const item=draft?.exercises.find(row=>row.exerciseId===suggestion.exerciseId); if(!item)return;
      /* #481: never let a stale card revert a tracking-mode switch. If the
         suggestion was computed for a different mode than the exercise is in
         now, recompute for the current mode and apply the fresh card instead.
         #498: this also covers distance — a stale 'reps'-mode distance card
         on a distance-tracked custom item recomputes to a 'distance'-mode
         card (the profile follows exerciseTracking, i.e. item.tracking), so
         the fresh card matches and applies instead of being dropped. */
      if(suggestion.mode&&item.tracking&&suggestion.mode!==item.tracking){
        const fresh=refreshSuggestionForExercise(draft,item);
        if(fresh&&fresh!==suggestion&&fresh.mode===item.tracking)return applyProgressionSuggestion(draft,fresh,rerender);
        return;
      }
      item.tracking=suggestion.mode;
      /* #99 C2: never touch user-entered values or complete=true attestations.
         The suggestion writes only to suggestedTarget (ghosted placeholders,
         per the comment below); sets with user-entered values are left alone. */
      // Suggested targets are hints, not values: they render as true HTML placeholders
      // (ghosted text, empty value, cleared on focus) and are saved only when a set is
      // completed with its field untouched.
      item.suggestedTarget={w:suggestion.nextWeight?String(suggestion.nextWeight):'',r:suggestion.mode==='time'?'':suggestion.isDistance?'':(suggestion.amrap?'':String(suggestion.nextReps)),seconds:suggestion.mode==='time'?String(suggestion.nextSeconds):'',distance:suggestion.isDistance?String(suggestion.nextDistance):''};
      /* #400: indexed per-set targets for the All-sets toggle. The singular
         target above stays as the fallback for rows whose position has no
         per-set target (and for drafts built with the toggle off). */
      if(suggestion.setTargets){
        item.suggestedTargets=suggestion.setTargets.map(t=>t?{w:t.w?String(t.w):'',r:suggestion.mode==='time'?'':String(t.r),seconds:suggestion.mode==='time'?String(t.seconds):''}:null);
      }else delete item.suggestedTargets;
      /* #575 (user 2026-09-20): a tap is an explicit apply. Ghost
         placeholders are invisible in already-filled inputs, so the tap
         looked like a no-op when the sets had values. Write the suggestion
         into the actual set fields for every unchecked, non-warmup set:
         its own per-set target (per-set targets are the only path now —
         QA batch 2026-09-22). Completed sets are attestations and are never
         touched; a per-set position with no baseline is never invented. The
         ghosts above stay as the fallback for rows left empty. */
      const perfKey575=suggestion.isDistance?'distance':(suggestion.mode==='time'?'seconds':'r');
      const topVal575={w:suggestion.nextWeight,
        r:(suggestion.amrap||suggestion.mode==='time'||suggestion.isDistance)?'':suggestion.nextReps,
        seconds:suggestion.mode==='time'?suggestion.nextSeconds:'',
        distance:suggestion.isDistance?suggestion.nextDistance:''};
      let pos575=-1;
      for(const set of item.sets||[]){
        if(isWarmupSet(set))continue;
        pos575++;
        if(set.complete)continue;
        const pt=(suggestion.setTargets&&suggestion.setTargets[pos575])||null;
        if(suggestion.setTargets&&!pt)continue;
        const w575=pt?pt.w:topVal575.w;
        const v575=pt?(perfKey575==='r'?pt.r:perfKey575==='seconds'?pt.seconds:topVal575.distance):topVal575[perfKey575];
        if(w575!=null&&w575!==''&&Number(w575)>0)set.w=String(w575);
        if(v575!=null&&v575!==''&&Number(v575)>0)set[perfKey575]=String(v575);
      }
      /* QA batch (user 2026-09-22): accepting a suggestion also rescales the
         warm-up ladder — the ladder is anchored on the working weight, so a
         new top-set target means new warm-up rungs. Only the weight hint
         moves (it's a placeholder, not a value); rung reps and any typed
         values stay untouched. */
      const _warmupRows=(item.sets||[]).filter(isWarmupSet);
      if(_warmupRows.length&&Number(suggestion.nextWeight)>0){
        const _wuEx=resolveExercise(item.exerciseId);
        const _wuTracking=exerciseTracking(item,_wuEx);
        const _wuEvenTotal=_wuEx?.equipment==='dumbbell'&&dbEntryMode(item.exerciseId,item)==='per'&&!dbSingleDumbbell(item.exerciseId,item);
        const _wuLadder=warmupLadderRows(suggestion.nextWeight,_wuTracking,_wuEvenTotal);
        _warmupRows.forEach((s,i)=>{ if(_wuLadder[i]) s.warmupHint={...(s.warmupHint||{}),w:_wuLadder[i].w||''}; });
      }
      suggestion.applied=true;
      if(rerender){renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();}
    }

    /* Renders the program-context pill and the suggestion cards for the live draft. */
    function renderWorkoutProgression() {
      const draft=workoutState.draft, box=$('#workoutProgression'), context=$('#workoutContext');
      /* #148: never render suggestion cards while editing a completed workout. */
      if(draft?.editingId){box.hidden=true;return;}
      const program=workoutState.activeProgram && draft?.programId===workoutState.activeProgram.id?workoutState.activeProgram:null;
      /* #68: the pill duplicates the workout name field when they match. The pill
         carries program context; the name field carries the name. Only show the
         scheduled workout name in the pill when the user renamed this workout,
         so the pill still says which program slot this is. */
      let contextText='';
      if(program){
        contextText=`${program.name} · Week ${programWeek(program)}`;
        const scheduled=program.workouts.find(w=>w.uid===draft.programWorkoutUid);
        const scheduledName=(scheduled?.name||'').trim(), draftName=(draft.name||'').trim();
        if(scheduledName&&draftName&&scheduledName.toLowerCase()!==draftName.toLowerCase())contextText+=`, ${scheduledName}`;
      }
      context.hidden=!program; context.textContent=contextText;
      /* #406 (user 2026-09-16): the suggestion banner is retired — each
         exercise card renders its own suggestion row (cardSuggestionHtml,
         wired by wireLiveCardSuggestions in the workout editor), merged with
         the card's history line. The banner box stays hidden. */
      box.hidden=true;
    }

    