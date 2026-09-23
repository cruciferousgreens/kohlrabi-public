
/* ===== module: workout-editor.js ===== */
    /** The live workout editor: start/continue the current draft session,
        exercise cards with per-set logging rows, suggestion cards, tags,
        supersets, warm-up ladder, and the finish flow. The saved-workout
        builder reuses these card primitives — see saved-workouts.js. */
    /* Shared lookup (efficiency pass 2026-09-12): the live draft's exercise
       row by uid — one place instead of a dozen inline find() calls. */
       /* Module map (v1.006) — Key: startBlankWorkout(), renderWorkoutScreen(), newSet()/newExerciseItem(), liveExerciseCardHtml(), recentWorkoutButton(). Depends on: catalog, progression (prepareDraftProgression), supersets.js, set-tags.js, state, persistence. */
    function findDraftExercise(uid){
      return workoutState.draft?.exercises.find(item=>item.uid===uid);
    }
    /* QA batch (user 2026-09-21): the effort column toggles between RPE and
       RIR display/entry. Stored set.rpe stays canonical RPE — RIR is purely a
       display/entry lens (RIR = 10 − RPE), persisted as progressionSetup.effortMode. */
    function effortMode(){ return progressionSetup.effortMode==='rir' ? 'rir' : 'rpe'; }
    /* → assets/js/formulas/rpe.js: rpeToRir — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/rpe.js: rirToRpe — moved here in the v1.878 restructure (no behavior change). */
    function effortDisplayPlaceholder(){
      /* QA batch (user 2026-09-22): the app targets weight/reps, never RPE —
         so the effort field always shows the bare field name, even when the
         set carries a programmed targetRpe. */
      return effortMode()==='rir'?'RIR':'RPE';
    }
    /** Manages the live workout draft, set completion, exercise notes, and mobile interactions. */
    /* QA batch (user 2026-09-21): set by the "or start a new workout" link on
       the start screen; the shared discard-confirm handler consumes it and
       starts a blank workout after the old draft is discarded. */
    let startNewAfterDiscard=false;
    let pendingRemoveExerciseUid=null;
    /* Removes the pending exercise from the draft and refreshes the editor. */
    function doRemoveExercise(){
      const draft=workoutState.draft; if(!draft||!pendingRemoveExerciseUid)return;
      draft.exercises=draft.exercises.filter(item=>item.uid!==pendingRemoveExerciseUid);
      /* #272: clear any supersetId orphaned by the removal — the survivor's
         band hides (grouping needs 2+), but the stale id would serialize into
         logs and repeats. */
      normalizeSupersets();
      prepareDraftProgression(draft, workoutState.activeProgram?.id===draft.programId?workoutState.activeProgram.progression:freeformProgressionConfig());
      renderWorkoutExercises(); renderWorkoutProgression(); markDraftSaved();
      pendingRemoveExerciseUid=null;
    }
    $('#cancelRemoveExercise')?.addEventListener('click',()=>$('#removeExerciseDialog').close());
    $('#keepExercise')?.addEventListener('click',()=>$('#removeExerciseDialog').close());
    $('#confirmRemoveExercise')?.addEventListener('click',()=>{ $('#removeExerciseDialog').close(); doRemoveExercise(); });
    /* Always-on checkboxes inside the reorder dialog (user 2026-09-22): every
       row carries a checkbox on the left plus the reorder arrows — no Select
       button. Ticking a box swaps the footer from Done to group/delete
       actions; selection is per superset block, not per member. */
    let reorderConfirmingDelete=false;
    const reorderSelectedUids=new Set();
    /* Opens the reorder dialog for the exercise list under edit (draft or saved builder). */
    function openReorderDialog(){
      /* Reuses the shared exercise-list context (user 2026-09-12): the saved-
         workout builder gets reordering through this same dialog. */
      const list=contextExercises(); if(!list||list.length<2)return;
      reorderConfirmingDelete=false; reorderSelectedUids.clear();
      renderReorderDialog();
      $('#reorderExercisesDialog').showModal();
    }
    /* Renders the whole reorder dialog for its current state: checkbox rows
       or the delete confirmation. */
    function renderReorderDialog(){
      const list=contextExercises(); if(!list)return;
      const title=$('#reorderExercisesTitle');
      const sub=$('#reorderExercisesSub');
      if(reorderConfirmingDelete){
        const n=reorderSelectedUids.size;
        if(title)title.textContent=`Delete ${n} exercise${n===1?'':'s'}?`;
        if(sub)sub.textContent='';
      }else{
        if(title)title.textContent='Reorder exercises';
        if(sub)sub.textContent='Tick boxes to group or delete · arrows reorder.';
      }
      renderReorderList();
      renderReorderFoot();
    }
    /* Renders the reorder dialog rows — one row per superset block, each with
       an always-visible checkbox on the left and the reorder arrows on the
       right. Ticking a block selects the whole block (all its members). */
    function renderReorderList(){
      const list=contextExercises(); if(!list)return;
      const listEl=$('#reorderExercisesList'); if(!listEl)return;
      /* The delete confirm replaces the rows with the confirm copy. */
      if(reorderConfirmingDelete){ listEl.innerHTML=reorderDeleteConfirmHtml(list); return; }
      /* #448 (user 2026-09-14): the reorder dialog renders ONE row per
         superset block, not one row per member. The row the user sees is the
         unit that moves — a group shows the Superset N tag plus its members
         and carries a single arrow pair. */
      const blocks=(typeof supersetVisualBlocks==='function')
        ?supersetVisualBlocks(list)
        :list.map(item=>({group:false,items:[item]}));
      const upSvg='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>';
      const downSvg='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
      listEl.innerHTML=blocks.map((block,bi)=>{
        const names=block.items.map(item=>{
          const ex=resolveExercise(item.exerciseId);
          return ex?ex.name:'Exercise';
        });
        const groupNum=block.group?supersetGroupNumber(list,block.supersetId):0;
        const nameHtml=block.group
          ?`<span class="reorder-superset-tag">Superset ${groupNum}</span><span class="reorder-members">${names.map(n=>escapeHtml(n)).join(' · ')}</span>`
          :escapeHtml(names[0]);
        const label=block.group?`superset ${groupNum}`:names[0];
        const checked=block.items.some(item=>reorderSelectedUids.has(item.uid));
        return `<div class="reorder-row" data-reorder-block="${bi}">
          <button class="reorder-check" type="button" data-check-block="${bi}" aria-pressed="${checked}" aria-label="Select ${escapeHtml(label)}"><span class="select-check${checked?' on':''}" aria-hidden="true">${checked?'✓':''}</span></button>
          <span class="reorder-name">${nameHtml}</span>
          <span class="reorder-arrows">
            <button class="reorder-arrow" type="button" data-move="up" data-block="${bi}" ${bi===0?'disabled':''} aria-label="Move ${escapeHtml(label)} up">${upSvg}</button>
            <button class="reorder-arrow" type="button" data-move="down" data-block="${bi}" ${bi===blocks.length-1?'disabled':''} aria-label="Move ${escapeHtml(label)} down">${downSvg}</button>
          </span>
        </div>`;
      }).join('');
      listEl.querySelectorAll('[data-check-block]').forEach(btn=>btn.addEventListener('click',()=>{
        const list2=contextExercises(); if(!list2)return;
        const blocks2=(typeof supersetVisualBlocks==='function')
          ?supersetVisualBlocks(list2)
          :list2.map(item=>({group:false,items:[item]}));
        const block=blocks2[Number(btn.dataset.checkBlock)]; if(!block)return;
        const anyOn=block.items.some(item=>reorderSelectedUids.has(item.uid));
        block.items.forEach(item=>{ if(anyOn)reorderSelectedUids.delete(item.uid); else reorderSelectedUids.add(item.uid); });
        renderReorderDialog();
        /* The re-render destroys the tapped checkbox — refocus its
           replacement (same focus-drop guard as the arrow rows). */
        listEl.querySelector(`[data-check-block="${CSS.escape(btn.dataset.checkBlock)}"]`)?.focus({preventScroll:true});
      }));
      listEl.querySelectorAll('.reorder-arrow').forEach(btn=>btn.addEventListener('click',()=>{
        const list2=contextExercises(); if(!list2)return;
        const move=btn.dataset.move, bi=Number(btn.dataset.block);
        /* moveBlockAt moves the whole visual block containing the given item
           index — resolve the block's first item so the group always moves
           as one (user 2026-09-14, #448). */
        const blocks2=(typeof supersetVisualBlocks==='function')
          ?supersetVisualBlocks(list2)
          :list2.map(item=>({group:false,items:[item]}));
        const block=blocks2[bi]; if(!block||!block.items.length)return;
        const i=list2.findIndex(x=>x.uid===block.items[0].uid); if(i<0)return;
        const moved=moveBlockAt(list2,i,move); if(!moved)return;
        list2.length=0; list2.push(...moved);
        contextSaved();
        renderReorderList();
        /* The re-render destroys the tapped arrow — refocus its replacement
           on the moved block so focus doesn't drop to <body> and jump the
           page (user 2026-09-14, same focus-drop guard as the superset dialog). */
        const newBi=move==='up'?bi-1:bi+1;
        listEl.querySelector(`.reorder-arrow[data-block="${newBi}"][data-move="${move}"]`)?.focus({preventScroll:true});
      }));
    }
    /* Names the exercises about to be deleted, for the confirm step. */
    function reorderDeleteConfirmHtml(list){
      const names=list.filter(item=>reorderSelectedUids.has(item.uid))
        .map(item=>{const ex=resolveExercise(item.exerciseId);return ex?ex.name:'Exercise';});
      let who;
      if(names.length===1)who=`<b>${escapeHtml(names[0])}</b>`;
      else if(names.length===2)who=`<b>${escapeHtml(names[0])}</b> and <b>${escapeHtml(names[1])}</b>`;
      else who=`<b>${escapeHtml(names[0])}</b>, <b>${escapeHtml(names[1])}</b>, and ${names.length-2} other${names.length-2===1?'':'s'}`;
      return `<p class="reorder-confirm-body">${who} will be removed from this workout, along with ${names.length===1?'its':'their'} sets. This can't be undone.</p>`;
    }
    /* Renders the reorder dialog footer: Done when nothing is selected; the
       group/ungroup + delete actions appear on the first checkbox tick. */
    function renderReorderFoot(){
      const foot=$('#reorderExercisesFoot'); if(!foot)return;
      if(reorderConfirmingDelete){
        foot.innerHTML=`<button class="form-action secondary" id="backReorderSelect" type="button">Cancel</button>`
          +`<button class="form-action danger" id="confirmReorderDelete" type="button">Delete</button>`;
        $('#backReorderSelect')?.addEventListener('click',()=>{reorderConfirmingDelete=false;renderReorderDialog();});
        $('#confirmReorderDelete')?.addEventListener('click',confirmReorderDelete);
        return;
      }
      if(reorderSelectedUids.size){
        const list=contextExercises()||[];
        const selectedBlocks=(typeof supersetVisualBlocks==='function'
          ?supersetVisualBlocks(list)
          :list.map(item=>({group:false,items:[item]})))
          .filter(block=>block.items.some(item=>reorderSelectedUids.has(item.uid)));
        const n=reorderSelectedUids.size;
        /* Exactly one group selected: offer to dissolve it (replaces the old
           member-picker's toggle-off). Otherwise offer grouping — enabled
           once at least two blocks are selected so groups merge. */
        const action=(selectedBlocks.length===1&&selectedBlocks[0].group)
          ?`<button class="form-action primary" id="ungroupReorderSelection" type="button">Ungroup</button>`
          :`<button class="form-action primary" id="groupReorderSelection" type="button" ${selectedBlocks.length<2?'disabled':''}>Group as superset (${n})</button>`;
        foot.innerHTML=`<div class="reorder-select-foot"><div class="reorder-select-actions">`
          +action
          +`<button class="form-action danger" id="deleteReorderSelection" type="button">Delete</button></div></div>`;
        $('#groupReorderSelection')?.addEventListener('click',groupReorderSelection);
        $('#ungroupReorderSelection')?.addEventListener('click',ungroupReorderSelection);
        $('#deleteReorderSelection')?.addEventListener('click',()=>{reorderConfirmingDelete=true;renderReorderDialog();});
        return;
      }
      foot.innerHTML=`<button class="form-action primary" id="doneReorderExercises" type="button">Done</button>`;
      $('#doneReorderExercises')?.addEventListener('click',()=>{ $('#reorderExercisesDialog').close(); contextRerender(); });
    }
    /* Groups the selection as a new superset. Applies immediately and
       returns to the plain reorder view. */
    function groupReorderSelection(){
      const list=contextExercises(); if(!list)return;
      if(reorderSelectedUids.size<2)return;
      const gid=newSupersetGroupId();
      list.forEach(item=>{if(reorderSelectedUids.has(item.uid))item.supersetId=gid;});
      normalizeSupersets();
      contextSaved();
      reorderSelectedUids.clear();
      renderReorderDialog(); contextRerender();
    }
    /* Dissolves the single selected group back into plain exercises. */
    function ungroupReorderSelection(){
      const list=contextExercises(); if(!list)return;
      list.forEach(item=>{if(reorderSelectedUids.has(item.uid))item.supersetId=null;});
      normalizeSupersets();
      contextSaved();
      reorderSelectedUids.clear();
      renderReorderDialog(); contextRerender();
    }
    /* Deletes the selection after the confirm step. Mirrors
       doRemoveExercise's draft bookkeeping (superset normalize + progression
       refresh) for whichever exercise list is under edit. */
    function confirmReorderDelete(){
      const list=contextExercises(); if(!list)return;
      const kept=list.filter(item=>!reorderSelectedUids.has(item.uid));
      list.length=0; list.push(...kept);
      normalizeSupersets();
      if(exerciseListContext()==='draft'&&workoutState.draft){
        /* Same program-config resolution as doRemoveExercise: the active
           program's progression only when the draft belongs to it. */
        const activeProg=workoutState.activeProgram;
        const progConfig=(activeProg&&activeProg.id===workoutState.draft.programId)
          ?activeProg.progression:freeformProgressionConfig();
        prepareDraftProgression(workoutState.draft,progConfig);
      }
      contextSaved();
      reorderSelectedUids.clear(); reorderConfirmingDelete=false;
      if(list.length<2){ $('#reorderExercisesDialog').close(); contextRerender(); return; }
      renderReorderDialog(); contextRerender();
    }
    $('#reorderWorkoutExercises')?.addEventListener('click',openReorderDialog);
    $('#cancelReorderExercises')?.addEventListener('click',()=>$('#reorderExercisesDialog').close());
    /* #18: workout history view wiring. */
    $('#historySearch')?.addEventListener('input',()=>renderWorkoutHistoryList());
    /* Factory for a fresh empty set row. */
    function newSet() { return {uid:newSetId(), w:'', r:'', seconds:'', distance:'', rpe:'', targetRpe:'', tags:[], complete:false}; }
    /* #99 H3: ONE factory owns the exercise-item shape. Every construction site
       (picker, templates, programs, history-edit) must build items through here
       so uids and fields never drift again. `sets` are passed in; use newSet()
       (or Object.assign(newSet(), overrides)) for those.
       #498: `metrics` overrides the catalog metric profile for the item. */
    function newExerciseItem(opts={}) {
      const ex=opts.exerciseId&&typeof exercises!=='undefined'?resolveExercise(opts.exerciseId):null;
      /* #498: stamp the catalog default metrics when the caller passes none —
         items stay self-describing for the perf field and share links. */
      const metrics=Array.isArray(opts.metrics)?[...opts.metrics]:(typeof exerciseMetrics==='function'?exerciseMetrics(ex):null);
      return {
        uid: newExerciseUid(),
        exerciseId: opts.exerciseId,
        tracking: opts.tracking || 'reps',
        metrics,
        note: opts.note || '',
        noteOpen: !!opts.noteOpen,
        exerciseTags: [...(opts.exerciseTags || [])],
        supersetId: opts.supersetId || null,
        progression: opts.progression ? {...opts.progression} : null,
        sets: opts.sets || []
      };
    }
    /* The most recent weighted set's load for this exercise, or '' when none. */
    function lastUsedWeight(exerciseId) {
      const logs = getExerciseLogs(exerciseId).slice().sort(sortByWorkoutDateDesc); /* #274: most-recently-done */
      for (const log of logs) {
        const weighted = log.sets.filter(set => Number(set.w) > 0);
        if (weighted.length) return String(weighted[weighted.length - 1].w);
      }
      return '';
    }
    /* One-line "Last: 135 lb x 8 @ RPE 8 - date" summary from the latest log. */
    function lastSessionSetSummary(exerciseId) {
      const logs=getExerciseLogs(exerciseId).sort(sortByWorkoutDateDesc); /* #274: most-recently-done */
      const latest=logs[0]; if(!latest?.sets?.length)return '';
      const set=latest.sets.slice().sort((a,b)=>estimate1RM(b)-estimate1RM(a))[0];
      /* #498: distance sessions summarize load × distance. */
      const distanced=Number(set.distance)>0;
      const timed=!distanced&&(latest.tracking==='time'||set.seconds!=null);
      /* #410 (user 2026-09-13): the "Last:" line follows the dumbbell entry mode. */
      const isDb=(typeof exercises!=='undefined')&&resolveExercise(exerciseId)?.equipment==='dumbbell';
      const load=Number(set.w)>0?`${dbDisplayWeight(set.w,exerciseId,null,isDb)} ${weightUnit()}${timed?' · ':' × '}`:'';
      const performance=distanced?`${set.distance} m`:timed?(set.seconds!=null?`${set.seconds} sec`:''):(set.r!=null?`${set.r} reps`:'');
      return `Last: ${load}${performance||'—'}${set.rpe==null?'':` @ RPE ${set.rpe}`} · ${formatLogDate(latest.isoDate)}`;
    }
    /* v0.99al: latest top set's performance, for hold-case ghost defaults. When
       the progression engine holds (completed history exists but no suggestion
       fired), set rows ghost the latest top set (e.g. 6 reps) instead of the
       range minimum (1) — so 100 lb × 6 doesn't read as 100 × 1. Returns ''
       when there is no history, the top set logged no performance, or the
       exercise is AMRAP (reps stay explicit: completing an untouched AMRAP set
       must not auto-save a value). */
    function latestTopSetPerf(exerciseId, perf, isAmrap) {
      if (isAmrap) return '';
      const logs = getExerciseLogs(exerciseId).slice().sort(sortByWorkoutDateDesc); /* #274: most-recently-done */
      const latest = logs[0];
      if (!latest?.sets?.length) return '';
      /* #498: distance ghosts the longest logged distance. */
      if (perf==='distance') {
        const best=Math.max(0,...latest.sets.map(s=>Number(s.distance)||0));
        return best>0?String(best):'';
      }
      const top = latest.sets.slice().sort((a,b) => estimate1RM(b) - estimate1RM(a))[0];
      const v = perf === 'seconds' ? top.seconds : top.r;
      return v == null || v === '' ? '' : String(v);
    }
    /* #266: one PR toast per exercise per session — several sets at a PR load
       (or an uncheck/re-check) must not re-fire it. Reset when the draft
       changes. */
    let prToastedDraft=null;const prToastedExercises=new Set();
    /* PR label for a live set vs prior history — longest-hold, distance,
       bodyweight rep, e1RM, or heaviest-set — or '' when no PR. */
    function livePRLabel(item,set) {
      if(!item||!set)return '';
      const tracking=exerciseTracking(item,resolveExercise(item.exerciseId));
      const ex=resolveExercise(item.exerciseId);
      /* #282: timed PRs — a longest hold at the set's load fires the same
         celebration path as a rep PR. */
      if(tracking==='time'){
        const prior=getExerciseLogs(item.exerciseId).flatMap(log=>log.sets);
        if(detectTimedPRs([set],prior))return `${ex?.name||'Exercise'} · new longest hold PR`;
        return '';
      }
      /* #498: distance PRs — a longest distance fires the same celebration
         path as a rep PR. */
      if(setPerfField(item,ex)==='distance'){
        const prior=getExerciseLogs(item.exerciseId).flatMap(log=>log.sets);
        if(detectDistancePRs([set],prior))return `${ex?.name||'Exercise'} · new distance PR`;
        return '';
      }
      if(tracking!=='reps')return '';
      /* #372: bodyweight rep PRs — a new best unweighted rep set fires the
         same celebration path as a weighted PR. */
      if(Number(set.w)<=0){
        const prior=getExerciseLogs(item.exerciseId).flatMap(log=>log.sets);
        if(!prior.length)return '';
        if(detectBodyweightPRs([set],prior))return `${ex?.name||'Exercise'} · new rep PR`;
        return '';
      }
      const prior=getExerciseLogs(item.exerciseId).flatMap(log=>log.sets).filter(row=>Number(row.w)>0);
      if(!prior.length)return '';
      const kind=detectExercisePRs([set],prior);
      if(kind==='e1rm')return `${ex?.name||'Exercise'} · new estimated 1RM PR`;
      if(kind==='heaviest')return `${ex?.name||'Exercise'} · new heaviest set PR`;
      return '';
    }

    /* #99 B12: showToast lives in utilities.js now (one shared toast service).
       Toasts pop up and fade away (user 2026-09-10) — never a static banner. */

    /* markDraftSaved = persist only (user 2026-09-12): the visible autosave
       note was deleted, so there's no status element to update anymore. */
    function markDraftSaved() {
      schedulePersist();
    }

    /* Starts a fresh workout session: builds the draft, opens the editor, renders. */
    function startBlankWorkout(name = '', programId = null, programWorkoutUid = null) {
      /* #95 (user 2026-09-11): new workouts default to the Settings Default
         Focus, so the matching pill renders highlighted from the start. */
      const defaultFocus = progressionSetup.defaultRange?.preset || null;
      /* #99 H5: starting a fresh session closes the logs list. (#187: the
         render path now lets the list open over a draft.) */
      state.workoutHistoryOpen=false;
      workoutState.draft = {name, date:localIsoDate(), exercises:[], programId, programWorkoutUid, editingId:null, focusPreset:defaultFocus};
      $('#workoutComplete').hidden = true;
      state.workoutEditorOpen = true; /* #129: fresh session opens the editor directly. */
      renderWorkoutScreen();
    }

    /* Program-name chip (user 2026-09-12): a completed workout that belonged
       to a program shows the program name next to the workout name, like the
       Built-in chip. Looks in the active program first, then archived ones. */
    /* Shared lookup (efficiency pass 2026-09-12): a program by id, active
       first then archived — one place instead of inline copies. */
    function findProgramById(id){
      if(!id)return null;
      return (workoutState.activeProgram?.id===id?workoutState.activeProgram:null)
        ||(workoutState.archivedPrograms||[]).find(p=>p.id===id)
        ||null;
    }
    /* User 2026-09-14: ONE program-line resolver for the live-session card —
       Home and the Workout start screen render the identical line. (Home once
       gated on a getActiveProgram() helper that no longer exists, so its
       program line silently never rendered.) */
    function draftProgramLine(draft){
      if(!draft?.programId)return '';
      const program=findProgramById(draft.programId);
      if(!program)return '';
      const pw=(program.workouts||[]).find(w=>w.uid===draft.programWorkoutUid);
      return `${escapeHtml(program.name)}${pw?` · ${escapeHtml(pw.name)}`:''}`;
    }
    /* Program-name chip HTML for workout rows, or '' when the workout has no program. */
    function programNameChip(workout){
      if(!workout?.programId)return '';
      const program=findProgramById(workout.programId);
      return program?` <span class="built-in-label">${escapeHtml(program.name)}</span>`:'';
    }
    /* #99: single canonical recent-workout row — replaces three duplicated
       button markups (dashboard recent, workout-tab recent, history list). */
    function recentWorkoutButton(workout, dataAttr, smallText) {
      /* #301 (user 2026-09-12): singular "1 set", not "1 sets".
         #302: timed-only lists show total time, not "0 lb". */
      const summary = smallText || (()=>{const s=workoutSummary(workout);const vol=s.timedOnly?`${s.totalSeconds} sec`:formatVolume(s.volume);return `${formatLogDate(workout.date)}, ${s.sets} set${s.sets===1?'':'s'}, ${vol}`;})();
      return `<button class="recent-workout" type="button" ${dataAttr}="${escapeHtml(workout.id)}"><span><strong>${escapeHtml(workout.name)}${programNameChip(workout)}</strong><small>${escapeHtml(summary)}</small></span><span aria-hidden="true">›</span></button>`;
    }
    /* #18: full workout history with search + month grouping. */
    function showWorkoutHistory(){
      state.workoutHistoryOpen=true;
      const s=$('#historySearch'); if(s)s.value='';
      renderWorkoutScreen();
      /* Logs are their own page (user 2026-09-12): no tab highlight on the
         list. Coherent history: the list is a pushed page, so system back
         returns here instead of skipping to the pre-list screen. */
      setActiveNav('workout', null);
      window.scrollTo({top:0,behavior:'auto'});
      history.pushState({view:'workout', sub:'history'}, '', '#workout');
    }
    /* Closes the workout history list and re-renders the start screen. */
    function hideWorkoutHistory(){
      state.workoutHistoryOpen=false;
      renderWorkoutScreen();
      window.scrollTo({top:0,behavior:'auto'});
    }
    /* #128 (user 2026-09-12): workout logs get the same period pills as
       Home/Stats (Today / Week / Month / Year / All time) and the same flat
       card layout as Home's Recent workouts — no month grouping. Search
       covers workout names and exercise names. */
    function exerciseNamesForSearch(workout){
      return (workout.exercises||[]).map(item=>{
        const ex=resolveExercise(item.exerciseId);
        return ex?ex.name:'';
      });
    }
    /* Renders the workout log list with period filter pills. */
    function renderWorkoutHistoryList(){
      const host=$('#workoutHistoryList'); if(!host)return;
      /* Period pills (shared periodTabs helper, same look as Home/Stats). */
      const tabsHost=$('#logPeriodTabs');
      if(tabsHost){
        tabsHost.innerHTML=periodTabs('data-log-period',state.logPeriod||'all');
        tabsHost.querySelectorAll('[data-log-period]').forEach(button=>button.addEventListener('click',()=>{
          if(state.logPeriod===button.dataset.logPeriod)return;
          state.logPeriod=button.dataset.logPeriod;schedulePersist();
          /* The list height changes with the period — pin the scroll so the
             page doesn't jump, same pattern as the dashboard period tabs. */
          const scrollY=window.scrollY;
          renderWorkoutHistoryList();
          requestAnimationFrame(()=>{if(window.scrollY!==scrollY)window.scrollTo(0,scrollY);});
        }));
      }
      const searchEl=$('#historySearch');
      const query=(searchEl&&searchEl.value||'').trim().toLowerCase();
      let list=workoutsForPeriod(state.logPeriod||'all').slice().sort(sortByWorkoutDateDesc); /* #401: the list shows w.date, so it sorts by workout date (completedAt only breaks same-day ties) */
      if(query) list=list.filter(w=>(w.name||'').toLowerCase().includes(query)||exerciseNamesForSearch(w).some(name=>name.toLowerCase().includes(query)));
      const countNote=$('#historyCountNote');
      /* #311 (user 2026-09-12): just the count for the period — never
         "# of N". */
      if(countNote)countNote.textContent=`${list.length} completed session${list.length===1?'':'s'}`;
      if(!list.length){
        /* #504 (v1.8): first-use vs filtered-void. A fresh account gets the
           explained state with direct actions; an active account with an empty
           period/search gets a reset action, distinct from first use. */
        const hasAnyData=(workoutState.completed||[]).length>0;
        if(!hasAnyData){
          host.innerHTML=emptyStateHtml({
            title:'No logs yet',
            description:'Finished workouts land here with every set, rep, and PR.',
            primaryHtml:emptyStatePrimary('logsEmptyStart','Start a workout'),
            secondaryHtml:emptyStateSecondary('logsEmptyImport','Import past workouts')
          });
          $('#logsEmptyStart')?.addEventListener('click',()=>{state.workoutHistoryOpen=false;startBlankWorkout();});
          $('#logsEmptyImport')?.addEventListener('click',()=>{if(typeof openCsvImport==='function')openCsvImport();});
          return;
        }
        host.innerHTML=query
          ?`<p class="section-note">No workouts match your search. <button class="text-link" id="logsClearSearch" type="button">Clear search</button></p>`
          :`<p class="section-note">No logs in this period. <button class="text-link" id="logsViewAll" type="button">View all time</button></p>`;
        $('#logsClearSearch')?.addEventListener('click',()=>{const el=$('#historySearch');if(el)el.value='';renderWorkoutHistoryList();});
        $('#logsViewAll')?.addEventListener('click',()=>{state.logPeriod='all';schedulePersist();renderWorkoutHistoryList();});
        return;
      }
      /* Flat Home-style card: one card, hairline-divided rows, no groups. */
      host.innerHTML=`<div class="dashboard-card history-card"><div class="recent-workouts">${list.map(workout=>recentWorkoutButton(workout,'data-history-workout')).join('')}</div></div>`;
      host.querySelectorAll('[data-history-workout]').forEach(button=>button.addEventListener('click',()=>{state.workoutHistoryOpen=false;state.workoutDetailReturn=ROUTES.DETAIL_RETURN.HISTORY;renderCompletedWorkout(workoutState.completed.find(workout=>workout.id===button.dataset.historyWorkout),{push:true});}));
    }
    /* #196 (user 2026-09-12): pure no-program home layout decision. */
    function workoutHomeLayout({hasProgram, hasLastWorkout}) {
      return {
        showNextInProgram: hasProgram,
        blankAsHero: !hasProgram,
        showCreateProgram: !hasProgram,
        showRepeatLast: hasLastWorkout,
      };
    }
    /* Renders the start screen's program suggestion (or no-program) cards. */
    function renderWorkoutProgramSuggestion(homeLayout) {
      const host=$('#programStartSuggestion'),program=workoutState.activeProgram;
      if(!host)return;
      /* #196 (user 2026-09-12): no-program home — no "Next in program" card;
         the start hero carries its own [Start blank workout] primary (#504),
         so the duplicate blank-workout option card hides and a
         "Create a program" card (›) takes its slot in the options. Hidden
         nodes stay in place (never moved), so the boot-wired listeners
         survive; the change is idempotent and reversible when a program
         is set. */
      const layout=homeLayout||workoutHomeLayout({hasProgram:!!program,hasLastWorkout:true});
      const hero=$('#startBlankWorkout'),options=host.closest('.workout-start-options');
      if(layout.blankAsHero){
        host.innerHTML='';
        /* #377: the hero primary carries the highlight now, not the card. */
        hero?.classList.remove('primary');
        /* #504: the hero's own [Start blank workout] covers it — no duplicate card. */
        if(hero)hero.hidden=true;
        if(options&&!options.querySelector('#createProgramCard')){
          const card=document.createElement('button');
          card.type='button';card.id='createProgramCard';card.className='start-option has-arrow';
          card.innerHTML='<strong>Create a program</strong><span>Structure your training into a plan.</span><span class="start-option-arrow" aria-hidden="true">›</span>';
          card.addEventListener('click',()=>showProgram());
          host.after(card);
        }
        return;
      }
      /* #377: all start options live under the hero; the Continue-program
         card is the single highlighted option, so the blank card drops primary. */
      if(hero)hero.hidden=false;
      hero?.classList.remove('primary');
      options?.querySelector('#createProgramCard')?.remove();
      const ready=(program.workouts||[]).filter(workout=>workout.template?.exercises?.length);
      const next=suggestedProgramWorkout(program),week=programWeek(program),range=programRangeForWeek(program,week);
      if(!next){host.innerHTML=`<div class="program-next-wrap"><div class="program-next-main"><span><span class="program-next-kicker">ACTIVE PROGRAM · ${escapeHtml(program.name)}</span><strong>Set up your first workout</strong><small>Week ${week} · ${escapeHtml(programRangeLabel(range))}</small></span><span class="program-next-arrow" aria-hidden="true">›</span></div></div>`;host.querySelector('.program-next-main').addEventListener('click',()=>showProgram());return;}
      host.innerHTML=`<div class="program-next-wrap"><button class="program-next-main" id="startSuggestedProgramWorkout" type="button"><span><span class="program-next-kicker">CONTINUE PROGRAM · ${escapeHtml(program.name)}</span><strong>${escapeHtml(next.name)}</strong><small>Week ${week}, ${next.template.exercises.length} exercise${next.template.exercises.length===1?'':'s'}, ${escapeHtml(programWorkoutRangeLabel(program,next,week))}</small></span><span class="program-next-arrow" aria-hidden="true">›</span></button>${ready.length>1?`<details class="program-next-flexibility"><summary>Choose a different program workout</summary><div class="program-next-alternatives">${ready.filter(workout=>workout.uid!==next.uid).map(workout=>`<button type="button" data-start-program-alternative="${escapeHtml(workout.uid)}">${escapeHtml(workout.name)}</button>`).join('')}</div></details>`:''}</div>`;
      $('#startSuggestedProgramWorkout').addEventListener('click',()=>startProgramWorkout(program,next));
      document.querySelectorAll('[data-start-program-alternative]').forEach(button=>button.addEventListener('click',()=>{const workout=ready.find(row=>row.uid===button.dataset.startProgramAlternative);if(workout)startProgramWorkout(program,workout);}));
    }
    /* #66: records a workout sub-screen transition. A new sub-screen is a
       genuinely new screen: its remembered scroll resets and the viewport
       moves to the top synchronously, before the browser can paint partway
       down. Re-renders within the same sub-screen return false and never
       touch the scroll.
       #488: the viewport move belongs to the workout view. Background
       re-renders of the hidden workout view (settings unit/dumbbell pills
       and toggles, sync merges) must not yank the visible page to the top —
       a settings tap could otherwise scroll the settings page to 0 on the
       first sub-screen transition of the session. */
    function noteWorkoutSubScreen(sub) {
      if (state.workoutSubScreen === sub) return false;
      state.workoutSubScreen = sub;
      state.scroll['workout:' + sub] = 0;
      if (state.activeView === 'workout') window.scrollTo({top: 0, behavior: 'auto'});
      return true;
    }
    /* #187 (user 2026-09-12): pure pane-selection for renderWorkoutScreen.
       The logs list opens over a live draft — the draft object is untouched
       underneath, and backing out (chevron / Live chip) returns to the editor
       because workoutEditorOpen is never cleared by the list. Exactly one pane
       wins; #129 still holds (a tab tap clears workoutHistoryOpen, so a draft
       lands on the start screen with the Continue card). */
    function workoutPaneSelection({hasDraft, editorRequested, historyOpen, completeVisible, shareOpen, savedOpen, builderOpen}) {
      /* #214 (user 2026-09-12): the share landing opens over a live draft —
         shareOpen suppresses the editor like historyOpen does; the draft
         underneath is untouched and dismissing the landing restores it. */
      const editorOpen = hasDraft && editorRequested && !historyOpen && !shareOpen;
      const viewingComplete = !hasDraft && completeVisible;
      /* #235: the share landing suppresses the history, saved-workout, and
         builder panes like it does the editor — the screens underneath are
         never destroyed, so dismissing the landing restores them (extends
         #214's "dismissing returns to whatever was underneath" to every
         sub-screen). */
      const viewingHistory = !viewingComplete && !shareOpen && historyOpen;
      const viewingShare = !editorOpen && shareOpen;
      const viewingSaved = !editorOpen && !viewingShare && savedOpen;
      const viewingBuilder = !editorOpen && !viewingShare && builderOpen;
      const showingStart = !editorOpen && !viewingComplete && !viewingHistory && !viewingSaved && !viewingBuilder && !viewingShare;
      return {editorOpen, viewingComplete, viewingHistory, viewingShare, viewingSaved, viewingBuilder, showingStart};
    }
    /* Main workout-tab renderer: picks the visible pane (start, editor, logs,
       complete, share, saved, builder) and paints it. */
    function renderWorkoutScreen() {
      /* #472/#473 follow-up: a draft restored from an older build carries
         that build's suggestions — recompute once per build when the editor
         opens so fixed rounding/ordering reaches already-started workouts.
         maybeRefreshDraftSuggestions is guarded (never clobbers applied
         cards, typed values, or completed sets) and idempotent after its
         single run; the #99 H5 no-mutation rule stands for everything else
         in this render. */
      if(typeof maybeRefreshDraftSuggestions==='function'){try{maybeRefreshDraftSuggestions();}catch(_){}}
      const hasDraft = !!workoutState.draft;
      /* #129: the live editor is a destination, not the default. A draft puts a
         Continue card on the start screen; the editor opens only when the user
         taps Continue or starts a fresh session (state.workoutEditorOpen). */
      // #99 H5: no state mutation here — draft creators clear workoutHistoryOpen.
      if (hasDraft) { $('#workoutComplete').hidden = true; }
      const {editorOpen, viewingComplete, viewingHistory, viewingShare, viewingSaved, viewingBuilder, showingStart} = workoutPaneSelection({
        hasDraft,
        editorRequested: state.workoutEditorOpen,
        historyOpen: state.workoutHistoryOpen,
        completeVisible: !$('#workoutComplete').hidden,
        shareOpen: !!state.sharePreview,
        savedOpen: !!state.savedWorkoutId,
        builderOpen: !!state.savedBuilder && state.builderOpen,
      });
      /* Share preview (user 2026-09-12): a shared workout/program renders as
         its own full-screen page. The live editor still wins when open.
         Saved-workout editor page (user 2026-09-12): a saved workout opens its
         own editor, never a live session. The live editor still wins when open.
         Saved-workout builder (user 2026-09-11): its own page, like the saved
         editor. The live editor still wins when open. */
      noteWorkoutSubScreen(editorOpen ? 'editor' : (viewingShare ? 'share' : (viewingBuilder ? 'builder' : (viewingComplete ? 'complete' : (viewingHistory ? 'history' : (viewingSaved ? 'saved' : 'start'))))));
      /* Title-bar back follows the sub-screen (user 2026-09-11): keep the
         top bar in sync whenever the workout sub-screen changes. */
      if (state.activeView === 'workout') updateTopBar('workout');
      $('#workoutStart').hidden = !showingStart;
      $('#workoutEditor').hidden = !editorOpen;
      $('#workoutHistory').hidden = !viewingHistory;
      $('#savedWorkout').hidden = !viewingSaved;
      $('#savedBuilder').hidden = !viewingBuilder;
      $('#sharePreview').hidden = !viewingShare;
      const lede = $('#workoutLede');
      if (lede) lede.textContent = editorOpen ? 'Workout in progress — log your sets below.'
        : viewingComplete ? 'Reviewing a completed session.'
        : viewingHistory ? 'Browse all completed sessions.'
        : viewingShare ? 'Someone shared this with you — start it or save it.'
        : viewingSaved ? 'View or edit this saved workout.'
        : viewingBuilder ? 'Build a reusable saved workout.'
        : hasDraft ? 'A session is in progress — tap Continue to jump back in.'
        : 'Start a session or revisit your recent work.';
      updateLiveWorkoutIndicator();
      if (showingStart) {
        renderContinueWorkout();
        renderBuilderContinue();
        /* Phone QA 2026-09-12, revised user 2026-09-11: with a live session the
           start screen shows the Continue card AND the saved list (hidden hero
           only). The draft is discarded from inside the editor, never here. */
        $('#workoutStart')?.classList.toggle('draft-live', hasDraft);
        if (!hasDraft) {
          const latestReal=workoutState.completed.slice().sort(sortByRecencyDesc)[0]; /* #99 A13: latest by completion */
          /* #196 (user 2026-09-12): pure home-layout decision — the no-program
             state and a fresh user (no last workout) reshape the cards. */
          const homeLayout=workoutHomeLayout({hasProgram:!!workoutState.activeProgram,hasLastWorkout:!!latestReal});
          renderWorkoutProgramSuggestion(homeLayout);
          const repeatBtn=$('#repeatLastWorkout');
          /* #196: the Repeat last card isn't rendered at all for a fresh user. */
          if(repeatBtn){repeatBtn.hidden=!homeLayout.showRepeatLast;repeatBtn.disabled=!latestReal;$('#repeatLastWorkoutMeta').textContent=latestReal?`${latestReal.name} · ${formatLogDate(latestReal.date)}`:'Complete a workout to enable this.';}
        }
        renderWorkoutTemplateList();
      }
      if (viewingHistory) renderWorkoutHistoryList();
      if (viewingShare) renderSharePreview();
      if (viewingSaved) renderSavedWorkoutEditor();
      if (viewingBuilder) renderSavedBuilder();
      if (!editorOpen) return;
      $('#workoutName').value = workoutState.draft.name || '';
      $('#workoutDate').value = workoutState.draft.date;
      renderWorkoutDateDisplay();
      renderWorkoutExercises();
      renderWorkoutProgression();
      syncWorkoutFocusPills();
    }
    /* #129: Continue card — the autosaved in-progress workout ("draft" is
       internal-only language, never user-facing) leads the start screen with
       program + workout info. Tapping it opens the live editor.
       User 2026-09-14: this renders the long-standing green continue card
       (continueWorkoutCardHtml, shared with renderWorkoutInProgressCard) — one
       card, both pages, so the counts can never drift apart again. The
       saved-workout draft card stays Workout-page-only (renderBuilderContinue). */
    function renderContinueWorkout() {
      const wrap = $('#continueWorkoutWrap');
      if (!wrap) return;
      const draft = workoutState.draft;
      /* #443: like Home, the start screen surfaces any live draft. */
      if (!draft||!draft.exercises) { wrap.hidden = true; wrap.innerHTML = ''; return; }
      wrap.hidden = false;
      const programLine=draftProgramLine(draft);
      wrap.innerHTML = `<button class="continue-workout-card" id="continueWorkoutCard" type="button" aria-label="Continue ${escapeHtml(draft.name || 'workout')}">${continueWorkoutCardHtml(draft,programLine)}</button>
        <button class="start-new-workout-link" id="startNewWorkoutLink" type="button">or start a new workout</button>`;
      $('#continueWorkoutCard').addEventListener('click', () => { state.workoutEditorOpen = true; renderWorkoutScreen(); });
      /* QA batch (user 2026-09-21): when a workout is already active, offer a
         small bold link under the Continue card that starts a fresh workout
         through the normal discard-confirmation flow. The flag is consumed by
         the shared confirm handler in app-bootstrap.js. */
      $('#startNewWorkoutLink').addEventListener('click', () => {
        startNewAfterDiscard = true;
        showModalPinned($('#discardDraftDialog'));
      });
    }

    /* #317 BEGIN swipeGestureShouldLock (pure — unit-tested via eval in tests/swipe-weight-label-317.test.js) */
    function swipeGestureShouldLock(ax, ay) {
      ax = Math.abs(ax); ay = Math.abs(ay);
      if (ax < 7 && ay < 7) return false;                /* dead zone: undecided, keep waiting */
      if (ay > ax && (ay >= 12 || ax < 7)) return false; /* vertical wins: yield to native scroll */
      return true;                                      /* horizontal intent: engage the swipe */
    }
    /* #317 END swipeGestureShouldLock */

    /* Swipe-to-delete helpers (user 2026-09-11): iOS-Mail style — swipe left
       reveals a 72px red rail at the row's trailing end, tap the icon to
       delete; tapping anywhere else closes an open row. */
    let swipeOutsideCloserInstalled = false;
    /* Opens or closes a set row's swipe-to-delete rail. */
    function setSwipeOpen(item, open) {
      /* #85 (user 2026-09-11): the old single-open constraint is gone. Rail
         dismissal is owned by the document-level outside closer below
         (capture-phase pointerdown): touching or swiping another row closes
         the active rail, MacroFactor-style. This block used to force-close
         others here too, but it was redundant — the closer always runs before
         any swipe's finish() can open a rail. */
      item.classList.toggle('is-open', open);
      item.classList.remove('is-swiping'); /* #107: is-open owns the red now */
      const action = item.querySelector(':scope > .swipe-delete-action');
      if (action) action.tabIndex = open ? 0 : -1;
      /* #106 (agent 2026-09-14): a closed rail sits behind the row content —
         invisible, but it was still announced in the accessibility tree, so
         every set row exposed its delete twice. The rail joins the a11y tree
         only while its row is open (it is visible then); the inline × covers
         the closed state. All rails render closed, so markup starts hidden. */
      if (action) action.setAttribute('aria-hidden', open ? 'false' : 'true');
      /* #93 (user 2026-09-11): closing must also clear any leaked inline
         translateX from a pointermove whose finish() never ran (iOS can
         swallow pointerup or deliver it with a mismatched pointerId). The
         class toggle alone can't repair that — the rail would stay visibly
         open with no is-open class for the #86 close to find.
         #317 (experts 2026-09-13): clear on BOTH paths. On open, the inline
         `transition:none` + `translateX(deltaX)` left by the drag would
         otherwise beat the .is-open rule — the rail would freeze wherever
         the finger released instead of snapping to -72px with the CSS
         transition. */
      const content = item.querySelector(':scope > .swipe-content');
      if (content) { content.style.transition = ''; content.style.transform = ''; }
    }
    /* One-time document-level closer so an open swipe rail dismisses on outside tap. */
    function installSwipeOutsideCloser() {
      if (swipeOutsideCloserInstalled) return;
      swipeOutsideCloserInstalled = true;
      /* Without this, a revealed delete rail gets "stuck" open — tapping
         elsewhere must dismiss it, like iOS Mail. Capture phase so it runs
         before any row's own pointerdown handler. */
      document.addEventListener('pointerdown', event => {
        const inside = event.target && event.target.closest ? event.target.closest('.swipe-item.is-open') : null;
        document.querySelectorAll('.swipe-item.is-open').forEach(open => { if (open !== inside) setSwipeOpen(open, false); });
      }, true);
    }

    /* Wires swipe-to-delete gestures on set/exercise rows within scope. */
    function attachSwipeDelete(scope = document) {
      installSwipeOutsideCloser();
      scope.querySelectorAll('.swipe-item').forEach(item => {
        const content = item.querySelector(':scope > .swipe-content');
        if (!content || content.dataset.swipeReady) return;
        content.dataset.swipeReady = 'true';
        /* Per-item scope: both the pointerdown and pointermove listeners below
           need this. (v0.90 fix: it used to be declared inside the pointerdown
           closure only, so the pointermove blur line threw a ReferenceError
           on every swipe start — every swipe since v0.86 died right there.) */
        const isSetSwipe = item.classList.contains('set-swipe');
        let startX = 0, startY = 0, deltaX = 0, tracking = false, horizontal = false, startedOpen = false, pointerId = null, suppressClick = false, interactiveStart = false, startedOnCheckbox = false;
        content.addEventListener('pointerdown', event => {
          suppressClick = false;
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          /* Set-row swipe is touch-only and toggle-gated (user 2026-09-11):
             desktop keeps the × button, and the gesture never engages when the
             Settings toggle is off. */
          if (isSetSwipe && (typeof swipeDeleteSetsEnabled!=='function' || !swipeDeleteSetsEnabled())) return;
          /* user 2026-09-11: checked rows aren't swipeable (stopgap; #101
             tracks revisiting). Don't even start tracking the gesture. */
          if (isSetSwipe && content.classList.contains('is-complete')) return;
          /* No stopPropagation here: the document-level outside closer must see
             this tap, or open rows can never be dismissed by tapping away. */
          startX = event.clientX; startY = event.clientY; deltaX = 0; tracking = true; horizontal = false;
          /* user 2026-09-11: a gesture starting on the complete-set checkbox is
             always a tap, never a swipe. */
          startedOnCheckbox = isSetSwipe && !!event.target.closest('.complete-set');
          startedOpen = item.classList.contains('is-open'); pointerId = event.pointerId;
          /* Set rows are mostly text fields: the swipe may start anywhere on
             the row except the checkbox (see above). Tap vs swipe is decided
             at release by how far the finger actually traveled (see finish). */
          /* Program rows (user 2026-09-12): the row-open button covers the
             whole row, so every swipe started "on a button" and died here —
             the × was the only visible delete path. The open button IS the row
             body, so swipes may start on it (tap-vs-swipe is still decided at
             release); the × keeps the interactive exemption. */
          const rowBodyStart = !isSetSwipe && !!event.target.closest('.program-workout-open,.saved-workout-open');
          interactiveStart = isSetSwipe
            ? false
            : (!rowBodyStart && !!event.target.closest('input, button, textarea, select, a, summary'));
          /* Deliberately NEVER calling setPointerCapture: iOS gives every touch
             implicit capture to its touch target, and these listeners sit on an
             ancestor so the events arrive regardless. An explicit
             setPointerCapture mid-gesture makes WebKit yank capture back ~1ms
             later and fire lostpointercapture, which cancels the drag. */
        });
        content.addEventListener('pointermove', event => {
          if (!tracking || event.pointerId !== pointerId || interactiveStart || startedOnCheckbox) return;
          /* #93 (user 2026-09-11): checked rows never visually slide — the
             rail can't even flash red during the drag. (v1.045: also gates on
             startedOnCheckbox — a gesture that begins on the completion
             checkbox never visually slides; finish() forces it back to a tap
             so the checkbox rule from the #93 era is preserved. v1.046 tried
             letting the row slide from the checkbox like prod — the user
             reported it still didn't slide, so this is reverted and filed
             for a later release.) */
          if (isSetSwipe && content.classList.contains('is-complete')) return;
          const dx = event.clientX - startX, dy = event.clientY - startY;
          const ax = Math.abs(dx), ay = Math.abs(dy);
          /* #317: the lock/abort decision lives in swipeGestureShouldLock
             (pure, unit-tested) — the touchmove claim layer below mirrors it
             exactly. Inside the 7px dead zone the finger hasn't decided yet:
             keep tracking and wait. Past the dead zone, a vertical-dominant
             move kills the gesture so page scroll stays native; anything else
             locks horizontal. */
          if (!horizontal && ax < 7 && ay < 7) return;
          if (!horizontal && !swipeGestureShouldLock(ax, ay)) { tracking = false; return; }
          /* #317 (both experts 2026-09-13): NO blur here — never mutate focus
             during an active touch sequence. The v1.041 lock-time blur
             dismissed the keyboard, iOS resized the viewport mid-gesture, and
             WebKit answered with pointercancel (the row slid back). The
             v1.042 pointerdown blur was the same poison, earlier. A
             translateX works identically with a focused input. */
          horizontal = true;
          event.preventDefault();
          const base = startedOpen ? -72 : 0;
          deltaX = Math.max(-72, Math.min(0, base + dx));
          content.style.transition = 'none';
          content.style.transform = `translateX(${deltaX}px)`;
          /* #107: paint rail red only when genuinely swiped left (deltaX<0),
             added synchronously with transform so no first-frame flash. */
          item.classList.toggle('is-swiping', deltaX < 0);
        });
        /* #317 (experts 2026-09-13): iOS claim layer. WebKit's native
           recognizers — scroll AND the caret-drag/text-interaction claim on
           focused inputs — are default touch behaviors. preventDefault() on
           the PointerEvent (above) does NOT stop them on iOS; only a
           touch-level preventDefault() or touch-action does. A focused
           input's caret-drag recognizer was reclaiming horizontal drags ~10px
           in, firing pointercancel before the 24px commit — the row visibly
           slid back. This non-passive touchmove mirrors the lock predicate
           read-only and claims the gesture the moment OUR swipe would engage.
           Taps (dead zone) and vertical scrolls are never prevented, so
           tap-to-type, click, and native scrolling are untouched. touchmove
           fires before pointermove per sample, so the lock sample itself is
           claimed with no one-event lag. (v1.045: gestures starting on the
           completion checkbox are NOT claimed — they stay tap-only, matching
           finish()'s checkbox rule. v1.046 tried claiming them so the row
           would slide like prod — the user reported it still didn't slide,
           so this is reverted and filed for a later release.) */
        const claimSwipeTouch = event => {
          if (!tracking || horizontal || interactiveStart || startedOnCheckbox) return;
          if (isSetSwipe && content.classList.contains('is-complete')) return;
          if (event.touches.length !== 1) return; /* leave pinch/multi-touch alone */
          const t = event.changedTouches[0];
          if (swipeGestureShouldLock(Math.abs(t.clientX - startX), Math.abs(t.clientY - startY))) {
            event.preventDefault();
          }
        };
        const holdSwipeTouch = event => {
          /* Once locked, keep preventing so WebKit can't reclaim mid-drag. */
          if (!tracking || !horizontal) return;
          if (event.touches.length !== 1) return;
          event.preventDefault();
        };
        content.addEventListener('touchmove', claimSwipeTouch, { passive: false });
        content.addEventListener('touchmove', holdSwipeTouch, { passive: false });
        const finish = event => {
          if (event.pointerId !== pointerId) return;
          tracking = false;
          /* Reset any live-drag transform when the rail isn't opening. A tap
             with finger drift applies translateX via pointermove; if we return
             without clearing it, the rail stays visibly open with no is-open
             class, and nothing (not the #86 close, not the bubble closer) can
             dismiss it. (user 2026-09-11, #93) */
          const resetDrag = () => { content.style.transition = ''; content.style.transform = ''; horizontal = false; pointerId = null; item.classList.remove('is-swiping'); };
          /* user 2026-09-11: two hard rules. (1) A gesture starting on the
             checkbox is always a tap — never open the rail. (2) A completed
             set can't be swiped open. */
          if (startedOnCheckbox) { resetDrag(); return; }
          if (isSetSwipe && content.classList.contains('is-complete')) { resetDrag(); return; }
          /* Tap vs swipe is decided here, not at the 7px lock: only a
             deliberate drag (>= 24px of travel) counts as a swipe; anything
             smaller is a tap, so the click goes through untouched. */
          if (horizontal && Math.abs(deltaX - (startedOpen ? -72 : 0)) >= 24) {
            event.preventDefault();
            const willOpen = deltaX < -36;
            setSwipeOpen(item, willOpen);
            item.classList.remove('is-swiping'); /* #107: is-open now owns the red */
            suppressClick = true;
          } else {
            resetDrag();
          }
          horizontal = false; pointerId = null;
        };
        content.addEventListener('pointerup', finish);
        content.addEventListener('pointercancel', finish);
        /* No lostpointercapture listener: with no explicit capture there is
           nothing to lose mid-gesture (implicit touch capture releases after
           pointerup, when pointerId is already null). Binding finish() to it
           was the bug — WebKit fires it ~1ms after an explicit
           setPointerCapture and it canceled every swipe mid-gesture. */
        content.addEventListener('click', event => {
          if (!suppressClick) return;
          event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false;
        }, true);
        /* Tapping an open row itself (not the delete action, which is a
           sibling) dismisses the rail — iOS-Mail behavior. Runs at bubble so
           the tapped control (checkbox, field) still does its job first; the
           capture-phase suppressor above already swallowed post-swipe taps. */
        content.addEventListener('click', () => {
          if (!suppressClick && item.classList.contains('is-open')) setSwipeOpen(item, false);
        });
        /* #317 F1 (experts 2026-09-13): a swipe whose pointerup lands over the
           exposed rail fires click on the delete button — the capture-phase
           suppressor above sits on content (a sibling) and never sees it, so
           the set would delete instantly with no confirmation. The
           discriminator: a genuine tap always has a pointerdown on the
           button first; the swipe's own click doesn't. So the button's
           pointerdown clears suppressClick (a new gesture is starting here),
           and its capture click swallows only a click with no preceding
           pointerdown — the swipe-ending one. */
        const delBtn = item.querySelector(':scope > .swipe-delete-action');
        if (delBtn) {
          delBtn.addEventListener('pointerdown', () => { suppressClick = false; });
          delBtn.addEventListener('click', event => {
            if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; }
          }, true);
        }
      });
    }


    /* #99 B5: renderWorkoutExercises decomposed by pure code motion. HTML
       building moved verbatim into liveExerciseCardHtml; the draft-uid
       backfill into backfillDraftUids; each listener group verbatim into a
       wireLive* helper; deleteWorkoutSet hoisted to module scope (it was a
       nested declaration used once). renderWorkoutExercises only
       orchestrates the same steps in the same order. */
    function backfillDraftUids(draft){
      /* #99 H3: all constructors go through newExerciseItem()/newSet(), so fresh
         items always carry uids. This one-time migration backfills uids for
         drafts persisted before the factory existed (pre-v0.99d); it is a
         no-op for everything already built by the factory. */
      draft.exercises.forEach(item=>{
        if(!item.uid)item.uid=newExerciseUid();
        (item.sets||[]).forEach(set=>{if(!set.uid)set.uid=newSetId();});
      });
    }
    /* #146: the dumbbell total readout — the logged weight is the combined
       weight of both dumbbells. Shows "2 x per-hand = total" under the weight
       field so a per-hand entry is visibly wrong. Readout only; the entered
       value is never altered.
       #538: single-dumbbell exercises have nothing to disambiguate — the
       entered weight already IS the total — so the readout hides. */
    function dbTotalReadout(canonicalW,exerciseId,item){
      const t=Number(canonicalW); if(!(t>0))return '';
      if(dbSingleDumbbell(exerciseId,item))return '';
      return `2 \u00d7 ${displayWeight(t/2)} = ${displayWeight(t)} ${weightUnit()} total`;
    }
    /* #332 (user 2026-09-13): an exercise whose sets are all deleted stays in
       the workout — the card shows this empty state in place of the sets,
       with an explicit Remove exercise (same confirmation dialog as the
       options-menu button, via .remove-workout-exercise) plus the + Add set
       button below it. */
    function emptyExerciseStateHtml(item,ex){
      return `<div class="empty-exercise-state"><p class="section-note">No sets — add some to keep ${escapeHtml(ex?.name||'this exercise')} in this workout, or remove it.</p><button class="remove-workout-exercise text-danger-button" type="button" data-uid="${escapeHtml(item.uid)}" aria-label="Remove ${escapeHtml(ex?.name||'this exercise')} from this workout">Remove exercise</button></div>`;
    }
    /* #145 (user 2026-09-12): the per-set row HTML, extracted verbatim from
       liveExerciseCardHtml so "+ Add set" can append an identical row
       surgically instead of rebuilding the whole exercise list (the full
       render jumped the scroll). The add-set path is the live-workout
       variant of the #198 delete path — same full-render mechanism, same
       fix. Context (tracking, hints, placeholders) is recomputed here
       exactly as the card computed it. */
    function liveSetRowHtml(item,set,index){
        const ex = resolveExercise(item.exerciseId); if (!ex) return '';
        const isBodyweight = ex.equipment === 'body only';
        const weightOptionalEx = exerciseWeightOptional(ex); /* #382: bands */
        const isDumbbell = ex.equipment === 'dumbbell';
        const tracking = exerciseTracking(item, ex);
        /* #498: the performance field — 'r', 'seconds', or 'distance'. The
           distance column replaces reps/seconds in place; no sixth column. */
        const perf = setPerfField(item, ex);
        const lastWeight = lastUsedWeight(item.exerciseId);
        /* #400: All-sets toggle — ghost the per-set target for this row's
           non-warmup position. A position with no baseline gets no ghost
           (never invented); the singular target applies only when the toggle
           is off. */
        const setPos=item.sets.filter(s=>!isWarmupSet(s)).indexOf(set);
        const target=(item.suggestedTargets&&setPos>=0)?(item.suggestedTargets[setPos]||{}):(item.suggestedTarget||{});
        /* #185 (user 2026-09-13): warm-up ladder values are placeholders, not
           entered values. Warm-up rows render empty, ghost the ladder
           numbers, and the standard untouched-completion path
           (data-placeholder-*) saves the ladder values when a set is
           completed with its fields untouched. Suggestion ghosts never
           show on warm-up rows. */
        const isWarmupRow = isWarmupSet(set);
        const warmHint = isWarmupRow ? (set.warmupHint||{}) : null;
        /* QA batch (user 2026-09-22): the "+ Add set" prefill hint — the
           previous set's values ghost as placeholders on the new row.
           Suggestion targets keep priority; the hint beats the
           last-session/history ghosts. */
        const preHint=(!isWarmupRow&&set.prefillHint)?set.prefillHint:null;
        const preW=(preHint&&preHint.w!==''&&preHint.w!=null)?preHint.w:'';
        const preP=(preHint&&preHint[perf]!==''&&preHint[perf]!=null)?preHint[perf]:'';
        const weightHint = warmHint ? (warmHint.w||'') : (target.w || preW || lastWeight || '');
        const weightHintNote = !weightHint ? '' : warmHint ? `; warm-up ${escapeHtml(dbDisplayWeight(weightHint,item.exerciseId,item,isDumbbell))}` : target.w ? `; suggested ${escapeHtml(dbDisplayWeight(weightHint,item.exerciseId,item,isDumbbell))}` : preW ? `; previous set ${escapeHtml(dbDisplayWeight(weightHint,item.exerciseId,item,isDumbbell))}` : `; last used ${escapeHtml(dbDisplayWeight(weightHint,item.exerciseId,item,isDumbbell))}`;
        /* #498: rep-range placeholders don't apply to distance — the ghost is
           the suggestion's distance or the latest logged distance. */
        /* QA batch (user 2026-09-21, #3): the placeholder profile falls back to
           the default range (like progressionProfileForDraftItem), so a null
           item.progression never leaves the row with no prefill. */
        const rpProfile=(typeof progressionProfileForDraftItem==='function')?progressionProfileForDraftItem(item):null;
        const rp = perf==='distance' ? {text:'',value:''} : rangePlaceholder(rpProfile||item.progression,tracking==='time');
        const holdPerf = (!target.r && !target.seconds && !target.distance) ? latestTopSetPerf(item.exerciseId, perf, !!item.progression?.amrap) : '';
        const warmPerf = warmHint ? (warmHint.perf||'') : '';
        /* QA batch (user 2026-09-21, #8): the rep/seconds placeholder is stable —
           an explicit suggestion wins, else the range. The history ghost
           (holdPerf) no longer overrides the range in the display, so filling
           sets or tagging can't mutate it. Distance keeps its ghost. */
        const perfHint = warmHint ? warmPerf : (perf === 'seconds' ? (target.seconds || preP || rp.text) : perf === 'distance' ? (target.distance || preP || holdPerf || rp.text) : (target.r || preP || rp.text));
        /* QA batch (user 2026-09-21, #8): the untouched-completion fallback
           stays in sync with the stable display placeholder above. */
        const perfFallback = warmHint ? warmPerf : (perf === 'seconds' ? (target.seconds || preP || rp.value) : perf === 'distance' ? (target.distance || preP || holdPerf || rp.value) : (target.r || preP || rp.value));
        return `
              <div class="swipe-item set-swipe" data-set-swipe="${escapeHtml(set.uid)}">
                <button class="swipe-delete-action delete-set-swipe" type="button" aria-hidden="true" data-exercise-uid="${escapeHtml(item.uid)}" data-set-uid="${escapeHtml(set.uid)}" aria-label="Delete set ${index + 1}" tabindex="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/></svg></button>
              <div class="log-set swipe-content ${set.complete ? 'is-complete' : ''}" data-set-uid="${escapeHtml(set.uid)}">
                <button class="log-set-number ${set.tags.length ? 'has-tags' : ''}" type="button" data-tag-exercise-uid="${escapeHtml(item.uid)}" data-tag-set-uid="${escapeHtml(set.uid)}"${setIsFrozen(set)?' data-uncomplete="1"':''} aria-label="${setIsFrozen(set)?`Mark set ${index + 1} incomplete`:`Choose tags for set ${index + 1}`}" aria-haspopup="dialog">${index + 1}</button>
                <!-- #317: this wrapper was a <label> until v1.040 (the
                     label-activation theory didn't pan out — the span stays
                     because it's harmless and the input's aria-label already
                     names it). -->
                <span class="weight-entry"><input class="log-input weight-input" data-field="w"${setIsFrozen(set)?' readonly aria-disabled="true"':''} data-placeholder-weight="${escapeHtml(weightHint)}" type="number" min="0" step="${isMetric()?'0.1':'0.5'}" inputmode="decimal" value="${escapeHtml(dbDisplayWeight(set.w,item.exerciseId,item,isDumbbell))}" placeholder="${weightHint?escapeHtml(dbDisplayWeight(weightHint,item.exerciseId,item,isDumbbell)):((weightOptionalEx||tracking==='time')?'Optional':'Weight')}" aria-label="Set ${index + 1} ${isBodyweight ? 'optional added weight' : isDumbbell ? (dbEntryMode(item.exerciseId,item)==='per'?'per-dumbbell weight':'total dumbbell weight') : 'weight'} in ${isMetric()?'kilograms':'pounds'}${weightHintNote}" />${isDumbbell?`<span class="db-total-readout" data-db-readout${dbTotalReadout(set.w,item.exerciseId,item)?'':' hidden'}>${escapeHtml(dbTotalReadout(set.w,item.exerciseId,item))}</span>`:""}</span>
                <input class="log-input reps-input" data-field="${perf}"${setIsFrozen(set)?' readonly aria-disabled="true"':''} data-placeholder-perf="${escapeHtml(perfFallback)}" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(set[perf] ?? '')}" placeholder="${perfHint || (perf === 'seconds' ? 'Seconds' : perf === 'distance' ? 'Distance (m)' : 'Reps')}" aria-label="Set ${index + 1} ${perf === 'seconds' ? 'seconds' : perf === 'distance' ? 'distance in meters' : 'reps'}${perfHint ? `; target ${escapeHtml(perfHint)}` : ''}" />
                <input class="log-input rpe-input" data-field="rpe"${setIsFrozen(set)?' readonly aria-disabled="true"':''} type="number" min="0" max="10" step="0.5" inputmode="decimal" value="${escapeHtml(effortMode()==='rir'?rpeToRir(set.rpe):set.rpe)}" placeholder="${effortDisplayPlaceholder()}" aria-label="Set ${index + 1} optional ${effortMode()==='rir'?'RIR':'RPE'}" />
                <div class="set-actions">
                  <button class="complete-set" type="button" data-exercise-uid="${escapeHtml(item.uid)}" data-set-uid="${escapeHtml(set.uid)}" aria-pressed="${set.complete}" aria-label="${set.complete ? 'Mark set incomplete' : 'Mark set complete'}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect class="box" x="3.2" y="3.2" width="17.6" height="17.6" rx="5.5"/><path class="tick" d="m8 12.4 2.6 2.6 5.6-6.2"/></svg></button>
                  <button class="delete-set delete-set-inline" type="button" data-exercise-uid="${escapeHtml(item.uid)}" data-set-uid="${escapeHtml(set.uid)}" aria-label="Delete set ${index + 1}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
                </div>
                <div class="selected-set-tags" aria-label="Selected tags">${set.tags.map(tag => `<span class="set-tag-chip">${escapeHtml(tag)}</span>`).join('')}</div>
              </div>
              </div>`;
    }
    /* HTML for one live exercise card: set rows, placeholders, and suggestion hints. */
    function liveExerciseCardHtml(item,draft){
        const ex = resolveExercise(item.exerciseId); if (!ex) return '';
        const isDumbbell = ex.equipment === 'dumbbell';
        const tracking = exerciseTracking(item, ex);
        const perf = setPerfField(item, ex); /* #498: 'r' | 'seconds' | 'distance' */
        const lastWeight = lastUsedWeight(item.exerciseId);
        const target = item.suggestedTarget || {};
        const weightHint = target.w || lastWeight || '';
        /* QA batch (user 2026-09-21, #3): fall back to the default range so a
           null item.progression never leaves the card with no prefill. */
        const rpProfile2=(typeof progressionProfileForDraftItem==='function')?progressionProfileForDraftItem(item):null;
        const rp = perf==='distance' ? {text:'',value:''} : rangePlaceholder(rpProfile2||item.progression,tracking==='time');
        /* QA batch (user 2026-09-21, #8): the rep/seconds placeholder is stable —
           an explicit suggestion wins, else the range. The v0.99al history ghost
           no longer overrides the range, so the placeholder can't mutate when
           sets are filled or tags added. Distance keeps its ghost. The ghost
           placeholder and the untouched-completion fallback below stay in sync
           because both derive from these two values. */
        const holdPerf = (!target.r && !target.seconds && !target.distance) ? latestTopSetPerf(item.exerciseId, perf, !!item.progression?.amrap) : '';
        const perfHint = perf === 'seconds' ? (target.seconds || rp.text) : perf === 'distance' ? (target.distance || holdPerf || rp.text) : (target.r || rp.text);
        const perfFallback = perf === 'seconds' ? (target.seconds || rp.value) : perf === 'distance' ? (target.distance || holdPerf || rp.value) : (target.r || rp.value);
        const lastSummary = lastSessionSetSummary(item.exerciseId);
        /* #406 (user 2026-09-16): the progression suggestion lives in the
           card, merged with the history line — the separate banner is gone.
           Tap applies via applyProgressionSuggestion (ghost placeholders;
           typed values are never wiped). Hidden while editing a completed
           workout (#148). */
        const cardSuggestion=draft?.editingId?null:(draft.progressionSuggestions||[]).find(s=>s&&s.exerciseId===item.exerciseId);
        /* #498: distance exercises show a static metric label instead of the
           reps/seconds toggle. */
        const trackingSeg = perf==='distance'
          ? `<div class="tracking-segment" role="group" aria-label="Tracking metric"><span class="tracking-static">Distance</span></div>`
          : `<div class="tracking-segment" role="group" aria-label="Track reps or seconds"><button type="button" data-tracking-mode="reps" data-tracking-uid="${escapeHtml(item.uid)}" aria-pressed="${tracking==='time'?'false':'true'}">Reps</button><button type="button" data-tracking-mode="seconds" data-tracking-uid="${escapeHtml(item.uid)}" aria-pressed="${tracking==='time'?'true':'false'}">Seconds</button></div>`;
        const topWeight=Math.max(0,...item.sets.map(set=>Number(set.w)||0));
        /* #103 (user 2026-09-11): the N/M complete counter doesn't give the
           user anything — the checkboxes already show progress. Keep just
           the weight summary. */
        /* #410 (user 2026-09-13): the card's top-weight summary follows the
           dumbbell entry mode like every other display. */
        const cardSummary=`${topWeight?`${dbDisplayWeight(topWeight,item.exerciseId,item,isDumbbell)} ${weightUnit()}`:''}`;
        /* #185 (user 2026-09-13): the Warm-up button lives in the card header —
           it inserts the ladder once per exercise and hides while warm-up rows
           exist. No bulk-remove control: warm-up rows delete individually like
           any other set. (user 2026-09-22: the info icon is gone from the
           card header entirely — the collapsed card shows just the title.) */
        const hasWarmups=item.sets.some(isWarmupSet);
        const warmupControl=hasWarmups
          ? ''
          : `<button class="warmup-corner" type="button" data-warmup-uid="${escapeHtml(item.uid)}">Warm-up</button>`;
        return `<details class="exercise-accordion workout-exercise" data-workout-exercise="${escapeHtml(item.uid)}" ${item.cardOpen===false?'':'open'}>
            <summary class="exercise-accordion-head"><span class="exercise-accordion-chevron" aria-hidden="true">›</span><span class="exercise-accordion-title"><strong>${escapeHtml(ex.name)}</strong>${cardSummary?`<small>${escapeHtml(cardSummary)}</small>`:''}</span>${warmupControl}</summary>
            <div class="exercise-accordion-body">
            ${/* #438 (user 2026-09-14): the per-card Superset N band is gone —
               the group outline (rendered by renderWorkoutExercises) carries
               the single label + Edit affordance. */''}
            ${lastSummary?`<p class="last-session-line"><strong>${escapeHtml(lastSummary)}</strong></p>`:''}
            ${cardSuggestion?cardSuggestionHtml(item,cardSuggestion):''}
            <div class="log-labels"><span>SET</span><span>WEIGHT</span><span>${perf === 'seconds' ? 'SECONDS' : perf === 'distance' ? 'DIST (M)' : 'REPS'}</span><span>${effortMode()==='rir'?'RIR':'RPE'}</span><span></span></div>
            <div class="log-sets">${item.sets.length?item.sets.map((set,index)=>liveSetRowHtml(item,set,index)).join(''):emptyExerciseStateHtml(item,ex)}</div>
            <div class="set-utility-row"><button class="add-set" type="button" data-uid="${escapeHtml(item.uid)}">+ Add set</button></div>
            <div class="exercise-note">${item.noteOpen || item.note ? `<textarea id="note-${escapeHtml(item.uid)}" data-exercise-note="${escapeHtml(item.uid)}" aria-label="Exercise notes" placeholder="Cues, setup, pain, or anything to remember">${escapeHtml(item.note || '')}</textarea>` : `<button class="add-note-toggle" type="button" data-add-note="${escapeHtml(item.uid)}">Add notes</button>`}</div>
            ${/* user 2026-09-22: the progression summary sits UNDER Exercise
               options (inside the disclosure), matching the saved-workout
               builder — it was rendering as a sibling above the disclosure.
               Superset management moved to the reorder dialog's checkboxes;
               the per-exercise member picker is gone. */''}
            <details class="advanced-options" ${item.optionsOpen?'open':''}><summary>Exercise options</summary><div class="advanced-options-body"><div class="exercise-tools">${trackingSeg}</div>${progressionSummaryForOptions(item)}<div class="exercise-tag-row">${(item.exerciseTags||[]).map(tag=>`<span class="exercise-tag-chip ${workoutState.exerciseTagPresets.includes(tag)?'preset':''}">${escapeHtml(tag)}</span>`).join('')}<button class="exercise-tag-button" type="button" data-draft-exercise-tags="${escapeHtml(item.uid)}">${item.exerciseTags?.length?'Edit exercise tags':'+ Exercise tags'}</button></div><div class="remove-exercise-separator"></div><button class="swap-workout-exercise" type="button" data-swap-exercise="${escapeHtml(item.uid)}" aria-label="Swap ${escapeHtml(ex.name)} for a different exercise">Swap exercise</button><button class="remove-workout-exercise text-danger-button" type="button" data-uid="${escapeHtml(item.uid)}" aria-label="Remove ${escapeHtml(ex.name)} from this workout">Remove exercise</button></div></details>
            </div>
          </details>`;
    }
    /* #198 (user 2026-09-12): pure scroll-compensation rule for surgical set
       removal. Deleting a row above the viewport would otherwise drag the
       content under the user's eyes upward; shifting scrollY down by the
       removed height keeps the visible content glued in place. Returns the
       scrollY to restore, or null when the row was at/below the viewport top
       and scrollY must stay untouched. */
    function setDeleteScrollTarget(rowTop,rowHeight,scrollY){
      if(rowTop<scrollY)return Math.max(0,scrollY-rowHeight);
      return null;
    }
    /* #198 (user 2026-09-12): deleting a set must not flash, jump the scroll,
       or change exercise expansion. The old full renderWorkoutExercises()
       rebuild (innerHTML swap + listener rewiring + scrollTo) caused all
       three. Now only the affected node is removed: surviving set rows are
       renumbered in place,
       and nothing else is touched — sibling exercises keep their nodes,
       listeners, and <details> open state. Falls back to the full render only
       when the set row can't be found in the DOM. */
    /* Renumber a card's set rows so the sequence stays 1..N with no gaps —
       visible labels, input names, and delete names all follow the row's
       position. Called after the surgical set-row removal in
       deleteWorkoutSet, where the DOM is otherwise left untouched. */
    function renumberWorkoutSetRows(card){
      card.querySelectorAll('.log-set').forEach((setRow,i)=>{
        const n=String(i+1);
        const numBtn=setRow.querySelector('.log-set-number');
        if(numBtn){
          numBtn.textContent=n;
          /* #242: a frozen set's number button is the uncomplete unlock, not
             the tag opener — keep its label accurate after a renumber. */
          numBtn.setAttribute('aria-label',numBtn.hasAttribute('data-uncomplete')?`Mark set ${n} incomplete`:`Choose tags for set ${n}`);
        }
        /* Input names say "Set 3 weight in pounds" etc. — the visible label
           is what sighted users see, but screen-reader names must follow. */
        setRow.querySelectorAll('input[aria-label]').forEach(input=>{
          const label=input.getAttribute('aria-label');
          if(label)input.setAttribute('aria-label',label.replace(/^Set \d+ /,`Set ${n} `));
        });
        const inlineBtn=setRow.querySelector('.delete-set-inline');
        if(inlineBtn)inlineBtn.setAttribute('aria-label',`Delete set ${n}`);
        const swipeWrap=setRow.closest('.set-swipe');
        const swipeBtn=swipeWrap?swipeWrap.querySelector('.delete-set-swipe'):null;
        if(swipeBtn)swipeBtn.setAttribute('aria-label',`Delete set ${n}`);
      });
    }
    /* Deletes a draft set, holding scroll position; full-renders when the DOM
       is out of sync. */
    function deleteWorkoutSet(exerciseUid,setUid){
      const draft=workoutState.draft;if(!draft)return;
      const item=findDraftExercise(exerciseUid);if(!item)return;
      const fullRender=()=>{renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();};
      const host=$('#workoutExercises');
      const row=host?host.querySelector(`[data-set-swipe="${setUid}"]`):null;
      const card=row?row.closest('[data-workout-exercise]'):null;
      if(!row||!card){ /* DOM out of sync — rebuild rather than guess. */
        item.sets=item.sets.filter(set=>set.uid!==setUid);
        /* #332 (user 2026-09-13): the exercise stays with zero sets — the
           empty state renders on the full render below. */
        fullRender();return;
      }
      const removedTop=row.getBoundingClientRect().top+window.scrollY;
      const removedH=row.offsetHeight||row.getBoundingClientRect().height;
      const scrollY=window.scrollY;
      item.sets=item.sets.filter(set=>set.uid!==setUid);
      row.remove();
      const target=setDeleteScrollTarget(removedTop,removedH,scrollY);
      if(target!==null)window.scrollTo(0,target);
      if(!item.sets.length){
        /* #332: last set gone — the card stays. Swap the set list for the
           empty state (Remove exercise + the + Add set button below it). */
        const listEl=card.querySelector('.log-sets');
        if(listEl){
          const ex=resolveExercise(item.exerciseId);
          listEl.innerHTML=emptyExerciseStateHtml(item,ex);
          wireLiveRemoveExercise(listEl);
        }
      }else{
        renumberWorkoutSetRows(card);
        /* (b) user 2026-09-13: if the DOM and the data disagree after the
           surgical removal, the in-place numbers above would lie — fall back
           to a full render, which rebuilds the numbers from the data. */
        if(card.querySelectorAll('[data-set-swipe]').length!==item.sets.length){fullRender();return;}
      }
      markDraftSaved();
    }
    /* Wires the remove-exercise and swap-exercise buttons in the live editor. */
    function wireLiveRemoveExercise(scope=document){

      /* #142: swap an exercise while its set structure carries over. */
      scope.querySelectorAll('[data-swap-exercise]').forEach(button => button.addEventListener('click', () => startExerciseSwap(button.dataset.swapExercise,'draft')));
      scope.querySelectorAll('.remove-workout-exercise').forEach(button => button.addEventListener('click', () => {
        const draft=workoutState.draft;
        const item = draft?.exercises.find(row => row.uid === button.dataset.uid);
        const ex = item ? resolveExercise(item.exerciseId) : null;
        pendingRemoveExerciseUid = button.dataset.uid;
        $('#removeExerciseDesc').textContent = ex ? `Remove "${ex.name}" from this workout? This cannot be undone.` : 'Remove this exercise from the workout? This cannot be undone.';
        showModalPinned($('#removeExerciseDialog'));
      }));
    }
    /* #145 (user 2026-09-12): "+ Add set" in a live workout jumped the
       scroll — the handler rebuilt the whole exercise list via
       renderWorkoutExercises(). Now the new set's row is appended in place:
       identical markup (liveSetRowHtml), listeners wired on just the new
       node, sibling DOM/scroll/<details> state untouched. Falls back to the
       full render only when the exercise's set list can't be found. */
    function addWorkoutSet(exerciseUid){
      const draft=workoutState.draft;if(!draft)return;
      const item=findDraftExercise(exerciseUid);if(!item)return;
      const set=newSet();
      /* QA batch (user 2026-09-22): "+ Add set" ghosts the previous set's
         values as placeholders instead of copying them as real values —
         this replaces the removed "Apply set 1 to all". The hint rides on
         the new set object; the untouched-completion path
         (data-placeholder-*) saves the ghosted values when a set is
         completed with its fields untouched, and typing always wins. */
      const prev=[...item.sets].reverse().find(s=>!isWarmupSet(s));
      if(prev)set.prefillHint={w:prev.w??'',r:prev.r??'',seconds:prev.seconds??'',distance:prev.distance??''};
      item.sets.push(set);
      const host=$('#workoutExercises');
      const card=host?host.querySelector(`[data-workout-exercise="${CSS.escape(exerciseUid)}"]`):null;
      const list=card?card.querySelector('.log-sets'):null;
      if(!list){renderWorkoutExercises();markDraftSaved();return;}
      /* #332: adding a set to an emptied exercise clears the empty state. */
      list.querySelector('.empty-exercise-state')?.remove();
      list.insertAdjacentHTML('beforeend',liveSetRowHtml(item,set,item.sets.length-1));
      const rowEl=list.lastElementChild;
      wireLiveSetTags(rowEl);wireLiveSetInputs(rowEl);wireLiveCompleteSet(rowEl);wireLiveDeleteSet(rowEl);
      attachSwipeDelete(list); /* idempotent via dataset.swipeReady; the row itself is not its own descendant */
      markDraftSaved();
    }
    /* Wires the add-set buttons in the live editor. */
    function wireLiveAddSet(scope=document){
      scope.querySelectorAll('.add-set').forEach(button => button.addEventListener('click', () => addWorkoutSet(button.dataset.uid)));
    }
    /* #185 (user 2026-09-13): one-tap warm-up ladder. The button inserts the
       configured ladder once per exercise — a second tap is impossible
       because the button hides while warm-up rows exist. Ladder values are
       placeholders, not entered values:
       the rows render empty, ghost the ladder numbers, and completing an
       untouched set saves the ladder values via the standard
       data-placeholder-* path. Row math lives in warmupLadderRows/
       warmupAnchorLb (progression.js). */
    const REDUCED_MOTION=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* #185: warm-up rows unfold instead of popping in — WAAPI on the
       .swipe-item wrapper (never the inner .log-set.swipe-content, which
       owns the .18s swipe transform transition). Measured px heights, never
       auto; fill:'backwards' keeps staggered rows collapsed during their
       delay. No fill-forwards on insert, so effects release cleanly. */
    function animateWarmupRowsIn(rows){
      if(REDUCED_MOTION||!rows.length)return;
      rows.forEach((row,i)=>{
        const h=row.offsetHeight;
        row.animate(
          [{height:'0px',opacity:'0'},{height:h+'px',opacity:'1'}],
          {duration:260,delay:i*70,easing:'cubic-bezier(.32,.72,0,1)',fill:'backwards'}
        );
      });
    }
    /* Inserts a percentage-based warm-up ladder above an exercise's working sets. */
    function addWarmupSets(exerciseUid){
      const draft=workoutState.draft;if(!draft)return;
      const item=findDraftExercise(exerciseUid);if(!item||!item.sets)return;
      if(item.sets.some(isWarmupSet))return;
      const ex=resolveExercise(item.exerciseId);
      const tracking=exerciseTracking(item,ex);
      const perf=setPerfField(item,ex); /* #498 */
      const anchorLb=warmupAnchorLb(item);
      /* #492: warmup rung totals snap to an even total when this exercise
         displays per-dumbbell, so the halved placeholder stays whole. */
      /* #473 even-total rule: the halved per-dumbbell display stays whole.
         #538: single-dumbbell exercises display the canonical weight as-is
         (no halving), so the even-total snap must not run — it would corrupt
         e.g. 25 into 26. */
      const evenTotal=ex?.equipment==='dumbbell'&&dbEntryMode(item.exerciseId,item)==='per'&&!dbSingleDumbbell(item.exerciseId,item);
      const rows=warmupLadderRows(anchorLb,tracking,evenTotal).map(row=>{
        const set=newSet();set.tags=[WARMUP_TAG];
        /* Placeholders only — the inputs render empty. */
        set.warmupHint={w:row.w||'',perf:perf==='distance'?(row.distance||''):tracking==='time'?(row.seconds||''):(row.reps||'')};
        return set;
      });
      item.sets=[...rows,...item.sets];
      const newUids=new Set(rows.map(s=>s.uid));
      /* Surgical swap keeps the scroll glued (no full-render jump); the new
         rows then unfold with a subtle stagger. Falls back to the full
         render when the card can't be found (tests, edge cases). */
      const newCard=swapExerciseCard(item);
      if(newCard){
        const newRows=[...newCard.querySelectorAll('[data-set-swipe]')].filter(el=>newUids.has(el.dataset.setSwipe));
        animateWarmupRowsIn(newRows);
      }else{
        renderWorkoutExercises();
      }
      markDraftSaved();
    }
    /* Wires the add-warm-up-sets control. */
    function wireLiveWarmup(scope=document){
      /* The control sits inside <summary> — preventDefault + stopPropagation
         so the tap doesn't also toggle the accordion. */
      scope.querySelectorAll('[data-warmup-uid]').forEach(button => button.addEventListener('click', (e) => {e.preventDefault();e.stopPropagation();addWarmupSets(button.dataset.warmupUid);}));
    }
    /* #270: the inline × sits in the same action column as the checkbox — a
       mis-tap trap. It gets the standard confirmation dialog; the deliberate
       swipe-rail delete stays instant. */
    let pendingDeleteSet=null;
    /* Stages a set for deletion and opens the confirm dialog. */
    function requestDeleteSet(exerciseUid,setUid){
      pendingDeleteSet={exerciseUid,setUid};
      showModalPinned($('#removeSetDialog'));
    }
    $('#cancelRemoveSet')?.addEventListener('click',()=>$('#removeSetDialog').close());
    $('#keepSet')?.addEventListener('click',()=>$('#removeSetDialog').close());
    $('#confirmRemoveSet')?.addEventListener('click',()=>{ $('#removeSetDialog').close(); if(pendingDeleteSet)deleteWorkoutSet(pendingDeleteSet.exerciseUid,pendingDeleteSet.setUid); pendingDeleteSet=null; });
    /* Wires the delete-set buttons (swipe rail and inline x). */
    function wireLiveDeleteSet(scope=document){
      scope.querySelectorAll('.delete-set-swipe').forEach(button => button.addEventListener('click', () => deleteWorkoutSet(button.dataset.exerciseUid,button.dataset.setUid)));
      scope.querySelectorAll('.delete-set-inline').forEach(button => button.addEventListener('click', () => requestDeleteSet(button.dataset.exerciseUid,button.dataset.setUid)));
    }
    /* QA batch (user 2026-09-21): the effort column header toggles RPE/RIR.
       The choice persists in progressionSetup and re-renders the editor so
       every row shows the new lens; stored values stay canonical RPE. */
    function wireLiveSetInputs(scope=document){
      scope.querySelectorAll('.log-input').forEach(input => input.addEventListener('input', () => { const row=input.closest('.log-set'); const exerciseUid = input.closest('.workout-exercise').dataset.workoutExercise; const setUid = row.dataset.setUid; const item=findDraftExercise(exerciseUid); const set = item?.sets.find(itemSet => itemSet.uid === setUid); /* #410 (user 2026-09-13): the weight field holds the dumbbell entry-mode value — convert back to canonical total-combined storage on input. */ const ex=item?resolveExercise(item.exerciseId):null; const isDumbbell=ex?.equipment==='dumbbell'; if (set) { set[input.dataset.field] = input.dataset.field==='w' ? dbStorageWeight(input.value,item?.exerciseId,item,isDumbbell) : (input.dataset.field==='rpe'&&effortMode()==='rir' ? (input.value===''?'':rirToRpe(input.value)) : input.value); } /* #146: keep the dumbbell-total readout live as the user types. The field holds display units (and the entry-mode value for dumbbells) — convert back to canonical lb so the readout formats through the same displayWeight path. */ if(input.dataset.field==='w'){const readout=row.querySelector('[data-db-readout]');if(readout){const txt=dbTotalReadout(dbStorageWeight(input.value,item?.exerciseId,item,isDumbbell),item?.exerciseId,item);readout.hidden=!txt;readout.textContent=txt;}} /* #161: editing a value no longer silently un-completes the set — the old flip shrank completed-set counts on every keystroke. The checkbox stays the one explicit complete/incomplete control. */ $('#workoutError').textContent = ''; markDraftSaved(); }));
    }
    /* #242 (user 2026-09-12, corrected same day): a completed set's checkbox
       stays tappable — tapping it unchecks (uncompletes) the set. The set's
       other fields stay frozen (readonly) while it is complete; the set-number
       button also offers "Mark set N incomplete" as a secondary deliberate
       unlock. This helper keeps the
       checkbox, inputs, and number button in sync after any complete-state
       change; `setNumber` is the 1-based label for the number button. */
    function syncFrozenSetRow(setRow,set,setNumber){
      const frozen=setIsFrozen(set);
      const checkbox=setRow.querySelector('.complete-set');
      if(checkbox){
        checkbox.setAttribute('aria-pressed',String(set.complete));
        checkbox.setAttribute('aria-label',set.complete?'Mark set incomplete':'Mark set complete');
      }
      setRow.classList.toggle('is-complete',set.complete);
      setRow.querySelectorAll('.log-input').forEach(input=>{if(frozen){input.setAttribute('readonly','');input.setAttribute('aria-disabled','true');}else{input.removeAttribute('readonly');input.removeAttribute('aria-disabled');}});
      const tagBtn=setRow.querySelector('.log-set-number');
      if(tagBtn){
        if(frozen){tagBtn.setAttribute('data-uncomplete','1');tagBtn.setAttribute('aria-label',`Mark set ${setNumber} incomplete`);}
        else{tagBtn.removeAttribute('data-uncomplete');tagBtn.setAttribute('aria-label',`Choose tags for set ${setNumber}`);}
      }
    }
    /* #242: deliberate uncomplete — flips a frozen set back to editable via
       the set-number button. Surgical like the rest of the row updates. */
    function uncompleteDraftSet(exerciseUid,setUid,setRow){
      const set=findDraftSet(exerciseUid,setUid);
      if(!set||!set.complete||!setRow)return;
      set.complete=false;
      const tagBtn=setRow.querySelector('.log-set-number');
      syncFrozenSetRow(setRow,set,tagBtn?tagBtn.textContent.trim():'?');
      markDraftSaved();
    }
    /* #497 (agent): the logged-RPE scale is 0–10 — RPE 0 (trivially easy,
       e.g. a warm-up) is valid. Blank ('') stays "no RPE". */
    function validLoggedRpe(rpe){
      if(rpe===''||rpe==null)return true;
      const n=Number(rpe);
      return Number.isFinite(n)&&n>=0&&n<=10;
    }
    /* Wires the set completion checkboxes (validation, PR checks, suggestion refresh). */
    function wireLiveCompleteSet(scope=document){
      scope.querySelectorAll('.complete-set').forEach(button => button.addEventListener('click', () => {
        /* #93 (user 2026-09-11): a checkbox click means the user's intent was
           to toggle the set, not to swipe — so unconditionally clear any swipe
           state. The click is the most reliable event in iOS touch handling
           (it fires even when pointerup is swallowed), and setSwipeOpen(false)
           clears leaked inline transforms that the is-open class never tracked. */
        const swipeItem = button.closest('.swipe-item');
        if (swipeItem) setSwipeOpen(swipeItem, false);
        const set = findDraftSet(button.dataset.exerciseUid, button.dataset.setUid);
        const item=findDraftExercise(button.dataset.exerciseUid);
        const ex=resolveExercise(item?.exerciseId);
        const tracking=exerciseTracking(item,ex), weightOptional=exerciseWeightOptional(ex)||tracking==='time'; /* #279: weight is optional for timed tracking regardless of equipment (machine cardio). #382: banded work is weight-optional like bodyweight. */
        if (!set) return;
        const setRow=button.closest('.log-set');
        const weightInput=setRow.querySelector('.weight-input');
        const perfInput=setRow.querySelector('.reps-input');
        const perfField=setPerfField(item,ex); /* #498: 'r' | 'seconds' | 'distance' */
        if (!set.complete && set.w === '' && weightInput?.dataset.placeholderWeight) {
          set.w=weightInput.dataset.placeholderWeight;
          /* A6/#156: the field renders in the user's display unit — show the
             converted value, not the canonical-lb value, or metric users see
             (and then edit) lbs. #410: the field also renders in the dumbbell
             entry mode; input converts back via dbStorageWeight(). */
          weightInput.value=dbDisplayWeight(set.w,item?.exerciseId,item,ex?.equipment==='dumbbell');
        }
        if (!set.complete && (set[perfField]==null||set[perfField]==='') && perfInput?.dataset.placeholderPerf) {
          set[perfField]=perfInput.dataset.placeholderPerf;
          perfInput.value=set[perfField];
        }
        /* Persona P11#4 (2026-09-22): validate the RAW weight/RPE before the
           #564 sanitize below clamps them — a negative weight or an
           out-of-range RPE must block completion with a clear message, not
           silently clamp (-5→0, 15→10) and complete as if valid. */
        if(!set.complete){
          const rawW=set.w, rawRpe=set.rpe;
          const wNum=Number(rawW);
          const wBad=rawW!==''&&rawW!=null&&(!Number.isFinite(wNum)||wNum<0||wNum>5000);
          const rpeBad=rawRpe!==''&&rawRpe!=null&&!validLoggedRpe(rawRpe);
          if(wBad||rpeBad){
            const effortWord=effortMode()==='rir'?'RIR':'RPE';
            showToast(wBad?'Enter a weight between 0 and 5000.':`${effortWord} must be between 0 and 10 (or left blank).`);
            setRow.querySelector(wBad?'.weight-input':'.rpe-input')?.focus();
            return;
          }
        }
        /* #564: normalize on the commit point. The draft holds raw strings
           while typing (mid-keystroke states like "1." must not be clobbered),
           but marking a set complete canonicalizes its fields — fractional
           reps become whole, absurd values clamp, invalid becomes '' so the
           gate below prompts instead of logging junk. */
        if(!set.complete){
          for(const f of ['w','r','seconds','distance','rpe']){
            const v=sanitizeSetValue(f,set[f]);
            set[f]=v==null?'':v;
          }
        }
        const performanceValue=set[perfField];
        /* A10 (#99): NaN comparisons are false, so non-numeric input used to
           pass this gate as valid — require finite numbers explicitly. */
        if (!set.complete && ((!weightOptional && set.w === '') || performanceValue === '' || !Number.isFinite(Number(set.w||0)) || Number(set.w||0) < 0 || !Number.isFinite(Number(performanceValue)) || Number(performanceValue) < 1 || (set.rpe !== '' && !validLoggedRpe(set.rpe)))) {
          const perfWord = perfField==='seconds'?'seconds':perfField==='distance'?'distance (m)':'reps';
          showToast(weightOptional ? `Enter ${perfWord} to complete the set.` : `Enter weight and ${perfWord} to complete this set. RPE is optional.`);
          setRow.querySelector((!weightOptional&&set.w==='')?'.weight-input':'.reps-input')?.focus(); return;
        }
        if(prToastedDraft!==workoutState.draft){prToastedDraft=workoutState.draft;prToastedExercises.clear();}
        const pr=!set.complete&&!prToastedExercises.has(item.exerciseId)?livePRLabel(item,set):'';
        if(pr)prToastedExercises.add(item.exerciseId);
        set.complete = !set.complete; /* #161/#242: freeze the set's other inputs once it is complete (they stay readonly while complete). The checkbox itself stays tappable so the set can be unchecked; the set-number button is a secondary deliberate unlock ("Mark set N incomplete") via syncFrozenSetRow. */ {const numBtn=setRow.querySelector('.log-set-number');syncFrozenSetRow(setRow,set,numBtn?numBtn.textContent.trim():'?');} $('#workoutError').textContent = ''; if(pr)showToast(`PR · ${pr}`,'pr-toast'); markDraftSaved();
      }));
    }
    /* Wires the advanced-options disclosures on exercise cards. */
    function wireLiveAdvancedToggles(scope=document){
      scope.querySelectorAll('.advanced-options').forEach(details => details.addEventListener('toggle', () => { const item=findDraftExercise(details.closest('.workout-exercise')?.dataset.workoutExercise); if(item)item.optionsOpen=details.open; }));
    }
    /* Wires exercise card expand/collapse toggles. */
    function wireLiveCardToggles(scope=document){
      scope.querySelectorAll(".exercise-accordion").forEach(card => card.addEventListener('toggle', () => { const item=findDraftExercise(card.dataset.workoutExercise); if(item){item.cardOpen=card.open;markDraftSaved();} }));
    }
    /* Gentle open animation for exercise cards (skipped for reduced-motion users). */
    function wireLiveCardExpandAnimation(){
      /* #88 (user 2026-09-11): tiny pleasant expand animation. When a card
         opens, the body grows from 0 to full height with a soft fade (220ms).
         Close stays native/instant — animating it would require intercepting
         the summary click and risk the toggle state. */
      document.querySelectorAll(".exercise-accordion").forEach(card => card.addEventListener('toggle', () => {
        if (!card.open) return;
        /* Reduced-motion users get the instant native toggle both ways. */
        if (window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const body = card.querySelector(':scope > .exercise-accordion-body');
        if (!body || !body.animate) return;
        const height = body.scrollHeight;
        body.style.overflow = 'hidden';
        const anim = body.animate(
          [{ height: '0px', opacity: '0' }, { height: height + 'px', opacity: '1' }],
          { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
        );
        anim.onfinish = () => { body.style.height = ''; body.style.opacity = ''; body.style.overflow = ''; };
        anim.oncancel = () => { body.style.height = ''; body.style.opacity = ''; body.style.overflow = ''; };
      }));
    }
    /* Wires set tag buttons (or un-complete tap on frozen sets). */
    function wireLiveSetTags(scope=document){
      /* #242: on a frozen (completed) set the number button is the deliberate
         unlock — tapping it un-completes the set instead of opening tags. */
      scope.querySelectorAll('[data-tag-set-uid]').forEach(button => button.addEventListener('click', () => {
        if(button.hasAttribute('data-uncomplete')){
          const row=button.closest('.log-set');
          uncompleteDraftSet(button.dataset.tagExerciseUid, button.dataset.tagSetUid, row);
          return;
        }
        openTagDialog(button.dataset.tagExerciseUid, button.dataset.tagSetUid);
      }));
    }
    /* Wires the exercise-level tag buttons in the live editor. */
    function wireLiveExerciseTags(scope=document){
      scope.querySelectorAll('[data-draft-exercise-tags]').forEach(button => button.addEventListener('click', () => openExerciseTagDialog({mode:'draft',exerciseUid:button.dataset.draftExerciseTags})));
    }
    /* User 2026-09-14: tapping a completed set's field is a silent no-op
       (readonly by #161/#242 design) — e.g. adding weight to a bodyweight
       set after completing it. Say why and point at the set-number unlock
       instead of leaving the tap dead. */
    function wireLiveFrozenInputHint(scope){
      scope.querySelectorAll('.log-input[readonly]').forEach(input=>input.addEventListener('click',()=>{
        showToast('That set is complete — tap its number to edit it.');
      }));
    }
    /* Wires the add-note buttons on exercise cards. */
    function wireLiveAddNote(scope=document){
      scope.querySelectorAll('[data-add-note]').forEach(button => button.addEventListener('click', () => { const item = findDraftExercise(button.dataset.addNote); if (!item) return; item.noteOpen = true; /* Surgical swap: replace the button with the textarea in place. A full renderWorkoutExercises() here destroys all DOM and causes scroll jumps; the in-place swap keeps layout stable. */ const ta = document.createElement('textarea'); ta.id = `note-${item.uid}`; ta.dataset.exerciseNote = item.uid; ta.setAttribute('aria-label', 'Exercise notes'); ta.placeholder = 'Cues, setup, pain, or anything to remember'; ta.value = item.note || ''; ta.addEventListener('input', () => { item.note = ta.value; markDraftSaved(); }); button.replaceWith(ta); ta.focus({preventScroll:true}); }));
    }
    /* #406 (user 2026-09-16): tap-to-apply for the in-card suggestion rows.
       The engine path (applyProgressionSuggestion) only writes ghost
       placeholders — typed values and completions are never touched — then
       the surgical card swap replaces just this card (siblings keep their
       nodes, listeners, and <details> state) and focus lands on the applied
       row: no jank, no focus drop. Falls back to the full render when the
       card can't be found. */
    function wireLiveCardSuggestions(scope=document){
      scope.querySelectorAll('[data-card-suggestion]').forEach(button=>button.addEventListener('click',()=>{
        const uid=button.dataset.cardSuggestion;
        const draft=workoutState.draft;if(!draft)return;
        const item=findDraftExercise(uid);if(!item)return;
        const suggestion=(draft.progressionSuggestions||[]).find(s=>s&&s.exerciseId===item.exerciseId);
        if(!suggestion||suggestion.applied)return;
        applyProgressionSuggestion(draft,suggestion,false);
        const newCard=swapExerciseCard(item);
        if(newCard){
          newCard.querySelector('[data-card-suggestion-applied]')?.focus({preventScroll:true});
          markDraftSaved();
          return;
        }
        renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();
      }));
    }
    /* Wires the exercise note text inputs (persist on input). */
    function wireLiveNoteInputs(scope=document){
      scope.querySelectorAll('[data-exercise-note]').forEach(input => input.addEventListener('input', () => { const item = findDraftExercise(input.dataset.exerciseNote); if (item) item.note = input.value; markDraftSaved(); }));
    }
    /* #334/#185 (user 2026-09-13): surgical card swap — replaces only the
       affected exercise card via liveExerciseCardHtml, glues the scroll so
       the card stays visually pinned, and rewires listeners on the fresh
       node. Siblings keep their nodes, listeners, and <details> state.
       Skips wireLiveCardExpandAnimation — re-running it on the fresh card
       was part of the jump. Returns the new card, or null when it can't be
       found (callers fall back to the full render). */
    /* cssEsc: CSS.escape with a test-harness fallback (the harness
       stubs document but not CSS). */
    const cssEsc=s=>(typeof CSS!=='undefined'&&CSS.escape)?CSS.escape(String(s)):String(s);
    /* %1RM inputs + reps-only toggle share one after-change: recompute
       suggestions with the program week stamped (deload detection) and
       re-render. Used by the full render and by the surgical card swap. */
    function refreshProgressionAfterOptionChange(){
      const draft=workoutState.draft;
      const program=draft?.programId&&workoutState.activeProgram?.id===draft.programId?workoutState.activeProgram:null;
      prepareDraftProgression(draft,program?{...program.progression,currentWeek:programWeek(program)}:freeformProgressionConfig());
      renderWorkoutExercises();renderWorkoutProgression();
    }
    /* #398 (user 2026-09-13): the reps-only toggle gets the same surgical
       card swap as the #334 Reps/Seconds toggle. The full
       renderWorkoutExercises() in refreshProgressionAfterOptionChange()
       destroyed the tapped toggle (focus dropped to <body> — an iOS scroll
       cue) and re-ran card animations. Falls back to the full render when
       the card can't be found. The %1RM inputs keep the old after-change —
       a tap-targeted swap with focus restore is toggle-specific. */
    function repsOnlyAfterChange(item){
      const draft=workoutState.draft;
      const program=draft?.programId&&workoutState.activeProgram?.id===draft.programId?workoutState.activeProgram:null;
      prepareDraftProgression(draft,program?{...program.progression,currentWeek:programWeek(program)}:freeformProgressionConfig());
      const newCard=swapExerciseCard(item);
      if(newCard){
        newCard.querySelector(`[data-reps-only-toggle="${cssEsc(item.uid)}"]`)?.focus({preventScroll:true});
        return;
      }
      renderWorkoutExercises();renderWorkoutProgression();
    }
    /* Re-renders one exercise card in place (keeps focus/scroll); returns null
       when a full render is needed instead. */
    function swapExerciseCard(item){
      const draft=workoutState.draft;if(!draft||!item)return null;
      if(typeof document==='undefined'||typeof document.querySelector!=='function')return null;
      const card=document.querySelector(`[data-workout-exercise="${cssEsc(item.uid)}"]`);
      if(!card)return null;
      const tmp=document.createElement('div');
      tmp.innerHTML=liveExerciseCardHtml(item,draft);
      const newCard=tmp.firstElementChild;
      /* Capability check: limited DOMs (tests) can't do a real swap — the
         caller falls back to the full render. */
      if(!newCard||typeof card.getBoundingClientRect!=='function'||typeof card.replaceWith!=='function')return null;
      const top=card.getBoundingClientRect().top;
      card.replaceWith(newCard);
      wireLiveRemoveExercise(newCard);wireLiveAddSet(newCard);wireLiveWarmup(newCard);
      wireLiveDeleteSet(newCard);wireLiveSetInputs(newCard);wireLiveCompleteSet(newCard);
      wireLiveAdvancedToggles(newCard);wireLiveCardToggles(newCard);wireLiveSetTags(newCard);
      wireLiveExerciseTags(newCard);wireLiveAddNote(newCard);
      wireLiveNoteInputs(newCard);wireLiveTracking(newCard);wireLiveSuperset(newCard);
      wireLiveCardSuggestions(newCard); /* #406: the swapped card's suggestion row stays tappable. */
      /* The swap rebuilds the set rows — their swipe listeners must be
         re-attached too (user 2026-09-13: adding warm-ups froze swiping on
         the whole exercise; the #334 Reps/Seconds swap had the same hole). */
      attachSwipeDelete(newCard);
      /* Same hole, same fix for the Exercise-options controls: the swap
         rebuilds them too, so the %1RM inputs and the reps-only toggle
         would go dead on the swapped card without a re-wire. */
      wireOnermOptionInputs(newCard,findDraftExercise,refreshProgressionAfterOptionChange);
      wireRepsOnlyToggle(newCard,findDraftExercise,repsOnlyAfterChange);
      /* Per-exercise RPE trigger (user 2026-09-22): moved from Settings back
         under Exercise options where it used to be. */
      wireExerciseThresholdPills(newCard,findDraftExercise,repsOnlyAfterChange);
      /* #410 (user 2026-09-13): per-exercise dumbbell entry-mode override. */
      wireDbEntryToggle(newCard,findDraftExercise,repsOnlyAfterChange);
      /* #538 (user 2026-09-17): single-dumbbell toggle. */
      wireDbSingleToggle(newCard,findDraftExercise,repsOnlyAfterChange);
      renderWorkoutProgression();
      const top2=newCard.getBoundingClientRect().top;
      if(top2!==top)window.scrollBy(0,top2-top);
      return newCard;
    }
    /* #547 (user 2026-09-19): tapping a workout focus pill recomputed the
       suggestions (prepareDraftProgression) and refreshed the rep-range
       placeholders, but the per-card suggestion rows kept showing the old
       targets — renderWorkoutProgression() only hides the retired banner;
       the rows live inside each exercise card and were rebuilt only by a
       full renderWorkoutExercises() (the #92 flash) or swapExerciseCard().
       Refresh just the suggestion row in each card: no full-list teardown,
       no set-row rebuild, scroll and in-progress inputs untouched. */
    function refreshCardSuggestionRows(){
      const draft=workoutState.draft;
      if(!draft||typeof document==='undefined'||typeof document.querySelector!=='function')return 0;
      let refreshed=0;
      (draft.exercises||[]).forEach(item=>{
        const card=document.querySelector(`[data-workout-exercise="${cssEsc(item.uid)}"]`);
        if(!card)return;
        const suggestion=(draft.progressionSuggestions||[]).find(s=>s&&s.exerciseId===item.exerciseId);
        /* cardSuggestionHtml renders nothing without a suggestion — mirror
           liveExerciseCardHtml's `${cardSuggestion?...:''}` exactly. */
        const oldRow=card.querySelector(':scope .suggestion-inline');
        if(!suggestion){if(oldRow)oldRow.remove();return;}
        const tmp=document.createElement('div');
        tmp.innerHTML=cardSuggestionHtml(item,suggestion);
        const newRow=tmp.firstElementChild;
        if(!newRow)return;
        if(oldRow)oldRow.replaceWith(newRow);
        else{
          /* Same slot liveExerciseCardHtml uses: after the last-session
             line, before the set header row. */
          const anchor=card.querySelector(':scope .log-labels');
          if(anchor)anchor.before(newRow);
          else card.querySelector(':scope .exercise-accordion-body')?.appendChild(newRow);
        }
        wireLiveCardSuggestions(card);
        refreshed++;
      });
      return refreshed;
    }
    /* Wires the reps/time tracking-mode switch on exercise cards. */
    function wireLiveTracking(scope=document){
      scope.querySelectorAll('[data-tracking-uid]').forEach(button => button.addEventListener('click', () => {
        const item = findDraftExercise(button.dataset.trackingUid); if (!item) return;
        /* One canonical switch (efficiency pass 2026-09-12): maps "seconds"
           to 'time', no-ops when already set (no scroll jump), keeps the
           progression mode in sync, never mutates entered values. */
        const mode=button.dataset.trackingMode||'reps';
        if(!setExerciseTracking(item, mode, {resetCompletion:true}))return;
        /* #481: the switch invalidates this exercise's suggestion
           (computed for the old mode) — recompute for the new mode so no
           stale row lingers in the card; the exercise card swap below
           keeps focus. */
        refreshSuggestionForExercise(workoutState.draft, item);
        /* #334 (user 2026-09-13): surgical card swap instead of a full
           renderWorkoutExercises(). The full rebuild destroyed the tapped
           button (focus dropped to <body> — an iOS scroll cue), restored a
           stale scrollY under changed row heights, and re-ran card
           animations. Falls back to the full render when the card can't be
           found. */
        const newCard=swapExerciseCard(item);
        if(newCard){
          newCard.querySelector(`[data-tracking-uid="${cssEsc(item.uid)}"][data-tracking-mode="${cssEsc(mode)}"]`)?.focus({preventScroll:true});
          markDraftSaved();
          return;
        }
        renderWorkoutExercises(); renderWorkoutProgression(); markDraftSaved();
      }));
    }
    /* Wires the superset buttons in the live editor. */
    function wireLiveSuperset(scope=document){
      /* User 2026-09-22: superset management lives in the reorder dialog's
         checkboxes — the group outline's Edit button opens that dialog. */
      scope.querySelectorAll('[data-superset-uid]').forEach(button => button.addEventListener('click', openReorderDialog));
    }
    /* Renders the live draft's exercise list (superset groups + cards). */
    function renderWorkoutExercises() {
      const draft = workoutState.draft;
      if (!draft) return;
      /* Reorder button only makes sense with 2+ exercises to reorder. */
      const reorderBtn = $('#reorderWorkoutExercises');
      if (reorderBtn) reorderBtn.style.display = draft.exercises.length >= 2 ? '' : 'none';
      /* Preserve scroll across re-renders (prevents tap-induced jumps). */
      const _scrollY=window.scrollY;
      backfillDraftUids(draft);
      /* #438 (user 2026-09-14): consecutive superset members render inside one
         subtle group outline (single "Superset N" label + one Edit superset
         affordance in the group header) instead of a per-card band. */
      $('#workoutExercises').innerHTML = draft.exercises.length ? supersetVisualBlocks(draft.exercises).map(block=>
        block.group
          ? `<div class="superset-group" data-superset-group="${escapeHtml(block.supersetId)}">${supersetGroupHeadHtml(draft.exercises,block.supersetId,`data-superset-uid="${escapeHtml(block.items[0].uid)}"`)}${block.items.map(item=>liveExerciseCardHtml(item,draft)).join('')}</div>`
          : liveExerciseCardHtml(block.items[0],draft)
      ).join('') : '<div class="history-empty">No exercises yet. Add your first movement to begin logging.</div>';
      wireLiveRemoveExercise();
      wireLiveAddSet();
      wireLiveWarmup();
      wireLiveDeleteSet();
      wireLiveSetInputs();
      wireLiveFrozenInputHint($('#workoutExercises'));
      wireLiveCompleteSet();
      wireLiveAdvancedToggles();
      wireLiveCardToggles();
      wireLiveCardExpandAnimation();
      wireLiveSetTags();
      wireLiveExerciseTags();
      wireLiveAddNote();
      wireLiveNoteInputs();
      wireLiveTracking();
      wireLiveSuperset();
      wireLiveCardSuggestions(); /* #406: in-card suggestion tap-to-apply. */
      /* %1RM per-exercise inputs (#54, v1.001): % override + training max.
         Recompute suggestions with the program week stamped so deload
         detection stays correct after an edit. */
      wireOnermOptionInputs(document, findDraftExercise, refreshProgressionAfterOptionChange);
      /* Reps-only toggle in Exercise options (#395, user 2026-09-13). */
      wireRepsOnlyToggle(document, findDraftExercise, repsOnlyAfterChange);
      /* Per-exercise RPE trigger (user 2026-09-22): moved from Settings back
         under Exercise options where it used to be. */
      wireExerciseThresholdPills(document, findDraftExercise, repsOnlyAfterChange);
      /* Dumbbell entry-mode override in Exercise options (#410, user 2026-09-13). */
      wireDbEntryToggle(document, findDraftExercise, repsOnlyAfterChange);
      /* Single-dumbbell toggle in Exercise options (#538, user 2026-09-17). */
      wireDbSingleToggle(document, findDraftExercise, repsOnlyAfterChange);
      attachSwipeDelete($('#workoutExercises'));
      window.scrollTo(0,_scrollY);
    }

    