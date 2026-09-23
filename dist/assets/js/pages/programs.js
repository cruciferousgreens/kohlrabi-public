
/* ===== module: programs.js ===== */
    /** Active programs: model helpers, create/edit form, program home,
        program-workout pages, and archived history (split #99 B3 —
        saved-workout templates, the builder, and template launch live in
        saved-workouts.js, which loads just before this file). */
        /* Module map (v1.006) — Key: renderProgram(), openProgramWorkoutPage(), startProgramWorkout(), programWeekAtDate(), seedProgramForm(). Depends on: workout-editor factories, saved-workouts.js (loads just before), state programs. */
    /* iOS Safari quirk (user 2026-09-12): opening a top-layer <dialog> with
       showModal() can yank the page scroll — focus scrolls the dialog's
       in-flow position (end of <body>) into view, so the page behind jumps.
       Pin the scroll position across showModal so the page never moves. */
    function showModalPinned(dialog){
      const x=window.scrollX,y=window.scrollY;
      dialog.showModal();
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if(window.scrollX!==x||window.scrollY!==y)window.scrollTo(x,y);
      }));
    }
    /* Applies a rep-range preset (strength/hypertrophy/…) onto a progression config and syncs the min/max inputs and pills. */
    function applyRepPreset(key,target=progressionSetup){
      const preset=REP_PRESETS[key]||REP_PRESETS.hypertrophy;
      target.defaultRange={preset:key,min:preset.min,max:preset.max,openTop:!!preset.openTop,amrap:!!preset.amrap};
      /* Settings pills edit the global defaults; program pills edit the form
         draft only (user 2026-09-10: the program form must never change
         the defaults — defaults flow INTO the form instead). */
      const isGlobal=target===progressionSetup;
      const minInput=$(isGlobal?'#settingsRepMin':'#programRepMin'), maxInput=$(isGlobal?'#settingsRepMax':'#programRepMax');
      if(minInput)minInput.value=preset.min??'';
      if(maxInput)maxInput.value=preset.max??'';
      document.querySelectorAll(`${isGlobal?'#settingsRepPresets':'#programRepPresets'} [data-rep-preset]`).forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.repPreset===key)));
    }
    /* Program setup form scratch state (user 2026-09-10): every control in
       the program form reads/writes this draft, never the global
       progressionSetup. Seeding flows the defaults INTO the form (or a
       program's own progression when editing); creating the program
       snapshots the draft. */
    /* Program revision stamp (persona sweep 2026-09-22): every mutation of
       the active program stamps updatedAt so mergeExternalBlob can do
       last-write-wins per program object instead of blindly adopting a
       stale tab's blob — the stale-program-reference data-loss family
       (tab-tap program vanish, new-program destroyed by stale builder,
       dead program buttons, share-says-no-program). Call at every site
       that mutates workoutState.activeProgram or its workouts. */
    function touchProgram(p){if(p&&typeof p==='object'){try{p.updatedAt=Date.now();}catch(_){}}return p;}
    let programDraftProgression=null;
    let pendingDeleteProgramWorkoutUid=null;
    let pendingDeleteSavedProgramId=null;
    /* #461 (user 2026-09-15): pending archived-program delete target for the
       confirm dialog below. */
    let pendingDeleteArchivedProgramId=null;
    /* #455 (user 2026-09-14): pending activation of a saved program through
       the #432 confirm dialog. */
    let pendingSavedProgramActivationId=null;
    /* #338 (user 2026-09-13): program workouts in the unified saved-workout
       list share this delete-confirmation path with the program cover. */
    function confirmDeleteProgramWorkout(uid){
      const program=workoutState.activeProgram;
      const workout=program?.workouts?.find(w=>w.uid===uid);
      pendingDeleteProgramWorkoutUid=uid;
      $('#deleteProgramWorkoutDesc').textContent=workout?`Delete "${workout.name}" from your program? This cannot be undone.`:'Delete this workout from your program? This cannot be undone.';
      showModalPinned($('#deleteProgramWorkoutDialog'));
    }
    /* #455 (user 2026-09-14): starting a saved program follows the #432
       confirmation flow — the shared "Set as active program?" dialog.
       share.js owns the dialog's own confirm listener; this second listener
       handles the saved-program pending (share.js's is a no-op when its own
       payload is null). Dismissing the dialog clears the pending id.
       Named (not inline) so tests can re-run it against a fake document,
       mirroring wireShareProgramStartDialogs. */
    function wireSavedProgramActivation(){
      $('#confirmSetSharedProgramActive')?.addEventListener('click',()=>{
        if(pendingSavedProgramActivationId){const id=pendingSavedProgramActivationId;pendingSavedProgramActivationId=null;activateSavedProgramById(id);}
      });
      $('#confirmSetSharedProgramActiveDialog')?.addEventListener('close',()=>{pendingSavedProgramActivationId=null;});
    }
    /* #445 (user 2026-09-14): a #program deep link (e.g. the marketing
       site's "Create program" CTA) with an active program must not drop
       into the active program — offer a modal: start a new program anyway
       (the active program moves into Saved, #503 supersedes #432) or keep
       the active program. Named (not inline) so tests can re-run it against
       a fake document, mirroring wireShareProgramStartDialogs. */
    function wireProgramDeepLinkDialog(){
      const close=()=>$('#programDeepLinkDialog')?.close();
      $('#closeProgramDeepLink')?.addEventListener('click',close);
      $('#keepActiveProgram')?.addEventListener('click',close);
      $('#confirmStartNewProgram')?.addEventListener('click',()=>{
        const program=workoutState.activeProgram;
        close();
        if(program){
          /* #503 (user 2026-09-15) supersedes the #432 convention: starting
             new moves the outgoing active program into Saved (never deleted)
             instead of archiving it. Replace, never skip: the outgoing
             (live) object is always newer than a stale Saved copy with the
             same id, so a same-id Saved entry is removed first. */
          delete program.archivedAt;
          program.savedAt=localIsoDate();
          const saved=workoutState.savedPrograms||(workoutState.savedPrograms=[]);
          const existing=saved.findIndex(p=>p.id===program.id);
          if(existing>=0)saved.splice(existing,1);
          saved.unshift(program);
          workoutState.activeProgram=null;
        }
        /* Fresh setup form, mirroring the End-program reset. */
        programDraftProgression=null;
        programEditSnapshot=null;
        $('#programName').value='';$('#programStartWeek').value='1';$('#programFocus').value='';
        delete $('#createProgram').dataset.editing;
        $('#createProgram').textContent='Create active program';
        $('#programSetupTitle').textContent='Create your active program.';
        schedulePersist();state.programSetupOpen=true;renderProgram();renderDashboard();
        $('#programSetup')?.scrollIntoView({behavior:'smooth',block:'start'});
      });
    }
    /* #445: boot-time #program deep link — offer the modal only when an
       active program exists; with none, the Program tab's setup form is
       already the right landing. */
    /* Persona QA 2026-09-16: the #program deep-link modal exists for
       EXTERNAL deep links (#445 — e.g. the marketing site's "start a
       program" CTA). A plain reload while already on #program is
       indistinguishable by hash, but the user didn't ask to start anything
       — stay quiet on reloads. Named (not inline) so tests can drive it
       without a DOM. */
    function isReloadNavigation(){
      try{
        const nav=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];
        return !!(nav&&nav.type==='reload');
      }catch(_){return false;}
    }
    /* Offers the new-program modal for a #program deep link (stays quiet on plain reloads). */
    function maybeOfferNewProgramForDeepLink(){
      if(isReloadNavigation())return;
      const program=workoutState.activeProgram;
      const dlg=$('#programDeepLinkDialog');
      if(!program||!dlg)return;
      $('#programDeepLinkDesc').textContent=`You have an active program (“${program.name}”). Starting a new program will replace it — your current program moves to your saved programs — nothing is deleted.`;
      showModalPinned(dlg);
    }
    wireSavedProgramActivation();
    /* #445 (user 2026-09-14): the #program deep-link modal — wired once at
       load; the boot path re-opens it via maybeOfferNewProgramForDeepLink. */
    wireProgramDeepLinkDialog();
    /* #71: confirmation dialog for deleting a program workout. */
    $('#cancelDeleteProgramWorkout')?.addEventListener('click',()=>$('#deleteProgramWorkoutDialog').close());
    $('#keepProgramWorkout')?.addEventListener('click',()=>$('#deleteProgramWorkoutDialog').close());
    /* #392: confirmation dialog for deleting a saved program. Scroll is
       preserved like the program-workout delete above. */
    $('#cancelDeleteSavedProgram')?.addEventListener('click',()=>{$('#deleteSavedProgramDialog').close();pendingDeleteSavedProgramId=null;});
    $('#keepSavedProgram')?.addEventListener('click',()=>{$('#deleteSavedProgramDialog').close();pendingDeleteSavedProgramId=null;});
    $('#confirmDeleteSavedProgram')?.addEventListener('click',()=>{
      const sx=window.scrollX,sy=window.scrollY;
      $('#deleteSavedProgramDialog').close();
      if(pendingDeleteSavedProgramId){
        workoutState.savedPrograms=(workoutState.savedPrograms||[]).filter(p=>p.id!==pendingDeleteSavedProgramId);
        pendingDeleteSavedProgramId=null;
        schedulePersist();renderProgram();
        window.scrollTo(sx,sy);
        showToast('Saved program deleted.');
      }
    });
    /* #461 (user 2026-09-15): confirmation dialog for deleting an archived
       program. Scroll is preserved like the saved-program delete above. */
    $('#cancelDeleteArchivedProgram')?.addEventListener('click',()=>{$('#deleteArchivedProgramDialog').close();pendingDeleteArchivedProgramId=null;});
    $('#keepArchivedProgram')?.addEventListener('click',()=>{$('#deleteArchivedProgramDialog').close();pendingDeleteArchivedProgramId=null;});
    $('#confirmDeleteArchivedProgram')?.addEventListener('click',()=>{
      const sx=window.scrollX,sy=window.scrollY;
      $('#deleteArchivedProgramDialog').close();
      if(pendingDeleteArchivedProgramId){
        const idx=(workoutState.archivedPrograms||[]).findIndex(p=>p.id===pendingDeleteArchivedProgramId);
        const removed=removeArchivedProgramAt(idx);
        pendingDeleteArchivedProgramId=null;
        schedulePersist();renderProgram();
        window.scrollTo(sx,sy);
        if(removed)showToast('Archived program deleted.');
      }
    });
    $('#confirmDeleteProgramWorkout')?.addEventListener('click',()=>{
      /* Deleting from the program list must not jump to the top of the page
         (user 2026-09-12): capture scroll before the dialog closes and the
         list re-renders, then restore it. Deleting from a workout's own page
         returns to the program cover, where the top is the right landing. */
      const wasOnWorkoutPage=!!state.programWorkoutUid&&state.programWorkoutUid===pendingDeleteProgramWorkoutUid;
      const sx=window.scrollX,sy=window.scrollY;
      $('#deleteProgramWorkoutDialog').close();
      const program=workoutState.activeProgram;
      if(program&&pendingDeleteProgramWorkoutUid){
        program.workouts=program.workouts.filter(workout=>workout.uid!==pendingDeleteProgramWorkoutUid);
        if(state.programWorkoutUid===pendingDeleteProgramWorkoutUid)state.programWorkoutUid=null;
        schedulePersist();renderProgram();
        if(typeof renderWorkoutTemplateList==='function')renderWorkoutTemplateList();
        if(!wasOnWorkoutPage)window.scrollTo(sx,sy);
      }
      pendingDeleteProgramWorkoutUid=null;
    });
    /* Discard-changes modal for the program setup form (user 2026-09-12). */
    let programEditSnapshot=null;
    $('#keepProgramChanges')?.addEventListener('click',()=>$('#discardProgramChangesDialog').close());
    $('#keepProgramChangesBtn')?.addEventListener('click',()=>$('#discardProgramChangesDialog').close());
    /* #420 (user 2026-09-13): the form edits a DETACHED draft — the %1RM wave
       toggle (and every other draft control) never reaches the live program
       or the blob until createProgram() runs. The dialog must offer Save. */
    $('#saveProgramChangesDialog')?.addEventListener('click',()=>{$('#discardProgramChangesDialog').close();createProgram();});
    $('#confirmDiscardProgramChanges')?.addEventListener('click',()=>{$('#discardProgramChangesDialog').close();cancelProgramEdit();});
    $('#closeAddSavedToProgram')?.addEventListener('click',()=>$('#addSavedToProgramDialog').close());
    /* Deep-ish clone of a progression config (range object and weekly arrays copied) for the detached form draft. */
    function cloneProgression(src){const base=src||{};return {...base,defaultRange:{...(base.defaultRange||{})},weeklyRanges:[...(base.weeklyRanges||[])],weeklyPcts:[...(base.weeklyPcts||[])],weeklyDeloads:[...(base.weeklyDeloads||[])] };}
    /* The program form's detached progression draft (seeded from global defaults); the live config is never touched until Create/Save. */
    function programFormProgression(){if(!programDraftProgression)programDraftProgression=cloneProgression(progressionSetup);return programDraftProgression;}
    /* #295 (user 2026-09-12): the "% of 1RM" row and its help text show ONLY
       for the %1RM scheme — hidden for RPE-based and Linear. Factored out so
       the per-scheme visibility is unit-testable. The markup also defaults
       the row to hidden (matching the default linear scheme), so the first
       paint is correct even on a path that never re-syncs the form. */
    function syncPctRowForScheme(scheme){
      const pctRow=$('#progressionPctRow'); if(!pctRow)return;
      pctRow.hidden=scheme!=='onerm';
      const help=pctRow.nextElementSibling;
      if(help&&help.classList.contains('field-help'))help.hidden=pctRow.hidden;
    }
    /* Syncs every program-setup form control (pills, toggles, inputs, wave panels) from the detached draft. */
    function syncProgramForm(){
      const p=programFormProgression(), range=p.defaultRange||{};
      /* #99 H6: null-guard every direct DOM write. */
      /* #405: per-program progression off-switch; when off, the rest of the
         section dims (same language as the Settings section). */
      const poToggle=$('#programProgressionOffToggle');
      if(poToggle){const off=!!p.progressionOff;poToggle.setAttribute('aria-pressed',String(!off));poToggle.setAttribute('aria-label',`Progression for this program ${off?'off':'on'}`);}
      const ppSection=poToggle?.closest('section.program-progression');
      if(ppSection)ppSection.classList.toggle('progression-off',!!p.progressionOff);
      /* #108 (2026-09-14): program RPE trigger is the same 7/8/9 square-box
         selector as Settings — the old spinbutton is gone. */
      const thresholdPills=$('#programRpePills');
      /* QA batch (user 2026-09-22): 7/8/9 or 'completion' — string compare. */
      if(thresholdPills)thresholdPills.querySelectorAll('[data-rpe-threshold]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.rpeThreshold===String(p.threshold??8))));
      const scheme=p.scheme||'linear';
      document.querySelectorAll('#programSchemePills [data-scheme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scheme===scheme)));
      // The RPE trigger only applies to RPE-based mode — hide it entirely
      // under linear and %1RM progression (user 2026-09-11, #54).
      if(thresholdPills&&thresholdPills.closest('.rule-field'))thresholdPills.closest('.rule-field').hidden=scheme==='linear'||scheme==='onerm';
      const incType=$('#progressionIncrementType'); if(incType)incType.value=p.incrementType||'lb';
      // %1RM prescribes load as a percentage of 1RM, so fixed increments don't apply.
      const incPair=incType&&incType.closest('.settings-pair'); if(incPair)incPair.hidden=scheme==='onerm';
      syncPctRowForScheme(scheme);
      const pctInput=$('#progressionPercentOf1RM'); if(pctInput)pctInput.value=clampPct1RM(Number(p.percentOf1RM)||75);
      /* QA batch (user 2026-09-22): Auto Deload removed entirely. Manual
         per-week deload flags live in the % wave panel (#478). */
      const waveToggle=$('#pctWaveToggle');
      if(waveToggle){waveToggle.setAttribute('aria-pressed',String(!!p.pctWave));waveToggle.setAttribute('aria-label',`Vary percent of 1RM by week ${p.pctWave?'on':'off'}`);}
      const incVal=$('#progressionIncrementValue'); if(incVal)incVal.value=p.incrementValue??5;
      const repMin=$('#programRepMin'); if(repMin)repMin.value=range.min??'';
      const repMax=$('#programRepMax'); if(repMax)repMax.value=range.max??'';
      document.querySelectorAll('#programRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.repPreset===(range.preset||'hypertrophy'))));
      syncTimeStepPills($('#programTimeStepPills'),p.timeStep??5);
      /* QA batch (user 2026-09-22): vary-ranges toggle + week pills. The
         schedule panel renders exactly cycleLength rows (see
         renderWeekRanges); only suggested rep ranges vary. */
      syncProgramCycleUI(p);
      /* %1RM wave panel (#54, v1.001). */
      const pwp=$('#pctWavePanel');
      if(pwp)pwp.hidden=!p.pctWave;
      syncProgramIncrementUnit();
      renderWeekRanges(p);
      renderWeekPcts(p);
    }
    /* Seeds the detached draft from a program's progression (or the global defaults) and syncs the form. */
    function seedProgramForm(fromProgram){
      programDraftProgression=cloneProgression(fromProgram?.progression||progressionSetup);
      syncProgramForm();
    }
    /* Renders the per-cycle-week rep-range pill rows in the program form. */
    function renderWeekRanges(target){
      target=target||programFormProgression();
      const panel=$('#undulatingPanel'),list=$('#weekRangeList'),length=Math.max(1,Math.min(52,Number($('#programLength').value)||8));
      const startWeekInput=$('#programStartWeek');if(startWeekInput){startWeekInput.max=String(length);startWeekInput.value=String(Math.max(1,Math.min(length,Number(startWeekInput.value)||1)));}
      /* #118: the schedule is a cycle — exactly cycleLength rows, independent
         of the program length (short programs use the cycle's first weeks,
         long programs loop via cycleWeek in programRangeForWeek). */
      const cycleLen=normalizeCycleLength(target);
      panel.hidden=cycleLen<=0;if(panel.hidden)return;
      /* #99 H5: normalize state via the shared helper — no mutation inside render. */
      ensureWeeklyRanges(target,cycleLen);
      list.innerHTML=target.weeklyRanges.map((preset,index)=>weekRangeRow(preset,index,'data-week-pill')).join('');
      /* #420: target is the detached draft — no schedulePersist (it cannot persist the draft). */
      document.querySelectorAll('[data-week-pill]').forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.weekPill);target.weeklyRanges[index]=button.dataset.preset;document.querySelectorAll(`[data-week-pill="${index}"]`).forEach(other=>other.setAttribute('aria-pressed',String(other===button)));}));
    }
    /* #99 H5: normalize % wave state OUTSIDE render — render functions must
       not mutate state. New weeks inherit the flat %; deload flags default off. */
    function ensureWeeklyPcts(target,length){
      const flat=clampPct1RM(Number(target.percentOf1RM)||75);
      if(!Array.isArray(target.weeklyPcts))target.weeklyPcts=[];
      while(target.weeklyPcts.length<length)target.weeklyPcts.push(flat);
      target.weeklyPcts=target.weeklyPcts.slice(0,length);
      if(!Array.isArray(target.weeklyDeloads))target.weeklyDeloads=[];
      while(target.weeklyDeloads.length<length)target.weeklyDeloads.push(false);
      target.weeklyDeloads=target.weeklyDeloads.slice(0,length);
    }
    /* Weekly % wave panel (#54, v1.001): mirrors the undulating rep-range
       panel. Each row shows the week's rep-range context (so a deload week
       reads e.g. "Week 4 · Endurance · 60% · deload"), a % number input, and
       a per-week deload flag. */
    function weekPctRow(pct,deload,index,rangeLabel){
      /* #255 (user 2026-09-13): the range label used to sit in a squeezed
         grid column and ellipsize ("6...") — it now stacks under the week
         with room to wrap, and the input is the standard bordered 44px
         input with the accent focus ring. */
      return `<div class="week-pct-row"><span class="week-pct-id"><strong>Week ${index+1}</strong><span class="week-pct-range">${escapeHtml(rangeLabel)}</span></span><label class="week-pct-input"><input type="number" inputmode="numeric" min="1" max="100" step="1" value="${pct}" data-week-pct="${index}" aria-label="Week ${index+1} percent of 1RM"><span class="unit">%</span></label><button type="button" class="rep-preset" data-week-deload="${index}" aria-pressed="${deload?'true':'false'}">Deload</button></div>`;
    }
    /* Renders the %1RM wave panel rows (week, range label, % input, deload flag) in the program form. */
    function renderWeekPcts(target){
      target=target||programFormProgression();
      const panel=$('#pctWavePanel'),list=$('#weekPctList');
      if(!panel||!list)return;
      const length=Math.max(1,Math.min(52,Number($('#programLength').value)||8));
      panel.hidden=!target.pctWave;if(panel.hidden)return;
      ensureWeeklyPcts(target,length);
      list.innerHTML=target.weeklyPcts.map((pct,index)=>{
        const rangeLabel=programRangeLabel(programRangeForWeek({progression:target},index+1));
        return weekPctRow(clampPct1RM(Number(pct)||target.percentOf1RM||75),!!target.weeklyDeloads[index],index,rangeLabel);
      }).join('');
      list.querySelectorAll('[data-week-pct]').forEach(input=>input.addEventListener('change',()=>{
        const index=Number(input.dataset.weekPct);
        target.weeklyPcts[index]=clampPct1RM(Number(input.value)||target.percentOf1RM||75);
        input.value=target.weeklyPcts[index];
        /* #420: target is the detached draft — schedulePersist cannot persist it. */
      }));
      list.querySelectorAll('[data-week-deload]').forEach(button=>button.addEventListener('click',()=>{
        const index=Number(button.dataset.weekDeload);
        target.weeklyDeloads[index]=!target.weeklyDeloads[index];
        button.setAttribute('aria-pressed',String(target.weeklyDeloads[index]));
        /* #420: target is the detached draft — schedulePersist cannot persist it. */
      }));
    }
    /* #118 (user 2026-09-16): periodization cycle lengths — Off / 4 / 6 / 8 /
       12 weeks. cycleLength 0 = Off (no varying). Otherwise program week N
       maps to cycle week ((N-1) mod cycleLen) + 1: programs shorter than the
       cycle use the cycle's first weeks, longer programs loop. Only the
       suggested rep ranges vary — the schedule never auto-applies training. */
    const CYCLE_LENGTHS=[4,6,8,12];
    /* Canonical cycle-length read: valid 4/6/8/12, else 0 (Off). Bare config
       objects that never passed through normalizeProgression (tests, ad-hoc
       configs) keep the legacy fallback — undulating on means an 8-week
       cycle — so old callers don't silently lose their schedule. */
    function normalizeCycleLength(p){
      const n=Number(p&&p.cycleLength);
      if(CYCLE_LENGTHS.includes(n))return n;
      return p&&p.undulating?8:0;
    }
    /* Maps a program week onto its cycle week: ((week-1) mod cycleLen) + 1; no cycle → the week itself. */
    function cycleWeek(week,cycleLen){
      const len=CYCLE_LENGTHS.includes(Number(cycleLen))?Number(cycleLen):0;
      const w=Math.max(1,Math.floor(Number(week)||1));
      return len>0?((w-1)%len)+1:w;
    }
    /* Single canonical cycle-pill sync — the program form and Settings share
       the 4/6/8/12 pill group. QA batch (user 2026-09-22): the vary-ranges
       toggle is back, so this only syncs the pills; the toggle + wrap
       visibility live in syncProgramCycleUI / syncSettingsCycleUI. */
    function syncCyclePills(pillSelector,target){
      const len=normalizeCycleLength(target);
      document.querySelectorAll(pillSelector+' [data-cycle-length]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.cycleLength)===len)));
    }
    /* QA batch (user 2026-09-22): program-form vary-ranges toggle — the week
       pills only appear when the toggle is on. Turning it on restores the
       last cycle length (4 wks when there isn't one). */
    function syncProgramCycleUI(target){
      target=target||programFormProgression();
      const on=normalizeCycleLength(target)>0;
      const toggle=$('#varyRangesToggle');
      if(toggle){toggle.setAttribute('aria-pressed',String(on));toggle.setAttribute('aria-label',`Vary rep ranges by week ${on?'on':'off'}`);}
      const wrap=$('#programCycleWrap');if(wrap)wrap.hidden=!on;
      syncCyclePills('#programCyclePills',target);
    }
    /* The rep-range prescription for a program week: the cycle-week's preset (or the default range when the cycle is off). */
    function programRangeForWeek(program,week){const progression=program?.progression||progressionSetup;const cycleLen=normalizeCycleLength(progression);if(cycleLen<=0)return progression.defaultRange||progressionSetup.defaultRange;const key=progression.weeklyRanges?.[cycleWeek(week,cycleLen)-1]||progression.defaultRange?.preset||'hypertrophy';const preset=REP_PRESETS[key]||REP_PRESETS.hypertrophy;return {preset:key,min:preset.min,max:preset.max,openTop:!!preset.openTop,amrap:!!preset.amrap};}
    /* → assets/js/formulas/program-math.js: programPctForWeek — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/program-math.js: isDeloadWeek — moved here in the v1.878 restructure (no behavior change). */
    /* Muscle→exercise-count rows for all program workouts, sorted by count (primary + secondary). */
    function programMuscles(program){const counts={};(program.workouts||[]).forEach(workout=>(workout.template?.exercises||[]).forEach(item=>{const ex=resolveExercise(item.exerciseId);[...(ex?.primary||[]),...(ex?.secondary||[])].forEach(m=>counts[m]=(counts[m]||0)+1);}));return Object.entries(counts).sort((a,b)=>b[1]-a[1]);}
    /* #89 (user 2026-09-14): the program cover "Muscles in this program" card
       renders ONE view — Chart (the existing muscle bars, default) or Heat map
       (the Stats anatomical body map, heat-graded by weekly sets per muscle).
       The view is chosen ONLY by Settings → Units → "Program muscle card";
       the card carries no toggle (removed v1.694 per user call — the Settings
       row is the single control). Pure builders so the layout contract is
       unit-testable. */
    function programMuscleViewDefault(){
      return progressionSetup.programMuscleView==='heatmap'?'heatmap':'chart';
    }
    /* Muscle bars for the program cover's "Muscles in this program" card. */
    function programMuscleChartHtml(muscleRows,muscleMax){
      return `<div class=\"program-muscle-bars\">${muscleRows.slice(0,8).map(([muscle,count])=>`<div class=\"program-muscle-bar\"><span>${escapeHtml(titleCase(muscle))}</span><i style=\"--fill:${Math.max(8,count/muscleMax*100)}%\"></i></div>`).join('')}</div>`;
    }
    /* Heat-map variant of the program muscle card: anatomical map heat-graded by weekly sets per muscle. */
    function programMuscleHeatmapHtml(muscleRows){
      /* Reuse the Stats heat scale: muscleHeatmapMarkup with bySets, so the
         legend reads "N sets" and regions grade by weekly sets. */
      const volumes={};muscleRows.forEach(([muscle,count])=>{volumes[muscle]=count;});
      return muscleHeatmapMarkup(volumes,new Set(muscleRows.map(([muscle])=>String(muscle).toLowerCase())),false,true);
    }
    /* The program cover's "Muscles in this program" section: chart or heat-map view per the Settings choice, with the empty state. */
    function programMuscleSectionHtml(muscleRows,muscleMax){
      if(!muscleRows.length)return `<section class=\"program-muscles\"><h3>Muscles in this program</h3><p class=\"section-note\">Add exercises to a program workout to see its muscle coverage.</p></section>`;
      /* #460 (user 2026-09-15): the "Sets per muscle across all program
         workouts" caption is gone — the chart reads on its own. The
         heatmap variant keeps its caption. */
      const body=programMuscleViewDefault()==='heatmap'
        ? `<p class=\"section-note\">Heat-graded by weekly sets across all program workouts</p>${programMuscleHeatmapHtml(muscleRows)}`
        : programMuscleChartHtml(muscleRows,muscleMax);
      return `<section class=\"program-muscles\"><h3>Muscles in this program</h3>${body}</section>`;
    }
    /* The 1-based program week containing a date, from the program start (clamped to 1..length). */
    function programWeekAtDate(program,date=new Date()) {
      /* #99 A14: compare LOCAL CALENDAR-DAY ordinals — no noon-ms math, so
         the week can't flip mid-day or drift across a DST transition. */
      const dayNum=iso=>{
        const parts=String(iso).split('-');
        return Math.floor(Date.UTC(Number(parts[0]),Number(parts[1])-1,Number(parts[2]))/86400000);
      };
      const startDay=dayNum(program.startedAt||localIsoDate());
      const pointDay=typeof date==='string'?dayNum(date):dayNum(localIsoDate(date));
      const elapsed=Math.max(0,Math.floor((pointDay-startDay)/7));
      return Math.max(1,Math.min(program.length,Math.max(1,Number(program.startWeek)||1)+elapsed));
    }
    /* The program's current week (today). */
    function programWeek(program) { return programWeekAtDate(program,new Date()); }
    /* Human label for a rep-range profile ("6–12 reps", "15+ reps", "AMRAP from 6 reps"). */
    function programRangeLabel(range) {
      /* Share-imported programs can carry progression:null, so defaultRange
         is undefined — fall back to the standard hypertrophy default instead
         of throwing and blanking the Program tab (browser QA 2026-09-14). */
      const r=range||{min:6,max:12};
      if(r.amrap)return `AMRAP from ${r.min||1} reps`;
      if(r.openTop||r.max==null)return `${r.min||15}+ reps`;
      if(r.min&&r.min===r.max)return `${r.min} reps`;
      return `${r.min||1}–${r.max||r.min||1} reps`;
    }
    /* #49: the Workout tab's continue-program card must read as the workout's
       own prescription, not the program default. Exercises without their own
       range inherit the program default for the week, so those label as the
       default; mixed prescriptions label honestly as mixed. */
    function programWorkoutRangeLabel(program,workout,week){
      const fallback=programRangeForWeek(program,week);
      const labels=[...new Set((workout?.template?.exercises||[]).map(x=>{
        const p=x.progression||{}, time=(x.tracking||p.mode)==='time';
        if(time){
          if(p.timeMin==null&&p.timeMax==null)return programRangeLabel(fallback);
          const min=p.timeMin,max=p.timeMax;
          return min&&max&&min!==max?`${min}–${max} sec`:`${min||max} sec`;
        }
        const hasOwn=p.min!=null||p.max!=null||p.openTop||p.amrap;
        return programRangeLabel(hasOwn?p:fallback);
      }).filter(Boolean))];
      if(!labels.length)return programRangeLabel(fallback);
      return labels.length===1?labels[0]:'Mixed ranges';
    }
    /* The next suggested program workout: the ready workout (non-empty template) least recently logged. */
    function suggestedProgramWorkout(program) {
      const ready=(program?.workouts||[]).filter(workout=>workout.template?.exercises?.length);
      if(!ready.length)return null;
      return ready.map((workout,index)=>{
        const logs=workoutState.completed.filter(row=>row.programId===program.id&&row.programWorkoutUid===workout.uid);
        const last=logs.reduce((latest,row)=>row.date>(latest||'')?row.date:latest,'');
        return {workout,index,last};
      }).sort((a,b)=>(a.last||'').localeCompare(b.last||'')||a.index-b.index)[0].workout;
    }
    /* #461 (user 2026-09-15): pure archived-program removal — splices the
       program at the index and returns it (null when out of range). Top-level
       (not nested in renderArchivedPrograms) so the module-scope delete
       confirmation handler can call it — nesting it caused a ReferenceError
       on confirm, leaving the program in place. Named (not inline) so tests
       can drive it without a DOM. The caller persists and re-renders. */
    function removeArchivedProgramAt(index){
      const archived=workoutState.archivedPrograms;
      if(index<0||index>=archived.length)return null;
      return archived.splice(index,1)[0];
    }
    /* Renders the archived-programs list with per-program history disclosures, restore, and delete. */
    function renderArchivedPrograms() {
      const archived=workoutState.archivedPrograms;$('#archivedPrograms').hidden=!archived.length;
      $('#archivedProgramList').innerHTML=archived.map(program=>{
        const logs=workoutState.completed.filter(workout=>workout.programId===program.id).sort(sortByRecencyDesc); /* #99 A13: latest by completion */
        /* #132 (user 2026-09-11): flat row (no nested card), date kept on one
           line, Restore is a quiet tertiary action. #461 (user 2026-09-15):
           Delete joins it — archived programs (and shared ones, which live
           in the saved list with a Delete in their preview) can be removed. */
        return `<div class="archive-row-wrap"><div class="archive-row"><div><strong>${escapeHtml(program.name)}</strong><br><span class="archive-meta">${program.length} weeks · ${logs.length} log${logs.length===1?'':'s'}</span><br><span class="archive-meta archive-date">Archived ${escapeHtml(formatLogDate(program.archivedAt))}</span></div><div class="archive-actions"><button class="archive-restore restore-program" type="button" data-program-id="${escapeHtml(program.id)}">Restore</button><button class="archive-restore archive-delete delete-archived-program" type="button" data-program-id="${escapeHtml(program.id)}">Delete</button></div></div><details class="archive-history"><summary>View program history${logs.length?` · ${logs.length} logs`:''}</summary><div class="archive-history-list">${logs.length?logs.map(workout=>`<button class="archive-workout" type="button" data-archived-workout="${escapeHtml(workout.id)}"><strong>${escapeHtml(workout.name)}</strong><span>${escapeHtml(formatLogDate(workout.date))} · ${workout.exercises.reduce((sum,item)=>sum+item.sets.length,0)} sets</span></button>`).join(''):'<p class="section-note">No logs are linked to this program.</p>'}</div></details></div>`;
      }).join('');
    /* Persona-4 finding 5 (agent 2026-09-16): restoring an archived program must
       never let a stale archived copy silently replace the live active
       program on id collision (reachable via sync merge from another
       device). The live object always wins: the archived duplicate is
       dropped and the active program stays untouched. Named (not inline) so
       tests can drive it without a DOM, mirroring maybeOfferNewProgramForDeepLink. */
    function restoreArchivedProgramAt(index){
      const archived=workoutState.archivedPrograms;
      if(index<0||index>=archived.length)return;
      const restored=archived.splice(index,1)[0];
      const active=workoutState.activeProgram;
      if(!(active&&active.id===restored.id)){
        if(active){active.archivedAt=localIsoDate();archived.unshift(active);}
        workoutState.activeProgram=restored;
        delete workoutState.activeProgram.archivedAt;
      }
      /* Same-id collision: the archived copy was already removed above and
         the live active object wins untouched — the stale duplicate is
         simply dropped, never installed over the live program. */
      schedulePersist();renderProgram();renderDashboard();
    }
      document.querySelectorAll('.restore-program').forEach(button=>button.addEventListener('click',()=>{restoreArchivedProgramAt(workoutState.archivedPrograms.findIndex(p=>p.id===button.dataset.programId));}));
      /* #461 (user 2026-09-15): deleting an archived program asks first. */
      document.querySelectorAll('.delete-archived-program').forEach(button=>button.addEventListener('click',()=>{
        const program=workoutState.archivedPrograms.find(p=>p.id===button.dataset.programId);if(!program)return;
        pendingDeleteArchivedProgramId=program.id;
        $('#deleteArchivedProgramDesc').textContent=`"${program.name||'This program'}" will be permanently deleted. This cannot be undone.`;
        showModalPinned($('#deleteArchivedProgramDialog'));
      }));
      document.querySelectorAll('[data-archived-workout]').forEach(button=>button.addEventListener('click',()=>{const workout=workoutState.completed.find(row=>row.id===button.dataset.archivedWorkout);if(!workout)return;state.workoutDetailReturn=ROUTES.DETAIL_RETURN.PROGRAM;showWorkouts(false);renderCompletedWorkout(workout,{push:true});}));
    }
    /* #455 (user 2026-09-14): the Saved programs list mirrors the Archived
       programs card — same card container, same row layout (program name,
       "N weeks · N workouts" meta line, action pill on the right), rows
       separated like the archive list. Differences: the pill is "Set active"
       (the #432 confirm flow — the current active program moves into Saved,
       #503 supersedes the #432 archive convention), and
       tapping a row opens the saved program. No "view program history"
       disclosure: saved programs can now have been active before (#503
       moved replaced programs into Saved), so they may carry linked logs —
       the row keeps the archive's compact meta line. Delete lives in the
       preview. */
    function renderSavedPrograms(){
      const saved=workoutState.savedPrograms||[];
      /* #504 (v1.8): the section renders its empty state instead of hiding —
         but a totally fresh account (no active, saved, or archived program)
         already sees the No-active-program state above, so the saved section
         stays hidden there to avoid a doubled Create-a-program CTA. */
      const showEmpty=!saved.length&&(workoutState.activeProgram||(workoutState.archivedPrograms||[]).length);
      $('#savedPrograms').hidden=!saved.length&&!showEmpty;
      $('#savedProgramList').innerHTML=showEmpty?emptyStateHtml({
        title:'No saved programs',
        description:'Programs you create or open from a shared link stay here for later.',
        primaryHtml:emptyStatePrimary('savedEmptyCreate','Create a program')
      }):saved.map(program=>{
        const workoutCount=(program.workouts||[]).length;
        const sharedChip=program.shared?' <span class="built-in-label">Shared</span>':'';
        return `<div class="archive-row-wrap"><div class="archive-row"><button class="open-saved-program" type="button" data-program-id="${escapeHtml(program.id)}" aria-label="Open ${escapeHtml(program.name)}"><strong>${escapeHtml(program.name)}</strong>${sharedChip}<br><span class="archive-meta">${program.length} weeks · ${workoutCount} workout${workoutCount===1?'':'s'}</span></button><button class="archive-restore set-active-saved" type="button" data-program-id="${escapeHtml(program.id)}">Set active</button></div></div>`;
      }).join('');
      if(showEmpty){
        /* #504: with an active program, creating a new one goes through the
           same start-new modal as the #program deep link (current moves to
           Saved); with none, the form opens directly. */
        $('#savedEmptyCreate')?.addEventListener('click',()=>{
          if(workoutState.activeProgram){maybeOfferNewProgramForDeepLink();}
          else{state.programSetupOpen=true;renderProgram();$('#programSetup')?.scrollIntoView({behavior:'smooth',block:'start'});}
        });
        return;
      }
      /* Tapping a row opens the saved program; the pill runs the #432
         activation confirmation flow. */
      document.querySelectorAll('.open-saved-program').forEach(button=>button.addEventListener('click',()=>openSavedProgramPreview(button.dataset.programId)));
      document.querySelectorAll('.set-active-saved').forEach(button=>button.addEventListener('click',()=>requestActivateSavedProgram(button.dataset.programId)));
    }
    /* #455 (user 2026-09-14): activating a saved program follows the #432
       confirmation flow — with an active program in place, Start asks first
       ("Set as active program? Your current program moves to your saved
       programs — nothing is deleted."), with no active program it activates
       directly. #503 (user 2026-09-15) supersedes the #432 archive
       convention: the outgoing program lands in Saved, not the archive. */
    function requestActivateSavedProgram(id){
      const saved=(workoutState.savedPrograms||[]).find(p=>p.id===id);if(!saved)return;
      if(workoutState.activeProgram&&workoutState.activeProgram.id!==saved.id){
        pendingSavedProgramActivationId=id;
        showModalPinned($('#confirmSetSharedProgramActiveDialog'));
        return;
      }
      activateSavedProgramById(id);
    }
    /* The move itself, shared by the card Start button, the preview's "Set
       as active", and the confirm dialog: the program leaves Saved for
       Active; the outgoing active program moves into Saved (never deleted).
       #503 (user 2026-09-15) supersedes the #432 archive convention.
       Replace, never skip: the outgoing (live) object is always newer
       than a stale Saved copy with the same id, so a same-id Saved entry
       is removed first. */
    function activateSavedProgramById(id){
      const saved=workoutState.savedPrograms||[];
      const index=saved.findIndex(p=>p.id===id);if(index<0)return false;
      const started=saved.splice(index,1)[0];
      if(workoutState.activeProgram&&workoutState.activeProgram.id!==started.id){
        const outgoing=workoutState.activeProgram;
        delete outgoing.archivedAt;
        outgoing.savedAt=localIsoDate();
        const existing=saved.findIndex(p=>p.id===outgoing.id);
        if(existing>=0)saved.splice(existing,1);
        saved.unshift(outgoing);
      }
      workoutState.activeProgram=started;
      delete workoutState.activeProgram.archivedAt;
      delete workoutState.activeProgram.savedAt;
      state.savedProgramPreviewId=null;state.programWorkoutUid=null;
      schedulePersist();renderProgram();renderDashboard();
      showToast(`"${started.name}" is now your active program.`);
      return true;
    }
    /* #455: open a saved program into a read-only preview cover. */
    function openSavedProgramPreview(id){
      const program=(workoutState.savedPrograms||[]).find(p=>p.id===id);if(!program)return;
      state.savedProgramPreviewId=id;state.programWorkoutUid=null;
      renderProgram();window.scrollTo({top:0});
    }
    /* Markup for a saved program's read-only preview cover (head, muscle section, workouts, actions). */
    function savedProgramPreviewHtml(program){
      const workoutCount=(program.workouts||[]).length;
      const sharedChip=program.shared?' <span class="built-in-label">Shared</span>':'';
      const muscleRows=programMuscles(program),muscleMax=Math.max(1,...muscleRows.map(([,count])=>count));
      return `<div class="program-cover-head"><div class="program-cover-kicker">SAVED PROGRAM</div><h2>${escapeHtml(program.name)}</h2>${sharedChip}<p class="program-cover-meta">${program.length} weeks · ${workoutCount} workout${workoutCount===1?'':'s'}</p></div><div class="program-body">${programMuscleSectionHtml(muscleRows,muscleMax)}<div class="workout-toolbar"><h2>Workouts</h2></div><div class="program-workouts">${program.workouts.length?program.workouts.map(workout=>{const exerciseCount=workout.template?.exercises?.length||0;
        return `<div class="picker-item saved-workout-card program-workout-row"><button class="program-workout-open" type="button" data-program-workout="${escapeHtml(workout.uid)}" aria-label="Open ${escapeHtml(workout.name)}"><span><strong>${escapeHtml(workout.name)}</strong><span>${exerciseCount?`${exerciseCount} exercise${exerciseCount===1?'':'s'}`:'Empty shell'}</span></span><span class="picker-state" aria-hidden="true">›</span></button></div>`;}).join(''):'<div class="history-empty">No workouts in this program.</div>'}</div><div class="program-actions"><button class="primary-button" id="setSavedProgramActive" type="button">Set as active</button><button class="secondary-button" id="shareSavedProgramBtn" type="button">Share</button><button class="secondary-button" id="deleteSavedProgramPreview" type="button">Delete</button></div><p class="session-note">Setting it active moves your current program to your saved programs — nothing is deleted.</p></div>`;
    }
    /* Renders the saved-program preview cover into the program page and wires its actions. */
    function renderSavedProgramPreview(program){
      const cover=$('#programCover');if(!cover)return;
      $('#programSetup').hidden=true;cover.hidden=false;
      cover.innerHTML=savedProgramPreviewHtml(program);
      document.querySelectorAll('[data-program-workout]').forEach(b=>b.addEventListener('click',()=>{state.programWorkoutUid=b.dataset.programWorkout;renderProgram();window.scrollTo({top:0});}));
      $('#setSavedProgramActive')?.addEventListener('click',()=>requestActivateSavedProgram(program.id));
      /* #459 (user 2026-09-15): share this saved program — same machinery
         as the active program's Share. */
      $('#shareSavedProgramBtn')?.addEventListener('click',()=>{if(typeof shareSavedProgram==='function')shareSavedProgram(program.id);});
      $('#deleteSavedProgramPreview')?.addEventListener('click',()=>{
        pendingDeleteSavedProgramId=program.id;
        $('#deleteSavedProgramDesc').textContent=`"${program.name||'This program'}" will be permanently deleted. This cannot be undone.`;
        showModalPinned($('#deleteSavedProgramDialog'));
      });
      hydrateBodyMaps();
      updateTopBar('program');
    }
    /* Starts a program workout behind the live-draft conflict guard. */
    function startProgramWorkout(program, workout, week=null) {
      requestStartWithConflict(workout.name,()=>doStartProgramWorkout(program,workout,week));
    }
    /* Builds the live draft from a program workout: week range inherited into every exercise, then the editor opens. */
    function doStartProgramWorkout(program, workout, week=null) {
      /* #559: a start from the Upcoming card on a future calendar date uses
         THAT date's program week — not the current week — so the inherited
         range matches the week the card displayed. Callers that don't pass
         a week (program cover, etc.) keep the current-week behavior. */
      const startWeek=Number(week)||programWeek(program);
      const inheritedRange=programRangeForWeek(program,startWeek);
      /* User 2026-09-13: the workout's focus pill must reflect the inherited
         range — previously the range reached the exercises but focusPreset
         stayed null, so no pill highlighted. Key-only: per-exercise overrides
         above are untouched (unlike applyWorkoutFocus, which stamps them). */
      const focusPresetKey=REP_PRESETS[inheritedRange.preset]?inheritedRange.preset:null;
      showWorkouts();
      state.workoutHistoryOpen=false;
      /* #337 (user 2026-09-13): a session started from a program workout gets
         a BLANK name — the input shows its "Workout" placeholder and the
         user names the session themselves. (The conflict dialog above still
         names the program workout being started.) */
      workoutState.draft={name:'',date:localIsoDate(),programId:program.id,programWorkoutUid:workout.uid,editingId:null,focusPreset:focusPresetKey,exercises:workout.template.exercises.map(x=>{
        const base=x.progression||{};
        /* #99 M21: spread base FIRST, then computed fallbacks. Previously the
           fallbacks came before ...base, so an explicit `{min: undefined}` in
           base would silently clobber the inherited range. */
        /* #431 (user 2026-09-13): the program week's range governs on program
           start. A range stored on the template (copied from wherever the
           template came from) is stale baggage, not an override — letting it
           win contradicts the focus pill (which shows the week range) and
           mints suggestions for the wrong range until the user re-taps the
           pill. Other per-exercise settings (mode, dbEntry, increments) are
           still preserved from the template. */
        const progression={
          ...base,
          mode:base.mode||x.tracking||'reps',
          min:inheritedRange.min,
          max:inheritedRange.max,
          openTop:!!inheritedRange.openTop,
          amrap:!!inheritedRange.amrap,
          scheme:program.progression?.scheme||'linear'
        };
        return cloneExerciseItem(x,'fromProgram',{tracking:x.tracking||progression.mode||'reps',noteOpen:!!x.note,progression,emptyDefault:true});
      })};
      const progressionContext={...program.progression,currentWeek:startWeek};
      prepareDraftProgression(workoutState.draft,progressionContext);
      /* #402 (user 2026-09-13): suggestions are never auto-applied — each
         exercise card shows its own tap-to-apply row (#406) and the user
         picks each one. */
      /* v0.99al: no range-minimum stamping. The live editor ghosts the right
         default per exercise — explicit suggestion first, then the latest top
         set when the engine holds (history but no suggestion), then the range
         placeholder when there is no history. Stamping the minimum here made
         holds read as e.g. 100×1 instead of 100×6, and prefilled values hid
         the ghost. Entered values are never altered. */
      schedulePersist();
      state.workoutEditorOpen = true; /* #129: program session starts immediately. */
      renderWorkoutScreen();
    }
    /* Renders the Program tab: setup form / active-program cover / program-workout page / saved preview / first-use empty state. */
    function renderProgram() {
      const program = workoutState.activeProgram;
      const editing=$('#createProgram').dataset.editing==='true'&&!!program;
      $('#programSetup').hidden = !!program && !editing;
      /* #509: the save-to-library secondary button only commits the builder
         form — while editing the active program the only commit path is
         "Save program changes", so it stays out of the way. */
      const saveLibBtn=$('#saveProgramToLibrary');if(saveLibBtn)saveLibBtn.hidden=editing;
      $('#programCover').hidden = !program || editing;
      renderArchivedPrograms();
      renderSavedPrograms();
      /* #455 (user 2026-09-14): a saved program opens into a read-only
         preview cover — this works with or without an active program. A
         stale preview id (the program was deleted) falls through to the
         normal page. */
      const savedPreview=(workoutState.savedPrograms||[]).find(p=>p.id===state.savedProgramPreviewId);
      if(state.savedProgramPreviewId&&!savedPreview)state.savedProgramPreviewId=null;
      if (!program&&!savedPreview) {
        state.programWorkoutUid=null;
        /* #504 (v1.8): first-use empty state — the setup form reveals only
           after [Create a program], so a fresh account gets the explainer,
           not the bare form. Deep links and the saved-programs empty state
           open the form directly via state.programSetupOpen. */
        const emptyHost=$('#programEmpty');
        if(state.programSetupOpen){
          const setup=$('#programSetup');
          if(emptyHost)emptyHost.hidden=true;
          setup.hidden=false;
          /* Same seeding as the first-use branch: a cold deep link has no
             draft yet. Re-renders only sync the draft back — syncProgramForm
             never wipes typed values (it leaves the name/length/focus fields
             alone, and the draft is the source of truth for the controls it
             does touch). */
          if(!programDraftProgression)seedProgramForm(null); else syncProgramForm();
          state.programSetupOpen=false;
          updateTopBar('program');return;
        }
        if(emptyHost){
          emptyHost.hidden=false;
          emptyHost.innerHTML=emptyStateHtml({
            title:'No active program',
            description:'A program lays out your workouts across weeks and shows what is next.',
            primaryHtml:emptyStatePrimary('programEmptyCreate','Create a program'),
            secondaryHtml:emptyStateSecondary('programEmptyGuide','How programs work')
          });
          $('#programEmptyCreate')?.addEventListener('click',()=>{
            state.programSetupOpen=true;renderProgram();
            $('#programSetup')?.scrollIntoView({behavior:'smooth',block:'start'});
          });
          $('#programEmptyGuide')?.addEventListener('click',()=>{
            window.open('https://cruciferousgreens.com/getting-started','_blank','noopener');
          });
        }
        $('#programSetup').hidden=true;
        if(!programDraftProgression)seedProgramForm(null); else syncProgramForm();
        updateTopBar('program');return;
      }
      /* #504: the first-use empty state belongs only to the no-program
         branch — the cover, the program-workout page, and saved previews
         all hide it. */
      const emptyHost=$('#programEmpty');if(emptyHost)emptyHost.hidden=true;
      /* Program-workout page (user 2026-09-12): a workout's own view/edit/start
         page, mirroring the saved-workout editor page. From a saved-program
         preview the page is read-only (#455). */
      if(state.programWorkoutUid){
        const owner=savedPreview||program;
        const pw=owner?.workouts.find(w=>w.uid===state.programWorkoutUid);
        if(pw){renderProgramWorkoutPage(owner,pw,{readOnly:!!savedPreview});return;}
        state.programWorkoutUid=null;
      }
      if(savedPreview){renderSavedProgramPreview(savedPreview);return;}
      const week=programWeek(program), completedThisWeek=workoutState.completed.filter(w=>w.programId===program.id&&programWeekAtDate(program,w.date)===week).length;
      const muscleRows=programMuscles(program),muscleMax=Math.max(1,...muscleRows.map(([,count])=>count));
      $('#programCover').innerHTML = `<div class="program-cover-head"><div class="program-cover-kicker">ACTIVE PROGRAM · WEEK ${week} OF ${program.length}</div><h2>${escapeHtml(program.name)}</h2>${program.schedule?`<p class="program-cover-meta">${escapeHtml(program.schedule)} · ${program.workouts.length} session${program.workouts.length===1?'':'s'} per week</p>`:''}</div><div class="program-body"><div class="program-progress"><span>${program.workouts.length} workout${program.workouts.length === 1 ? '' : 's'} in rotation</span><span>${completedThisWeek} completed this week</span></div><div class="week-progress" style="--program-weeks:${program.length}" aria-label="Week ${week} of ${program.length}">${Array.from({length:program.length},(_,i)=>`<span class="week-segment ${i+1<week?'past':i+1===week?'current':''}${isDeloadWeek(program,i+1)?' deload':''}"></span>`).join('')}</div><div class="program-cover-actions"><button class="secondary-button" id="editProgram" type="button">Edit program</button><button class="secondary-button" id="shareProgramBtn" type="button">Share program</button></div>${programMuscleSectionHtml(muscleRows,muscleMax)}<details class="program-progression-summary program-progression-disclosure"><summary class="progression-disclosure-summary"><h3>Progression engine</h3><span class="disclosure-chev" aria-hidden="true">\u203a</span></summary><div class="program-progression-meta">${(progressionSetup.progressionOff||program.progression?.progressionOff)?'<span class="tag">Progression off</span>':(`${(program.progression?.scheme||'linear')==='linear'?'<span class="tag">Linear progression</span>':program.progression?.scheme==='onerm'?'<span class="tag">%1RM-based</span>':`<span class="tag">Top set ≤ RPE ${program.progression?.threshold??8}</span>`}${program.progression?.scheme==='onerm'?'':`<span class="tag">${program.progression?.incrementType==='percent'?(program.progression.incrementValue+'%'):(program.progression?.incrementValue??5)+' '+weightUnit()} ${(program.progression?.scheme||'linear')==='linear'?'every session':'default jump'}</span>`}<span class="tag">${escapeHtml(titleCase(program.progression?.defaultRange?.preset||'hypertrophy'))} · ${programRangeLabel(program.progression?.defaultRange)}</span>${normalizeCycleLength(program.progression)>0?'<span class="tag">Varies by week</span>':''}${program.progression?.pctWave&&program.progression?.weeklyPcts?.length?'<span class="tag">% varies by week</span>':''}`)}</div></details><div class="workout-toolbar"><h2>Workouts</h2><button class="exercise-info-button plain-glyph" id="addProgramWorkoutBtn" type="button" aria-label="Add workout"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div><div class="program-workouts" id="programWorkouts">${program.workouts.length ? program.workouts.map((workout) => {const exerciseCount=workout.template?.exercises?.length||0;
        /* #159: exactly one remove affordance per row — the swipe rail when swipe-to-delete is on, the visible x-button when it is off. */
        const swipeOn=typeof swipeDeleteSetsEnabled==='function'?swipeDeleteSetsEnabled():true;
        return `<div class="swipe-item program-swipe">${swipeOn?`<button aria-hidden="true" class="swipe-delete-action delete-program-workout" type="button" data-uid="${escapeHtml(workout.uid)}" aria-label="Remove ${escapeHtml(workout.name)}" tabindex="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/></svg></button>`:''}<div class="picker-item saved-workout-card swipe-content program-workout-row"><button class="program-workout-open" type="button" data-program-workout="${escapeHtml(workout.uid)}" aria-label="Open ${escapeHtml(workout.name)}"><span><strong>${escapeHtml(workout.name)}</strong><span>${exerciseCount?`${exerciseCount} exercise${exerciseCount===1?'':'s'}`:'Empty shell<br><span class="empty-shell-hint">tap to add exercises</span>'}</span></span><span class="picker-state" aria-hidden="true">›</span></button>${swipeOn?'':`<button class="program-workout-del" type="button" data-del-program-workout="${escapeHtml(workout.uid)}" aria-label="Delete ${escapeHtml(workout.name)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`}</div></div>`;}).join('') : '<div class="history-empty">No workouts yet. Tap + to add the first one.</div>'}</div><button class="new-template-button" id="addSavedToProgramBtn" type="button">+ Add saved workout</button><div class="program-actions"><button class="secondary-button" id="endProgram" type="button">Archive program</button></div><p class="session-note">Weeks advance with calendar time; workout order is flexible.</p></div>`;
      $('#editProgram')?.addEventListener('click',editActiveProgram);
      /* #256 (user 2026-09-13): program sharing restored — deliverShareLink
         mints a server short link (kind=program) for signed-in shares and
         falls back to the long link otherwise, same as workouts. */
      $('#shareProgramBtn')?.addEventListener('click',shareActiveProgram);
      /* User 2026-09-12: program workouts need a visible delete button, not
         just swipe-to-delete — the × on each card opens the same confirm. */
      document.querySelectorAll('.delete-program-workout').forEach(button => button.addEventListener('click', () => confirmDeleteProgramWorkout(button.dataset.uid)));
      document.querySelectorAll('[data-del-program-workout]').forEach(button => button.addEventListener('click', () => confirmDeleteProgramWorkout(button.dataset.delProgramWorkout)));
      document.querySelectorAll('[data-program-workout]').forEach(b=>b.addEventListener('click',()=>openProgramWorkoutPage(b.dataset.programWorkout)));
      $('#addProgramWorkoutBtn').addEventListener('click', addProgramWorkout);
      $('#addSavedToProgramBtn')?.addEventListener('click', openAddSavedToProgram);
      /* #89: hydrate the heat map eagerly when it's the selected view, so the
         anatomical map paints into its pre-sized reserve with no layout shift. */
      hydrateBodyMaps();
    /* #257 (user 2026-09-13): archiving must not hide the program's workouts
       from the saved list. Program-only shells (no live source template) are
       promoted to real saved templates, so they stay visible as the user's
       saved workouts; shells already covered by a live template need
       nothing. Pure-ish (takes state) so it's unit-testable. */
    function promoteProgramShellsToTemplates(program,templates){
      (program.workouts||[]).forEach(w=>{
        if(w.sourceTemplateId&&(templates||[]).some(t=>t.id===w.sourceTemplateId))return;
        const template={id:newTemplateId(),name:w.name||'Untitled',exercises:cloneTemplateExercises(w.template?.exercises||[])};
        templates.unshift(template);
        w.sourceTemplateId=template.id;
      });
    }
      $('#endProgram').addEventListener('click', () => {promoteProgramShellsToTemplates(program,workoutState.templates);program.archivedAt=localIsoDate();workoutState.archivedPrograms.unshift(program);workoutState.activeProgram=null;programDraftProgression=null;$('#programName').value='';$('#programStartWeek').value='1';$('#programFocus').value='';state.programSetupOpen=false;schedulePersist();renderProgram();renderDashboard();});
      /* User 2026-09-12: card swipe respects the Settings swipe-to-delete
         choice — when it's off, the × button is the delete path. */
      if(typeof swipeDeleteSetsEnabled==='function'?swipeDeleteSetsEnabled():true)attachSwipeDelete($('#programWorkouts'));
      updateTopBar('program');
    }

    /* + under Program → Workouts (user 2026-09-12): opens the workout
       editor (the shared builder in edit mode) directly for the new shell —
       the dashed "Part of <program>" chip at the top shows it belongs to the
       program. The shell itself is created lazily in openSavedBuilder so a
       kept draft leaves no orphan "Workout N" behind. Backing out of the
       builder returns to the program page. */
    function addProgramWorkout() {
      if (!workoutState.activeProgram) return;
      startSavedBuilder({newProgramWorkout:true});
    }

    /* Program-workout page (user 2026-09-12): mirrors the saved-workout editor
       page — kicker, stats, Start inline with the name at top-right, muscle
       map, exercise list, Edit (the builder in edit mode), delete. Reuses
       savedExerciseSummary, workoutBodyMapMarkup, and hydrateBodyMaps. */
    /* Opens a program workout's own page (view/edit/start); switches to the Program tab first when opened from elsewhere. */
    function openProgramWorkoutPage(uid){
      const program=workoutState.activeProgram;
      if(!program?.workouts.some(w=>w.uid===uid))return;
      state.programWorkoutUid=uid;
      /* The card can be tapped from the Workout tab's "From <program>"
         section too (user 2026-09-12) — switch to the Program screen first,
         otherwise the top bar says Program while the Workout tab stays
         rendered. */
      showProgram(false);
      window.scrollTo({top:0});
    }
    /* Renders the program-workout page: stats, muscle map, exercise list, and Edit/Duplicate/Archive/Delete (view-only for saved previews). */
    function renderProgramWorkoutPage(program,workout,opts={}){
      const readOnly=!!opts.readOnly; /* #455: workouts viewed from a saved-program preview are view-only. */
      const cover=$('#programCover');if(!cover)return;
      $('#programSetup').hidden=true;cover.hidden=false;
      const rows=workout.template?.exercises||[];
      const muscles=[...new Set(rows.flatMap(item=>{const ex=resolveExercise(item.exerciseId);return [...(ex?.primary||[]),...(ex?.secondary||[])];}))];
      const totalSets=rows.reduce((n,item)=>n+(item.sets||[]).length,0);
      const listRows=rows.map(item=>{const s=savedExerciseSummary(item);return `<button class="picker-item saved-editor-row" type="button" data-program-exercise="${escapeHtml(item.exerciseId)}" aria-label="Open ${escapeHtml(s.name)} details"><span><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.meta)}</span></span><span class="picker-state" aria-hidden="true">\u203a</span></button>`;}).join('');
      cover.innerHTML=`<div class="completed-card"><span class="continue-kicker">Program workout</span><div class="detail-title-row"><h2>${escapeHtml(workout.name)}</h2><span class="title-actions"><button class="icon-button" id="shareProgramWorkoutBtn" type="button" aria-label="Share ${escapeHtml(workout.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 14.5v-11"/><path d="M7.6 7.4L12 3l4.4 4.4"/><path d="M6 11.5V19a1.6 1.6 0 0 0 1.6 1.6h8.8A1.6 1.6 0 0 0 18 19v-7.5"/></svg></button>${rows.length&&!readOnly?`<button class="start-inline-button" id="startProgramWorkoutBtn" type="button">Start</button>`:''}</span></div><div class="meta-chips" role="list" aria-label="Workout summary"><span class="tag" role="listitem">${rows.length} exercise${rows.length===1?'':'s'}</span><span class="tag" role="listitem">${totalSets} set${totalSets===1?'':'s'}</span></div>
      ${muscles.length?`<div class="section-head"><h3>Muscles worked</h3></div>${workoutBodyMapMarkup(muscles)}<div class="workout-muscles">${muscles.map(m=>musclePill(m)).join('')}</div>`:''}
      <div class="section-head"><h3>Exercises</h3></div>${listRows||`<p class="section-note">${readOnly?'No exercises in this workout.':'No exercises yet — tap Edit to build this workout.'}</p>`}
      ${readOnly?'':`<div class="detail-action-buttons"><div class="detail-action-row"><button class="secondary-button" id="editProgramWorkoutBtn" type="button">Edit</button><button class="secondary-button" id="duplicateProgramWorkoutBtn" type="button">Duplicate</button></div>
      <button class="new-template-button neutral" id="archiveProgramWorkoutBtn" type="button">Archive</button>
      <button class="template-delete-text" id="deleteProgramWorkoutBtn" type="button">delete workout</button></div>`}</div>`;
      hydrateBodyMaps();
      $('#startProgramWorkoutBtn')?.addEventListener('click',()=>startProgramWorkout(program,workout));
      /* #181: exercise rows open the exercise detail — state.programWorkoutUid
         is untouched, so Back lands on this program workout page. */
      document.querySelectorAll('[data-program-exercise]').forEach(b=>b.addEventListener('click',()=>openExercise(b.dataset.programExercise,true,makeReturnRoute(ROUTES.VIEW.PROGRAM))));
      /* Program workouts share as saved workouts (user 2026-09-12) — the
         workout already stores a template-shaped object. */
      $('#shareProgramWorkoutBtn')?.addEventListener('click',()=>shareTemplateLike(workout.name,workout.template?.exercises||[]));
      $('#editProgramWorkoutBtn')?.addEventListener('click',()=>{startSavedBuilder({programUid:workout.uid});});
      /* #338 (user 2026-09-13): saved-workout function parity — Duplicate
         copies the shell inside the program; Archive promotes it to a real
         saved workout and removes it from the program (the #257 pattern). */
      $('#duplicateProgramWorkoutBtn')?.addEventListener('click',()=>duplicateProgramWorkout(program,workout));
      $('#archiveProgramWorkoutBtn')?.addEventListener('click',()=>archiveProgramWorkout(program,workout));
      $('#deleteProgramWorkoutBtn')?.addEventListener('click',()=>{
        pendingDeleteProgramWorkoutUid=workout.uid;
        $('#deleteProgramWorkoutDesc').textContent=`Delete "${workout.name}" from your program? This cannot be undone.`;
        showModalPinned($('#deleteProgramWorkoutDialog'));
      });
      updateTopBar('program');
    }
    /* #338 (user 2026-09-13): Duplicate a program workout — a fresh shell in
       the same program with the template copied over.
       Persona-4 finding 2 (agent 2026-09-16): the duplicate is a NEW shell, so
       it clears sourceTemplateId/sourceWorkoutId — inheriting them would hide
       the duplicate's divergent exercises as "covered" in the saved list and
       skip the shell in promoteProgramShellsToTemplates on archive, losing
       the duplicate's edits. */
    function duplicateProgramWorkout(program,workout){
      if(!program||!workout)return;
      const copy={
        uid:newProgramWorkoutUid(),
        name:`${workout.name||'Untitled'} copy`,
        sourceWorkoutId:null,
        sourceTemplateId:null,
        template:{name:workout.template?.name||workout.name||'Untitled',
          exercises:cloneTemplateExercises(workout.template?.exercises||[])},
      };
      program.workouts.push(copy);
      schedulePersist();
      showToast(`Duplicated as "${copy.name}".`);
      renderProgramWorkoutPage(program,copy);
    }
    /* #338 (user 2026-09-13): Archive a program workout — promote it to a
       real saved workout (unless a live source template already covers it)
       and remove it from the program. Mirrors #257's program-archive
       promotion at the single-workout level. */
    function archiveProgramWorkout(program,workout){
      if(!program||!workout)return;
      const liveTemplateIds=new Set((workoutState.templates||[]).filter(t=>!t.archivedAt).map(t=>t.id));
      if(!(workout.sourceTemplateId&&liveTemplateIds.has(workout.sourceTemplateId))){
        workoutState.templates.unshift({id:newTemplateId(),name:workout.name||'Untitled',
          exercises:cloneTemplateExercises(workout.template?.exercises||[])});
      }
      program.workouts=program.workouts.filter(w=>w.uid!==workout.uid);
      if(state.programWorkoutUid===workout.uid)state.programWorkoutUid=null;
      schedulePersist();renderProgram();
      if(typeof renderWorkoutTemplateList==='function')renderWorkoutTemplateList();
      showToast(`Archived "${workout.name}" to saved workouts.`);
    }
    /* Dashed "+ Add saved workout" under the program's workouts (user
       2026-09-12): pulls an existing saved workout into the program as a new
       workout, copying its exercises. */
    /* #64: the add-to-program dialog sources from saved workouts AND past
       sessions — a past session becomes its own program-workout copy
       (exercises + set counts + ranges + progression rules; actuals become
       targets via the same conversion as "save as template"). */
    let addToProgramTab='saved';
    function openAddSavedToProgram(){
      const program=workoutState.activeProgram;if(!program)return;
      addToProgramTab='saved';
      const addShellToProgram=shell=>{
        /* Persona P11#7 (2026-09-22): read the live program at commit time,
           not the dialog-open closure — a cross-tab/sync merge can replace
           workoutState.activeProgram while the dialog is open, and pushing
           to the detached object produced the false-success toast ("Added…"
           with an empty rotation). */
        const live=workoutState.activeProgram;
        if(!live){$('#addSavedToProgramDialog').close();showToast('No active program — the workout was not added.','error');return;}
        live.workouts.push(shell);
        touchProgram(live);
        schedulePersist();
        /* Stay on the program page (user 2026-09-12): don't jump into the
           workout that was just added. Preserve the scroll position so the
           list doesn't jump either. */
        const sx=window.scrollX,sy=window.scrollY;
        $('#addSavedToProgramDialog').close();
        state.programWorkoutUid=null;
        renderProgram();
        window.scrollTo(sx,sy);
        showToast(`Added "${shell.name}" to the program.`);
      };
      const renderList=()=>{
        const host=$('#addSavedToProgramList');if(!host)return;
        $('#addToProgramTabSaved')?.setAttribute('aria-pressed',String(addToProgramTab==='saved'));
        $('#addToProgramTabPast')?.setAttribute('aria-pressed',String(addToProgramTab==='past'));
        if(addToProgramTab==='past'){
          const past=(workoutState.completed||[]).slice().sort(sortByRecencyDesc);
          host.innerHTML=past.length?past.map(w=>{const n=(w.exercises||[]).length;return `<button class="picker-item" type="button" data-add-past="${escapeHtml(w.id)}"><span><strong>${escapeHtml(w.name||'Workout')}</strong><span>${escapeHtml(formatLogDate(w.date))} · ${n} exercise${n===1?'':'s'}</span></span><span class="picker-state">+</span></button>`;}).join(''):'<div class="dialog-empty">No past workouts yet.</div>';
          host.querySelectorAll('[data-add-past]').forEach(b=>b.addEventListener('click',()=>{
            const w=workoutState.completed.find(x=>x.id===b.dataset.addPast);if(!w)return;
            /* #447: pass the whole workout — templateExercisesFromCompleted
               reads workout.exercises itself. Passing w.exercises threw and
               the + button silently added nothing. */
            addShellToProgram({uid:newProgramWorkoutUid(),name:w.name||'Workout',sourceWorkoutId:w.id,template:{name:w.name||'Workout',exercises:templateExercisesFromCompleted(w)}});
          }));
          return;
        }
        const live=(workoutState.templates||[]).filter(t=>!t.archivedAt);
        host.innerHTML=live.length?live.map(t=>`<button class="picker-item" type="button" data-add-saved="${escapeHtml(t.id)}"><span><strong>${escapeHtml(t.name)} ${t.builtIn?'<span class="built-in-label">Built-in</span>':''}</strong><span>${t.exercises.length} exercise${t.exercises.length===1?'':'s'}</span></span><span class="picker-state">+</span></button>`).join(''):'<div class="dialog-empty">No saved workouts yet.</div>';
        host.querySelectorAll('[data-add-saved]').forEach(b=>b.addEventListener('click',()=>{
          const t=workoutState.templates.find(x=>x.id===b.dataset.addSaved);if(!t)return;
          /* sourceTemplateId (user 2026-09-12): the shell is a copy, but it
             remembers which template it came from so the saved list can show
             "in program" chips — and a template may live in many programs. */
          addShellToProgram({uid:newProgramWorkoutUid(),name:t.name,sourceTemplateId:t.id,template:{name:t.name,exercises:cloneTemplateExercises(t.exercises||[])}});
        }));
      };
      $('#addToProgramTabSaved').onclick=()=>{addToProgramTab='saved';renderList();};
      $('#addToProgramTabPast').onclick=()=>{addToProgramTab='past';renderList();};
      renderList();
      $('#addSavedToProgramDialog').showModal();
    }

    /* #509 (user 2026-09-16): shared builder-form validation/assembly for
       createProgram() and saveProgramToLibrary() — returns the validated
       values, or null after stamping the form error. */
    function programFormValues(){
      const name = $('#programName').value.trim();
      const length = Number($('#programLength').value);
      const startWeek = Number($('#programStartWeek').value);
      if (!name || !Number.isInteger(length) || length < 1 || length > 52 || !Number.isInteger(startWeek) || startWeek < 1 || startWeek > length) {
        $('#programError').textContent = 'Add a program name, a length from 1 to 52 weeks, and a start week within that range.';
        return null;
      }
      return {name, length, startWeek, focus:$('#programFocus').value.trim(), progression:cloneProgression(programFormProgression())};
    }
    /* Validates the program form and creates (or saves edits to) the active program from the detached draft. */
    function createProgram() {
      const vals=programFormValues();if(!vals)return;
      const {name,length,startWeek,focus,progression}=vals;
      if($('#createProgram').dataset.editing==='true'&&workoutState.activeProgram){Object.assign(workoutState.activeProgram,{name,length,startWeek,focus,progression});delete $('#createProgram').dataset.editing;$('#createProgram').textContent='Create active program';$('#programSetupTitle').textContent='Create your active program.';}
      else workoutState.activeProgram = {id:newProgramId(), name, length, startWeek, focus, workouts:[], startedAt:localIsoDate(), progression};
      programDraftProgression=null;programEditSnapshot=null;
      $('#programError').textContent = '';
      schedulePersist(); renderProgram();renderDashboard();
    }
    /* #509: save the builder form to the saved-programs library instead of
       making it active — mirrors the #432 share-page pattern (set as active
       vs save to library). Same validation as createProgram; the program is
       unshifted onto savedPrograms (never made active), the form resets, and
       a toast confirms. Hidden while editing the active program (see
       renderProgram): there the only commit path is "Save program changes". */
    function saveProgramToLibrary(){
      const vals=programFormValues();if(!vals)return;
      const {name,length,startWeek,focus,progression}=vals;
      const program={id:newProgramId(), name, length, startWeek, focus, workouts:[], startedAt:localIsoDate(), savedAt:localIsoDate(), progression};
      const saved=workoutState.savedPrograms||(workoutState.savedPrograms=[]);
      saved.unshift(program);
      programDraftProgression=null;programEditSnapshot=null;
      $('#programError').textContent = '';
      schedulePersist();renderProgram();renderDashboard();
      showToast(`"${name}" saved to your library.`);
    }
    /* Loads the active program into the setup form in edit mode and snapshots it for the discard-changes dialog. */
    function editActiveProgram(){
      const program=workoutState.activeProgram;if(!program)return;
      state.programWorkoutUid=null;
      $('#programName').value=program.name;$('#programLength').value=program.length;$('#programStartWeek').max=String(program.length);$('#programStartWeek').value=String(Math.max(1,Math.min(program.length,Number(program.startWeek)||1)));$('#programFocus').value=program.focus||'';
      seedProgramForm(program);
      $('#createProgram').dataset.editing='true';$('#createProgram').textContent='Save program changes';$('#programSetupTitle').textContent='Edit your active program.';$('#programSetup').hidden=false;$('#programCover').hidden=true;$('#programSetup').scrollIntoView({behavior:'smooth',block:'start'});
      /* Snapshot for the discard-changes modal (user 2026-09-12): taken after
         seeding so the form and the draft agree. */
      programEditSnapshot=JSON.stringify({name:program.name,length:program.length,startWeek:program.startWeek,focus:program.focus||'',progression:programFormProgression()});
      updateTopBar('program');
    }
    /* The setup form is dirty when any field differs from the edit snapshot. */
    function programFormDirty(){
      if($('#createProgram')?.dataset.editing!=='true'||!programEditSnapshot)return false;
      const cur={name:$('#programName').value,length:Number($('#programLength').value),startWeek:Number($('#programStartWeek').value),focus:$('#programFocus').value,progression:programFormProgression()};
      return JSON.stringify(cur)!==programEditSnapshot;
    }
    /* Drops the edit draft and returns to the program cover. */
    function cancelProgramEdit(){
      /* #420 (user 2026-09-13, v1.645): discarding must drop the draft too.
         Otherwise a stale draft (e.g. wave toggled ON) leaks into the next
         new-program form via renderProgram()'s `else syncProgramForm()`
         branch, ignoring the current Settings defaults. */
      programDraftProgression=null;
      programEditSnapshot=null;
      delete $('#createProgram').dataset.editing;$('#createProgram').textContent='Create active program';$('#programSetupTitle').textContent='Create your active program.';
      renderProgram();
    }
    /* Cancels the program edit immediately, or asks via the discard-changes dialog when the form is dirty. */
    function requestCancelProgramEdit(){
      if(programFormDirty())showModalPinned($('#discardProgramChangesDialog'));
      else cancelProgramEdit();
    }

    
