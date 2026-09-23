
/* ===== module: set-tags.js ===== */
    /** Handles set annotations and exercise-level tags used by templates, live logging, and history. */
    /* Module map (v1.006) — Key: openTagDialog(), openExerciseTagDialog(), renderTagDialog(), addTag(). Depends on: workoutState.tags/exerciseTagTarget, state draft + builder, workout-builder picker context. */
    /* #329 (user 2026-09-13): tag toggles must not full re-render the exercise
       list behind the open dialog — it causes jumping/expanding/re-firing
       animations. Tag changes persist immediately but the re-render is deferred
       until the dialog closes (single catch-up render).
       #365 (user 2026-09-13): the saved-workout builder gets the same
       defer-until-close treatment — its tag dialog used to call
       renderSavedBuilder() on every toggle. */
    let pendingLiveTagRender=false;
    let pendingLiveExerciseTagRender=false;
    let pendingBuilderTagRender=false;
    let pendingBuilderExerciseTagRender=false;
    /* The exercise item the exercise-tag dialog edits (template, builder, or draft). */
    function exerciseTagTargetItem() {
      const target=workoutState.exerciseTagTarget;
      if(!target)return null;
      if(target.mode==='template')return pickerTemplate()?.exercises.find(item=>item.exerciseId===target.exerciseId)||null;
      /* The saved-workout builder reuses this dialog (user 2026-09-12). */
      if(target.mode==='builder')return state.savedBuilder?.exercises.find(item=>item.uid===target.exerciseUid)||null;
      return workoutState.draft?.exercises.find(item=>item.uid===target.exerciseUid)||null;
    }
    /* Opens the exercise-level tag dialog for the target item. */
    function openExerciseTagDialog(target) {
      workoutState.exerciseTagTarget=target;
      $('#newExerciseTagInput').value='';
      renderExerciseTagDialog();
      $('#exerciseTagsDialog').showModal();
    }
    /* #496: blur anything focused inside the tag dialogs before an innerHTML
       rebuild — destroying a focused element makes iOS Safari drop focus to
       <body> and fire an unpredictable scroll (the hideAllViews precedent).
       NOT used on the add-tag path: the text input keeps focus (and the iOS
       keyboard) so the user can add several tags in a row — the input lives
       outside the rebuilt containers, so no focus-drop can fire there. */
    function blurTagDialogFocus(){
      const focused=document.activeElement;
      if(focused&&focused!==document.body&&focused.closest&&focused.closest('#setTagsDialog,#exerciseTagsDialog'))focused.blur();
    }
    /* Renders the exercise-tag dialog's pill options. */
    function renderExerciseTagDialog() {
      const item=exerciseTagTargetItem(); if(!item)return;
      item.exerciseTags=item.exerciseTags||[];
      const options=[...new Set([...workoutState.exerciseTagPresets,...item.exerciseTags])];
      $('#exerciseTagPickerOptions').innerHTML=options.map(tag=>`<button class="form-pill" type="button" data-exercise-tag="${escapeHtml(tag)}" aria-pressed="${item.exerciseTags.includes(tag)}">${escapeHtml(tag)}</button>`).join('');
      /* #99: scoped to the exercise-tag dialog (not document-wide). */
      document.querySelectorAll('#exerciseTagPickerOptions [data-exercise-tag]').forEach(button=>button.addEventListener('click',()=>{
        const tag=button.dataset.exerciseTag;
        item.exerciseTags=item.exerciseTags.includes(tag)?item.exerciseTags.filter(value=>value!==tag):[...item.exerciseTags,tag];
        /* #496: flip the tapped pill in place. Re-rendering the picker here
           destroys the focused button and iOS Safari scroll-jumps on the
           focus drop (same family as the dashboard period tabs). */
        button.setAttribute('aria-pressed',String(item.exerciseTags.includes(tag)));
        /* The tag target lives on workoutState, so route the re-render to the
           screen that owns the item: template picker, saved builder,
           or the live draft. Live and builder both defer until dialog close
           (#329, #365); the picker has no modal-over-list problem. */
        if(workoutState.exerciseTagTarget?.mode==='template'){schedulePersist();renderPickerRules();}
        else if(workoutState.exerciseTagTarget?.mode==='builder'){schedulePersist();pendingBuilderExerciseTagRender=true;}
        else{markDraftSaved();pendingLiveExerciseTagRender=true;}
      }));
    }
    /* Adds a new tag to the target exercise (reuses a preset case-insensitively). */
    function addExerciseTag() {
      const tag=$('#newExerciseTagInput').value.trim(),item=exerciseTagTargetItem();
      if(!tag||!item)return;
      item.exerciseTags=item.exerciseTags||[];
      const existing=[...workoutState.exerciseTagPresets,...item.exerciseTags].find(value=>value.toLowerCase()===tag.toLowerCase());
      const selected=existing||tag;
      if(!item.exerciseTags.includes(selected))item.exerciseTags.push(selected);
      $('#newExerciseTagInput').value='';
      renderExerciseTagDialog();
      if(workoutState.exerciseTagTarget?.mode==='template'){schedulePersist();renderPickerRules();}
      else if(workoutState.exerciseTagTarget?.mode==='builder'){schedulePersist();pendingBuilderExerciseTagRender=true;}
      else{markDraftSaved();pendingLiveExerciseTagRender=true;}
    }

    /* Finds one set in the live draft by exercise + set uid. */
    function findDraftSet(exerciseUid, setUid) {
      return workoutState.draft?.exercises.find(item => item.uid === exerciseUid)?.sets.find(set => set.uid === setUid);
    }

    /* Set-tag dialog target resolution (user 2026-09-12: set tags in saved
       templates): the live draft owns its sets; the saved-workout builder
       owns its own on state.savedBuilder. */
    function findTagSet(exerciseUid, setUid) {
      if (workoutState.tagTarget?.mode === 'builder')
        return state.savedBuilder?.exercises.find(item => item.uid === exerciseUid)?.sets.find(set => set.uid === setUid);
      return findDraftSet(exerciseUid, setUid);
    }

    /* Tag edits land on whichever screen owns the target. The live draft and
       the saved builder both persist immediately but defer their exercise
       re-render until the dialog closes (#329, #365); the template picker
       re-renders its rules at once (no modal-over-list problem there). */
    function afterTagChange() {
      if (workoutState.tagTarget?.mode === 'builder') { schedulePersist(); pendingBuilderTagRender=true; }
      else { markDraftSaved(); pendingLiveTagRender=true; }
    }

    /* Opens the set-tag dialog (refuses frozen completed sets). */
    function openTagDialog(exerciseUid, setUid, mode) {
      workoutState.tagTarget = {exerciseUid, setUid, mode};
      /* #161: completed sets are fully read-only, including their tags — the
         set-number button is disabled for completed rows, but guard the dialog
         itself so no path can edit a frozen set's tags. Builder sets are never
         completable, so the freeze guard only applies to live-draft sets. */
      if (!mode && setIsFrozen(findDraftSet(exerciseUid, setUid))) { workoutState.tagTarget = null; return; }
      $('#newTagInput').value = '';
      renderTagDialog();
      $('#setTagsDialog').showModal();
    }

    /* Renders the set-tag dialog: preset pills plus the editable global tag list. */
    function renderTagDialog() {
      const target = workoutState.tagTarget;
      const set = target ? findTagSet(target.exerciseUid, target.setUid) : null;
      if (!set) return;
      $('#tagPickerOptions').innerHTML = workoutState.tags.map(tag => `<button class="form-pill" type="button" data-tag="${escapeHtml(tag)}" aria-pressed="${set.tags.includes(tag)}">${escapeHtml(tag)}</button>`).join('');
      $('#editableTagList').innerHTML = workoutState.tags.map(tag => `<span class="tag-list-item">${escapeHtml(tag)}<button type="button" data-delete-tag="${escapeHtml(tag)}" aria-label="Remove ${escapeHtml(tag)} from tag list">×</button></span>`).join('');
      document.querySelectorAll('#tagPickerOptions .form-pill').forEach(button => button.addEventListener('click', () => {
        const tag = button.dataset.tag;
        set.tags = set.tags.includes(tag) ? set.tags.filter(item => item !== tag) : [...set.tags, tag];
        /* #496: flip the tapped pill in place — same focus-drop guard as the
           exercise-tag pills above. */
        button.setAttribute('aria-pressed', String(set.tags.includes(tag)));
        afterTagChange();
      }));
      /* #99: scoped to the tag dialog's editable list (not document-wide) so a
         future [data-delete-tag] elsewhere can never be hijacked. */
      document.querySelectorAll('#editableTagList [data-delete-tag]').forEach(button => button.addEventListener('click', () => {
        const tag = button.dataset.deleteTag;
        workoutState.tags = workoutState.tags.filter(item => item !== tag);
        workoutState.draft?.exercises.forEach(item => item.sets.forEach(row => { row.tags = row.tags.filter(value => value !== tag); }));
        /* A tag deleted from the global list must also leave template sets —
           the builder may be the screen that opened this dialog. */
        state.savedBuilder?.exercises.forEach(item => item.sets.forEach(row => { row.tags = (row.tags || []).filter(value => value !== tag); }));
        /* #496: the tapped × lives inside the rebuilt list — blur it first so
           its destruction can't trigger the iOS focus-drop scroll. */
        blurTagDialogFocus();
        renderTagDialog();
        afterTagChange();
      }));
    }

    /* Adds a new tag to the global list and applies it to the target set. */
    function addTag() {
      const tag = $('#newTagInput').value.trim();
      if (!tag) return;
      const existing = workoutState.tags.find(item => item.toLowerCase() === tag.toLowerCase());
      if (!existing) workoutState.tags.push(tag);
      const target = workoutState.tagTarget;
      const set = target ? findTagSet(target.exerciseUid, target.setUid) : null;
      const selected = existing || tag;
      if (set) { set.tags = set.tags || []; if (!set.tags.includes(selected)) set.tags.push(selected); }
      $('#newTagInput').value = '';
      renderTagDialog();
      afterTagChange();
    }

    /* #329/#365: the deferred catch-up renders — one re-render per dialog
       close, no matter how many toggles happened while it was open. The
       close event fires for every dismissal path (Done/×/ESC/backdrop).
       Only one mode's flag can be set per dialog session.
       #496: the catch-up render rebuilds the exercise list behind the closed
       dialog. Closing the dialog returns focus to the set-number button,
       which the render then destroys — the iOS focus-drop scroll. Blur first
       and pin the scroll position across the render (#404 pattern); tag chips
       change set-row heights, so the pin (not just the blur) keeps the
       viewport stable. */
    function renderAfterTagDialog(render){
      const y=window.scrollY;
      const focused=document.activeElement;
      if(focused&&focused!==document.body)focused.blur();
      render();
      requestAnimationFrame(()=>window.scrollTo(0,y));
    }
    /* QA batch (user 2026-09-21): set-tag changes in the live editor no longer
       rebuild the whole exercise list on dialog close — the teardown/rebuild
       caused a visible layout flash. Instead, surgically update the targeted
       row's tag-button state and chips; the row's DOM, inputs, focus, and
       scroll position survive untouched. */
    function syncLiveSetTagRow(target){
      if(!target||target.mode==='builder')return;
      const set=findDraftSet(target.exerciseUid,target.setUid);
      const row=document.querySelector(`.log-set[data-set-uid="${CSS.escape(target.setUid)}"]`);
      if(!row)return;
      const tags=set?.tags||[];
      const numBtn=row.querySelector('.log-set-number');
      if(numBtn)numBtn.classList.toggle('has-tags',tags.length>0);
      const chips=row.querySelector('.selected-set-tags');
      if(chips)chips.innerHTML=tags.map(tag=>`<span class="set-tag-chip">${escapeHtml(tag)}</span>`).join('');
    }
    $('#setTagsDialog')?.addEventListener('close',()=>{
      if(pendingLiveTagRender){pendingLiveTagRender=false;syncLiveSetTagRow(workoutState.tagTarget);}
      else if(pendingBuilderTagRender){pendingBuilderTagRender=false;renderAfterTagDialog(renderSavedBuilder);}
    });
    $('#exerciseTagsDialog')?.addEventListener('close',()=>{
      if(pendingLiveExerciseTagRender){pendingLiveExerciseTagRender=false;renderAfterTagDialog(renderWorkoutExercises);}
      else if(pendingBuilderExerciseTagRender){pendingBuilderExerciseTagRender=false;renderAfterTagDialog(renderSavedBuilder);}
    });

    