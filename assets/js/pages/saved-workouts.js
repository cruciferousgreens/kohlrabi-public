/* ===== module: saved-workouts.js ===== */
    /* Saved-workout repository, builder UI, and template-launch service
       (split from programs.js, #99 B3). Owns: saved-workout templates
       (list/filter/editor/duplicate/delete), repeat-workout, starting a
       workout from a template, the saved-workout builder (draft autosave,
       exercise cards, configure dialog, persist), and the live-start
       conflict dialog. Program-domain rendering it navigates back to
       (openProgramWorkoutPage) lives in programs.js, which loads right
       after this file. */
       /* Module map (v1.006) — Key: renderSavedBuilder(), openSavedWorkoutEditor(), startWorkoutFromTemplate(), repeatWorkout(), saveCompletedAsTemplate(), duplicateSavedWorkout(). Depends on: workout-editor factories, supersets.js + set-tags.js dialogs, state builder state. */
    /* #99 C19: the pending* + confirm-dialog convention — destructive actions stash
       their target in a module-level pendingX, show a <dialog>, and the confirm
       handler consumes + clears it (see pendingDeleteTemplateId, discardingBuilder
       below; also workout-editor.js, workout-history.js, supersets.js). Never read
       pendingX outside that pair. */
    let pendingRepeatWorkout=null;
    /* Starts a new live session cloned from a finished workout (RPE targets only — actual RPE never pre-fills). */
    function repeatWorkout(workout,confirmed=false){
      if(!workout)return;
      if(workoutState.draft&&!confirmed){pendingRepeatWorkout=workout;$('#replaceDraftDialog').showModal();return;}
      showWorkouts();
      /* #99 H5: a live draft wins over the history sub-pane (was done in render). */
      state.workoutHistoryOpen=false;
      workoutState.draft={
        name:workout.name, date:localIsoDate(), programId:null, programWorkoutUid:null, editingId:null,
        /* User 2026-09-13: repeat restores the finished session's focus
           (persisted on the log at finish). */
        focusPreset:REP_PRESETS[workout.focusPreset]?workout.focusPreset:null,
        /* #99 B8: canonical clone — A7 (actual RPE stays cleared, only a stored
           target carries) + #175 (weight carried as a real value). */
        exercises:workout.exercises.map(item=>cloneExerciseItem(item,'forNewSession'))
      };
      prepareDraftProgression(workoutState.draft,freeformProgressionConfig());
      schedulePersist();
      state.workoutEditorOpen = true; /* #129: repeat starts the session immediately. */
      renderWorkoutScreen();
    }
    /* A7 (#99): a saved workout stores PRESCRIPTIONS, not history. Last
       session's actual RPE becomes a suggested target — it must never start
       a new session pre-filled as an actual. Canonical clone (#99 B8). */
    function templateExercisesFromCompleted(workout) {
      return workout.exercises.map(item=>cloneExerciseItem(item,'forTemplate'));
    }
    /* Saves a completed workout as a saved workout (prescriptions, not history) and swaps its button to Start + Share. */
    function saveCompletedAsTemplate(workout,statusEl) {
      if(!workout?.exercises?.length)return;
      const template={id:newTemplateId(),name:workout.name||'Saved workout',exercises:templateExercisesFromCompleted(workout)};
      /* #240: remember which log this template came from, so the completed
         view can offer Start (not another Save as template) on re-render. */
      template.sourceLogId=workout.id;
      workoutState.templates.unshift(template); schedulePersist();
      const message=`Saved “${template.name}” as a saved workout.`;
      if(statusEl)statusEl.textContent=message; showToast(message);
      /* User 2026-09-13 (storage decision #3): the backup nudge also fires
         after saving (not just finishing workouts). */
      /* #240 (user 2026-09-12): the completed workout's button becomes Start
         — the template now exists, so the next tap trains it. The old
         addEventListener handler is dropped by replacing the node. */
      const btn=document.getElementById('saveCompletedWorkoutTop');
      if(btn){
        const start=document.createElement('button');
        start.type='button';start.id='saveCompletedWorkoutTop';start.className=btn.className;start.textContent='Start';
        /* #269: the replacement Start button gets the same conflict guard — it
           must not silently destroy the session it was just saved from. */
        start.addEventListener('click',()=>requestStartWithConflict(template.name,()=>startWorkoutFromTemplate(template.id)));
        btn.replaceWith(start);
        /* #240 refinement (user 2026-09-13): the log just became a saved
           workout — add Share next to Start immediately, no re-render needed. */
        const shareBtn=document.createElement('button');
        shareBtn.type='button';shareBtn.id='shareCompletedTemplateBtn';shareBtn.className='icon-button';
        shareBtn.setAttribute('aria-label',`Share ${template.name}`);
        shareBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 14.5v-11"/><path d="M7.6 7.4L12 3l4.4 4.4"/><path d="M6 11.5V19a1.6 1.6 0 0 0 1.6 1.6h8.8A1.6 1.6 0 0 0 18 19v-7.5"/></svg>';
        shareBtn.addEventListener('click',()=>shareTemplate(template.id));
        start.before(shareBtn);
      }
    }
    /* Starts a live session from a saved workout (template focus and progression config carried in). */
    function startWorkoutFromTemplate(id) {
      const t=workoutState.templates.find(x=>x.id===id);if(!t)return;
      state.workoutHistoryOpen=false;state.savedWorkoutId=null;
      workoutState.draft={
        name:t.name, date:localIsoDate(), programId:null, programWorkoutUid:null, editingId:null,
        /* User 2026-09-13: a template's saved focus carries into the session. */
        focusPreset:REP_PRESETS[t.focusKey]?t.focusKey:null,
        /* #99 B8: canonical clone — A7 (actual RPE never pre-fills; legacy
           templates stored the target in `rpe`, so targetRpe is preferred). */
        exercises:t.exercises.map(x=>cloneExerciseItem(x,'fromTemplate',{noteOpen:!!x.note}))
      };
      prepareDraftProgression(workoutState.draft,freeformProgressionConfig());schedulePersist();
      state.workoutEditorOpen = true; /* #129 rework: Start is tapped from the saved-workout editor. */
      renderWorkoutScreen();
    }
    /* #129 rework (user phone QA 2026-09-12): saved workouts render as clean
       StrongLifts-style cards — name, Built-in badge, exercise count, chevron.
       No inline Edit/Rename/Archive/delete; tapping a card opens the saved
       workout's editor page (never a live workout). The redundant "+ New saved
       workout" button is gone — the hero button is the one creation path. */
    /* Saved-list filter state (user 2026-09-12): one filterable saved-workout
       list. muscles = required primary muscles (AND), inProgram = only
       workouts linked to a program. Saved-workout tags come later. */
    function savedFilterState(){
      state.savedFilter=state.savedFilter||{muscles:[],inProgram:false,shared:false};
      return state.savedFilter;
    }
    /* Primary muscles hit by saved-workout exercise rows. */
    function savedItemMuscles(exerciseRows){
      const out=new Set();
      (exerciseRows||[]).forEach(item=>{
        const ex=resolveExercise(item.exerciseId);
        (ex?.primary||[]).forEach(m=>out.add(m));
      });
      return [...out];
    }
    /* Which programs reference a saved workout (user 2026-09-12: a saved workout
       may live in multiple programs — shells carry sourceTemplateId, so the
       link survives renames and the model allows many programs per saved workout). */
    function templateProgramNames(templateId){
      const names=[];
      [workoutState.activeProgram,...(workoutState.archivedPrograms||[])].filter(Boolean).forEach(p=>{
        (p.workouts||[]).forEach(w=>{if(w.sourceTemplateId===templateId&&!names.includes(p.name))names.push(p.name);});
      });
      return names;
    }
    /* #312 (user 2026-09-12): a program shell copied FROM a live saved
       workout is not a second card — the template card already carries
       the program chip, so the shell would read as a duplicate. Program-
       only workouts (no source template, or the template is gone) still
       show as their own cards. Pure so it's unit-testable. */
    function programShellCoveredByTemplate(workout,liveTemplateIds){
      return !!(workout&&workout.sourceTemplateId&&liveTemplateIds.has(workout.sourceTemplateId));
    }
    /* Renders the unified saved-workouts list (templates + uncovered program workouts) with search, filters, swipe-delete, and the archived disclosure. */
    function renderWorkoutTemplateList() {
      const host=$('#savedWorkoutList');if(!host)return;
      const filter=savedFilterState();
      const query=($('#savedSearch')?.value||'').trim().toLowerCase();
      const program=workoutState.activeProgram;
      /* One unified list (user 2026-09-12): saved workouts and program workouts
         together, each card carrying its chips (Built-in / program name). */
      const items=[];
      (workoutState.templates||[]).filter(t=>!t.archivedAt).forEach(t=>{
        items.push({kind:'template',id:t.id,name:t.name||'Untitled',builtIn:!!t.builtIn,
          shared:!!t.shared,
          exercises:t.exercises||[],programNames:templateProgramNames(t.id),
          muscles:savedItemMuscles(t.exercises||[])});
      });
      const liveTemplateIds=new Set((workoutState.templates||[]).filter(t=>!t.archivedAt).map(t=>t.id));
      (program?.workouts||[]).forEach(w=>{
        /* #312: shells covered by a live template are not second cards. */
        if(programShellCoveredByTemplate(w,liveTemplateIds))return;
        items.push({kind:'program',uid:w.uid,name:w.name||'Untitled',
          exercises:w.template?.exercises||[],programNames:[program.name],
          muscles:savedItemMuscles(w.template?.exercises||[])});
      });
      const matches=item=>{
        if(filter.inProgram&&!item.programNames.length)return false;
        if(filter.shared&&!item.shared)return false; /* #231: filterable 'shared' tag */
        if(filter.muscles.length&&!filter.muscles.every(m=>item.muscles.includes(m)))return false;
        if(query){
          const hay=(item.name+' '+item.exercises.map(e=>resolveExercise(e.exerciseId)?.name||'').join(' ')).toLowerCase();
          if(!hay.includes(query))return false;
        }
        return true;
      };
      const shown=items.filter(matches).sort((a,b)=>a.name.localeCompare(b.name));
      const card=item=>{
        /* #315 (user 2026-09-13): shared workouts carry a SHARED chip, not a
           "(shared)" name suffix. */
        const chips=`${item.kind==='template'&&item.builtIn?'<span class="built-in-label">Built-in</span>':''}${item.kind==='template'&&item.shared?'<span class="built-in-label">Shared</span>':''}${item.programNames.map(n=>`<span class="built-in-label">${escapeHtml(n)}</span>`).join('')}`;
        const count=item.exercises.length;
        const body=`<span><strong>${escapeHtml(item.name)} ${chips}</strong><span>${count} exercise${count===1?'':'s'}</span></span><span class="picker-state" aria-hidden="true">›</span>`;
        /* #338 fix (user 2026-09-13): swipeOn is declared up here, before
           EITHER branch uses it. It used to be declared after the program
           branch's early return, so rendering a program-workout card threw
           "Cannot access 'swipeOn' before initialization" and broke the whole
           workout picker (start-from-program, the program + button,
           add-exercise all render through here). */
        const swipeOn=typeof swipeDeleteSetsEnabled==='function'?swipeDeleteSetsEnabled():true;
        if(item.kind!=='template'){
          /* #338 (user 2026-09-13): program workouts get the same swipe-delete
             rail / inline × as saved-workout rows — the rail and × open the
             program-workout delete confirmation. */
          const rail=swipeOn?`<button aria-hidden="true" class="swipe-delete-action delete-program-workout" type="button" data-uid="${escapeHtml(item.uid)}" aria-label="Delete ${escapeHtml(item.name)}" tabindex="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/></svg></button>`:'';
          const inlineDel=!swipeOn?`<button class="program-workout-del" type="button" data-del-program-workout="${escapeHtml(item.uid)}" aria-label="Delete ${escapeHtml(item.name)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`:'';
          return `<div class="swipe-item program-swipe">${rail}<div class="picker-item saved-workout-card swipe-content program-workout-row"><button class="program-workout-open" type="button" data-program-workout="${escapeHtml(item.uid)}" aria-label="Open ${escapeHtml(item.name)}">${body}</button>${inlineDel}</div></div>`;
        }
        /* #260 (user 2026-09-12): swipe-to-delete on saved-workout rows,
           mirroring the program rows — the rail opens the standard delete
           confirmation (with sync tombstone). Built-ins can't be deleted, so
           they get no rail. */
        const rail=swipeOn&&!item.builtIn?`<button aria-hidden="true" class="swipe-delete-action delete-saved-row" type="button" data-saved-id="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.name)}" tabindex="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/></svg></button>`:'';
        /* #324 (user 2026-09-12): inline × delete when swipe-to-delete is off
           (desktop always) — same UI as the program workout rows. */
        const inlineDel=!swipeOn&&!item.builtIn?`<button class="saved-workout-del" type="button" data-del-saved-id="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.name)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`:'';
        return `<div class="swipe-item saved-swipe">${rail}<div class="picker-item saved-workout-card swipe-content saved-workout-row"><button class="saved-workout-open" type="button" data-saved-id="${escapeHtml(item.id)}" aria-label="Open ${escapeHtml(item.name)}">${body}</button>${inlineDel}</div></div>`;
      };
      const archived=(workoutState.templates||[]).filter(t=>t.archivedAt);
      const archivedCard=t=>card({kind:'template',id:t.id,name:t.name||'Untitled',builtIn:!!t.builtIn,exercises:t.exercises||[],programNames:[],muscles:[]});
      const filtering=query||filter.muscles.length||filter.inProgram||filter.shared;
      host.innerHTML=(shown.length?`<div class="saved-workout-cards">${shown.map(card).join('')}</div>`
        :filtering?'<div class="dialog-empty"><strong>No saved workouts match.</strong><br>Try <button type="button" class="text-link dialog-empty-link" data-clear-saved-search>clearing the search</button> or filters.</div>'
        :'<div class="dialog-empty"><strong>No saved workouts yet.</strong><br>Tap + Add saved workout below to build one, or choose Save as template on a finished log.</div>')
        +(archived.length?`<details class="archived-saved-disclosure"><summary>Archived (${archived.length})</summary><div class="saved-workout-cards">${archived.map(archivedCard).join('')}</div></details>`:'')
        +`<button class="new-template-button" id="addSavedWorkoutButton" type="button">+ Add saved workout</button>`;
      host.querySelectorAll('.saved-workout-open[data-saved-id]').forEach(b=>b.addEventListener('click',()=>openSavedWorkoutEditor(b.dataset.savedId)));
      host.querySelectorAll('[data-program-workout]').forEach(b=>b.addEventListener('click',()=>openProgramWorkoutPage(b.dataset.programWorkout)));
      /* #260: the swipe rail's delete opens the standard confirmation modal
         (with sync tombstone) instead of deleting instantly. #324: the
         inline × opens the same confirmation. */
      const confirmDeleteSaved=id=>{
        const t=workoutState.templates.find(x=>x.id===id);if(!t||t.builtIn)return;
        pendingDeleteTemplateId=t.id;
        $('#deleteTemplateDesc').textContent=`Delete "${t.name}"? This cannot be undone.`;
        showModalPinned($('#deleteTemplateDialog'));
      };
      host.querySelectorAll('.delete-saved-row').forEach(b=>b.addEventListener('click',()=>confirmDeleteSaved(b.dataset.savedId)));
      host.querySelectorAll('[data-del-saved-id]').forEach(b=>b.addEventListener('click',()=>confirmDeleteSaved(b.dataset.delSavedId)));
      /* #338: program-card rail/× reuse the program-workout delete
         confirmation (hoisted in programs.js). */
      host.querySelectorAll('.delete-program-workout').forEach(b=>b.addEventListener('click',()=>confirmDeleteProgramWorkout(b.dataset.uid)));
      host.querySelectorAll('[data-del-program-workout]').forEach(b=>b.addEventListener('click',()=>confirmDeleteProgramWorkout(b.dataset.delProgramWorkout)));
      attachSwipeDelete(host);
      $('#addSavedWorkoutButton')?.addEventListener('click',()=>startSavedBuilder());
      /* #232 (user 2026-09-12): the empty state's "clearing the search" is a
         tappable link — same clear as the filter dialog's Clear button. */
      host.querySelector('[data-clear-saved-search]')?.addEventListener('click',()=>clearSavedSearchAndFilters());
      updateSavedFilterBadge();
    }
    /* Updates the saved-list filter badge count from the active filter state. */
    function updateSavedFilterBadge(){
      const filter=savedFilterState(),n=filter.muscles.length+(filter.inProgram?1:0)+(filter.shared?1:0);
      const badge=$('#savedFilterCount');
      if(badge){badge.hidden=!n;badge.textContent=n||'';}
      $('#savedFilterBtn')?.classList.toggle('has-filters',!!n);
    }
    /* Renders the saved-list filter dialog (muscle pills, in-program, shared toggles) from the filter state. */
    function renderSavedFilterDialog(){
      const filter=savedFilterState();
      const all=new Set();
      (workoutState.templates||[]).forEach(t=>savedItemMuscles(t.exercises||[]).forEach(m=>all.add(m)));
      (workoutState.activeProgram?.workouts||[]).forEach(w=>savedItemMuscles(w.template?.exercises||[]).forEach(m=>all.add(m)));
      const muscles=[...all].sort();
      const host=$('#savedMuscleOptions');
      host.innerHTML=muscles.length?muscles.map(m=>`<button class="muscle-option" type="button" data-saved-muscle="${escapeHtml(m)}" aria-pressed="${filter.muscles.includes(m)}">${escapeHtml(titleCase(m))}</button>`).join(''):'<p class="section-note">No muscles in saved workouts yet.</p>';
      host.querySelectorAll('[data-saved-muscle]').forEach(b=>b.addEventListener('click',()=>{
        const m=b.dataset.savedMuscle,f=savedFilterState();
        f.muscles=f.muscles.includes(m)?f.muscles.filter(x=>x!==m):[...f.muscles,m];
        b.setAttribute('aria-pressed',String(f.muscles.includes(m)));
        $('#clearSavedMuscles').hidden=!f.muscles.length;
        updateSavedFilterBadge();schedulePersist(); /* v0.99al: filter survives reloads */
      }));
      $('#clearSavedMuscles').hidden=!filter.muscles.length;
      $('#savedInProgramToggle').setAttribute('aria-pressed',String(filter.inProgram));
      $('#savedSharedToggle')?.setAttribute('aria-pressed',String(!!filter.shared));
    }
    /* Opens the saved-workouts filter dialog. */
    function openSavedFilterDialog(){
      renderSavedFilterDialog();
      $('#savedFilterDialog').showModal();
    }
    /* User 2026-09-12: clearing search/filters scrolls the saved-workouts
       section into view (a controlled scroll instead of a disorienting jump
       when the list height changes). "Clear all" in the filter modal also
       drops the modal — one-shot modal actions dismiss the modal. */
    function clearSavedSearchAndFilters(dropDialog){
      const f=savedFilterState();f.muscles=[];f.inProgram=false;f.shared=false;
      const s=$('#savedSearch');if(s)s.value='';
      renderSavedFilterDialog();renderWorkoutTemplateList();schedulePersist();
      if(dropDialog)$('#savedFilterDialog').close();
      const sec=$('#savedWorkoutList')?.closest('section');
      if(sec)sec.scrollIntoView({behavior:'smooth',block:'start'});
    }
    /* One-time wiring for the saved-list search + filter (user 2026-09-12). */
    (function wireSavedListControls(){
      $('#savedSearch')?.addEventListener('input',()=>renderWorkoutTemplateList());
      $('#savedFilterBtn')?.addEventListener('click',openSavedFilterDialog);
      $('#closeSavedFilter')?.addEventListener('click',()=>$('#savedFilterDialog').close());
      $('#clearSavedMuscles')?.addEventListener('click',()=>{savedFilterState().muscles=[];renderSavedFilterDialog();updateSavedFilterBadge();schedulePersist();});
      $('#savedInProgramToggle')?.addEventListener('click',e=>{const f=savedFilterState();f.inProgram=!f.inProgram;e.currentTarget.setAttribute('aria-pressed',String(f.inProgram));updateSavedFilterBadge();schedulePersist();});
      /* #231 (user 2026-09-13): 'shared' tag filter for the saved-workouts list. */
      $('#savedSharedToggle')?.addEventListener('click',e=>{const f=savedFilterState();f.shared=!f.shared;e.currentTarget.setAttribute('aria-pressed',String(f.shared));updateSavedFilterBadge();schedulePersist();});
      $('#clearSavedFilters')?.addEventListener('click',()=>clearSavedSearchAndFilters(true));
      $('#applySavedFilters')?.addEventListener('click',()=>{$('#savedFilterDialog').close();renderWorkoutTemplateList();});
    })();
    /* Saved-workout editor page (user 2026-09-12): view/edit/start a saved
       workout. Edit/Rename/Archive/Delete live here, not on the list. #32
       will add the share-link action here too. */
    function openSavedWorkoutEditor(id){
      if(!workoutState.templates.some(t=>t.id===id))return;
      /* #135: the saved-workout detail is a Workout-tab page — own the tab
         switch (like the builder does) so the header/tab can never claim
         Program while the screen shows Workout content. */
      if(state.activeView!=='workout')showWorkouts(false);
      state.savedWorkoutId=id;state.workoutEditorOpen=false;state.builderOpen=false;renderWorkoutScreen();
    }
    /* The name + target summary for one saved-workout exercise row. */
    function savedExerciseSummary(item){
      const ex=resolveExercise(item.exerciseId);
      return exerciseTargetSummary(item,ex?.name||'Exercise');
    }
    /* Renders the saved-workout editor page: summary chips, muscle map, exercise rows, and Start/Edit/Duplicate/Archive/Delete. */
    function renderSavedWorkoutEditor(){
      const host=$('#savedWorkoutBody');if(!host)return;
      const t=workoutState.templates.find(x=>x.id===state.savedWorkoutId);
      if(!t){host.innerHTML='<div class="dialog-empty">Saved workout not found.</div>';return;}
      /* Richer summary (user 2026-09-12): focus, set totals, muscle map. */
      const focusLabel=t.focusKey&&REP_PRESETS[t.focusKey]?(()=>{const p=REP_PRESETS[t.focusKey];
        if(p.amrap)return `${p.label} · from ${p.min} rep`;
        if(p.openTop)return `${p.label} · ${p.min}+ reps`;
        return `${p.label} · ${p.min}–${p.max} reps`;})():'';
      const muscles=[...new Set((t.exercises||[]).flatMap(item=>{const ex=resolveExercise(item.exerciseId);return [...(ex?.primary||[]),...(ex?.secondary||[])];}))];
      const totalSets=(t.exercises||[]).reduce((n,item)=>n+(item.sets||[]).length,0);
      const rows=(t.exercises||[]).map(item=>{const s=savedExerciseSummary(item);return `<button class="picker-item saved-editor-row" type="button" data-saved-exercise="${escapeHtml(item.exerciseId)}" aria-label="Open ${escapeHtml(s.name)} details"><span><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.meta)}</span></span><span class="picker-state" aria-hidden="true">\u203a</span></button>`;}).join('');
      /* Layout (user 2026-09-12): Start sits inline with the workout name,
         top-right (just "Start"), not a full-width button under the stats.
         Edit opens the builder in edit mode (the creation page reused);
         built-in templates show Edit as disabled. Bottom row is Edit +
         Duplicate; Archive is a dashed button beneath. */
      /* #315 (user 2026-09-13): SHARED chip instead of a "(shared)" suffix. */
      const badges=`${t.builtIn?'<span class="built-in-label">Built-in</span>':''}${t.shared?' <span class="built-in-label">Shared</span>':''}${t.archivedAt?' <span class="built-in-label">Archived</span>':''}`;
      host.innerHTML=`<div class="completed-card"><span class="continue-kicker">Saved workout</span><div class="detail-title-row"><h2>${escapeHtml(t.name)} ${badges}</h2><span class="title-actions"><button class="icon-button" id="shareSavedWorkoutBtn" type="button" aria-label="Share ${escapeHtml(t.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 14.5v-11"/><path d="M7.6 7.4L12 3l4.4 4.4"/><path d="M6 11.5V19a1.6 1.6 0 0 0 1.6 1.6h8.8A1.6 1.6 0 0 0 18 19v-7.5"/></svg></button><button class="start-inline-button" id="startSavedWorkoutBtn" type="button">Start</button></span></div><div class="meta-chips" role="list" aria-label="Workout summary"><span class="tag" role="listitem">${t.exercises.length} exercise${t.exercises.length===1?'':'s'}</span><span class="tag" role="listitem">${totalSets} set${totalSets===1?'':'s'}</span>${focusLabel?`<span class="tag" role="listitem">Focus: ${escapeHtml(focusLabel)}</span>`:''}</div>
      ${muscles.length?`<div class="section-head"><h3>Muscles worked</h3></div>${workoutBodyMapMarkup(muscles)}<div class="workout-muscles">${muscles.map(m=>musclePill(m)).join('')}</div>`:''}
      <div class="section-head"><h3>Exercises</h3></div>${rows||'<p class="section-note">No exercises yet — add some below.</p>'}
      <div class="detail-action-buttons"><div class="detail-action-row"><button class="secondary-button" id="editSavedWorkoutBtn" type="button" ${t.builtIn?'disabled aria-disabled="true" title="Built-in workouts can\'t be edited — duplicate one to customize it"':''}>Edit</button><button class="secondary-button" id="duplicateSavedWorkoutBtn" type="button">Duplicate</button></div>
      ${t.builtIn?'':`<button class="new-template-button neutral" id="archiveSavedWorkoutBtn" type="button">${t.archivedAt?'Restore':'Archive'}</button>
      <button class="template-delete-text" id="deleteSavedWorkoutBtn" type="button">delete saved workout</button>`}</div></div>`;
      hydrateBodyMaps();
      $('#startSavedWorkoutBtn').addEventListener('click',()=>requestStartSavedWorkout(t.id));
      if(!t.builtIn)$('#editSavedWorkoutBtn')?.addEventListener('click',()=>startSavedBuilder({templateId:t.id}));
      $('#duplicateSavedWorkoutBtn')?.addEventListener('click',()=>duplicateSavedWorkout(t.id));
      /* #181: exercise rows open the exercise detail — Back returns to this
         saved workout via the saved sub-screen return route. */
      document.querySelectorAll('[data-saved-exercise]').forEach(b=>b.addEventListener('click',()=>openExercise(b.dataset.savedExercise,true,makeReturnRoute(ROUTES.VIEW.WORKOUT,{sub:ROUTES.WORKOUT_SUB.SAVED,savedWorkoutId:t.id}))));
      $('#shareSavedWorkoutBtn')?.addEventListener('click',()=>shareTemplate(t.id));
      if(!t.builtIn){
        $('#archiveSavedWorkoutBtn')?.addEventListener('click',()=>{
          if(t.archivedAt){delete t.archivedAt;showToast(`Restored “${t.name}”.`);}
          else{t.archivedAt=new Date().toISOString();showToast(`Archived “${t.name}”.`);}
          schedulePersist();refreshTemplateViews();
        });
        $('#deleteSavedWorkoutBtn')?.addEventListener('click',()=>{
          pendingDeleteTemplateId=t.id;
          $('#deleteTemplateDesc').textContent=`Delete "${t.name}"? This cannot be undone.`;
          showModalPinned($('#deleteTemplateDialog'));
        });
      }
    }
    /* Duplicate a saved workout (user 2026-09-12): deep copy with a fresh id —
       the natural way to customize a built-in template. */
    function duplicateSavedWorkout(id){
      const t=workoutState.templates.find(x=>x.id===id);if(!t)return;
      const copy={id:newTemplateId(),name:`${t.name} copy`,focusKey:t.focusKey||null,createdAt:Date.now(),exercises:cloneTemplateExercises(t.exercises||[])};
      workoutState.templates.unshift(copy);
      schedulePersist();
      showToast(`Duplicated as “${copy.name}”.`);
      openSavedWorkoutEditor(copy.id);
    }
    /* "Workout in progress" conflict (user 2026-09-12): starting a saved
       workout OR a program workout while a session is live asks first — back
       to the live workout, or switch (replace the draft). Editing a
       completed log goes through the same modal with edit-flavored copy
       (user 2026-09-12): editing opens the log as a live workout, so it
       must never silently replace the session in progress. One reusable
       modal. */
    let pendingConflictStart=null;
    function requestStartWithConflict(name,startFn,verb){
      if(workoutState.draft){
        pendingConflictStart=startFn;
        const action=verb||'Starting';
        $('#startSavedConflictDesc').textContent=`You have a workout in progress. ${action} “${name}” will replace it.`;
        $('#switchToSavedWorkout').textContent=verb==='Editing'?'Edit anyway':'Switch workout';
        $('#startSavedConflictDialog').showModal();
        return;
      }
      startFn();
    }
    /* Starts a saved workout behind the live-draft conflict guard. */
    function requestStartSavedWorkout(id){
      const t=workoutState.templates.find(x=>x.id===id);if(!t)return;
      requestStartWithConflict(t.name,()=>startWorkoutFromTemplate(id));
    }
    /* Saved-workout builder (user 2026-09-11): a full-page creator mirroring
       the live editor — name, focus pills, per-set targets — with "Save
       workout" instead of "Finish workout" and no complete checkboxes. The
       builder is in-memory until saved; it survives tab switches via a
       "Saved workout in progress" continue card, like a draft.
       Edit mode (user 2026-09-12): the creation page doubles as the editor.
       `source` is {templateId} for a saved workout or {programUid} for a
       program workout — every tool (focus, configure, supersets, tags,
       reorder) is the same code; only the save destination differs. */
    let pendingBuilderSource=null;
    /* Single "clear the builder draft" (efficiency pass 2026-09-12): every
       path that discards an in-progress builder goes through here so they
       can't disagree on what "clear" means. */
    function clearBuilderDraft(){
      /* #337: discarding a never-saved new program workout also removes its
         auto-named shell from the program — otherwise every backed-out "+"
         leaves an empty "Workout N" row on the program cover. */
      const b=state.savedBuilder;
      if(b?.isNewProgramShell&&b.editTarget?.kind==='program'){
        const program=workoutState.activeProgram;
        const idx=program?.workouts.findIndex(w=>w.uid===b.editTarget.uid)??-1;
        if(idx>=0)program.workouts.splice(idx,1);
      }
      state.savedBuilder=null;
      state.builderReturn=null;
      schedulePersist();
    }
    /* Backing out of the saved-workout builder without saving (user
       2026-09-12): a program-workout edit returns to that workout's page;
       any other builder returns to the Workout start screen. Back (chevron/
       system) keeps the draft — reopening the builder re-offers it; only
       the Discard confirmation clears it. Reads builderReturn before
       clearBuilderDraft() can wipe it. */
    function closeBuilderToReturn(clearDraft){
      const ret=state.builderReturn;
      state.builderOpen=false;
      if(clearDraft)clearBuilderDraft();else schedulePersist();
      const uid=ret&&ret.view==='program'?ret.programWorkoutUid:null;
      const stillThere=uid&&workoutState.activeProgram&&workoutState.activeProgram.workouts.some(w=>w.uid===uid);
      if(ret&&ret.view==='program'){
        /* The workout may have been deleted mid-edit — then the program
           cover is the sane fallback. */
        state.programWorkoutUid=stillThere?uid:null;
        showProgram(false);
      }else{
        renderWorkoutScreen();
      }
      window.scrollTo({top:0});
    }
    /* Opens the saved-workout builder; an in-progress builder draft asks first (keep it or start fresh). */
    function startSavedBuilder(source){
      /* A draft already open -> ask first: keep editing it, or delete it and
         start fresh (user 2026-09-11). */
      if(state.savedBuilder){pendingBuilderSource=source||null;showModalPinned($('#builderDraftExistsDialog'));return;}
      openSavedBuilder(source||null);
    }
    /* Sources describe intent; shells materialize at open time, after any
       draft conflict is resolved (efficiency pass 2026-09-12) — if a draft
       was already in progress and the user keeps it, no orphan "Workout N"
       is left behind. */
    function resolveProgramWorkoutSource(source){
      if(source?.programUid||!source?.newProgramWorkout)return source;
      const program=workoutState.activeProgram;
      if(!program)return null;
      const shell={uid:newProgramWorkoutUid(),name:`Workout ${program.workouts.length+1}`};
      program.workouts.push(shell);
      schedulePersist();
      return {programUid:shell.uid};
    }
    /* #411 (user 2026-09-13): a brand-new builder pre-highlights the default
       focus pill — the app Settings default for a new saved workout, the
       program's own default (current week) for a new program workout.
       Mirrors startBlankWorkout's #95 default. Edits keep their saved
       focus; only a real REP_PRESETS key highlights (a 'custom' default
       leaves the pills clear). Tapping the highlighted pill still clears
       it (applyBuilderFocus). Pure-ish so it's unit-testable. */
    function defaultBuilderFocusKey({isNewProgramShell,programWorkout,template,base}){
      if(base?.focusKey)return base.focusKey;
      const settingsPreset=()=>{
        const preset=progressionSetup.defaultRange&&progressionSetup.defaultRange.preset;
        return preset&&REP_PRESETS[preset]?preset:null;
      };
      const programPreset=()=>{
        /* programs.js always loads in the app; the typeof guard is for test
           roles that load the builder without it. */
        if(!workoutState.activeProgram)return null;
        if(typeof programRangeForWeek==='function'&&typeof programWeek==='function'){
          const wk=programRangeForWeek(workoutState.activeProgram,programWeek(workoutState.activeProgram));
          if(wk&&wk.preset&&REP_PRESETS[wk.preset])return wk.preset;
        }
        const dp=workoutState.activeProgram.progression&&workoutState.activeProgram.progression.defaultRange&&workoutState.activeProgram.progression.defaultRange.preset;
        return dp&&REP_PRESETS[dp]?dp:null;
      };
      /* #411 follow-up (user 2026-09-13): OPENING an existing workout with no
         saved focus falls back too — an existing program workout uses the
         program's current-week default (then the program default), any other
         builder (saved workout/template, unsaved scratch) uses the app
         Settings default. Previously only brand-new shells and brand-new
         saved workouts got a fallback, so reopened workouts showed blank
         pills. Tapping the highlighted pill still clears it (builder tests). */
      if(programWorkout)return programPreset();
      return settingsPreset();
    }
    /* Materializes the builder draft (cloned exercises, focus, edit target) on the Workout tab and renders it. */
    function openSavedBuilder(source){
      pendingBuilderSource=null;
      /* The builder lives on the Workout tab (efficiency pass 2026-09-12):
         the screen owns its tab switch, so no caller has to remember that
         this page "secretly" belongs to another tab. */
      if(state.activeView!=='workout')showWorkouts(false);
      /* #337 (user 2026-09-13): a fresh program-workout shell is auto-named
         ("Workout N") so the program cover never shows a blank row, but the
         builder's name field starts empty with the "Workout" placeholder —
         the auto name only sticks when the field is left blank at save. */
      const isNewProgramShell=!!source?.newProgramWorkout&&!source?.programUid;
      source=resolveProgramWorkoutSource(source);
      const programWorkout=source?.programUid?workoutState.activeProgram?.workouts.find(w=>w.uid===source.programUid):null;
      const template=source?.templateId?workoutState.templates.find(t=>t.id===source.templateId):null;
      const base=programWorkout?.template||template;
      /* Editing clones the exercises so the original is untouched until Save. */
      state.savedBuilder={
        id:template?template.id:newTemplateId(),
        name:programWorkout?(isNewProgramShell?'':programWorkout.name):(template?template.name:''),
        focusKey:defaultBuilderFocusKey({isNewProgramShell,programWorkout,template,base}),
        exercises:cloneTemplateExercises(base?.exercises||[]),
        editTarget:programWorkout?{kind:'program',uid:programWorkout.uid}:template?{kind:'template',id:template.id}:null,
        isNewProgramShell:isNewProgramShell&&!!programWorkout
      };
      /* Backing out of a program-workout edit returns to that workout's
         page (user 2026-09-12) — not the program cover, not the Workout tab. */
      state.builderReturn=programWorkout?{view:'program',programWorkoutUid:programWorkout.uid}:null;
      state.builderOpen=true;state.savedWorkoutId=null;state.workoutEditorOpen=false;
      schedulePersist();renderWorkoutScreen();window.scrollTo({top:0});
    }
    /* The builder mirrors the live editor card-for-card (user 2026-09-11):
       same accordion, chevron, corner info button, set rows, add-set row,
       notes, and exercise options -- minus every logging control (no weight,
       RPE, tags, or complete checkboxes). Set inputs hold per-set targets. */
    function builderExerciseCard(item,list){
      const ex=resolveExercise(item.exerciseId);
      const time=exerciseTracking(item,ex)==='time';
      const unit=time?'sec':'reps';
      const uidAttr=escapeHtml(item.uid||'');
      const rp=rangePlaceholder(item.progression,time);
      const rangeSummary=rp.text||'';
      const setRows=(item.sets||[]).map((set,i)=>{
        const val=time?(set.seconds??''):(set.r??'');
        const setTags=set.tags||[];
        /* P1 QA 2026-09-22: the tag names render as visible chips under the
           row — warm-up rows inserted by the Warm-up button were
           indistinguishable from work sets (only a subtle tint on the set
           number). The tag picker (tap the set number) can still edit/remove. */
        const tagChips=setTags.length?`<div class="builder-set-tags">${setTags.map(t=>`<span class="set-tag-chip">${escapeHtml(t)}</span>`).join('')}</div>`:'';
        return `<div class="swipe-item set-swipe" data-builder-set-swipe="${escapeHtml(set.uid||('s'+i))}"><button aria-hidden="true" class="swipe-delete-action delete-builder-set-swipe" type="button" data-builder-uid="${uidAttr}" data-builder-set="${i}" aria-label="Remove set ${i+1}" tabindex="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/></svg></button><div class="swipe-content"><div class="builder-set-row"><button class="builder-set-num log-set-number ${setTags.length?'has-tags':''}" type="button" data-builder-tag-set="${escapeHtml(set.uid||'')}" data-builder-tag-exercise="${uidAttr}" aria-label="Choose tags for set ${i+1}" aria-haspopup="dialog">${i+1}</button><input class="log-input" type="number" inputmode="numeric" min="1" value="${escapeHtml(String(val))}" placeholder="${escapeHtml(rangeSummary||'Target')}" data-builder-set="${i}" data-builder-uid="${uidAttr}" aria-label="Set ${i+1} target ${unit}"><button class="builder-x" type="button" data-builder-del-set="${i}" data-builder-uid="${uidAttr}" aria-label="Remove set ${i+1}">\u00d7</button></div>${tagChips}</div></div>`;
      }).join('');
      /* #185 (user 2026-09-13): templates can carry warm-up rows — the Warm-up
         button inserts the ladder once per exercise (reps/seconds targets,
         tagged Warmup) and hides while warm-up rows exist. No bulk-remove:
         warm-up rows delete individually like any other set. */
      const hasWarmups=(item.sets||[]).some(isWarmupSet);
      const warmupControl=hasWarmups
        ? ''
        : `<button class="add-warmup" type="button" data-builder-warmup="${uidAttr}">Warm-up</button>`;
      return `<details class="exercise-accordion workout-exercise" data-builder-exercise="${uidAttr}" ${item.cardOpen===false?'':'open'}>
            <summary class="exercise-accordion-head"><span class="exercise-accordion-chevron" aria-hidden="true">\u203a</span><span class="exercise-accordion-title"><strong>${escapeHtml(ex?.name||'Exercise')}</strong>${rangeSummary?`<small>${escapeHtml(rangeSummary)}</small>`:''}</span></summary>
            <div class="exercise-accordion-body">
            ${/* #438 (user 2026-09-14): per-card Superset N band removed — the
               group outline in savedBuilderPageHtml carries the label. */''}
            <div class="log-labels builder-labels"><span>SET</span><span>${time?'SECONDS':'REPS'}</span><span></span></div>
            <div class="log-sets">${setRows||'<div class="history-empty">No sets yet.</div>'}</div>
            <div class="set-utility-row"><button class="add-set" type="button" data-builder-add-set="${uidAttr}">+ Add set</button>${warmupControl}</div>
            <div class="exercise-note">${item.noteOpen||item.note?`<textarea id="note-${uidAttr}" data-builder-note="${uidAttr}" aria-label="Exercise notes" placeholder="Cues, setup, pain, or anything to remember">${escapeHtml(item.note||'')}</textarea>`:`<button class="add-note-toggle" type="button" data-builder-add-note="${uidAttr}">Add notes</button>`}</div>
            <details class="advanced-options" ${item.optionsOpen?'open':''}><summary>Exercise options</summary><div class="advanced-options-body"><div class="exercise-tools"><div class="tracking-segment" role="group" aria-label="Track reps or seconds"><button type="button" data-builder-tracking="reps" data-builder-uid="${uidAttr}" aria-pressed="${time?'false':'true'}">Reps</button><button type="button" data-builder-tracking="seconds" data-builder-uid="${uidAttr}" aria-pressed="${time?'true':'false'}">Seconds</button></div></div>${/* user 2026-09-22: superset management moved to the reorder dialog's checkboxes; the per-exercise member picker is gone. */''}<div class="builder-targets-row"><span class="range-summary">Targets${rangeSummary?`: ${escapeHtml(rangeSummary)}`:''}</span><button class="small-button" type="button" data-builder-configure="${uidAttr}">Configure</button></div>${builderRangePillsHtml(item,ex,time,uidAttr)}${progressionSummaryForOptions(item)}<div class="exercise-tag-row">${(item.exerciseTags||[]).map(tag=>`<span class="exercise-tag-chip ${workoutState.exerciseTagPresets.includes(tag)?'preset':''}">${escapeHtml(tag)}</span>`).join('')}<button class="exercise-tag-button" type="button" data-builder-exercise-tags="${uidAttr}">${item.exerciseTags?.length?'Edit exercise tags':'+ Exercise tags'}</button></div><div class="remove-exercise-separator"></div><button class="swap-workout-exercise" type="button" data-builder-swap-ex="${uidAttr}" aria-label="Swap ${escapeHtml(ex?.name||'exercise')} for a different exercise">Swap exercise</button><button class="remove-workout-exercise text-danger-button" type="button" data-builder-del-ex="${uidAttr}" aria-label="Remove ${escapeHtml(ex?.name||'exercise')} from this workout">Remove exercise</button></div></details>
            </div>
          </details>`;
    }    /* #99 B4: renderSavedBuilder decomposed by pure code motion. The page HTML
       moved verbatim into savedBuilderPageHtml; each listener group moved
       verbatim into a wire* helper. renderSavedBuilder only orchestrates
       the same steps in the same order. */
    function savedBuilderPageHtml(b){
      /* #438 (user 2026-09-14): consecutive superset members render inside one
         subtle group outline (single "Superset N" label + one Edit superset
         affordance in the group header) instead of a per-card band. */
      const cards=supersetVisualBlocks(b.exercises||[]).map(block=>
        block.group
          ? `<div class="superset-group" data-superset-group="${escapeHtml(block.supersetId)}">${supersetGroupHeadHtml(b.exercises,block.supersetId,`data-builder-superset="${escapeHtml(block.items[0].uid)}"`)}${block.items.map(item=>builderExerciseCard(item,b.exercises)).join('')}</div>`
          : builderExerciseCard(block.items[0],b.exercises)
      ).join('');
      return `<div class="builder-signifier"><span class="saved-pill">Saved workout</span>${(b.editTarget?.kind==='program'&&workoutState.activeProgram)?`<span class="saved-pill program-part-pill">Part of ${escapeHtml(workoutState.activeProgram.name)}</span>`:''}</div>
      <div class="workout-meta">
      <div class="field"><label for="builderName">WORKOUT NAME</label><input id="builderName" type="text" value="${escapeHtml(b.name||'')}" placeholder="Workout" autocomplete="off" maxlength="80"></div>
      <div class="workout-focus-open">
      <span class="workout-focus-label" id="builderFocusLabel">Workout focus</span>
      <div class="rep-preset-row" role="group" aria-labelledby="builderFocusLabel"><button class="rep-preset" type="button" data-builder-focus="strength">Strength \u00b7 1\u20135</button><button class="rep-preset" type="button" data-builder-focus="hypertrophy">Hypertrophy \u00b7 6\u201312</button><button class="rep-preset" type="button" data-builder-focus="endurance">Endurance \u00b7 12\u201320</button><button class="rep-preset" type="button" data-builder-focus="amrap">AMRAP</button></div>
      <p class="field-help">Sets the range on reps-tracked exercises — exercises with a per-exercise Configure range keep their own.</p>
      </div>
      </div>
      <div class="workout-toolbar"><h2>Exercises</h2><div class="workout-toolbar-actions"><button class="exercise-info-button plain-glyph" id="builderReorderExercises" type="button" aria-label="Reorder exercises"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3v18M8 3 4 7m4-4 4 4M16 21V3m0 18 4-4m-4 4-4-4"/></svg></button><button class="exercise-info-button plain-glyph" id="builderAddExercise" type="button" aria-label="Add exercises"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div></div>
      <div class="workout-exercises">${cards||'<div class="history-empty">No exercises yet. Add your first movement above.</div>'}</div>
      <button class="secondary-button add-exercise-bottom" id="builderAddExerciseBottom" type="button">+ Add exercise</button>
      <div class="workout-footer"><div class="workout-actions"><button class="secondary-button" id="discardBuilderBtn" type="button">Discard</button><button class="primary-button" id="saveBuilderBtn" type="button">Save workout</button></div></div>`;
    }
    /* Binds the builder name input to the draft (autosave). */
    function wireBuilderName(b){
      $('#builderName')?.addEventListener('input',e=>{b.name=e.target.value;schedulePersist();});
    }
    /* Wires the builder workout-focus pill row. */
    function wireBuilderFocusRow(host){
      host.querySelectorAll('[data-builder-focus]').forEach(btn=>btn.addEventListener('click',()=>applyBuilderFocus(btn.dataset.builderFocus||'')));
    }
    /* Wires the builder's add-exercise buttons. */
    function wireBuilderAddButtons(host,b){
      $('#builderAddExercise')?.addEventListener('click',()=>openTemplateBuilder(b));
      $('#builderAddExerciseBottom')?.addEventListener('click',()=>openTemplateBuilder(b));
    }
    /* Persists exercise-card open/closed state across builder re-renders. */
    function wireBuilderCardToggles(host,findItem){
      host.querySelectorAll('[data-builder-exercise]').forEach(card=>card.addEventListener('toggle',()=>{const item=findItem(card.dataset.builderExercise);if(item){item.cardOpen=card.open;schedulePersist();}}));
    }
    /* Persists Exercise-options open/closed state across builder re-renders. */
    function wireBuilderAdvancedToggles(host,findItem){
      host.querySelectorAll('.advanced-options').forEach(det=>det.addEventListener('toggle',()=>{const item=findItem(det.closest('[data-builder-exercise]')?.dataset.builderExercise);if(item){item.optionsOpen=det.open;schedulePersist();}}));
    }
    /* Wires exercise removal and exercise-swap buttons. */
    function wireBuilderDeleteExercise(host,b){
      host.querySelectorAll('[data-builder-del-ex]').forEach(btn=>btn.addEventListener('click',()=>{b.exercises=b.exercises.filter(x=>x.uid!==btn.dataset.builderDelEx);/* #272: same orphan cleanup as the live editor. */normalizeSupersets();schedulePersist();renderSavedBuilder();}));
      /* #142: swap an exercise while its set structure carries over. */
      host.querySelectorAll('[data-builder-swap-ex]').forEach(btn=>btn.addEventListener('click',()=>startExerciseSwap(btn.dataset.builderSwapEx,'template')));
    }
    /* Wires the per-card + Add set button (inherits the last set's target). */
    function wireBuilderAddSet(host,findItem){
      host.querySelectorAll('[data-builder-add-set]').forEach(btn=>btn.addEventListener('click',()=>{
        const item=findItem(btn.dataset.builderAddSet);if(!item)return;
        const ex=resolveExercise(item.exerciseId),time=exerciseTracking(item,ex)==='time';
        const last=(item.sets||[])[item.sets.length-1],pr=item.progression||{};
        const fallback=time?String(pr.timeMin??''): (pr.amrap?'':String(pr.min??''));
        item.sets=[...(item.sets||[]),Object.assign(newSet(),time?{seconds:last?.seconds??fallback}:{r:last?.r??fallback})];
        schedulePersist();renderSavedBuilder();
      }));
    }
    /* Wires the Warm-up button: inserts the warm-up ladder once per exercise. */
    function wireBuilderWarmup(host,findItem){
      host.querySelectorAll('[data-builder-warmup]').forEach(btn=>btn.addEventListener('click',()=>{
        const item=findItem(btn.dataset.builderWarmup);if(!item||(item.sets||[]).some(isWarmupSet))return;
        const ex=resolveExercise(item.exerciseId),time=exerciseTracking(item,ex)==='time';
        const rows=warmupLadderRows(0,time?'time':'reps').map(row=>{
          const set=newSet();set.tags=[WARMUP_TAG];
          if(time)set.seconds=row.seconds;else set.r=row.reps;
          return set;
        });
        item.sets=[...rows,...(item.sets||[])];
        schedulePersist();renderSavedBuilder();
      }));
    }
    /* Wires set removal (inline × and swipe rail share one path). */
    function wireBuilderDeleteSet(host,findItem){
      /* #339: the swipe rail deletes like the inline x — one shared removal. */
      const removeSet=(uid,idx)=>{
        const item=findItem(uid);if(!item)return;
        item.sets=(item.sets||[]).filter((_,i)=>i!==Number(idx));
        schedulePersist();renderSavedBuilder();
      };
      host.querySelectorAll('[data-builder-del-set]').forEach(btn=>btn.addEventListener('click',()=>removeSet(btn.dataset.builderUid,btn.dataset.builderDelSet)));
      host.querySelectorAll('.delete-builder-set-swipe').forEach(btn=>btn.addEventListener('click',()=>removeSet(btn.dataset.builderUid,btn.dataset.builderSet)));
    }
    /* Wires the builder set inputs (weight/reps on every keystroke) to the draft. */
    function wireBuilderSetInputs(host,findItem){
      /* #471 (user 2026-09-15): 'input', not 'change' — the live editor
         writes set values on every keystroke, and the builder must too. A
         'change'-only write drops the typed value whenever Save is tapped
         with the field still focused, so the saved template silently loses
         the prescription and the started workout shows nothing. */
      host.querySelectorAll('[data-builder-set]').forEach(input=>input.addEventListener('input',()=>{
        const item=findItem(input.dataset.builderUid);if(!item)return;
        const set=(item.sets||[])[Number(input.dataset.builderSet)];if(!set)return;
        const ex=resolveExercise(item.exerciseId),time=exerciseTracking(item,ex)==='time';
        const v=input.value.trim();
        if(time)set.seconds=v;else set.r=v;
        schedulePersist();
      }));
    }
    /* Wires the Reps/Seconds tracking switch per exercise card. */
    function wireBuilderTracking(host,findItem){
      host.querySelectorAll('[data-builder-tracking]').forEach(btn=>btn.addEventListener('click',()=>{
        const item=findItem(btn.dataset.builderUid);if(!item)return;
        /* One canonical switch (efficiency pass 2026-09-12, shared with the
           live editor): maps "seconds" to 'time', no-ops when already set (no
           scroll jump), keeps the progression mode in sync. */
        if(!setExerciseTracking(item, btn.dataset.builderTracking))return;
        schedulePersist();renderSavedBuilder();
      }));
    }
    /* Wires the Add-notes button (swaps the button for a textarea in place). */
    function wireBuilderAddNote(host,findItem){
      host.querySelectorAll('[data-builder-add-note]').forEach(btn=>btn.addEventListener('click',()=>{
        const item=findItem(btn.dataset.builderAddNote);if(!item)return;
        item.noteOpen=true;item.note=item.note||'';
        const ta=document.createElement('textarea');ta.id=`note-${item.uid}`;ta.dataset.builderNote=item.uid;
        ta.setAttribute('aria-label','Exercise notes');ta.placeholder='Cues, setup, pain, or anything to remember';ta.value=item.note;
        ta.addEventListener('input',()=>{item.note=ta.value;schedulePersist();});
        btn.replaceWith(ta);ta.focus({preventScroll:true});schedulePersist();
      }));
    }
    /* Binds the builder exercise-note textareas to the draft. */
    function wireBuilderNoteInputs(host,findItem){
      host.querySelectorAll('[data-builder-note]').forEach(ta=>ta.addEventListener('input',()=>{const item=findItem(ta.dataset.builderNote);if(item){item.note=ta.value;schedulePersist();}}));
    }
    /* Wires the Configure (target range) button per exercise card. */
    function wireBuilderConfigure(host){
      host.querySelectorAll('[data-builder-configure]').forEach(btn=>btn.addEventListener('click',()=>configureBuilderExercise(btn.dataset.builderConfigure)));
    }
    /* Wires the Create/Edit superset buttons. */
    function wireBuilderSuperset(host){
      /* User 2026-09-22: the group outline's Edit button opens the reorder
         dialog, where the checkboxes manage supersets. */
      host.querySelectorAll('[data-builder-superset]').forEach(btn=>btn.addEventListener('click',openReorderDialog));
    }
    /* Wires the exercise-tags button per builder card. */
    function wireBuilderExerciseTags(host){
      host.querySelectorAll('[data-builder-exercise-tags]').forEach(btn=>btn.addEventListener('click',()=>openExerciseTagDialog({mode:'builder',exerciseUid:btn.dataset.builderExerciseTags})));
    }
    /* #210 (user 2026-09-12): per-set tags in the saved-workout builder reuse
       the live workout's tag dialog, routed to the builder's sets. */
    function wireBuilderSetTags(host){
      host.querySelectorAll('[data-builder-tag-set]').forEach(btn=>btn.addEventListener('click',()=>openTagDialog(btn.dataset.builderTagExercise,btn.dataset.builderTagSet,'builder')));
    }
    /* Shows the reorder-exercises button when there are 2+ exercises. */
    function wireBuilderReorder(host,b){
      const reorderBtn=$('#builderReorderExercises');
      if(reorderBtn){reorderBtn.style.display=b.exercises.length>=2?'':'none';reorderBtn.addEventListener('click',openReorderDialog);}
    }
    /* Wires the builder footer: Discard (confirm dialog) and Save workout. */
    function wireBuilderFooter(b){
      $('#discardBuilderBtn')?.addEventListener('click',()=>{discardingBuilder=true;showModalPinned($('#discardDraftDialog'));});
      $('#saveBuilderBtn')?.addEventListener('click',saveBuilderWorkout);
    }
    /* Renders the saved-workout builder page (keeps scroll position) and wires every control group. */
    function renderSavedBuilder(){
      const host=$('#savedBuilderBody');if(!host)return;
      const b=state.savedBuilder;
      if(!b){host.innerHTML='';return;}
      /* Keep the scroll position across the full re-render (user 2026-09-12:
         toggling options jumped the page). openSavedBuilder scrolls to top
         after its own initial render, so restoring here never fights it. */
      const scrollY=window.scrollY;
      host.innerHTML=savedBuilderPageHtml(b);
      if(scrollY)window.scrollTo(0,scrollY);
      const findItem=uid=>b.exercises.find(x=>x.uid===uid);
      wireBuilderName(b);
      wireBuilderFocusRow(host);
      wireBuilderRangePills(host,findItem);
      wireBuilderAddButtons(host,b);
      wireBuilderCardToggles(host,findItem);
      wireBuilderAdvancedToggles(host,findItem);
      wireBuilderDeleteExercise(host,b);
      wireBuilderAddSet(host,findItem);
      wireBuilderWarmup(host,findItem);
      wireBuilderDeleteSet(host,findItem);
      wireBuilderSetInputs(host,findItem);
      wireBuilderTracking(host,findItem);
      wireBuilderAddNote(host,findItem);
      wireBuilderNoteInputs(host,findItem);
      wireBuilderConfigure(host);
      /* %1RM per-exercise inputs (#54, v1.001): % override + training max. */
      wireOnermOptionInputs(host, findItem, () => { schedulePersist(); renderSavedBuilder(); });
      /* Reps-only toggle in Exercise options (#395, user 2026-09-13). */
      wireRepsOnlyToggle(host, findItem, () => { schedulePersist(); renderSavedBuilder(); });
      /* Per-exercise RPE trigger (user 2026-09-22): moved from Settings back
         under Exercise options where it used to be. */
      wireExerciseThresholdPills(host, findItem, () => { schedulePersist(); renderSavedBuilder(); });
      /* Dumbbell entry-mode override in Exercise options (#410, user 2026-09-13). */
      wireDbEntryToggle(host, findItem, () => { schedulePersist(); renderSavedBuilder(); });
      /* Single-dumbbell toggle in Exercise options (#538, user 2026-09-17). */
      wireDbSingleToggle(host, findItem, () => { schedulePersist(); renderSavedBuilder(); });
      wireBuilderSuperset(host);
      wireBuilderExerciseTags(host);
      wireBuilderSetTags(host);
      wireBuilderReorder(host,b);
      wireBuilderFooter(b);
      attachSwipeDelete(host); /* #339: swipe-to-delete on builder set rows, like the live editor. */
      syncBuilderFocusPills();
    }
    /* #353: focus pills set the RANGE, not typed values — the ghost convention
       from rangePlaceholder (utilities.js): the range shows as a ghost
       placeholder ("6–12", "6+", "AMRAP") on the set inputs, and only the
       range minimum auto-saves when a set is completed untouched. Stamping
       the preset minimum into every set as a real entered value fought the
       ghost (fromTemplate carries set.r into the live workout as a real
       value). Per-exercise Configure customizations win over the pill:
       exercises hand-tuned in Configure (builderExerciseHasCustomRange) are
       left untouched and the skip is announced — never a silent clobber.
       Returns {applied,skipped} so the skip is testable. */
    function applyBuilderFocus(key){
      const b=state.savedBuilder;if(!b)return {applied:0,skipped:0};
      /* Tapping the selected pill clears the focus (user 2026-09-12) — the old
         "No focus" pill is gone. */
      if((key||'')===(b.focusKey||'')){b.focusKey=null;schedulePersist();renderSavedBuilder();return {applied:0,skipped:0};}
      b.focusKey=key||null;
      const preset=REP_PRESETS[key];
      let applied=0,skipped=0;
      if(preset){
        b.exercises.forEach(item=>{
          const ex=resolveExercise(item.exerciseId);
          if(exerciseTracking(item,ex)==='time')return;
          if(builderExerciseHasCustomRange(item)){skipped++;return;}
          item.progression={...(item.progression||{}),preset:key,min:preset.min,max:preset.max,openTop:!!preset.openTop,amrap:!!preset.amrap,custom:true};
          applied++;
        });
        if(skipped)showToast(applied
          ? `Focus set on ${applied} exercise${applied===1?'':'s'} — ${skipped} kept ${skipped===1?'its':'their'} per-exercise Configure range.`
          : `Nothing changed — ${skipped===1?'the exercise keeps':'every exercise keeps'} ${skipped===1?'its':'their'} per-exercise Configure range.`);
      }
      schedulePersist();renderSavedBuilder();
      return {applied,skipped};
    }
    /* Mirrors syncWorkoutFocusPills for the saved-workout builder. */
    function syncBuilderFocusPills(){
      const key=state.savedBuilder?.focusKey||'';
      document.querySelectorAll('[data-builder-focus]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.builderFocus||'')===key)));
    }
    /* #208 (user 2026-09-13): per-exercise rep-range pills in the builder
       reuse the program-setup REP_PRESETS. Returns the preset key whose
       bounds the exercise's stored range matches, or '' when it matches
       none (custom Configure values, or no range at all). The stored values
       must match, not just a stale `preset` field — the Configure dialog
       can rewrite min/max without clearing it. Pure so it's unit-testable. */
    function builderRangePresetKey(item){
      const p=item?.progression||{};
      const found=Object.entries(REP_PRESETS).find(([,v])=>
        Number(p.min)===v.min&&(v.max==null?p.max==null:Number(p.max)===v.max)&&!!p.openTop===!!v.openTop&&!!p.amrap===!!v.amrap);
      return found?found[0]:'';
    }
    /* #353: per-exercise Configure customizations win over the workout-focus
       pills — a pill only fills in exercises with no per-exercise
       customization, never silently clobbering hand-tuned ranges. A pill
       stamps `preset` with bounds that match the preset; the Configure dialog
       never writes `preset`, so a custom profile whose stamped preset is
       absent or stale (Configure rewrote the bounds without clearing it —
       see builderRangePresetKey) was hand-tuned per exercise. Pure so it's
       unit-testable. */
    function builderExerciseHasCustomRange(item){
      const p=item?.progression||{};
      if(!p.custom)return false;
      const stamped=p.preset;
      if(stamped&&REP_PRESETS[stamped]&&builderRangePresetKey(item)===stamped)return false;
      return true;
    }
    /* #208 (user 2026-09-13): tapping a per-exercise pill writes the preset
       bounds onto the exercise (mirroring the workout-focus pill row);
       tapping the active pill clears the range back to fixed reps — the
       same blank state the Configure dialog leaves when both fields are
       empty (min/max null), so the fixed-reps path behaves exactly as
       today. #353: the pill sets the range, not typed values — the ghost
       convention (rangePlaceholder) shows the range on the set inputs, so
       nothing is stamped into the sets on apply. Pure so it's
       unit-testable. */
    function applyBuilderRangePreset(item,key){
      const p={...(item.progression||{}),custom:true};
      const preset=REP_PRESETS[key];
      if(preset&&key!==builderRangePresetKey(item)){
        p.preset=key;p.min=preset.min;p.max=preset.max;p.openTop=!!preset.openTop;p.amrap=!!preset.amrap;
      }else{
        p.preset=null;p.min=null;p.max=null;p.openTop=false;p.amrap=false;
        (item.sets||[]).forEach(set=>{set.r='';});
      }
      item.progression=p;
      return p;
    }
    /* Per-exercise rep-range pills for one builder card (reps-tracked only —
       time-tracked exercises keep the Configure dialog's time range). The
       pill labels match the workout-focus row above. */
    function builderRangePillsHtml(item,ex,time,uidAttr){
      if(time)return '';
      const activeKey=builderRangePresetKey(item);
      const pillLabel=(key,v)=>key==='amrap'?'AMRAP':`${v.label} · ${v.min}–${v.max}`;
      /* QA batch (user 2026-09-21, #14): only visible presets — legacy 'open'
         stays resolvable via builderRangePresetKey but is never offered. */
      const pills=VISIBLE_REP_PRESETS.map(key=>{const v=REP_PRESETS[key];
        return `<button class="rep-preset" type="button" data-builder-range="${key}" data-builder-uid="${uidAttr}" aria-pressed="${key===activeKey}" aria-label="Rep range ${pillLabel(key,v)} for ${escapeHtml(ex?.name||'exercise')}">${pillLabel(key,v)}</button>`;}).join('');
      return `<div class="builder-range-row"><span class="range-summary">Rep range</span><div class="rep-preset-row" role="group" aria-label="Rep range">${pills}</div></div>`;
    }
    /* Wires the per-exercise rep-range pills (apply/clear the preset range on tap). */
    function wireBuilderRangePills(host,findItem){
      host.querySelectorAll('[data-builder-range]').forEach(btn=>btn.addEventListener('click',()=>{
        const item=findItem(btn.dataset.builderUid);if(!item)return;
        applyBuilderRangePreset(item,btn.dataset.builderRange||'');
        schedulePersist();renderSavedBuilder();
      }));
    }
    let pendingBuilderConfigureUid=null;
    /* #469 (pure): apply a Configure-dialog range to an exercise item's
       progression profile. The range is written; the sets are NEVER stamped —
       per the #353 ghost convention the range shows as a ghost placeholder
       on the set inputs, and the untouched-completion path saves the range
       floor when a set is finished untouched. Pure so it's unit-testable. */
    function applyBuilderConfigureRange(item,time,minVal,maxVal){
      const p={...(item?.progression||{}),custom:true};
      if(time){
        p.timeMin=minVal?Number(minVal):30;p.timeMax=maxVal?Number(maxVal):p.timeMin;
      }else{
        p.min=minVal?Number(minVal):null;p.max=maxVal?Number(maxVal):null;
        p.amrap=!maxVal&&!!minVal;p.openTop=false;
      }
      item.progression=p;
      return p;
    }
    /* #360: staged values for the Configure dialog's progression-override
       controls (reps-only toggle, time-step pills, progression on/off).
       Set on open, read on Apply. incrementType/Value read straight from
       their inputs at Apply time. */
    let pendingBuilderConfigure=null;
    /* Per-exercise target range editor for the builder (Configure button):
       the live editor's progression summary is display-only, so the builder
       gets this small min/max dialog instead. */
    function configureBuilderExercise(uidAttr){
      const b=state.savedBuilder;const item=b?.exercises.find(x=>x.uid===uidAttr);if(!item)return;
      pendingBuilderConfigureUid=uidAttr;
      const ex=resolveExercise(item.exerciseId);
      const time=exerciseTracking(item,ex)==='time';
      const p=item.progression||{};
      $('#builderConfigureTitle').textContent=ex?.name||'Exercise targets';
      $('#builderConfigureSub').textContent=time?'Target time range per set.':'Target rep range per set. Leave max blank for AMRAP.';
      $('#builderConfigureMinLabel').textContent=time?'Min sec':'Min reps';
      $('#builderConfigureMaxLabel').textContent=time?'Max sec':'Max reps';
      $('#builderConfigureMin').value=time?(p.timeMin??''):(p.min??'');
      $('#builderConfigureMax').value=time?(p.timeMax??''):(p.max??'');
      $('#builderConfigureMax').placeholder=time?'':'AMRAP';
      /* #360: stage the progression-override controls from the profile,
         falling back to the progression defaults. */
      pendingBuilderConfigure={
        repsOnly:!!p.repsOnly,
        timeStep:p.timeStep??progressionSetup.timeStep??5,
        progressionOn:p.scheme!=='off',
      };
      const incType=(p.incrementType==='percent')?'percent':'lb';
      const incSel=$('#builderConfigureIncrementType');
      if(incSel){incSel.value=incType;$('#builderConfigureLbOption').textContent=isMetric()?'Kilograms':'Pounds';}
      const incInput=$('#builderConfigureIncrementValue');
      if(incInput)incInput.value=p.incrementValue??progressionSetup.incrementValue??5;
      const incUnit=$('#builderConfigureIncrementUnit');
      if(incUnit)incUnit.textContent=(incType==='percent')?'%':weightUnit();
      const roBtn=$('#builderConfigureRepsOnly');
      if(roBtn)roBtn.setAttribute('aria-pressed',String(pendingBuilderConfigure.repsOnly));
      syncProgressionSwitch();
      const loadBlock=$('#builderConfigureLoad');
      if(loadBlock)loadBlock.classList.toggle('is-disabled',!pendingBuilderConfigure.progressionOn);
      const timeRow=$('#builderConfigureTimeRow');
      if(timeRow)timeRow.hidden=!time;
      syncTimeStepPills($('#builderConfigureTimeStep'),pendingBuilderConfigure.timeStep);
      $('#builderConfigureDialog').showModal();
      $('#builderConfigureMin').focus({preventScroll:true});
    }
    $('#cancelBuilderConfigure')?.addEventListener('click',()=>{$('#builderConfigureDialog').close();pendingBuilderConfigureUid=null;});
    /* #283 (agent 2026-09-12): the Configure dialog must not accept an
       inverted range (e.g. Min sec 90 / Max sec 60). Pure so it's
       unit-testable: returns an error string, or null when the range is
       fine. Blank max stays valid (AMRAP for reps; timeMax=timeMin for
       time), matching the apply handler's defaults. */
    function validateBuilderConfigureRange(time,minVal,maxVal){
      const min=minVal===''?null:Number(minVal), max=maxVal===''?null:Number(maxVal);
      if(min==null||max==null||!(min>0)||!(max>0))return null;
      if(min>max)return time?'Min sec can\u2019t be above Max sec.':'Min reps can\u2019t be above Max reps.';
      return null;
    }
    /* #360: builds the progression-profile patch the Configure dialog's
       Apply writes for its new override controls (reps-only toggle,
       increment type/value, time-step pills, progression on/off). Pure so
       it's unit-testable: `prev` is the exercise's existing progression
       profile, `vals` carries the staged dialog values ({time,repsOnly,
       incrementType,incrementValue,timeStep,progressionOn}). The engine
       gate for scheme:'off' lands via #405; this just writes the value. */
    function buildBuilderConfigureProgression(prev,vals){
      const p={...(prev||{}),custom:true};
      const v=vals||{};
      p.repsOnly=!!v.repsOnly;
      p.incrementType=(v.incrementType==='percent')?'percent':'lb';
      const incVal=Number(v.incrementValue);
      p.incrementValue=(incVal>0)?incVal:(((prev||{}).incrementValue??progressionSetup.incrementValue)??5);
      if(v.time)p.timeStep=Number(v.timeStep)||5;
      if(v.progressionOn===false)p.scheme='off';
      else if(v.progressionOn===true&&p.scheme==='off')delete p.scheme;
      return p;
    }
    /* #360: syncs the dialog's Progression switch to the staged value. */
    function syncProgressionSwitch(){
      const t=$('#builderConfigureProgressionToggle');
      if(!t||!pendingBuilderConfigure)return;
      const on=pendingBuilderConfigure.progressionOn;
      t.setAttribute('aria-pressed',String(on));
      t.setAttribute('aria-label',`Progression ${on?'on':'off'}`);
    }
    /* #360: one-time wiring for the dialog's override controls. The
       time-step pills wire once against the staging object (replaced on
       every open), so repeated opens never stack click listeners. */
    wireTimeStepPills($('#builderConfigureTimeStep'),()=>pendingBuilderConfigure?.timeStep??5,n=>{if(pendingBuilderConfigure)pendingBuilderConfigure.timeStep=n;});
    $('#builderConfigureRepsOnly')?.addEventListener('click',()=>{
      if(!pendingBuilderConfigure)return;
      pendingBuilderConfigure.repsOnly=!pendingBuilderConfigure.repsOnly;
      $('#builderConfigureRepsOnly').setAttribute('aria-pressed',String(pendingBuilderConfigure.repsOnly));
    });
    $('#builderConfigureProgressionToggle')?.addEventListener('click',()=>{
      if(!pendingBuilderConfigure)return;
      pendingBuilderConfigure.progressionOn=!pendingBuilderConfigure.progressionOn;
      syncProgressionSwitch();
      /* Increment controls don't apply while progression is off. */
      $('#builderConfigureLoad')?.classList.toggle('is-disabled',!pendingBuilderConfigure.progressionOn);
    });
    $('#builderConfigureIncrementType')?.addEventListener('change',()=>{
      const t=$('#builderConfigureIncrementType').value;
      const u=$('#builderConfigureIncrementUnit');
      if(u)u.textContent=(t==='percent')?'%':weightUnit();
    });
    $('#applyBuilderConfigure')?.addEventListener('click',()=>{
      const b=state.savedBuilder;const item=b?.exercises.find(x=>x.uid===pendingBuilderConfigureUid);
      if(!item){$('#builderConfigureDialog').close();pendingBuilderConfigureUid=null;return;}
      const ex=resolveExercise(item.exerciseId);
      const time=exerciseTracking(item,ex)==='time';
      const minVal=$('#builderConfigureMin').value.trim(),maxVal=$('#builderConfigureMax').value.trim();
      /* #283: reject inverted ranges before closing — the dialog stays open
         with the values intact so they can be fixed. */
      const rangeError=validateBuilderConfigureRange(time,minVal,maxVal);
      if(rangeError){showToast(rangeError,'error');return;}
      $('#builderConfigureDialog').close();
      /* #469: Configure writes the RANGE onto the progression profile only —
         the ghost convention (rangePlaceholder, #353): the range shows as a
         ghost placeholder on the set inputs, and only the range minimum
         auto-saves when a set is completed untouched. Typing the preset
         minimum into the sets as real values fought the ghost and carried
         stale entered numbers into the live workout via fromTemplate. */
      const beforeConfigure=item.progression;
      applyBuilderConfigureRange(item,time,minVal,maxVal);
      /* #360: progression overrides from the dialog's new controls. */
      Object.assign(item.progression,buildBuilderConfigureProgression(beforeConfigure,{
        time,
        repsOnly:pendingBuilderConfigure?.repsOnly,
        incrementType:$('#builderConfigureIncrementType')?.value,
        incrementValue:$('#builderConfigureIncrementValue')?.value,
        timeStep:pendingBuilderConfigure?.timeStep,
        progressionOn:pendingBuilderConfigure?.progressionOn,
      }));
      pendingBuilderConfigureUid=null;
      schedulePersist();renderSavedBuilder();
    });
    /* Persists the builder as a saved workout and opens its page. */
    function saveBuilderWorkout(){
      const b=state.savedBuilder;if(!b)return;
      if(!b.exercises.length){showToast('Add at least one exercise first.','error');return;}
      /* Program-workout edit (user 2026-09-12): write back to the program
         workout's template and return to its page. If the workout vanished
         (deleted mid-edit), fall through and save as a regular template. */
      const programWorkout=b.editTarget?.kind==='program'?workoutState.activeProgram?.workouts.find(w=>w.uid===b.editTarget.uid):null;
      /* #337: a program workout left unnamed keeps its auto "Workout N" shell
         name instead of becoming "New saved workout". */
      const name=(b.name||'').trim()||(programWorkout?programWorkout.name:'New saved workout');
      /* Drop orphaned superset ids (a group reduced to one exercise when its
         partner was removed) before persisting the template. */
      const counts={};
      b.exercises.forEach(item=>{if(item.supersetId)counts[item.supersetId]=(counts[item.supersetId]||0)+1;});
      const template={
        id:b.id||newTemplateId(),
        name,
        focusKey:b.focusKey||null,
        createdAt:b.createdAt||Date.now(),
        exercises:b.exercises.map(item=>cloneExerciseItem(item,'forSaveTemplate',{
          noteOpen:!!item.note,
          /* Drop orphaned superset ids (a group reduced to one exercise when
             its partner was removed) before persisting the template. */
          supersetId:item.supersetId&&counts[item.supersetId]>1?item.supersetId:null,
          progression:{...(item.progression||{})}
        }))
      };
      const idx=workoutState.templates.findIndex(t=>t.id===template.id);
      if(programWorkout){
        programWorkout.name=name;
        programWorkout.template={name,exercises:template.exercises};
        state.savedBuilder=null;state.builderOpen=false;state.builderReturn=null;
        schedulePersist();
        showToast(`Saved "${name}".`);
        state.programWorkoutUid=programWorkout.uid;
        showProgram(false);
        window.scrollTo({top:0});
        return;
      }
      if(idx>=0)workoutState.templates[idx]=template;else workoutState.templates.unshift(template);
      state.savedBuilder=null;state.builderOpen=false;state.builderReturn=null;
      schedulePersist();
      showToast(`Saved "${name}".`);
      openSavedWorkoutEditor(template.id);
    }
    /* Shows the "Saved workout draft" continue card when a builder draft exists but the builder is closed. */
    function renderBuilderContinue(){
      const wrap=$('#builderContinueWrap');if(!wrap)return;
      const b=state.savedBuilder;
      if(!b||state.builderOpen){wrap.hidden=true;wrap.innerHTML='';return;}
      wrap.hidden=false;
      const n=(b.exercises||[]).length;
      /* #337: a backed-out new program workout shows its auto "Workout N"
         shell name on the continue card, not "New saved workout". */
      const programShell=b.editTarget?.kind==='program'?workoutState.activeProgram?.workouts.find(w=>w.uid===b.editTarget.uid):null;
      const draftName=(b.name||'').trim()||programShell?.name||'New saved workout';
      wrap.innerHTML=`<button class="continue-workout-card is-draft" id="continueBuilderCard" type="button"><span><span class="continue-kicker">Saved workout draft</span><strong>${escapeHtml(draftName)}</strong><small>${n} exercise${n===1?'':'s'} added</small></span><span class="continue-arrow">\u203a</span></button>`;
      $('#continueBuilderCard')?.addEventListener('click',()=>{state.builderOpen=true;renderWorkoutScreen();window.scrollTo({top:0});});
    }
    /* Both the list and the open editor refresh after rename/archive/delete. */
    function refreshTemplateViews(){
      renderWorkoutTemplateList();
      if(state.savedWorkoutId)renderSavedWorkoutEditor();
    }
    /* #74: delete template dialog. */
    let pendingDeleteTemplateId=null;
    let discardingBuilder=false;
    /* #258 (user 2026-09-12): pure return rule — deleting the open editor
       returns to the saved-workouts list section (not the top of the Workouts
       page); a delete from the list itself leaves the user where they are. */
    function savedDeleteReturnsToList(deletedId,openEditorId){
      return !!deletedId&&deletedId===openEditorId;
    }
    $('#cancelDeleteTemplate')?.addEventListener('click',()=>$('#deleteTemplateDialog').close());
    $('#keepTemplate')?.addEventListener('click',()=>$('#deleteTemplateDialog').close());
    $('#confirmDeleteTemplate')?.addEventListener('click',()=>{
      $('#deleteTemplateDialog').close();
      if(pendingDeleteTemplateId){
        workoutState.templates=workoutState.templates.filter(x=>x.id!==pendingDeleteTemplateId);
        /* #258: capture the return decision BEFORE clearing the editor id. */
        const backToList=savedDeleteReturnsToList(pendingDeleteTemplateId,state.savedWorkoutId);
        if(state.savedWorkoutId===pendingDeleteTemplateId)state.savedWorkoutId=null;
        schedulePersist();showToast('Saved workout deleted.');
        /* #404 (user 2026-09-13): the re-render rebuilds the page — pin the
           scroll so the user stays where the deleted card was, same pattern
           as the log period tabs; clamp to the new max scroll height. */
        const _scrollY=window.scrollY;
        /* A deleted open editor falls back to the start screen. */
        renderWorkoutScreen();
        if(backToList){
          /* #258: the editor delete lands on the saved-workouts list section,
             where the user was — same scrollIntoView pattern as
             clearSavedSearchAndFilters. */
          const sec=$('#savedWorkoutList')?.closest('section');
          if(sec)sec.scrollIntoView({block:'start'});
        }else{
          requestAnimationFrame(()=>{const max=document.documentElement.scrollHeight-window.innerHeight;window.scrollTo(0,Math.min(_scrollY,Math.max(0,max)));});
        }
      }
      pendingDeleteTemplateId=null;
    });
