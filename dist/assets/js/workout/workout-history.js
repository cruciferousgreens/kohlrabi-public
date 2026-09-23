
/* ===== module: workout-history.js ===== */
    /** Finalizes editable workout records and renders detailed set-by-set history. */
    /* Module map (v1.006) — Key: finishWorkout(), renderCompletedWorkout(), workoutSummary(), editCompletedWorkout(), invalidSetsIn(). Depends on: workout-editor render + factories, state, persistence, utilities (detectExercisePRs, dates). */
    let pendingDeleteCompletedWorkoutId=null;
    /* #188 (user 2026-09-12): where to land after deleting a completed
       workout. Deleting from the logs list returns to the logs list;
       every other context keeps the #83 behavior (the Workout page).
       Pure so the rule is unit-testable. */
    function deleteCompletedWorkoutLanding(){
      return returnRouteKey(state.workoutDetailReturn)===ROUTES.DETAIL_RETURN.HISTORY?'history':'workout';
    }
    $('#cancelDeleteCompletedWorkout')?.addEventListener('click',()=>$('#deleteCompletedWorkoutDialog').close());
    $('#keepCompletedWorkout')?.addEventListener('click',()=>$('#deleteCompletedWorkoutDialog').close());
    $('#confirmDeleteCompletedWorkout')?.addEventListener('click',()=>{
      $('#deleteCompletedWorkoutDialog').close();
      if(pendingDeleteCompletedWorkoutId){
        workoutState.completed=workoutState.completed.filter(w=>w.id!==pendingDeleteCompletedWorkoutId);
        schedulePersist();
        $('#workoutComplete').hidden=true;
        /* #188: mirror the Back registry's HISTORY destination instead of
           unconditionally landing on the workout home (#83 keeps the rest). */
        if(deleteCompletedWorkoutLanding()==='history'){state.workoutHistoryOpen=true;renderWorkoutScreen();}
        else showWorkouts(false);
        renderDashboard();
      }
      pendingDeleteCompletedWorkoutId=null;
    });
    /** Sets missing required values (reps/seconds, weight for weighted
        exercises, or exercises with no sets at all). Powers the "Unfilled
        sets" dialog (user 2026-09-10). */
    function invalidSetsIn(draft){
      const rows=[];
      (draft?.exercises||[]).forEach(item=>{
        const ex=resolveExercise(item.exerciseId);
        /* #279: weight is optional for timed tracking regardless of equipment (machine cardio logs seconds, not load). */
        const tracking=exerciseTracking(item,ex), weightOptional=exerciseWeightOptional(ex)||tracking==='time'; /* #382: banded work is weight-optional like bodyweight. */
        if(!item.sets.length){rows.push({item,set:null});return;}
        item.sets.forEach(set=>{
          /* A10 (#99): Number('garbage') is NaN and NaN comparisons are
             false, so non-numeric input used to pass as valid. */
          const perf=tracking==='time'?set.seconds:set.r;
          const bad=(!weightOptional&&set.w==='')||perf===''||!Number.isFinite(Number(set.w||0))||Number(set.w||0)<0||!Number.isFinite(Number(perf))||Number(perf)<1||/* #268: legacy/imported sets may carry rpe:null — treat null/undefined like '' (RPE is optional). */(set.rpe!==''&&set.rpe!=null&&(!Number.isFinite(Number(set.rpe))||Number(set.rpe)<0||Number(set.rpe)>10));
          if(bad)rows.push({item,set});
        });
      });
      return rows;
    }
    /* #43: a set is only bulk-deletable when it holds no user-entered data at
       all — no values and no tags. Sets with partial values are never silently
       deleted (that path produced nulls); they must be marked complete or kept
       for editing. */
    function isEmptySet(set){
      /* #178: null/undefined count as blank too (legacy/imported sets may
         lack the '' initializer) — only genuinely user-entered data
         disqualifies a set from being "empty". */
      const blank=v=>v===''||v==null;
      return set&&blank(set.w)&&blank(set.r)&&blank(set.seconds)&&blank(set.rpe)&&!(set.tags?.length);
    }
    /* #501 (v1.8): sets that hold entered data but were never explicitly
       marked complete. Pure: the invalid-set computation is reused so the
       review list only ever holds genuinely finishable sets — partial or
       empty sets are never "completable" from the dialog (never-nulls,
       user 2026-09-11). */
    function unmarkedSetsWithData(draft){
      const bad=new Set(invalidSetsIn(draft).map(row=>row.set).filter(Boolean));
      const rows=[];
      (draft?.exercises||[]).forEach((item,exerciseIndex)=>{
        (item.sets||[]).forEach((set,index)=>{
          if(!set.complete&&!bad.has(set))rows.push({item,set,index,exerciseIndex});
        });
      });
      return rows;
    }
    /* #501: one-line value summary for a review-list row, e.g.
       "100 lb × 8 @ 7". Pure so the wording is test-pinned. */
    function unmarkedSetSummary(row){
      const {item,set}=row;
      const ex=resolveExercise(item.exerciseId);
      const tracking=exerciseTracking(item,ex);
      const rpe=(set.rpe===''||set.rpe==null)?'':` @ ${set.rpe}`;
      if(tracking==='time')return `${set.seconds} sec${rpe}`;
      if(exerciseWeightOptional(ex)){
        const w=Number(set.w)||0;
        return w>0?`+${displayWeight(set.w)} ${weightUnit()} × ${set.r}${rpe}`:`${set.r} reps${rpe}`;
      }
      return `${displayWeight(set.w)} ${weightUnit()} × ${set.r}${rpe}`;
    }
    /* #501: the review dialog lists each unmarked-but-valid set as a toggle
       row (exercise · Set N · entered values) so the choice is per-set, not
       just all-or-nothing. Rendered as a string (pure); row taps are
       delegated in app-bootstrap. */
    function reviewSetsListHtml(rows){
      return rows.map(row=>{
        const ex=resolveExercise(row.item.exerciseId);
        const label=`${ex?.name||'Exercise'} · Set ${row.index+1}`;
        return `<li><button type="button" class="review-set-row" data-exercise-uid="${escapeHtml(row.item.uid||'')}" data-set-uid="${escapeHtml(row.set.uid||'')}" data-exercise-index="${row.exerciseIndex}" data-set-index="${row.index}" aria-pressed="${!!row.set.complete}" aria-label="Mark ${escapeHtml(label)} complete"><span class="review-set-check" aria-hidden="true"><svg viewBox="0 0 24 24"><rect class="box" x="3.2" y="3.2" width="17.6" height="17.6" rx="5.5"/><path class="tick" d="m8 12.4 2.6 2.6 5.6-6.2"/></svg></span><span class="review-set-text"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(unmarkedSetSummary(row))}</span></span></button></li>`;
      }).join('');
    }
    /* #501: a finished set keeps the draft's explicit complete flag — the
       "Log incomplete sets" choice is recorded on the log, never silently
       completed. Pure so the rule is unit-testable. */
    function serializeCompletedSet(set){
      /* #564: every numeric field funnels through sanitizeSetValue — fractional
         reps ("8.5") and absurd weights no longer persist into stats. Distance
         was also dropped entirely here; distance-mode sets kept it in the
         draft but lost it on finish. */
      return {w:sanitizeSetValue('w',set.w), r:sanitizeSetValue('r',set.r), seconds:sanitizeSetValue('seconds',set.seconds), distance:sanitizeSetValue('distance',set.distance), rpe:sanitizeSetValue('rpe',set.rpe), tags:[...set.tags], complete:!!set.complete};
    }
    /* Finalizes the live draft into workoutState.completed (PR detection + review
       prompt), then resets the draft. */
    /* The single review prompt (#43): covers both problem kinds (unfilled
       values and unmarked sets) in one dialog. Extracted so the
       delete-empties action can re-show it directly (#189) instead of
       re-running finishWorkout and stacking a second modal. */
    /* #199 (user 2026-09-12): the review dialog's action contract — pure so
       tests pin which actions appear for every invalid-set shape.
       - "Mark all complete": only when every set is value-valid (just
         unmarked) — never-nulls (user 2026-09-11).
       - "Log incomplete sets" (user 2026-09-16 #535; the 2026-09-17 extension
         to the missing-values variant was reverted the same day — no nulls
         are ever logged): the second button ONLY when every set is
         value-valid, the explicit alternative to "Mark all complete"
         (values + unchecked flags kept as-is).
       - "Delete N empty sets" / "Remove N empty exercises": only fully-empty
         targets (#43 — never partial values, never silent).
       - "Finish anyway" (user 2026-09-13, #262): the primary whenever sets
         need review. Deletes every unfinished set (empty AND incomplete) and
         finishes in one tap — it never re-prompts or returns to editing.
         Partial values are dropped, never saved half-filled. The old middle
         "Delete N unfinished sets" button ran this same operation and is gone.
       - "Keep editing": a quiet text link below the hairline "or" separator,
         in every variant (user 2026-09-16).
       Exactly one dialog is ever shown (#189). */
    function reviewSetsActions(draft){
      const invalid=invalidSetsIn(draft);
      const badSets=new Set(invalid.map(row=>row.set).filter(Boolean));
      const emptyCount=invalid.filter(row=>!row.set).length;
      const showComplete=badSets.size===0&&draft.exercises.some(item=>item.sets.some(set=>!set.complete));
      /* user 2026-09-16: the dialog's shape — the finish actions, then the
         hairline "or" separator, then "Keep editing" as a quiet text link
         below it. Classes are set fresh on every open so no stale
         visibility or styling survives between openings. */
      const showFinishAnyway=badSets.size>0;
      const showDeleteEmptyExercises=badSets.size===0&&emptyCount>0;
      return {
        badCount:badSets.size,
        showComplete,
        /* user 2026-09-17 (revert): "Log incomplete sets" is the second button
           ONLY in the valid-but-unmarked variant — the explicit alternative
           to "Mark all complete". The missing-values variant is back to two
           options (Finish anyway + Keep editing), as before the #535
           extension: no nulls are ever logged. */
        showLogIncomplete:showComplete,
        showFinishAnyway,
        showDeleteEmptyExercises,
        deleteEmptyExercisesCount:emptyCount,
        /* Exactly one primary button. "Finish anyway" is the primary whenever
           sets need review. */
        primaryAction:showComplete?'complete':showFinishAnyway?'finish':showDeleteEmptyExercises?'delete':null,
      };
    }
    /* #199: "Finish anyway" drops every invalid set (empty AND incomplete) —
       partial values are dropped, never serialized half-filled. Pure over
       the draft; returns what was dropped for the confirmation toast. */
    function dropInvalidSets(draft){      const badSetObjs=new Set(invalidSetsIn(draft).map(row=>row.set).filter(Boolean));
      let droppedSets=0,droppedEmptySets=0;
      draft.exercises.forEach(item=>{
        item.sets=item.sets.filter(set=>{
          if(!badSetObjs.has(set))return true;
          droppedSets++;
          if(isEmptySet(set))droppedEmptySets++;
          return false;
        });
      });
      const beforeEx=draft.exercises.length;
      draft.exercises=draft.exercises.filter(item=>item.sets.length);
      return {droppedSets,droppedEmptySets,droppedExercises:beforeEx-draft.exercises.length};
    }
    /* User 2026-09-13 (#262): the user's copy. The count covers every
       unfinished set; "Finish anyway" deletes them and finishes — nothing is
       ever saved half-filled. Pure so tests pin the wording. */
    function reviewSetsCopy(draft,actions){
      const n=actions.badCount, exN=actions.deleteEmptyExercisesCount;
      if(actions.showComplete){
        const unmarked=draft.exercises.flatMap(item=>item.sets).filter(set=>!set.complete).length;
        return `${unmarked} set${unmarked===1?'':'s'} ${unmarked===1?"isn't":"aren't"} marked complete yet.`;
      }
      const parts=[];
      /* #569: the old copy read truncated ("2 sets are missing… Clicking
         Finish will delete your sets.") — ambiguous about WHICH sets get
         deleted, and "your sets" sounded like everything. Name the unfinished
         ones explicitly and promise the completed ones are kept. */
      if(n>0)parts.push(`${n} set${n===1?' isn\u2019t':'s aren\u2019t'} finished. Finishing now deletes ${n===1?'that set':'those sets'} \u2014 your completed sets are kept.`);
      if(exN>0)parts.push(`${exN} exercise${exN===1?' has':'s have'} no sets.`);
      return parts.join(' ');
    }
    /* Opens the finish-review dialog for drafts with invalid or unmarked sets. */
    function showReviewSetsDialog(draft,bad,unmarked){
      const actions=reviewSetsActions(draft);
      $('#reviewSetsCopy').textContent=reviewSetsCopy(draft,actions);
      /* #501: list the unmarked-but-valid sets in the mark-complete variant
         so the choice names each set, with per-set toggles. Hidden in every
         other variant (classes are set fresh on every open, like the
         buttons). */
      const rows=actions.showComplete?unmarkedSetsWithData(draft):[];
      const listEl=$('#reviewSetsList');
      listEl.hidden=!rows.length;
      listEl.innerHTML=reviewSetsListHtml(rows);
      const primary=actions.primaryAction;
      /* User 2026-09-13 (#262): whenever sets need review the dialog shows
         exactly two actions — primary "Finish anyway" and "Keep editing" as a
         real secondary button. Classes are set fresh on every open so no
         stale visibility or styling survives between openings. */
      /* user 2026-09-11: never save null data. "Mark all complete" is only
         offered when every set has valid values (just unmarked) — if any set
         is missing values, the button hides so the user must fix or delete
         the bad sets instead of saving nulls. */
      const completeBtn=$('#reviewSetsComplete');
      completeBtn.hidden=!actions.showComplete;
      if(actions.showComplete)completeBtn.className=primary==='complete'?'primary-button':'secondary-button';
      /* user 2026-09-16 #535 (missing-values extension reverted 2026-09-17):
         "Log incomplete sets" is the second button ONLY in the
         valid-but-unmarked variant — it finishes with every set's usable
         values AND their unchecked flags intact (nothing silently
         completed). The missing-values variant is back to Finish anyway +
         Keep editing. */
      const logIncompleteBtn=$('#reviewSetsLogIncomplete');
      logIncompleteBtn.hidden=!actions.showLogIncomplete;
      if(actions.showLogIncomplete)logIncompleteBtn.className='secondary-button';
      /* User 2026-09-12 (phone QA): the primary finish button says exactly
         "Finish anyway" — no appended "— drop N incomplete" clause. */
      const finishBtn=$('#reviewSetsFinishAnyway');
      finishBtn.hidden=!actions.showFinishAnyway;
      if(actions.showFinishAnyway){
        finishBtn.textContent='Finish anyway';
        finishBtn.className=primary==='finish'?'primary-button':'secondary-button';
      }
      /* The delete action only survives for the empty-exercise case (no bad
         sets, just an exercise with no sets) — never sets with partial
         values, so no user-entered data is silently lost. It carries no
         danger styling. Hidden otherwise. */
      const deleteBtn=$('#reviewSetsDelete');
      const deleteVisible=actions.showDeleteEmptyExercises;
      deleteBtn.hidden=!deleteVisible;
      if(deleteVisible){
        deleteBtn.textContent=`Remove ${actions.deleteEmptyExercisesCount} empty exercise${actions.deleteEmptyExercisesCount===1?'':'s'}`;
        deleteBtn.className=primary==='delete'?'primary-button':'secondary-button';
      }
      /* User 2026-09-16: "Keep editing" is always a quiet text link below
         the hairline "or" separator — in every dialog variant. */
      $('#reviewSetsCancel').className='text-link review-keep-editing';
      /* #501: per-set toggles re-render the open dialog — showModal() on an
         already-open <dialog> throws, so only open it when closed. */
      if(!$('#reviewSetsDialog').open)$('#reviewSetsDialog').showModal();
    }
    /* #189 (user 2026-09-12): after "Finish and delete empty sets", the
       finish must not re-prompt when everything left is value-valid.
       'refinish' — something still has invalid values and genuinely needs
       the user's eyes: re-show the ONE review dialog. 'finish' — all
       remaining sets are value-valid: mark them complete and finish.
       'blocked' — nothing finishable left (all exercises were empty). */
    function reviewDeleteEmptiesOutcome(draft){
      if(invalidSetsIn(draft).length)return 'refinish';
      if(!draft.exercises.length)return 'blocked';
      return 'finish';
    }
    /* #369 (user 2026-09-13): an edit-finish preserves the log's original
       finishedAnyway flag unless this finish explicitly re-decides it via
       the review dialog — otherwise every edit silently clears the "Finished
       with unlogged sets" marker. Pure so the rule is unit-testable. */
    function finishAnywayForFinish(draft,optsFinishedAnyway){
      const prior=draft&&draft.editingId?workoutState.completed.find(x=>x.id===draft.editingId):null;
      return !!optsFinishedAnyway||!!(prior&&prior.finishedAnyway);
    }
    /* Finishes the workout: reviews problem sets when needed, then saves the record. */
    function finishWorkout(skipReview,opts={}) {
      const draft = workoutState.draft;
      /* #178: an explicit finish-anyway may have dropped every empty set —
         the workout still finishes (the decision is recorded on the record),
         it just holds no logged sets. The guard stays on the explicit
         decision; the preserved flag below only affects the record. */
      const explicitAnyway=!!opts.finishedAnyway;
      if (!draft || (!draft.exercises.length && !explicitAnyway)) { showToast('Add at least one exercise before finishing.','error'); return; }
      /* One review prompt covers both problem kinds (unfilled values and
         unmarked sets) instead of two stacked dialogs (#43).
         Buttons: Mark all complete (only when all sets have valid values —
         never nulls, user 2026-09-11) / Log incomplete sets (second button
         ONLY in the valid-but-unmarked variant: values + unchecked flags
         kept as-is; the 2026-09-17 #535 extension to the missing-values
         variant was reverted the same day — no nulls are ever logged) /
         Finish and
         delete empty sets (only fully-empty sets, never partial ones) /
         Finish anyway (drops every invalid set, empty AND incomplete, with
         an explicit label — #199) / Keep editing (quiet text link below the
         hairline "or" separator).
         skipReview is an internal bypass used only by "Mark all complete":
         all sets already have valid values, so it just marks them complete
         without reopening the dialog. */
      const bad = invalidSetsIn(draft);
      const unmarked = draft.exercises.flatMap(item=>item.sets.map((set,index)=>({set,index,item}))).filter(row=>!row.set.complete);
      if (!skipReview && (bad.length || unmarked.length)) {
        showReviewSetsDialog(draft,bad,unmarked);
        return;
      }
      draft.name = $('#workoutName').value.trim() || 'Workout'; draft.date = $('#workoutDate').value || localIsoDate();
      /* #99 A13: stamp a completion timestamp — same-day sessions need a real
         chronology ("latest" must not be a coin flip). Edits keep the original
         completion time; only brand-new finishes stamp now. */
      const priorCompleted=draft.editingId?workoutState.completed.find(x=>x.id===draft.editingId):null;
      /* #369: an edit-finish preserves the original finishedAnyway flag
         unless this finish explicitly re-decided it via the review dialog. */
      const finishedAnyway=finishAnywayForFinish(draft,opts.finishedAnyway);
      const completed = { id:draft.editingId || newWorkoutId(), name:draft.name, date:draft.date, completedAt:priorCompleted?.completedAt||new Date().toISOString(), programId:draft.programId||null, programWorkoutUid:draft.programWorkoutUid||null, finishedAnyway, focusPreset:draft.focusPreset||null, exercises:draft.exercises.map(item => ({exerciseId:item.exerciseId, tracking:exerciseTracking(item,resolveExercise(item.exerciseId)), note:item.note||'', exerciseTags:[...(item.exerciseTags||[])], supersetId:item.supersetId||null, progression:item.progression?{...item.progression}:null, sets:item.sets.map(serializeCompletedSet)})) };
      if (draft.editingId) {
        /* A11 (#99): if the record being edited no longer exists (deleted on
           another device and synced away mid-edit), .map() would silently
           drop the whole workout. Save it as a new record instead. */
        if (workoutState.completed.some(x => x.id === draft.editingId)) {
          workoutState.completed = workoutState.completed.map(x => x.id === draft.editingId ? completed : x);
        } else {
          completed.id = newWorkoutId();
          workoutState.completed.unshift(completed);
          showToast('The workout you were editing was deleted elsewhere, so it was saved as a new workout.');
        }
      } else workoutState.completed.unshift(completed);
      workoutState.draft = null; state.shareReturn=null; /* #217: a share-started session is over — Back must not resurrect its landing. */ /* #275: an edit-finish keeps the return recorded when the log was opened (e.g. the Logs list) instead of forcing the Workout page — only brand-new finishes reset it. */
      /* #434: finishing a program workout still lands on the completed log
         (user 2026-09-12), but Back from that log returns to the Program
         page, not the Workout tab — the program context isn't lost. */
      /* Fresh finish only — editing a log and re-saving is not a new
         workout. Kept off the pinned line below (#434 source pins). */
      if(!draft.editingId)state.workoutDetailReturn=draft.programId?ROUTES.DETAIL_RETURN.PROGRAM:ROUTES.DETAIL_RETURN.WORKOUT; persistNow(); renderCompletedWorkout(completed); renderProgram(); renderLibrary(); renderDashboard(); renderStats();
      /* #153: renderProgram() unconditionally calls updateTopBar('program'),
         which flashed "Program" over the just-finished log. The log's title
         is "Log" (workoutSubScreen is 'complete' now) — restore it last. */
      updateTopBar('workout');
      /* Land on the top of the completed workout, instantly (no smooth scroll — user 2026-09-10). */
      window.scrollTo({top:0, behavior:'auto'});
      /* User 2026-09-12: finishing a program workout lands on the completed
         log, like every other workout. The old showProgram() call covered the
         log with the Program page the instant it rendered. */
    }
    /* Opens a completed log for editing (never clobbers a live draft). */
    function editCompletedWorkout(id) {
      const workout=workoutState.completed.find(x=>x.id===id); if(!workout) return;
      /* Editing opens the log as a live workout (user 2026-09-12) — it must
         never silently replace a session already in progress. Re-editing the
         same log is harmless, so it skips the modal. */
      if(workoutState.draft&&workoutState.draft.editingId!==id){
        requestStartWithConflict(workout.name,()=>openCompletedForEdit(workout),'Editing');
        return;
      }
      openCompletedForEdit(workout);
    }
    /* Converts a completed log into an editable live draft. */
    function openCompletedForEdit(workout){
      /* #99 H5: opening a log for edit closes the logs list. (#187: the
         render path now lets the list open over a draft.) */
      state.workoutHistoryOpen=false;
      /* #99 B8: canonical clone — full-fidelity round trip (actual RPE kept);
         it is editing, not a new session. */
      workoutState.draft={name:workout.name,date:workout.date,programId:workout.programId||null,programWorkoutUid:workout.programWorkoutUid||null,editingId:workout.id,focusPreset:REP_PRESETS[workout.focusPreset]?workout.focusPreset:null,exercises:workout.exercises.map(item=>cloneExerciseItem(item,'forEdit',{noteOpen:!!item.note}))};
      /* User 2026-09-12: editing must actually OPEN the workout — the old
         code built the draft but left workoutEditorOpen false, stranding the
         user on the start screen with a Continue card. */
      state.workoutEditorOpen=true;
      $('#workoutComplete').hidden=true; schedulePersist(); renderWorkoutScreen();
    }
    /* Aggregates a workout into {sets, volume, muscles, time, distance} stats. */
    function workoutSummary(workout) {
      const sets=workout.exercises.flatMap(item=>item.sets);
      /* #498: pass the exercise so non-volume (distance) work contributes zero. */
      const exFor=item=>resolveExercise(item.exerciseId);
      const volume=workout.exercises.reduce((total,item)=>total+item.sets.reduce((t,set)=>t+setVolume(set,exFor(item)),0),0);
      const muscles=[...new Set(workout.exercises.flatMap(item=>{const ex=exFor(item);return [...(ex?.primary||[]),...(ex?.secondary||[])];}))];
      /* #302 (user 2026-09-12): timed-only work has no meaningful volume —
         report total time instead of "0 lb". #498: same for distance-only. */
      const totalSeconds=sets.reduce((total,set)=>total+(Number(set.seconds)||0),0);
      const timedOnly=sets.length>0&&sets.every(set=>Number(set.seconds)>0);
      const totalDistance=sets.reduce((total,set)=>total+(Number(set.distance)||0),0);
      const distanceOnly=sets.length>0&&!timedOnly&&sets.every(set=>Number(set.distance)>0);
      return {sets:sets.length,volume,muscles,totalSeconds,timedOnly,totalDistance,distanceOnly};
    }
    /* PR descriptions for a completed workout vs prior history. */
    function workoutPRs(workout) {
      const prs=[];
      workout.exercises.forEach(item=>{
        const ex=resolveExercise(item.exerciseId);
        /* #282: timed PRs — longest hold at a given load joins the PR summary. */
        if((item.tracking||'reps')==='time'){
          if(!ex)return;
          const priorSets=priorSetsForPR(workout,item.exerciseId);
          if(detectTimedPRs(item.sets,priorSets)){const best=Math.max(...item.sets.map(s=>Number(s.seconds)||0));prs.push({name:ex.name,kind:'longest hold PR',value:`${Math.round(best)} sec`});}
          return;
        }
        /* F2 (persona-6 data portability): zero-rep sets must not feed PR
           math — estimate1RM(r:0) degenerates to w, so a 200×0 set could beat
           a real heaviest set and false-flag a heaviest-set or e1RM PR.
           Mirrors the sibling surfaces recentPRRows (dashboard-stats.js) and
           statsFor (exercise-detail.js), which already require r>0. */
        const currentWeighted=item.sets.filter(set=>Number(set.w)>0&&Number(set.r)>0);
        if(!ex)return;
        /* #99 A15 + #158: compare against prior sessions — all other records
           except the current one, including earlier same-day sessions (never
           later ones). priorSetsForPR matches the live PR banner's definition. */
        const priorSetsAll=priorSetsForPR(workout,item.exerciseId);
        /* #372: bodyweight rep PRs — a new best unweighted rep set joins the
           PR summary, independently of the weighted path. */
        const currentBW=item.sets.filter(set=>!(Number(set.w)>0)&&Number(set.r)>0);
        if(currentBW.length&&detectBodyweightPRs(currentBW,priorSetsAll)){const best=Math.max(...currentBW.map(s=>Number(s.r)||0));prs.push({name:ex.name,kind:'best rep set PR',value:`${best} reps`});}
        if(!currentWeighted.length)return;
        const priorSets=priorSetsAll.filter(set=>Number(set.w)>0&&Number(set.r)>0);
        if(!priorSets.length)return;
        const currentEst=Math.max(...currentWeighted.map(estimate1RM)),priorEst=Math.max(...priorSets.map(estimate1RM));
        const currentWeight=Math.max(...currentWeighted.map(set=>Number(set.w)||0)),priorWeight=Math.max(...priorSets.map(set=>Number(set.w)||0));
        /* User 2026-09-22: PRs are prettier and more descriptive — include the
           actual PR value so the pill says what was achieved. */
        if(currentEst>priorEst+.5)prs.push({name:ex.name,kind:'estimated 1RM PR',value:`${Math.round(currentEst)} ${weightUnit()}`});
        else if(currentWeight>priorWeight)prs.push({name:ex.name,kind:'heaviest set PR',value:`${displayWeight(currentWeight)} ${weightUnit()}`});
      });
      return prs;
    }
    /* #131 (user 2026-09-11): the set-by-set breakdown mirrors the live
       workout set-row grid (SET | WEIGHT | REPS | RPE) — compact read-only
       rows, not stacked stat boxes. No per-row checkmarks (phone QA
       2026-09-11) — but #501 (v1.8) lets a finish explicitly leave sets
       unchecked, so those rows carry a small "unchecked" chip instead of
       silently looking completed. Per-set est. 1RM lives on the exercise
       detail page; PRs hit are summarized above. */
    function completedExerciseMarkup(item, workoutId) {
      const ex=resolveExercise(item.exerciseId),isBodyweight=ex?.equipment==='body only',tracking=item.tracking||'reps';
      /* #498: the perf field — distance replaces reps/seconds in place. */
      const perfField=(typeof setPerfField==='function')?setPerfField(item,ex):(tracking==='time'?'seconds':'r');
      const volume=item.sets.reduce((total,set)=>total+setVolume(set,ex),0);
      const weightLabel=isBodyweight?'ADDED':'WEIGHT', perfLabel=perfField==='distance'?'DIST (M)':tracking==='time'?'SECONDS':'REPS';
      const headSummary=perfField==='distance'
        ? `${item.sets.reduce((n,set)=>n+(Number(set.distance)||0),0)} m total}`
        : tracking==='time'
          ? `${item.sets.reduce((n,set)=>n+(Number(set.seconds)||0),0)} sec total}`
          : `${formatVolume(volume)}${isBodyweight&&!volume?' · bodyweight':''}`;
      return `<section class="completed-exercise-detail"><div class="completed-exercise-detail-head"><button class="completed-exercise-link" type="button" data-id="${escapeHtml(item.exerciseId)}" data-return-workout="${escapeHtml(workoutId||'')}">${escapeHtml(ex?.name||'Exercise')}</button><span>${headSummary}</span></div>${item.exerciseTags?.length?`<div class="exercise-tag-row">${item.exerciseTags.map(tag=>`<span class="exercise-tag-chip ${workoutState.exerciseTagPresets.includes(tag)?'preset':''}">${escapeHtml(tag)}</span>`).join('')}</div>`:''}<div class="done-labels" aria-hidden="true"><span>SET</span><span>${weightLabel}</span><span>${perfLabel}</span><span>RPE</span></div><div class="done-sets">${item.sets.map((set,index)=>{
        const load=tracking==='time'?'—':isBodyweight?(Number(set.w)>0?`+${displayWeight(set.w)} ${weightUnit()}`:'—'):(set.w==null||set.w===''?`—`:`${displayWeight(set.w)} ${weightUnit()}`);
        const perf=perfField==='distance'?(set.distance==null||set.distance===''?`—`:`${set.distance} m`):tracking==='time'?(set.seconds==null||set.seconds===''?`—`:`${set.seconds} sec`):(set.r==null||set.r===''?`—`:`${set.r}`);
        return `<div class="done-set${set.complete===false?' is-unmarked':''}"><span class="done-num">${index+1}</span><span class="done-val">${escapeHtml(load)}</span><span class="done-val">${escapeHtml(perf)}</span><span class="done-val">${set.rpe==null?'—':escapeHtml(String(set.rpe))}</span>${set.complete===false?'<span class="done-set-unmarked">unchecked</span>':''}${set.tags?.length?`<span class="done-set-tags">${set.tags.map(tag=>`<span class="set-tag-chip">${escapeHtml(tag)}</span>`).join('')}</span>`:''}</div>`;}).join('')}</div>${item.note?`<p class="completed-note"><strong>Notes:</strong> ${escapeHtml(item.note)}</p>`:''}</section>`;
    }
    /* Renders the completed-workout detail pane (summary, PRs, exercises). */
    function renderCompletedWorkout(workout, opts = {}) {
      updateLiveWorkoutIndicator();
      if(!workout)return;
      const summary=workoutSummary(workout),prs=workoutPRs(workout);
      /* #240 (user 2026-09-12): once this log has been saved as a template,
         its button offers Start — the template exists, so the next tap trains
         it instead of duplicating the save. */
      const existingTemplate=workoutState.templates.find(t=>t.sourceLogId===workout.id);
      /* User 2026-09-12: opening a log row must navigate, not render the
         detail inline under the still-visible list. */
      $('#workoutEditor').hidden = true; $('#workoutStart').hidden = true; $('#workoutHistory').hidden = true; $('#workoutComplete').hidden = false;
      /* Systematic defect #1 (user 2026-09-12): the detail is one exclusive
         pane — hide every sibling, including the saved panes the old code
         forgot, so no stale sub-screen can render under it. */
      $('#savedWorkout').hidden = true; $('#savedBuilder').hidden = true;
      noteWorkoutSubScreen('complete');
      /* Logs are their own page (user 2026-09-12): no tab highlights while a
         log is open — the top bar still reads "Logs". */
      if(state.activeView==='workout')setActiveNav('workout', null);
      /* Coherent history (user 2026-09-12): drilling into a log pushes a page,
         so system back returns to the list instead of skipping it. */
      if (opts.push) history.pushState({view:'workout', sub:'complete', completedId: workout.id, returnTo: returnRouteKey(state.workoutDetailReturn)||ROUTES.DETAIL_RETURN.HISTORY}, '', '#log-' + workout.id);
      $('#workoutComplete').innerHTML = `<div class="completed-card"><div class="detail-title-row"><h2>${escapeHtml(workout.name)}</h2><div class="detail-title-actions">${existingTemplate?`<button class="icon-button" id="shareCompletedTemplateBtn" type="button" aria-label="Share ${escapeHtml(existingTemplate.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 14.5v-11"/><path d="M7.6 7.4L12 3l4.4 4.4"/><path d="M6 11.5V19a1.6 1.6 0 0 0 1.6 1.6h8.8A1.6 1.6 0 0 0 18 19v-7.5"/></svg></button>`:''}<button class="start-inline-button" id="saveCompletedWorkoutTop" type="button">${existingTemplate?'Start':'Save as template'}</button></div></div><p class="completed-meta">Completed ${escapeHtml(formatLogDate(workout.date))}</p>${workout.finishedAnyway?'<p class="section-note">Finished with unlogged sets.</p>':''}<div class="workout-detail-metrics"><div class="workout-detail-metric"><strong>${workout.exercises.length}</strong><span>exercise${workout.exercises.length===1?'':'s'}</span></div><div class="workout-detail-metric"><strong>${summary.sets}</strong><span>completed set${summary.sets===1?'':'s'}</span></div><div class="workout-detail-metric"><strong>${summary.timedOnly?`${summary.totalSeconds} sec`:summary.distanceOnly?`${summary.totalDistance} m`:formatVolume(summary.volume)}</strong><span>${summary.timedOnly?'total time':summary.distanceOnly?'total distance':'total volume'}</span></div></div><div class="section-head"><h3>Muscles worked</h3><p class="section-note">Primary and secondary</p></div>${summary.muscles.length?workoutBodyMapMarkup(summary.muscles):''}<div class="workout-muscles">${summary.muscles.length?summary.muscles.map(muscle=>musclePill(muscle)).join(''):'<span class="section-note">No muscle data</span>'}</div>${prs.length?`<div class="section-head"><h3>PRs hit</h3></div><div class="workout-prs">${prs.map(pr=>{const p=typeof pr==='string'?{name:pr,kind:'',value:''}:pr;return `<span class="workout-pr"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.kind)}${p.value?` · ${escapeHtml(p.value)}`:''}</span></span>`;}).join('')}</div>`:''}<div class="section-head"><h3>Set-by-set</h3><p class="section-note">Reps × weight @ RPE</p></div><div class="completed-exercise-details">${workout.exercises.map(item=>completedExerciseMarkup(item,workout.id)).join('')}</div><div class="detail-action-buttons"><button class="primary-button detail-action-primary" id="repeatCompletedWorkout" type="button">Repeat this workout</button><div class="detail-action-row"><button class="secondary-button" id="editCompletedWorkout" type="button">Edit workout</button><button class="secondary-button danger-button" id="deleteCompletedWorkout" type="button">Delete workout</button></div></div><p class="status-note" id="completedSaveStatus" role="status"></p></div>`;
      document.querySelectorAll('.completed-exercise-link').forEach(button => button.addEventListener('click', () => openExercise(button.dataset.id, true, button.dataset.returnWorkout ? {view:'completed-workout', workoutId:button.dataset.returnWorkout} : undefined)));
      $('#editCompletedWorkout').addEventListener('click',()=>editCompletedWorkout(workout.id));
      $('#repeatCompletedWorkout').addEventListener('click',()=>repeatWorkout(workout));
      /* #269 (user 2026-09-12): the completed view's Start must never silently
         replace a live draft — route through the same conflict guard the
         saved editor's Start uses. */
      $('#saveCompletedWorkoutTop').addEventListener('click',()=>existingTemplate?requestStartWithConflict(existingTemplate.name,()=>startWorkoutFromTemplate(existingTemplate.id)):saveCompletedAsTemplate(workout,$('#completedSaveStatus')));
      /* #240 refinement (user 2026-09-13): a log saved as a template IS a
         saved workout — Share sits next to Start, sharing the template. */
      if(existingTemplate)$('#shareCompletedTemplateBtn')?.addEventListener('click',()=>shareTemplate(existingTemplate.id));
      /* #240 (user 2026-09-13): Share lives on saved workouts only — a plain
         completed log has no Share; once it's saved as a template it IS a
         saved workout, so Share appears next to Start (see above). */
      $('#deleteCompletedWorkout').addEventListener('click',()=>{
        pendingDeleteCompletedWorkoutId=workout.id;
        $('#deleteCompletedWorkoutDesc').textContent=`Delete "${workout.name}" from ${formatLogDate(workout.date)}? This cannot be undone.`;
        showModalPinned($('#deleteCompletedWorkoutDialog'));
      });
      /* The top-bar chevron is the one and only back affordance
         (repeatable pattern, user 2026-09-11): the top-bar handler routes it
         through backFromWorkoutDetail() so the recorded return destination
         is honored (user 2026-09-12). */
      /* Phone QA 2026-09-12: the Muscles-worked body map hydrates async here. */
      hydrateBodyMaps();
    }

    