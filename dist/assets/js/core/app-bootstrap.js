
/* ===== module: app-bootstrap.js ===== */
    /** Connects static controls to feature modules and performs initial rendering.
        Historical note (docs, #99 C16): the Settings UI — renderSettings(),
        renderSettingsWeekRanges(), renderSettingsPctWave() — lives HERE, not in
        a settings.js (there is none). Boot's entry point is the anonymous
        (async function) at the bottom (BOOT banner); this file loads LAST so
        every feature module it wires already exists. */
    /* Module map (v1.006) — Key: touch-viewport IIFE, the static-control wiring block, renderSettings(), applyTheme(), setThemeName(), renderSettingsWeekRanges(). Depends on: every feature module (loads last — it wires the static DOM controls to all feature modules and performs the initial render). */
    /* Native-app feel (2026-09-11): on touch devices (phones/tablets — NOT
       desktop), lock the viewport scale and hide scrollbars so the app
       feels native in both the home-screen app and mobile browser tabs.
       pointer:coarse is the touch-vs-desktop line; done in JS (not the
       static meta/CSS) so desktop is completely unaffected. */
    (function(){
      var touch=false;
      try{touch=!!(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches);}catch(_){}
      if(!touch)return;
      document.documentElement.classList.add('is-touch');
      /* iOS Home Screen apps cache the system status-bar tint at launch —
         flag standalone so the theme section can note the relaunch caveat. */
      var standalone=false;
      try{standalone=(window.navigator&&window.navigator.standalone===true)||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches);}catch(_){}
      if(standalone)document.documentElement.classList.add('is-standalone');
      var vp=document.querySelector('meta[name="viewport"]');
      if(vp)vp.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
      /* Catches older iOS versions that still fire gesture events; the
         touch-action CSS above carries modern mobile browsers (iOS Safari
         ignores user-scalable=no, but honors touch-action). */
      document.addEventListener('gesturestart',function(e){e.preventDefault();},{passive:false});
    })();
    /** Theme state (user 2026-09-10): four themes in two visual columns.
        The dark toggle moves between the matching pills: Cruciferous <->
        Macchiato, Rosé Pine <-> Mocha — the newly active theme's pill is
        always the one shown selected. Tapping the Cruciferous pill always
        lands on Cruciferous light; tapping an already-active non-default
        pill also resets to Cruciferous light. Persisted as workout-theme
        (dark/light) + workout-theme-name (+ legacy workout-theme-light,
        kept for stored prefs). */
    let swipeToDeleteSets=true;
    /* #98 (user 2026-09-16): optional desktop layout — off by default. The
       phone layout stays the default and there is no automatic breakpoint;
       the wide shell only applies when the user opts in. */
    let desktopLayout=false;
    /* #99 B20: ONE theme value object instead of four overlapping variables
       (themeName/darkMode/ctpDark/lightTheme). `name` is the active pill:
       cruciferous|rosepine are the light families, macchiato|mocha the dark
       flavors; `dark` is the dark-mode toggle; `darkFlavor`/`lightName`
       remember which flavor the toggle walks to in each column. */
    const themeState={name:'cruciferous',dark:false,darkFlavor:'mocha',lightName:'cruciferous'};
    const ROSEPINE='rosepine', DARK_FLAVORS=['macchiato','mocha'], LIGHT_THEMES=['cruciferous','rosepine'];
    /* #99 B20: ONE apply path. The effective theme is one of
       light|macchiato|rosepine|mocha — the same vocabulary the inline head
       script writes pre-paint, so the value never changes during boot. */
    function applyTheme(){
      const t=themeState, eff=t.name==='cruciferous'?(t.dark?'macchiato':'light'):t.name;
      document.documentElement.dataset.theme=eff;
      const toggle=$('#darkModeToggle');
      if(toggle){toggle.setAttribute('aria-pressed',String(t.dark));toggle.setAttribute('aria-label',`Dark mode ${t.dark?'on':'off'}`);}
      document.querySelectorAll('#themePills [data-theme-name]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeName===t.name)));
      const color=getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();document.querySelector('meta[name="theme-color"]').setAttribute('content',color);document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').setAttribute('content',t.dark?'black-translucent':'default');
      try{localStorage.setItem('workout-theme',t.dark?'dark':'light');localStorage.setItem('workout-theme-name',t.name);localStorage.setItem('workout-theme-light',t.lightName);}catch(_){}
      /* Theme changes persist: schedule a local save. */
      if(typeof schedulePersist==='function')schedulePersist();
    }
    /** Appearance travels as one persisted key so the theme follows the
        profile. Validated on the way in; garbage never applies.
        The persisted payload shape ({themeName,darkMode,ctpDark,lightTheme}) is
        kept byte-compatible across app versions — only the in-memory model
        moved into themeState. */
    function getAppearanceState(){return {themeName:themeState.name,darkMode:themeState.dark,ctpDark:themeState.darkFlavor,lightTheme:themeState.lightName,swipeToDeleteSets:swipeToDeleteSets,desktopLayout:desktopLayout};}
    /* Updates the cached appearance value and notifies app-appearance listeners. */
    function setAppearanceState(v){
      if(!v||typeof v!=='object')return;
      if(!['cruciferous','rosepine','macchiato','mocha'].includes(v.themeName))return;
      if(typeof v.darkMode!=='boolean')return;
      if(!DARK_FLAVORS.includes(v.ctpDark)||!LIGHT_THEMES.includes(v.lightTheme))return;
      themeState.name=v.themeName;themeState.dark=v.darkMode;themeState.darkFlavor=v.ctpDark;themeState.lightName=v.lightTheme;
      if(typeof v.swipeToDeleteSets==='boolean')swipeToDeleteSets=v.swipeToDeleteSets;
      if(typeof v.desktopLayout==='boolean')desktopLayout=v.desktopLayout;
      applyTheme();applySwipeSets();applyDesktopLayout();
    }
    /** Swipe-to-delete for set rows (user 2026-09-11): a Settings toggle that
        travels with the persisted appearance key. The gesture itself only engages on
        touch devices — desktop keeps the × button regardless. */
    function applySwipeSets(){
      document.documentElement.classList.toggle('swipe-sets',swipeToDeleteSets);
      const toggle=$('#swipeDeleteSetsToggle');
      if(toggle){toggle.setAttribute('aria-pressed',String(swipeToDeleteSets));toggle.setAttribute('aria-label',`Swipe to delete ${swipeToDeleteSets?'on':'off'}`);}
    }
    /* True when swipe-to-delete on sets is allowed (touch devices only). */
    function swipeDeleteSetsEnabled(){return swipeToDeleteSets&&document.documentElement.classList.contains('is-touch');}
    /** #98 (user 2026-09-16): optional desktop layout. The body.desktop class
        is the only trigger — no automatic breakpoint — so the phone layout is
        untouched unless the user opts in. The choice travels with the
        appearance key and a localStorage flag (the flag also drives the
        pre-paint script in index.html, so the wide shell never flashes).
        user 2026-09-16: viewport-gated — a stored "on" only takes effect at
        desktop widths (>=900px). It must never alter the phone header or any
        mobile UI, even when left on (the toggle itself is hidden on mobile). */
    const DESKTOP_MIN_WIDTH=900;
    /* Forces the <html> root to a fixed tablet/desktop width (desktop testing aid). */
    function desktopViewport(){
      try{
        if(typeof window==='undefined'||!window.matchMedia)return true;
        return window.matchMedia('(min-width: '+DESKTOP_MIN_WIDTH+'px)').matches;
      }catch(_){return true;}
    }
    /* Applies the desktop-viewport transform and syncs the body class + Settings toggle. */
    function applyDesktopLayout(){
      document.body.classList.toggle('desktop',desktopLayout&&desktopViewport());
      const toggle=$('#desktopLayoutToggle');
      if(toggle){toggle.setAttribute('aria-pressed',String(desktopLayout));toggle.setAttribute('aria-label',`Desktop layout ${desktopLayout?'on':'off'}`);}
      try{localStorage.setItem('workout-desktop-layout',desktopLayout?'1':'0');}catch(_){}
    }
    /* Re-gate when the viewport crosses the breakpoint (tablet rotate, laptop
       resize): the class follows the stored choice only while wide. */
    try{
      const desktopMq=typeof window!=='undefined'&&window.matchMedia?window.matchMedia('(min-width: '+DESKTOP_MIN_WIDTH+'px)'):null;
      if(desktopMq&&typeof desktopMq.addEventListener==='function')desktopMq.addEventListener('change',applyDesktopLayout);
      else if(desktopMq&&typeof desktopMq.addListener==='function')desktopMq.addListener(applyDesktopLayout);
    }catch(_){}
    /* Sets the theme flavor and syncs the picker + Settings visibility. */
    function setThemeName(name){
      const t=themeState;t.name=name;
      if(name===ROSEPINE){t.dark=false;t.lightName=ROSEPINE;}
      /* Cruciferous always means Cruciferous light — tapping the pill must show
         the default theme, never linger in a dark palette (user 2026-09-10).
         The Cruciferous<->Macchiato dark relationship lives in the dark toggle. */
      else if(name==='cruciferous'){t.dark=false;t.lightName='cruciferous';}
      else{ /* dark Catppuccin flavor */ t.dark=true;t.darkFlavor=name;}
      applyTheme();
    }
    /** Highlights the active workout-focus pill from the draft's explicit choice (user 2026-09-10). */
    function syncWorkoutFocusPills(){
      const key=workoutState.draft?.focusPreset||null;
      document.querySelectorAll('[data-workout-focus]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.workoutFocus===key)));
    }
    /** Light unit suffix inside the program increment value field; follows the program form's type. */
    function syncProgramIncrementUnit(){
      const unit=$('#programIncrementUnit');
      if(unit) unit.textContent = programFormProgression().incrementType==='percent' ? '%' : weightUnit();
    }
    /** Light unit suffix inside the increment value field; follows the type (user 2026-09-10). */
    function syncSettingsIncrementUnit(){
      const unit=$('#settingsIncrementUnit');
      if(unit) unit.textContent = progressionSetup.incrementType==='percent' ? '%' : weightUnit();
      const typeOpt=$('#settingsIncrementType option[value="lb"]');
      /* v1.884 (user 2026-09-22): the fixed-weight option reads "Weight (lb)"
         to match the program builder. */
      if(typeOpt) typeOpt.textContent = 'Weight (lb)';
    }
    /* Reflects the unit setting in the Settings pills. */
    function syncUnitPills(){
      document.querySelectorAll('#settingsUnitPills [data-units]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.units===(progressionSetup.units||'imperial'))));
    }
    /* Stats default metric pills (user 2026-09-11): saved under Units,
       persisted in progressionSetup. */
    function syncStatsDefaultPills(){
      const def=progressionSetup.statsDefaultMetric==='sets'?'sets':'volume';
      document.querySelectorAll('#settingsStatsDefaultPills [data-stats-default]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.statsDefault===def)));
    }
    /* #89 (user 2026-09-14): program muscle card default view pills — 'chart'
       or 'heatmap'. Saved under Units, persisted in progressionSetup. */
    function syncProgramMusclePills(){
      const def=progressionSetup.programMuscleView==='heatmap'?'heatmap':'chart';
      document.querySelectorAll('#settingsProgramMusclePills [data-pm-default]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.pmDefault===def)));
    }
    /* #410 (user 2026-09-13): dumbbell weight entry pills — 'per' (per
       dumbbell, the default) or 'total'. Stored weight stays total combined;
       only entry/display change. */
    function syncDbEntryPills(){
      const mode=progressionSetup.dbEntry==='total'?'total':'per';
      document.querySelectorAll('#settingsDbEntryPills [data-db-entry]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.dbEntry===mode)));
    }
    /* QA batch (user 2026-09-21, #5): effort display pills — 'rpe' or 'rir'.
       Saved under Units, persisted in progressionSetup; the set column
       follows this setting. */
    function syncEffortPills(){
      const mode=(typeof effortMode==='function'?effortMode():'rpe');
      document.querySelectorAll('#settingsEffortPills [data-effort]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.effort===mode)));
    }
    /* #489: default set count for newly added exercises (picker). Clamped
       1..10; blobs written before the setting existed fall back to the old
       hardcoded 3. Lives here (the settings module) so the builder's picker
       call sites read it at click time — see the defaultSetCount() calls in
       workout-builder.js. */
    function defaultSetCount(){
      return Math.min(10,Math.max(1,Math.round(Number(progressionSetup.defaultSetCount)||3)));
    }
    /** Mirrors the program form: the RPE trigger only applies to RPE-based mode. */
    function syncSettingsScheme(){
      const scheme=progressionSetup.scheme||'linear';
      document.querySelectorAll('#settingsSchemePills [data-scheme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scheme===scheme)));
      /* #205: show only the selected mode's description under the pills. The
         container keeps a fixed min-height (styles.css) so swapping copy never
         moves the scroll position. */
      const schemeDesc=$('#settingsSchemeDesc');
      if(schemeDesc)schemeDesc.textContent=schemeDescription(scheme);
      /* %1RM defaults (#54, v1.001): fixed increments don't apply; show the
         % default instead. */
      const incPair=$('#settingsIncrementValue')?.closest('.settings-pair');
      if(incPair)incPair.hidden=scheme==='onerm';
      const pctRow=$('#settingsPctRow'); if(pctRow)pctRow.hidden=scheme!=='onerm';
      syncSettingsRpeTrigger(); /* v1.883: trigger row only shows in RPE mode */
    }
    /** Mirrors the program form: the RPE trigger pills in Settings show the
        global default threshold, visible only when RPE-based mode is on. */
    function syncSettingsRpeTrigger(){
      const scheme=progressionSetup.scheme||'linear';
      const row=$('#settingsRpeTriggerRow');
      if(row)row.hidden=scheme!=='rpe';
      const t=progressionSetup.threshold;
      document.querySelectorAll('#settingsRpePills [data-rpe-threshold]').forEach(button=>{
        button.setAttribute('aria-pressed',String(button.dataset.rpeThreshold===String(t)));
      });
    }
    /* #502/#408 (user 2026-09-16): Settings sections expand independently —
       opening one never closes the others. Each section's expansion state
       persists per section key (state.settingsSections, sparse {key:true}). */
    function settingsSectionKey(sec){
      try{return sec&&sec.dataset&&typeof sec.dataset.section==='string'?sec.dataset.section:'';}catch(_){return '';}
    }
    /* Wires the collapsible Settings sections (one open at a time). */
    function wireSettingsAccordion(){
      const sections=Array.from(document.querySelectorAll('#settingsView details.settings-section'));
      sections.forEach(sec=>sec.addEventListener('toggle',()=>{
        const key=settingsSectionKey(sec);
        if(!key)return;
        try{
          if(!state.settingsSections||typeof state.settingsSections!=='object')state.settingsSections={};
          if(sec.open)state.settingsSections[key]=true;
          else delete state.settingsSections[key];
          if(typeof schedulePersist==='function')schedulePersist();
        }catch(_){}
      }));
    }
    /* #502/#408: restore the saved expansion state each time the Settings tab
       opens (replaces the old all-collapsed reset). Called from showSettings
       (navigation.js) — NOT from renderSettings, which also runs
       mid-interaction (e.g. the warm-up rung buttons) and on cross-tab merge,
       where re-applying state could yank the open section away. Fresh
       profiles start all-collapsed (the markup default). */
    function applySettingsSectionsState(){
      let saved=null;
      try{saved=state.settingsSections;}catch(_){saved=null;}
      document.querySelectorAll('#settingsView details.settings-section').forEach(sec=>{
        const key=settingsSectionKey(sec);
        if(!key)return;
        try{sec.open=!!(saved&&saved[key]===true);}catch(_){}
      });
    }
    /* #506 (user 2026-09-16): QA-only "Replay onboarding" trigger in the
       About section — lets the first-run flow be tested on QA builds. */
    try{if(typeof wireOnboardingReplay==='function')wireOnboardingReplay();}catch(_){}
    /* Renders all Settings sections from the stored settings. */
    function renderSettings(){
      const darkToggle=$('#darkModeToggle');
      if(darkToggle){darkToggle.setAttribute('aria-pressed',String(themeState.dark));darkToggle.setAttribute('aria-label',`Dark mode ${themeState.dark?'on':'off'}`);}
      const swipeToggle=$('#swipeDeleteSetsToggle');
      if(swipeToggle){swipeToggle.setAttribute('aria-pressed',String(swipeToDeleteSets));swipeToggle.setAttribute('aria-label',`Swipe to delete ${swipeToDeleteSets?'on':'off'}`);}
      const desktopToggle=$('#desktopLayoutToggle');
      if(desktopToggle){desktopToggle.setAttribute('aria-pressed',String(desktopLayout));desktopToggle.setAttribute('aria-label',`Desktop layout ${desktopLayout?'on':'off'}`);}
      document.querySelectorAll('#themePills [data-theme-name]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeName===themeState.name)));
      /* #99 H6: null-guard every direct DOM write — Settings renders before
         some controls exist on first paint. */
      const incType=$('#settingsIncrementType'); if(incType)incType.value=progressionSetup.incrementType;
      const incVal=$('#settingsIncrementValue'); if(incVal)incVal.value=progressionSetup.incrementValue;
      syncSettingsIncrementUnit();
      const repMin=$('#settingsRepMin'); if(repMin)repMin.value=progressionSetup.defaultRange.min;
      const repMax=$('#settingsRepMax'); if(repMax)repMax.value=progressionSetup.defaultRange.max;
      const activePreset=progressionSetup.defaultRange.preset||'hypertrophy';
      document.querySelectorAll('[data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.repPreset===activePreset)));
      syncUnitPills();
      syncStatsDefaultPills();
      /* #405: progression off-switch (global default for new programs).
         aria-pressed reflects ON state; when off, the rest of the section
         dims via the .progression-off class (#420 precedent). */
      const progOffToggle=$('#progressionOffToggle');
      if(progOffToggle){const off=!!progressionSetup.progressionOff;progOffToggle.setAttribute('aria-pressed',String(!off));progOffToggle.setAttribute('aria-label',`Progression ${off?'off':'on'}`);}
      const progCard=$('#progressionDefaultsCard');
      if(progCard)progCard.classList.toggle('progression-off',!!progressionSetup.progressionOff);
      syncProgramMusclePills();
      syncDbEntryPills();
      syncEffortPills(); /* QA batch (user 2026-09-21, #5) */
      /* #489: default sets for newly added exercises (1–10). */
      const defSets=$('#settingsDefaultSetCount'); if(defSets)defSets.value=defaultSetCount();
      /* #495: hide the per-exercise dumbbell "Total" weight option. Off by
         default — existing behavior is unchanged until the user flips it. */
      const hideDbToggle=$('#hideDbTotalToggle');
      if(hideDbToggle){const hide=!!progressionSetup.hideDbTotal;hideDbToggle.setAttribute('aria-pressed',String(hide));hideDbToggle.setAttribute('aria-label',`Hide total-weight option ${hide?'on':'off'}`);}
      syncTimeStepPills($('#settingsTimeStepPills'),progressionSetup.timeStep);
      const pctDef=$('#settingsPercentOf1RM'); if(pctDef)pctDef.value=progressionSetup.percentOf1RM??75;
      /* #185: warm-up ladder settings. */
      const warmupRungsHost=$('#settingsWarmupRungs');
      if(warmupRungsHost){
        const n=Math.min(3,Math.max(1,Math.round(Number(progressionSetup.warmupRungs)||2)));
        warmupRungsHost.querySelectorAll('[data-warmup-rungs]').forEach(btn=>btn.setAttribute('aria-pressed',String(Number(btn.dataset.warmupRungs)===n)));
        document.querySelectorAll('[data-warmup-rung]').forEach(row=>{row.hidden=Number(row.dataset.warmupRung)>=n;});
      }
      (progressionSetup.warmupLadder||[]).forEach((rung,i)=>{
        const pctEl=$('#settingsWarmupPct'+i),repsEl=$('#settingsWarmupReps'+i);
        if(pctEl)pctEl.value=rung.pct; if(repsEl)repsEl.value=rung.reps;
      });
      syncSettingsScheme();
      /* QA batch (user 2026-09-22): the vary-ranges default toggle mirrors
         the stored default — the week pills only show when it's on. */
      syncSettingsCycleUI();
      /* #420 (user 2026-09-13): default %1RM wave for new programs, mirroring
         the vary-rep-ranges default. New programs inherit progressionSetup. */
      const pwDef=$('#settingsPctWaveDefaultToggle');
      if(pwDef){pwDef.setAttribute('aria-pressed',String(!!progressionSetup.pctWave));pwDef.setAttribute('aria-label',`Vary percent of 1RM by week ${progressionSetup.pctWave?'on':'off'}`);}
      syncSettingsPeriodization();
      renderSettingsPctWave();
    }
    window.addEventListener('load', () => {
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        /* updateViaCache:'none' (user 2026-09-11): the browser must never
           serve a cached sw.js when checking for updates — GitHub Pages sends
           max-age=600 and its headers aren't configurable. */
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
      }
    });

    /** Refreshes the pretty date button from the hidden native date input. */
    function renderWorkoutDateDisplay() {
      const input=$('#workoutDate'),display=$('#workoutDateDisplay');
      if(!input||!display)return;
      display.textContent=formatPrettyDate(input.value||localIsoDate());
    }

    $('#customExerciseForm').addEventListener('submit', event => {
      event.preventDefault();
      const name = $('#customName').value.trim();
      const primary = [...customDraft.primary];
      if (!name || !primary.length) {
        $('#customFormError').textContent = 'Add a name and select at least one primary muscle.';
        return;
      }
      const existingId = $('#customExerciseId').value;
      const id = existingId || newCustomExerciseId(name);
      const tracking = customDraft.tracking || 'reps';
      /* #498: distance-tracked custom exercises get distance metrics and
         skip standard volume. */
      const customExercise = {
        id,
        name,
        force: customDraft.force || null,
        level: null,
        mechanic: customDraft.mechanic || null,
        equipment: customDraft.equipment || null,
        tracking,
        metrics: tracking === 'distance' ? ['load','distance'] : null,
        primary,
        secondary: [...customDraft.secondary],
        category: null,
        instructions: $('#customInstructions').value.split('\n').map(step => step.trim()).filter(Boolean),
        custom: true
      };
      if (existingId) {
        /* A8 (#99): editing a soft-deleted exercise keeps its tombstone —
           the save must not resurrect it into the library. */
        const prev = state.customExercises.find(ex => ex.id === existingId);
        if (prev?.deletedAt) customExercise.deletedAt = prev.deletedAt;
        exercises = exercises.map(ex => ex.id === existingId ? customExercise : ex);
        state.customExercises = state.customExercises.map(ex => ex.id === existingId ? customExercise : ex);
      } else {
        exercises = [customExercise, ...exercises];
        state.customExercises.unshift(customExercise);
      }
      closeCustomDialog();
      refreshFilters();
      renderLibrary();
      schedulePersist();
      openExercise(id);
    });

    $('#addExerciseButton').addEventListener('click', () => openCustomDialog());
    $('#closeCustomDialog').addEventListener('click', closeCustomDialog);
    $('#cancelCustomExercise').addEventListener('click', closeCustomDialog);
    wireCustomDeleteDialog(); /* A8 (#99): custom-exercise soft-delete confirm. */

    /* #14: the top-exercises metric is now a two-button segmented control;
       its wiring lives in renderMuscleAnalysis (dashboard-stats.js). */

    $('#darkModeToggle').addEventListener('click',()=>{
      const t=themeState;t.dark=!t.dark;
      /* The toggle walks to the matching theme pill (user 2026-09-10):
         Cruciferous <-> Macchiato, Rosé Pine <-> Mocha. */
      if(t.dark){ if(t.name==='cruciferous')t.name='macchiato'; else if(t.name===ROSEPINE)t.name='mocha'; }
      else{ if(t.name==='macchiato')t.name='cruciferous'; else if(t.name==='mocha')t.name=ROSEPINE; }
      applyTheme();
    });
    $('#swipeDeleteSetsToggle').addEventListener('click',()=>{
      swipeToDeleteSets=!swipeToDeleteSets;
      applySwipeSets();
      /* Flipping the toggle changes the persisted appearance key. */
      if(typeof schedulePersist==='function')schedulePersist();
    });
    /* #98: the desktop-layout toggle — same persist + sync contract. */
    $('#desktopLayoutToggle').addEventListener('click',()=>{
      desktopLayout=!desktopLayout;
      applyDesktopLayout();
      if(typeof schedulePersist==='function')schedulePersist();
    });

    document.querySelectorAll('#themePills [data-theme-name]').forEach(button=>button.addEventListener('click',()=>{
      const name=button.dataset.themeName;
      /* Tapping the active pill resets to Cruciferous light. Tapping
         "Cruciferous" always shows Cruciferous light (user 2026-09-10) —
         the dark side of that column is reached via the dark toggle. */
      if(name===themeState.name){ themeState.name='cruciferous';themeState.dark=false;themeState.lightName='cruciferous';applyTheme(); return; }
      setThemeName(name);
    }));
    document.querySelectorAll('#settingsUnitPills [data-units]').forEach(button=>button.addEventListener('click',()=>{
      progressionSetup.units=button.dataset.units; syncUnitPills(); syncSettingsIncrementUnit(); syncProgramIncrementUnit(); schedulePersist();
      renderDashboard(); renderStats(); renderWorkoutScreen(); renderWorkoutProgression();
    }));
    document.querySelectorAll('#settingsDbEntryPills [data-db-entry]').forEach(button=>button.addEventListener('click',()=>{
      const mode=button.dataset.dbEntry; if(progressionSetup.dbEntry===mode)return;
      progressionSetup.dbEntry=mode; syncDbEntryPills(); schedulePersist();
      renderDashboard(); renderStats(); renderWorkoutScreen(); renderWorkoutProgression();
    }));
    document.querySelectorAll('#settingsEffortPills [data-effort]').forEach(button=>button.addEventListener('click',()=>{
      const mode=button.dataset.effort; if(progressionSetup.effortMode===mode)return;
      progressionSetup.effortMode=mode; syncEffortPills(); schedulePersist();
      renderDashboard(); renderStats(); renderWorkoutScreen(); renderWorkoutProgression();
    }));
    /* #489: default set count for newly added exercises — clamped 1..10,
       persisted in the progressionSetup blob. */
    $('#settingsDefaultSetCount')?.addEventListener('input',e=>{progressionSetup.defaultSetCount=Math.min(10,Math.max(1,Math.round(Number(e.target.value)||3)));schedulePersist();});
    /* #495: hide the per-exercise dumbbell "Total" option. While hidden, any
       stored per-exercise 'total' overrides are dropped — an exercise stuck
       in total mode with no UI to change it back would be a trap. */
    $('#hideDbTotalToggle')?.addEventListener('click',()=>{
      const hide=!progressionSetup.hideDbTotal;
      progressionSetup.hideDbTotal=hide;
      if(hide&&progressionSetup.dbEntryPrefs&&typeof progressionSetup.dbEntryPrefs==='object'){
        Object.keys(progressionSetup.dbEntryPrefs).forEach(k=>{if(progressionSetup.dbEntryPrefs[k]==='total')delete progressionSetup.dbEntryPrefs[k];});
      }
      /* Drop live per-exercise 'total' overrides too, so the current draft
         can't sit in total mode with the toggle gone. */
      const liveDraft=typeof workoutState!=='undefined'?workoutState.draft:null;
      (liveDraft?.exercises||[]).forEach(it=>{if(it&&it.progression&&it.progression.dbEntry==='total')delete it.progression.dbEntry;});
      const t=$('#hideDbTotalToggle');
      if(t){t.setAttribute('aria-pressed',String(hide));t.setAttribute('aria-label',`Hide total-weight option ${hide?'on':'off'}`);}
      schedulePersist();
      /* The per-exercise toggle renders in the live editor's Exercise
         options — re-render so the change shows immediately (precedent: the
         dumbbell entry-mode pills above). */
      renderWorkoutScreen();
    });
    document.querySelectorAll('#settingsStatsDefaultPills [data-stats-default]').forEach(button=>button.addEventListener('click',()=>{
      const def=button.dataset.statsDefault; if(progressionSetup.statsDefaultMetric===def)return;
      progressionSetup.statsDefaultMetric=def; syncStatsDefaultPills(); schedulePersist();
      /* Apply immediately: all Stats toggles follow the new default. */
      state.topExercisesMode=def; state.muscleVolumeMode=def; state.muscleMapMode=def; renderStats();
    }));
    document.querySelectorAll('#settingsProgramMusclePills [data-pm-default]').forEach(button=>button.addEventListener('click',()=>{
      const def=button.dataset.pmDefault; if(progressionSetup.programMuscleView===def)return;
      progressionSetup.programMuscleView=def; syncProgramMusclePills(); schedulePersist();
    }));
    $('#settingsIncrementType').addEventListener('change',e=>{progressionSetup.incrementType=e.target.value;syncSettingsIncrementUnit();schedulePersist();});
    $('#settingsIncrementValue').addEventListener('input',e=>{progressionSetup.incrementValue=Math.max(0,Number(e.target.value)||0);schedulePersist();});
    /* Persona P11#10 (2026-09-22): the rep-range fields must never lie — an
       inverted MIN/MAX was silently accepted (or half-clamped), leaving the
       input showing a value the model didn't hold. Clamp both directions and
       write the stored values back into the fields. */
    $('#settingsRepMin').addEventListener('input',e=>{const r=progressionSetup.defaultRange;r.min=Math.max(1,Math.round(Number(e.target.value)||1));if(r.max!=null&&r.max<r.min)r.max=r.min;e.target.value=r.min;const mx=$('#settingsRepMax');if(mx&&r.max!=null)mx.value=r.max;r.preset='custom';document.querySelectorAll('#settingsRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));schedulePersist();});
    $('#settingsRepMax').addEventListener('input',e=>{const r=progressionSetup.defaultRange;const v=e.target.value.trim();r.max=v===''?null:Math.max(r.min,Math.round(Number(v)||r.min));if(r.max!=null)e.target.value=r.max;r.preset='custom';document.querySelectorAll('#settingsRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));schedulePersist();});
    const syncAllTimeStepPills=()=>{syncTimeStepPills($('#settingsTimeStepPills'),progressionSetup.timeStep);syncTimeStepPills($('#programTimeStepPills'),programFormProgression().timeStep);};
    wireTimeStepPills($('#settingsTimeStepPills'),()=>progressionSetup.timeStep,v=>{progressionSetup.timeStep=v;syncAllTimeStepPills();schedulePersist();});
    wireTimeStepPills($('#programTimeStepPills'),()=>programFormProgression().timeStep,v=>{programFormProgression().timeStep=v;syncAllTimeStepPills();});
    document.querySelectorAll('#settingsSchemePills [data-scheme]').forEach(button=>button.addEventListener('click',()=>{progressionSetup.scheme=button.dataset.scheme;syncSettingsScheme();schedulePersist();}));
    /* v1.883: the RPE trigger control was dropped from Settings during the
       %1RM rework — restored. Mirrors the program-form pills. */
    document.querySelectorAll('#settingsRpePills [data-rpe-threshold]').forEach(button=>button.addEventListener('click',()=>{
      const v=button.dataset.rpeThreshold;
      progressionSetup.threshold=v==='completion'?'completion':Number(v);
      syncSettingsRpeTrigger();schedulePersist();
    }));
    $('#settingsPercentOf1RM')?.addEventListener('input',e=>{progressionSetup.percentOf1RM=clampPct1RM(Number(e.target.value)||75);schedulePersist();});
    /* QA batch (user 2026-09-22): Auto Deload removed entirely. */
    /* #185: warm-up ladder settings. */
    $('#settingsWarmupRungs')?.querySelectorAll('[data-warmup-rungs]').forEach(btn=>btn.addEventListener('click',()=>{
      progressionSetup.warmupRungs=Math.min(3,Math.max(1,Number(btn.dataset.warmupRungs)||2));
      normalizeProgression(progressionSetup);schedulePersist();renderSettings();
    }));
    [0,1,2].forEach(i=>{
      $('#settingsWarmupPct'+i)?.addEventListener('input',e=>{
        const ladder=progressionSetup.warmupLadder||[];
        ladder[i]=ladder[i]||{pct:40,reps:5};
        ladder[i].pct=Math.min(100,Math.max(1,Math.round(Number(e.target.value)||ladder[i].pct)));
        normalizeProgression(progressionSetup);schedulePersist();
      });
      $('#settingsWarmupReps'+i)?.addEventListener('input',e=>{
        const ladder=progressionSetup.warmupLadder||[];
        ladder[i]=ladder[i]||{pct:40,reps:5};
        ladder[i].reps=Math.max(1,Math.round(Number(e.target.value)||ladder[i].reps));
        normalizeProgression(progressionSetup);schedulePersist();
      });
    });
    /* Settings → default periodization editor (user 2026-09-11). Mirrors the
       program week-range editor: 8-week cycle, edits progressionSetup.weeklyRanges
       (the default new programs inherit via cloneProgression). */
    /* #99 H5: normalize weeklyRanges OUTSIDE render — render functions must not
       mutate state. Call this before any render that reads weeklyRanges. */
    /* #118 (user 2026-09-16): fills/truncates to the CYCLE length, not the
       program length. The schedule is a loop — programs shorter than the
       cycle use its first weeks, longer ones wrap (cycleWeek). A length of
       0 (Off) leaves the saved schedule untouched so toggling back on
       restores it. */
    function ensureWeeklyRanges(target,cycleLen){
      if(!Array.isArray(target.weeklyRanges))target.weeklyRanges=[];
      const len=Number(cycleLen);
      if(!(len===4||len===6||len===8||len===12))return;
      while(target.weeklyRanges.length<len)target.weeklyRanges.push(target.weeklyRanges.length%3===0?'strength':target.weeklyRanges.length%3===1?'hypertrophy':'endurance');
      target.weeklyRanges=target.weeklyRanges.slice(0,len);
    }
    /* #99: single canonical week-range pill renderer — replaces the duplicated
       markup in renderSettingsWeekRanges and renderWeekRanges. */
    function weekRangePills(preset, pillAttr, index) {
      /* QA batch (user 2026-09-21, #14): only visible presets — legacy 'open'
         stays resolvable but is never offered. */
      return VISIBLE_REP_PRESETS.map(key=>{const value=REP_PRESETS[key];
        const short=value.amrap?'AMRAP':`${value.min}–${value.max}`;
        return `<button type="button" class="rep-preset" ${pillAttr}="${index}" data-preset="${key}" aria-pressed="${key===preset}">${short}</button>`;
      }).join('');
    }
    /* Renders one week-range preset row in Settings. */
    function weekRangeRow(preset, index, pillAttr) {
      return `<div class="week-range-row"><strong>Week ${index+1}</strong><div class="week-range-pills" role="group" aria-label="Week ${index+1} rep range">${weekRangePills(preset,pillAttr,index)}</div></div>`;
    }
    /* Renders the week-range presets section in Settings. */
    function renderSettingsWeekRanges(){
      const list=$('#settingsWeekRangeList');if(!list)return;
      /* #118: the default schedule is a cycle — exactly cycleLength rows. */
      ensureWeeklyRanges(progressionSetup,normalizeCycleLength(progressionSetup));
      list.innerHTML=progressionSetup.weeklyRanges.map((preset,index)=>weekRangeRow(preset,index,'data-settings-week-pill')).join('');
      list.querySelectorAll('[data-settings-week-pill]').forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.settingsWeekPill);progressionSetup.weeklyRanges[index]=button.dataset.preset;list.querySelectorAll(`[data-settings-week-pill="${index}"]`).forEach(other=>other.setAttribute('aria-pressed',String(other===button)));schedulePersist();}));
    }
    /* #420 (user 2026-09-13): the active program's weekly %1RM wave, visible
       in Settings → progression defaults. Read-only — edits happen in the
       program builder. Hidden when there is no active %1RM program. */
    function renderSettingsPctWave(){
      const wrap=$('#settingsPctWaveWrap'),list=$('#settingsPctWaveList');
      if(!wrap||!list)return;
      /* #420 (user 2026-09-13, v1.646): the wave section only displays when
         the "Vary % of 1RM by week" DEFAULT is toggled on in Settings —
         gating on progressionSetup.pctWave, not on the active program. */
      if(!progressionSetup.pctWave){
        wrap.hidden=true;list.innerHTML='';return;
      }
      const program=workoutState&&workoutState.activeProgram;
      const target=program&&program.progression;
      const length=program?Math.max(1,Math.min(52,Number(program.length)||8)):0;
      /* #420 (user 2026-09-13): normalize before the visibility check. A
         pctWave program whose weeklyPcts was never persisted (or was saved
         before the array existed) must still render — ensureWeeklyPcts
         fills the arrays — instead of hiding the section. */
      if(target&&target.pctWave&&length)ensureWeeklyPcts(target,length);
      if(!target||!target.pctWave||!length){
        wrap.hidden=true;list.innerHTML='';return;
      }
      wrap.hidden=false;
      const nameEl=$('#settingsPctWaveProgram');
      if(nameEl)nameEl.textContent=program.name||'';
      list.innerHTML=target.weeklyPcts.map((pct,index)=>{
        const rangeLabel=programRangeLabel(programRangeForWeek({progression:target},index+1));
        return weekPctRow(clampPct1RM(Number(pct)||target.percentOf1RM||75),!!target.weeklyDeloads[index],index,rangeLabel);
      }).join('');
      /* Read-only: the rows render with the program-builder markup, but the
         inputs and deload toggles are disabled here. */
      list.querySelectorAll('input,button').forEach(el=>{el.disabled=true;});
    }
    $('#editPctWaveInProgram')?.addEventListener('click',()=>{if(typeof showProgram==='function')showProgram();});
    /* Syncs the periodization (wave) UI with the stored progressionSetup. */
    function syncSettingsPeriodization(){
      const wrap=$('#settingsPeriodizationWrap');if(!wrap)return;
      /* #118: the wrap shows when the default cycle is on (Off = 0). */
      const on=normalizeCycleLength(progressionSetup)>0;
      wrap.hidden=!on;
      if(on)renderSettingsWeekRanges();
      else{const panel=$('#settingsUndulatingPanel');if(panel)panel.hidden=true;}
    }
    $('#editDefaultPeriodization')?.addEventListener('click',()=>{const panel=$('#settingsUndulatingPanel');if(!panel)return;panel.hidden=!panel.hidden;if(!panel.hidden)renderSettingsWeekRanges();});
    /* QA batch (user 2026-09-22): the vary-rep-ranges default is a toggle
       again — the week pills only appear when it's on. Turning it on
       restores the last cycle length (4 wks when there isn't one). */
    function syncSettingsCycleUI(){
      const on=normalizeCycleLength(progressionSetup)>0;
      const toggle=$('#settingsVaryRangesToggle');
      if(toggle){toggle.setAttribute('aria-pressed',String(on));toggle.setAttribute('aria-label',`Vary rep ranges by week ${on?'on':'off'}`);}
      const wrap=$('#settingsCycleWrap');if(wrap)wrap.hidden=!on;
      syncCyclePills('#settingsCyclePills',progressionSetup);
      syncSettingsPeriodization();
    }
    document.querySelectorAll('#settingsCyclePills [data-cycle-length]').forEach(button=>button.addEventListener('click',()=>{progressionSetup.cycleLength=Number(button.dataset.cycleLength);progressionSetup.undulating=progressionSetup.cycleLength>0;syncSettingsCycleUI();schedulePersist();}));
    $('#settingsVaryRangesToggle')?.addEventListener('click',()=>{const on=!(normalizeCycleLength(progressionSetup)>0);progressionSetup.cycleLength=on?(normalizeCycleLength(progressionSetup)>0?normalizeCycleLength(progressionSetup):4):0;progressionSetup.undulating=on;syncSettingsCycleUI();schedulePersist();});
    /* #405 (user 2026-09-14): progression off-switch — the master default for
       new programs. Flipping it immediately dims/undims the rest of the
       section; per-program toggles can still override for a single program. */
    $('#progressionOffToggle')?.addEventListener('click',()=>{progressionSetup.progressionOff=!progressionSetup.progressionOff;const off=!!progressionSetup.progressionOff;const toggle=$('#progressionOffToggle');if(toggle){toggle.setAttribute('aria-pressed',String(!off));toggle.setAttribute('aria-label',`Progression ${off?'off':'on'}`);}const card=$('#progressionDefaultsCard');if(card)card.classList.toggle('progression-off',off);schedulePersist();});
    /* #420 (user 2026-09-13): the %1RM wave default for new programs.
       Flipping the default immediately shows/hides the wave section below —
       no reload needed (v1.646). QA batch (user 2026-09-22): Auto Deload
       removed — the wave-vs-deload availability dance is gone with it. */
    $('#settingsPctWaveDefaultToggle').addEventListener('click',()=>{progressionSetup.pctWave=!progressionSetup.pctWave;const toggle=$('#settingsPctWaveDefaultToggle');toggle.setAttribute('aria-pressed',String(!!progressionSetup.pctWave));toggle.setAttribute('aria-label',`Vary percent of 1RM by week ${progressionSetup.pctWave?'on':'off'}`);renderSettingsPctWave();schedulePersist();});
    $('#programProgressionInfoButton').addEventListener('click',()=>$('#progressionInfoDialog').showModal());
    $('#closeProgressionInfo').addEventListener('click',()=>$('#progressionInfoDialog').close());
    $('#doneProgressionInfo').addEventListener('click',()=>$('#progressionInfoDialog').close());
    $('#exportDataButton').addEventListener('click',()=>{downloadWorkoutBackup();showToast('Backup downloaded.');});
    $('#importCsvButton').addEventListener('click',()=>{if(typeof openCsvImport==='function')openCsvImport();});
    $('#deleteAllDataButton').addEventListener('click',()=>{showModalPinned($('#deleteAllDialog'));});
    $('#cancelDeleteAll').addEventListener('click',()=>$('#deleteAllDialog').close());
    $('#keepDeleteAll').addEventListener('click',()=>$('#deleteAllDialog').close());
    $('#confirmDeleteAll').addEventListener('click',()=>{
      $('#deleteAllDialog').close();
      /* Shared wipe (efficiency pass 2026-09-12): in-memory first so the
         pagehide persist can't resurrect anything, then localStorage. */
      /* Persona QA 2026-09-16: the wipe's IndexedDB delete is async — the
         reload must wait for it, or boot resurrects the still-present blob. */
      const wipeDone=wipeLocalUserData();
      try{Promise.resolve(wipeDone).then(()=>location.reload(),()=>location.reload());}catch(_){location.reload();}
    });
    /* #99 B29: standalone-key migrations run before anything reads them. */
    if(typeof runLocalKeyMigrations==='function'){try{runLocalKeyMigrations();}catch(_){}}
    try{
      themeState.dark=(localStorage.getItem('workout-theme')||'light')==='dark';
      themeState.name=localStorage.getItem('workout-theme-name')||'cruciferous';
      if(!['cruciferous','rosepine','macchiato','mocha'].includes(themeState.name))themeState.name='cruciferous';
      if(DARK_FLAVORS.includes(themeState.name))themeState.darkFlavor=themeState.name;
      try{const savedLight=localStorage.getItem('workout-theme-light');if(LIGHT_THEMES.includes(savedLight))themeState.lightName=savedLight;}catch(_){}
      try{desktopLayout=localStorage.getItem('workout-desktop-layout')==='1';}catch(_){}
    }catch(_){}
    applyTheme();applySwipeSets();applyDesktopLayout();
    $('#closeReplaceDraft').addEventListener('click',()=>{pendingRepeatWorkout=null;$('#replaceDraftDialog').close();});
    $('#keepCurrentDraft').addEventListener('click',()=>{pendingRepeatWorkout=null;$('#replaceDraftDialog').close();});
    $('#confirmReplaceDraft').addEventListener('click',()=>{const workout=pendingRepeatWorkout;pendingRepeatWorkout=null;$('#replaceDraftDialog').close();if(workout)repeatWorkout(workout,true);});
    /* The finish review dialog (#43, #199, #262, #501): a single prompt
       covering unfilled values and unmarked sets — "Mark all complete" /
       "Log incomplete sets" / "Finish anyway" / "Keep editing". */
    $('#dashboardNav').addEventListener('click', () => goTab(showDashboard));
    $('#workoutsNav').addEventListener('click', () => {
      // Re-tapping the active Workout tab collapses to the start screen
      // (#129 — the draft is autosaved, never disturbed). Otherwise switches tabs.
      if (state.activeView === 'workout') { collapseWorkoutToStart(); return; }
      goTab(showWorkouts);
    });
    /* Program tab (user 2026-09-12): always lands on the program home
       (cover), never the last sub-page seen. */
    $('#programNav').addEventListener('click', showProgramHome);
    $('#statsNav').addEventListener('click', () => goTab(showStats));
    /* #98 desktop header (2026-09-16): the header tabs proxy the bottom-nav
       buttons, so view-switching behavior is identical in desktop mode
       (programmatic .click() fires handlers even though the bottom nav is
       display:none). The brand goes Home; the header gear proxies the
       top-bar gear. */
    const desktopNavTarget = { dashboard:'#dashboardNav', library:'#libraryNav', workout:'#workoutsNav', program:'#programNav', stats:'#statsNav' };
    document.querySelectorAll('#desktopHeader .desktop-tab').forEach(tab => {
      tab.addEventListener('click', () => { $(desktopNavTarget[tab.dataset.view])?.click(); });
    });
    $('#desktopBrand')?.addEventListener('click', e => { e.preventDefault(); $('#dashboardNav')?.click(); });
    $('#desktopSettings')?.addEventListener('click', () => { $('#topBarSettings')?.click(); });
    /* The gear stays visible (active) on Settings — re-tapping it must not push
       a duplicate history entry, or the first Back tap just re-shows Settings
       (#27). Like the bottom tabs, re-tap scrolls to top instead. */
    $('#topBarSettings').addEventListener('click', () => {
      if (state.activeView === 'settings') { window.scrollTo({top:0, behavior:'auto'}); return; }
      goTab(showSettings);
    });
    $('#detailFavToggle')?.addEventListener('click', () => toggleFavorite(state.selected));
    /* #129 rework: starting a saved workout while a session is live asks first. */
    $('#closeStartSavedConflict')?.addEventListener('click',()=>{pendingConflictStart=null;$('#startSavedConflictDialog').close();});
    $('#backToLiveWorkout')?.addEventListener('click',()=>{pendingConflictStart=null;$('#startSavedConflictDialog').close();state.workoutEditorOpen=true;renderWorkoutScreen();window.scrollTo({top:0});});
    $('#switchToSavedWorkout')?.addEventListener('click',()=>{const fn=pendingConflictStart;pendingConflictStart=null;$('#startSavedConflictDialog').close();if(fn)fn();});
    $('#liveWorkoutChip')?.addEventListener('click', () => {
      if (!workoutState.draft) return;
      /* The pill disappears and its dot "pleasantly moves" next to the Workout
         header (user 2026-09-12): fly a dot clone from the chip to the title
         dot's resting spot, then fade the real title dot in. */
      const chip = $('#liveWorkoutChip');
      const startRect = chip?.querySelector('.live-dot')?.getBoundingClientRect();
      showWorkouts();
      state.workoutEditorOpen = true;
      renderWorkoutScreen(); window.scrollTo({top:0});
      const titleDot = $('#liveTitleDot');
      const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (startRect && titleDot && !titleDot.hidden && !reduceMotion) {
        const endRect = titleDot.getBoundingClientRect();
        const fly = document.createElement('span');
        fly.className = 'live-dot live-dot-fly';
        fly.style.left = startRect.left + 'px';
        fly.style.top = startRect.top + 'px';
        fly.style.width = startRect.width + 'px';
        fly.style.height = startRect.height + 'px';
        document.body.appendChild(fly);
        const dx = (endRect.left + endRect.width / 2) - (startRect.left + startRect.width / 2);
        const dy = (endRect.top + endRect.height / 2) - (startRect.top + startRect.height / 2);
        /* #184: the title dot's live-pulse CSS animation overrides inline
           opacity (animations beat inline styles in the cascade), so
           opacity='0' alone never hid it — two dots showed during the
           flight. Kill the animation too, restore both when the fly lands. */
        titleDot.style.animation='none';
        titleDot.style.opacity = '0';
        fly.animate([
          { transform: 'translate(0,0)', opacity: 1 },
          { transform: `translate(${dx}px,${dy}px)`, opacity: 1 }
        ], { duration: 420, easing: 'cubic-bezier(.25,.8,.3,1)' }).onfinish = () => {
          fly.remove();
          titleDot.style.animation='';
          titleDot.style.opacity = '';
        };
      }
    });
    /* Title-bar back is the repeatable pattern (user 2026-09-11): it backs
       out of every workout sub-screen. Backing out of the builder autosaves —
       the draft survives on the continue card; only Discard deletes it.
       Backing out of a program-workout edit returns to the program page. */
    $('#topBarBack').addEventListener('click', () => {
      if (state.activeView === 'detail') backFromExerciseDetail();
      else if (state.activeView === 'settings') backFromSettings();
      else if (state.activeView === 'program' && state.programWorkoutUid) { state.programWorkoutUid = null; renderProgram(); window.scrollTo({top:0}); }
      /* #455: back out of a saved-program preview cover to the program page. */
      else if (state.activeView === 'program' && state.savedProgramPreviewId) { state.savedProgramPreviewId = null; renderProgram(); window.scrollTo({top:0}); }
      else if (state.activeView === 'program' && $('#createProgram')?.dataset.editing === 'true') requestCancelProgramEdit();
      /* Completed-workout detail (user 2026-09-12): the chevron is the one
         and only back affordance — route it through backFromWorkoutDetail()
         so it returns to the recorded destination (dashboard / program /
         history / …), not just the workout start screen. */
      /* Completed-log detail (user 2026-09-12): the detail is a pushed page,
         so the chevron pops exactly like system back — the two never disagree.
         Unpushed (the post-finish flash) keeps the in-app return. */
      else if (state.activeView === 'workout' && !$('#workoutComplete').hidden) {
        if (history.state?.sub === 'complete') history.back();
        else backFromWorkoutDetail();
      }
      /* Log list (user 2026-09-12): also a pushed page — chevron and swipe-back
         agree. Rare in-app arrivals with no list entry collapse in place. */
      else if (state.activeView === 'workout' && state.workoutHistoryOpen) {
        if (history.state?.sub === 'history') history.back();
        else hideWorkoutHistory();
      }
      else if (state.activeView === 'workout') { if (!collapseWorkoutSubScreen()) history.back(); }
      else history.back();
    });
    /* "+ Add saved workout" with a draft open: keep the draft, or delete it
       and start fresh (user 2026-09-11). */
    $('#closeBuilderDraftExists')?.addEventListener('click',()=>$('#builderDraftExistsDialog').close());
    $('#keepBuilderDraft')?.addEventListener('click',()=>$('#builderDraftExistsDialog').close());
    $('#deleteBuilderDraft')?.addEventListener('click',()=>{ const src=pendingBuilderSource; $('#builderDraftExistsDialog').close(); clearBuilderDraft(); openSavedBuilder(src); });
    /* Program setup form controls edit the form draft, never the global
       defaults (user 2026-09-10).
       #420 (user 2026-09-13): these handlers mutate ONLY the detached
       programFormProgression() draft. schedulePersist() persists
       workoutState.activeProgram — which EXCLUDES the draft — so calling it
       here was a no-op that faked persistence. It is deliberately NOT called
       from draft-only handlers. The draft reaches the live program and the
       blob only via createProgram() ("Create active program" / "Save
       program changes", including the new Save action on the
       discard-changes dialog). */
    /* QA batch (user 2026-09-22): program RPE trigger is a 7/8/9/On-completion
       pill row, same as Settings — 'completion' is stored as a string. */
    document.querySelectorAll('#programRpePills [data-rpe-threshold]').forEach(button=>button.addEventListener('click',()=>{const v=button.dataset.rpeThreshold;programFormProgression().threshold=v==='completion'?'completion':Number(v);document.querySelectorAll('#programRpePills [data-rpe-threshold]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
    $('#progressionIncrementType').addEventListener('change',e=>{programFormProgression().incrementType=e.target.value;syncProgramIncrementUnit();});
    $('#progressionIncrementValue').addEventListener('input',e=>{programFormProgression().incrementValue=Number(e.target.value)||5;});
    /* %1RM wave (#54, v1.001). QA batch (user 2026-09-22): Auto Deload
       removed entirely — manual per-week deload flags live in the wave
       panel (#478). */
    $('#progressionPercentOf1RM').addEventListener('input',e=>{programFormProgression().percentOf1RM=clampPct1RM(Number(e.target.value)||75);});
    /* #405 (user 2026-09-14): per-program progression off-switch. */
    $('#programProgressionOffToggle')?.addEventListener('click',()=>{const d=programFormProgression();d.progressionOff=!d.progressionOff;syncProgramForm();schedulePersist();});
    /* Persona P11#10 (2026-09-22): same no-lying rule as the Settings pair
       above — clamp both directions and write the stored values back. */
    $('#programRepMin').addEventListener('input',e=>{const d=programFormProgression(),r=d.defaultRange;r.min=Math.max(1,Math.round(Number(e.target.value)||1));if(r.max!=null&&r.max<r.min)r.max=r.min;e.target.value=r.min;const mx=$('#programRepMax');if(mx&&r.max!=null)mx.value=r.max;r.preset='custom';document.querySelectorAll('#programRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));});
    $('#programRepMax').addEventListener('input',e=>{const d=programFormProgression(),r=d.defaultRange,v=e.target.value.trim();r.max=v===''?null:Math.max(r.min,Math.round(Number(v)||r.min));if(r.max!=null)e.target.value=r.max;r.preset='custom';document.querySelectorAll('#programRepPresets [data-rep-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));});
    document.querySelectorAll('#settingsRepPresets [data-rep-preset]').forEach(button=>button.addEventListener('click',()=>{applyRepPreset(button.dataset.repPreset);schedulePersist();}));
    document.querySelectorAll('#programRepPresets [data-rep-preset]').forEach(button=>button.addEventListener('click',()=>{applyRepPreset(button.dataset.repPreset,programFormProgression());}));
    document.querySelectorAll('#programSchemePills [data-scheme]').forEach(button=>button.addEventListener('click',()=>{programFormProgression().scheme=button.dataset.scheme;syncProgramForm();}));
    /* QA batch (user 2026-09-22): vary-ranges is a toggle again on the
       program draft — the week pills only appear when it's on. Draft-only:
       no schedulePersist (#420). */
    document.querySelectorAll('#programCyclePills [data-cycle-length]').forEach(button=>button.addEventListener('click',()=>{const d=programFormProgression();d.cycleLength=Number(button.dataset.cycleLength);d.undulating=d.cycleLength>0;syncProgramCycleUI(d);renderWeekRanges(d);}));
    $('#varyRangesToggle')?.addEventListener('click',()=>{const d=programFormProgression();const on=!(normalizeCycleLength(d)>0);d.cycleLength=on?(normalizeCycleLength(d)>0?normalizeCycleLength(d):4):0;d.undulating=on;syncProgramCycleUI(d);renderWeekRanges(d);});
    $('#pctWaveToggle').addEventListener('click',()=>{const d=programFormProgression();d.pctWave=!d.pctWave;ensureWeeklyPcts(d,Number($('#programLength')?.value)||8);$('#pctWaveToggle').setAttribute('aria-pressed',String(d.pctWave));$('#pctWaveToggle').setAttribute('aria-label',`Vary percent of 1RM by week ${d.pctWave?'on':'off'}`);$('#pctWavePanel').hidden=!d.pctWave;renderWeekPcts(d);});
    $('#programLength').addEventListener('input',()=>{renderWeekRanges();renderWeekPcts();});
    /* Per-exercise progression overrides are edited inside each program
       workout directly — no separate management screen (#45). */
    document.querySelectorAll('[data-treatment]').forEach(button=>button.addEventListener('click',()=>{progressionSetup.treatment=button.dataset.treatment;document.querySelectorAll('[data-treatment]').forEach(row=>row.setAttribute('aria-pressed',String(row===button)));schedulePersist();}));
    $('#createProgram').addEventListener('click', createProgram);
    /* #509: secondary builder path — parks the form in the saved-programs
       library instead of making it active. */
    $('#saveProgramToLibrary').addEventListener('click', saveProgramToLibrary);
    $('#startBlankWorkout').addEventListener('click', () => startBlankWorkout());
    /* #504 (v1.8): the start hero's own primary — the same blank-workout
       action, without scrolling anywhere. */
    $('#startBlankHero')?.addEventListener('click',()=>startBlankWorkout());
    /* #504: the hero's secondary route — the saved list already sits below
       the hero, so just scroll it into view. */
    $('#browseSavedWorkouts')?.addEventListener('click',()=>{
      const list=$('#savedWorkoutList');
      if(list)list.scrollIntoView({behavior:'smooth',block:'start'});
    });
    $('#repeatLastWorkout').addEventListener('click',()=>repeatWorkout(workoutState.completed.slice().sort(sortByRecencyDesc)[0])); /* #99 A13: latest by completion */
    $('#addWorkoutExercise').addEventListener('click', () => {
      workoutState.pickerMode='draft';workoutState.programWorkoutTarget=null;
      $('#exercisePickerTitle').textContent='Add exercise';
      $('#exercisePickerTitle').nextElementSibling.textContent='Choose one or more movements for this workout.';
      $('#exercisePickerSearch').value = '';
      preparePickerFilters();
      resetPickerSession();
      /* #192: remember where the user was — closing the picker restores this
         position instead of snapping to the new card. */
      workoutState.pickerScrollY=window.scrollY;
      renderExercisePicker();
      lockPickerBackground(); /* #510: pin the page behind the modal */
      $('#exercisePickerDialog').showModal();
      requestAnimationFrame(() => $('#exercisePickerSearch').focus());
    });
    // Bottom "Add exercise" button (#112) — same action as the top + button.
    $('#addWorkoutExerciseBottom')?.addEventListener('click', () => $('#addWorkoutExercise').click());
    /* #192 (user 2026-09-12): adding exercises must not move the viewport.
       The old #143 behavior scrolled to the newest card on close — the snap
       felt wrong. The new cards render expanded behind the dialog on every
       tap already, so on close we just restore the exact scroll position
       from when the picker opened (exercisePickerCloseScrollY). Runs in a
       frame so it wins over the dialog's focus-restore scroll. */
    const afterExercisePicker=()=>{if(workoutState.pickerMode==='template'){schedulePersist();if(typeof refreshTemplateViews==='function')refreshTemplateViews();}if(state.savedBuilder&&state.builderOpen&&typeof renderSavedBuilder==='function')renderSavedBuilder();
      if(workoutState.pickerMode!=='template'&&workoutState.draft&&typeof pickerSessionAdded!=='undefined'&&pickerSessionAdded.size){
        requestAnimationFrame(()=>{window.scrollTo({top:exercisePickerCloseScrollY(),behavior:'auto'});});
      }};
    $('#closeExercisePicker').addEventListener('click', () => {$('#exercisePickerDialog').close();afterExercisePicker();});
    $('#doneExercisePicker').addEventListener('click', () => {
      /* user 2026-09-17 (Hevy-style picker): in the workout add-sheet the
         footer commits the staged selection ("Add N exercises"); the ×
         button still closes without adding. Other modes just close. */
      if(workoutState.pickerMode==='draft'&&!workoutState.pickerSwapUid&&typeof commitPickerStaged==='function')commitPickerStaged();
      $('#exercisePickerDialog').close();afterExercisePicker();
    });
    /* #510: release the background scroll lock on EVERY close path — the ×
       and Done buttons, the swap-mode close, and the Esc key (native cancel
       fires close too). Runs before afterExercisePicker's own scroll restore
       so both agree on the pre-open position. */
    $('#exercisePickerDialog').addEventListener('close', unlockPickerBackground);
    /* Workout focus (2026-09-10): one tap applies a rep-range preset to every
       reps-tracked exercise in the draft. Explicit choice, so profiles become
       custom (the engine follows the chosen zone instead of last session's).
       #53: when the tap would wipe per-exercise ranges the user set themselves,
       confirm first — a silent one-tap clobber of a careful setup was the bug.
       Taps that change nothing already in place apply without a prompt. */
    /* Resolves a focus preset's display name ('Custom' when no preset matches). */
    function focusPresetName(preset){
      return (preset.amrap||preset.openTop) ? preset.label : `${preset.label} · ${preset.min}–${preset.max}`;
    }
    /* Names the fields a focus preset would clobber (for the reset-warning copy). */
    function focusPresetClobbers(preset){
      return (workoutState.draft?.exercises||[]).filter(item=>{
        const ex=resolveExercise(item.exerciseId);
        if(exerciseTracking(item,ex)==='time')return false;
        const p=item.progression||{};
        return p.custom&&(p.min!==preset.min||p.max!==preset.max||!!p.openTop!==!!preset.openTop||!!p.amrap!==!!preset.amrap);
      });
    }
    /* Applies the workout-focus preset (or 'custom' clear) to every exercise in the draft. */
    function applyWorkoutFocus(key){
      const preset=REP_PRESETS[key]; if(!preset||!workoutState.draft)return;
      workoutState.draft.focusPreset=key;
      workoutState.draft.exercises.forEach(item=>{
        const ex=resolveExercise(item.exerciseId);
        if(exerciseTracking(item,ex)==='time')return;
        item.progression={...(item.progression||{}),preset:key,min:preset.min,max:preset.max,openTop:!!preset.openTop,amrap:!!preset.amrap,custom:true};
      });
      prepareDraftProgression(workoutState.draft,freeformProgressionConfig());
      /* #92 (user 2026-09-11): don't full re-render the exercise list here —
         the innerHTML teardown/rebuild flashes unpleasantly. Update the
         rep-range placeholders in place instead; the data is already correct
         and the next natural re-render picks up everything else. */
      updateFocusPlaceholders();
      /* #547 (user 2026-09-19): the placeholders weren't enough — the
         per-card suggestion rows kept the pre-focus targets. Refresh just
         the rows (no card teardown, no flash). */
      if(typeof refreshCardSuggestionRows==='function')refreshCardSuggestionRows();
      renderWorkoutProgression(); syncWorkoutFocusPills(); markDraftSaved();
    }
    /* #92: surgically refresh the reps-input placeholders after a focus-pill
       change, without rebuilding the exercise cards. */
    function updateFocusPlaceholders(){
      const draft=workoutState.draft; if(!draft)return;
      draft.exercises.forEach(item=>{
        const card=document.querySelector(`[data-workout-exercise="${CSS.escape(item.uid)}"]`);
        if(!card)return;
        const p=item.progression||{};
        // Time-based exercises use seconds, never rep ranges (#110).
        if(p.mode==='time')return;
        /* #99 H4: reuse the canonical range text — no duplicated if/else chain. */
        const text=rangePlaceholder(p,false).text;
        if(!text)return;
        card.querySelectorAll('.reps-input').forEach(input=>{input.placeholder=text;});
      });
    }
    let pendingFocusKey=null;
    document.querySelectorAll('[data-workout-focus]').forEach(button=>button.addEventListener('click',()=>{
      if(!workoutState.draft)return;
      const key=button.dataset.workoutFocus;
      /* Tapping the selected pill clears the focus (user 2026-09-12) — the
         old "No focus" pill is gone; per-exercise ranges already applied stay
         as the exercises' own settings. */
      if(key===(workoutState.draft.focusPreset||'')){workoutState.draft.focusPreset=null;syncWorkoutFocusPills();markDraftSaved();return;}
      const preset=REP_PRESETS[key]; if(!preset)return;
      const clobbered=focusPresetClobbers(preset);
      if(!clobbered.length){applyWorkoutFocus(key);return;}
      pendingFocusKey=key;
      $('#focusConfirmCopy').textContent=`This replaces the rep ranges you set on ${clobbered.length} exercise${clobbered.length===1?'':'s'} with ${focusPresetName(preset)}. Timed exercises are untouched.`;
      $('#focusConfirmDialog').showModal();
    }));
    $('#closeFocusConfirm').addEventListener('click',()=>$('#focusConfirmDialog').close());
    $('#focusConfirmCancel').addEventListener('click',()=>$('#focusConfirmDialog').close());
    $('#focusConfirmApply').addEventListener('click',()=>{$('#focusConfirmDialog').close();if(pendingFocusKey){applyWorkoutFocus(pendingFocusKey);pendingFocusKey=null;}});
    $('#exercisePickerSearch').addEventListener('input', renderPickerList);
    /* Picker filter panel: the Exercises tab's selector interface inside the
       add-exercise dialog (user 2026-09-10). */
    $('#pickerFilterToggle').addEventListener('click',()=>{
      const panel=$('#pickerFilterPanel'),open=panel.classList.toggle('open');
      $('#pickerFilterToggle').setAttribute('aria-expanded',String(open));
    });
    $('#pickerMuscleOptions').addEventListener('click',event=>{
      const b=event.target.closest('[data-picker-muscle]');if(!b)return;
      const m=b.dataset.pickerMuscle;
      if(pickerFilters.muscles.has(m))pickerFilters.muscles.delete(m);else pickerFilters.muscles.add(m);
      renderPickerFilterState();renderPickerList();
    });
    $('#pickerFavoritesToggle').addEventListener('click',()=>{pickerFilters.onlyFavorites=!pickerFilters.onlyFavorites;renderPickerFilterState();renderPickerList();});
    $('#pickerCustomToggle').addEventListener('click',()=>{pickerFilters.onlyCustom=!pickerFilters.onlyCustom;renderPickerFilterState();renderPickerList();});
    $('#pickerEquipmentFilter').addEventListener('change',event=>{pickerFilters.equipment=event.target.value;renderPickerFilterState();renderPickerList();});
    $('#pickerClearMuscles').addEventListener('click',()=>{resetPickerFilters();renderPickerFilterState();renderPickerList();});
    $('#workoutName').addEventListener('input', event => { if (workoutState.draft) { workoutState.draft.name = event.target.value; markDraftSaved(); } });
    /* The native date input sits invisibly over the pretty date display, so
       tapping it opens the OS date picker directly (showPicker on a hidden
       input was unreliable on iOS). Both input and change are wired because
       some browsers only fire change for picker selections. */
    const workoutDateChanged=event=>{if(workoutState.draft&&event.target.value){workoutState.draft.date=event.target.value;markDraftSaved();}renderWorkoutDateDisplay();};
    $('#workoutDate').addEventListener('input',workoutDateChanged);
    $('#workoutDate').addEventListener('change',workoutDateChanged);
    $('#closeSetTags').addEventListener('click', () => $('#setTagsDialog').close());
    $('#doneSetTags').addEventListener('click', () => $('#setTagsDialog').close());
    $('#closeExerciseTags').addEventListener('click', () => $('#exerciseTagsDialog').close());
    $('#doneExerciseTags').addEventListener('click', () => $('#exerciseTagsDialog').close());
    $('#addExerciseTagButton').addEventListener('click', addExerciseTag);
    $('#newExerciseTagInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addExerciseTag(); } });
    $('#addTagButton').addEventListener('click', addTag);
    $('#newTagInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } });
    $('#cancelWorkout').addEventListener('click', () => { showModalPinned($('#discardDraftDialog')); });
    const doDiscardDraft=() => {
      workoutState.draft = null;
      state.shareReturn=null; /* #217: discarding a share-started session clears its landing return. */
      $('#workoutComplete').hidden = true;
      $('#workoutError').textContent = '';
      persistNow();
      renderWorkoutScreen();
    };
    $('#closeDiscardDraft').addEventListener('click', () => {discardingBuilder=false;startNewAfterDiscard=false;$('#discardDraftDialog').close();});
    $('#keepDraftButton').addEventListener('click', () => {discardingBuilder=false;startNewAfterDiscard=false;$('#discardDraftDialog').close();});
    /* #99 C3: `discardingBuilder` is declared in saved-workouts.js (let, top
       level). Classic scripts share one global scope and index.html loads
       saved-workouts.js before this file, so the declaration lives elsewhere —
       grep the whole js dir when a name seems undeclared. */
    $('#confirmDiscardDraft').addEventListener('click', () => { const startNew=startNewAfterDiscard; startNewAfterDiscard=false; $('#discardDraftDialog').close(); if(discardingBuilder){discardingBuilder=false;closeBuilderToReturn(true);} else { doDiscardDraft(); if(startNew) startBlankWorkout(); } });
    /* Esc/backdrop dismissal of the discard dialog also clears the flag. */
    $('#discardDraftDialog').addEventListener('close', () => { startNewAfterDiscard=false; });
    $('#finishWorkout').addEventListener('click', () => finishWorkout());
    /* Single review prompt on finish (2026-09-10, #43): unfilled values and
       unmarked sets are reviewed together — mark all complete, log
       incomplete sets (values + unchecked flags kept as-is), finish anyway
       (deleting the unfinished sets), or keep editing. */
    $('#closeReviewSets').addEventListener('click',()=>$('#reviewSetsDialog').close());
    $('#reviewSetsCancel').addEventListener('click',()=>$('#reviewSetsDialog').close());
    $('#reviewSetsComplete').addEventListener('click',()=>{$('#reviewSetsDialog').close();const draft=workoutState.draft;if(draft){draft.exercises.forEach(item=>item.sets.forEach(set=>{set.complete=true;}));renderWorkoutExercises();markDraftSaved();}finishWorkout(true);});
    /* #501: per-set toggles in the review list — flip the draft set's flag
       and re-render the dialog with the remaining unmarked sets. Toggling
       the last unmarked set is "Mark all complete" by hand, so finish
       directly instead of showing an empty dialog. */
    $('#reviewSetsList').addEventListener('click',(e)=>{
      const btn=e.target.closest('.review-set-row');if(!btn)return;
      const draft=workoutState.draft;if(!draft)return;
      const item=draft.exercises.find(it=>it.uid===btn.dataset.exerciseUid)||draft.exercises[Number(btn.dataset.exerciseIndex)]||null;
      const set=item&&(item.sets.find(s=>s.uid===btn.dataset.setUid)||item.sets[Number(btn.dataset.setIndex)])||null;
      if(!set)return;
      set.complete=!set.complete;
      renderWorkoutExercises();markDraftSaved();
      $('#reviewSetsDialog').close();
      if(!unmarkedSetsWithData(draft).length){finishWorkout(true);return;}
      showReviewSetsDialog(draft);
    });
    /* user 2026-09-16 #535 (missing-values extension reverted 2026-09-17):
       "Log incomplete sets" — finishes with every set's usable values AND
       their unchecked flags intact. Offered only when every set is
       value-valid (the valid-but-unmarked variant); the missing-values
       variant is back to Finish anyway + Keep editing. */
    $('#reviewSetsLogIncomplete').addEventListener('click',()=>{
      $('#reviewSetsDialog').close();
      const draft=workoutState.draft;if(!draft)return;
      renderWorkoutExercises();markDraftSaved();
      finishWorkout(true);
    });
    $('#reviewSetsDelete').addEventListener('click',()=>{
      $('#reviewSetsDialog').close();
      const draft=workoutState.draft;
      if(draft){
        /* #43: bulk delete removes only fully-empty sets (isEmptySet) and prunes exercises left with no sets — never sets with partial values. */
        let removed=0,removedEx=0;
        draft.exercises.forEach(item=>{const before=item.sets.length;item.sets=item.sets.filter(set=>!isEmptySet(set));removed+=before-item.sets.length;});
        const beforeEx=draft.exercises.length;draft.exercises=draft.exercises.filter(item=>item.sets.length);removedEx=beforeEx-draft.exercises.length;
        renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();
        if(removed||removedEx)showToast(`Deleted ${removed} empty set${removed===1?'':'s'}${removedEx?` and ${removedEx} empty exercise${removedEx===1?'':'s'}`:''}.`);
        /* #189: one modal, not two. If anything still has invalid values it
           genuinely needs the user's eyes — re-show the ONE review dialog.
           Otherwise everything left is value-valid: mark the sets complete
           and finish without a second prompt. */
        const outcome=reviewDeleteEmptiesOutcome(draft);
        if(outcome==='refinish'){finishWorkout();return;}
        if(outcome==='finish'){draft.exercises.forEach(item=>item.sets.forEach(set=>{set.complete=true;}));renderWorkoutExercises();markDraftSaved();}
      }
      finishWorkout(true);
    });
    /* #262 (user 2026-09-13): "Finish anyway" drops every unfinished set
       (empty AND incomplete) and finishes in one tap — the user's deliberate
       decision, recorded on the workout. Partial values are dropped, never
       saved half-filled (never-nulls, user 2026-09-11). The old middle
       "Delete unfinished sets" button ran this identical operation and is
       gone; two buttons only. One dialog only (#189): after the drop
       everything left is value-valid, so it finishes directly without
       re-prompting. */
    function reviewFinishAfterDrop(){
      $('#reviewSetsDialog').close();
      const draft=workoutState.draft;
      if(draft){
        const dropped=dropInvalidSets(draft);
        renderWorkoutExercises();renderWorkoutProgression();markDraftSaved();
        const bits=[];
        if(dropped.droppedSets)bits.push(`${dropped.droppedSets} unfinished set${dropped.droppedSets===1?'':'s'}`);
        if(dropped.droppedExercises)bits.push(`${dropped.droppedExercises} empty exercise${dropped.droppedExercises===1?'':'s'}`);
        if(!draft.exercises.length)showToast('Finished — no sets were logged.');
        else if(bits.length)showToast(`Deleted ${bits.join(' and ')}.`);
      }
      finishWorkout(true,{finishedAnyway:true});
    }
    $('#reviewSetsFinishAnyway').addEventListener('click',reviewFinishAfterDrop);

    $('#searchInput').addEventListener('input', e => {
      state.query = e.target.value;
      $('#clearSearch').classList.toggle('visible', !!state.query);
      renderLibrary();
    });
    $('#clearSearch').addEventListener('click', () => {
      state.query = ''; $('#searchInput').value = ''; $('#clearSearch').classList.remove('visible'); renderLibrary(); $('#searchInput').focus();
    });
    $('#filterToggle').addEventListener('click', () => {
      const open = !$('#filterPanel').classList.contains('open');
      $('#filterPanel').classList.toggle('open', open);
      $('#filterToggle').setAttribute('aria-expanded', open);
    });
    $('#clearMuscles').addEventListener('click', () => { state.muscles.clear(); renderMuscleSelection(); renderLibrary(); });
    $('#equipmentFilter').addEventListener('change', e => { state.equipment = e.target.value; renderLibrary(); });
    $('#libraryNav').addEventListener('click', () => goTab(showLibrary));
    /* #99 C7: History-API router, back/forward half. Each view's show function
       (navigation.js) records its route with history.pushState({view, sub, ...});
       system Back/Forward fires this popstate listener with that recorded state.
       Dispatch order: share-preview back-out → share-return → hash/state match
       (dashboard, exercise detail, program/workout sub-screens) → view+sub pages. */
    window.addEventListener('popstate', e => {
      /* #265: backing out of a share preview clears the preview state first —
         otherwise the destination renders with a stale preview cached.
         #433 (user 2026-09-14): backing out of a drilled-in program workout
         restores the program card inside backOutOfSharePreview — the
         destination entry is the share entry, so the router must stop here
         instead of continuing to the workout tab. */
      if(backOutOfSharePreview()==='drill')return;
      /* #217: system Back from a share-started live workout — the editor is
         unpushed, so Back pops the re-marked share entry. Restore the landing
         from the stashed payload instead of routing to the entry below.
         One-shot: the stash is consumed on restore. An exercise detail
         drilled in from the editor keeps its drill return (back → editor),
         mirroring the drill-back restore below. */
      if(state.shareReturn&&e.state?.view==='workout'&&e.state?.sub==='share'){
        const exRet217=state.exerciseDetailReturn;
        if(exRet217&&exRet217.view==='workout'&&exRet217.sub&&exRet217.sub!=='start'){
          state.exerciseDetailReturn=null;
          state.workoutEditorOpen=exRet217.sub==='editor'&&!!workoutState.draft;
          state.builderOpen=exRet217.sub==='builder'&&!!state.savedBuilder;
          state.savedWorkoutId=exRet217.sub==='saved'?(exRet217.savedWorkoutId||null):null;
          state.workoutHistoryOpen=exRet217.sub==='history';
          showWorkouts(false,true);
        }else{
          state.sharePreview=state.shareReturn;state.shareReturn=null;
          state.workoutEditorOpen=false;
          showWorkouts(false,true);
        }
        window.scrollTo({top:0});return;
      }
      /* #562: a malformed hash (lone %) must not abort routing — decode
         failure falls back to the raw slice instead of throwing. */
      const hash = safeDecodeHash(); const id = e.state?.exercise || hash;
      if (hash === 'dashboard' || e.state?.view === 'dashboard' || !hash) showDashboard(false);
      else if (hash === 'library' || e.state?.view === 'library') showLibrary(false);
      /* Coherent log history (user 2026-09-12): the log list and completed
         details are pushed pages — system back restores them instead of
         skipping to whatever came before the list. */
      else if (e.state?.view === 'workout' && e.state?.sub === 'history') {
        showWorkouts(false);
        state.workoutHistoryOpen = true;
        renderWorkoutScreen();
        setActiveNav('workout', null);
        window.scrollTo({top:0, behavior:'auto'});
      }
      else if (e.state?.view === 'workout' && e.state?.sub === 'complete' && e.state?.completedId) {
        const w = workoutState.completed.find(x => x.id === e.state.completedId);
        /* #543: scroll restoration is manual now — land at the top of the
           completed log, like finishWorkout does, instead of inheriting a
           stale position now that the native pass is off. */
        if (w) { state.workoutDetailReturn = returnRouteKey(e.state.returnTo)||ROUTES.DETAIL_RETURN.HISTORY; renderCompletedWorkout(w); window.scrollTo({top:0,behavior:'auto'}); }
        else showWorkouts(false);
      }
      else if (hash === 'workout' || e.state?.view === 'workout') {
        /* #433 drill-back class (user 2026-09-14): Back from a pushed exercise
           detail drilled into from a workout sub-screen (live editor, builder,
           saved editor, log list) restores that sub-screen instead of the
           start screen — the same restore backFromExerciseDetail does for the
           in-app path, so chevron and system Back agree. The return is
           consumed: a closed sub-screen must not resurrect on a later Back. */
        const exRet=state.exerciseDetailReturn;
        if(exRet&&exRet.view==='workout'&&exRet.sub&&exRet.sub!=='start'){
          state.exerciseDetailReturn=null;
          state.workoutEditorOpen=exRet.sub==='editor'&&!!workoutState.draft;
          state.builderOpen=exRet.sub==='builder'&&!!state.savedBuilder;
          state.savedWorkoutId=exRet.sub==='saved'?(exRet.savedWorkoutId||null):null;
          state.workoutHistoryOpen=exRet.sub==='history';
          showWorkouts(false,true);
        }
        else showWorkouts(false);
      }
      else if (hash === 'program' || e.state?.view === 'program') showProgram(false);
      else if (hash === 'stats' || e.state?.view === 'stats') showStats(false);
      else if (hash === 'settings' || e.state?.view === 'settings') showSettings(false);
      else if (id && exercises.some(x => x.id === id)) openExercise(id, false, e.state?.exReturn ?? undefined); else showDashboard(false);
    });
    /* #543 (user 2026-09-17): take history scroll restoration fully manual.
       The native 'auto' pass races the app's own restoreScroll() on
       history.back() — e.g. chevron-Back from an exercise detail drilled in
       from the live editor — and the loser can leave iOS Safari's viewport
       stuck on a blank region with only the edge of the editor peeking
       through. Every show function and popstate branch already manages scroll
       explicitly, so the native pass is pure hazard. */
    try{history.scrollRestoration='manual';}catch(_){}

    /* Build stamp (user 2026-09-11): version + last-updated in Settings → About. */
    try{
      const info=window.BUILD_INFO;
      if(info){
        /* #463: the version line is a link to the release notes — set the
           anchor's text so the link survives the stamp (fall back to the
           plain line for any older cached markup without the anchor). */
        const _avl=$('#appVersionLink')||$('#appVersionLine');
        if(_avl)_avl.textContent=`Kohlrabi · v${info.appVersion}`;
        const built=new Date(info.builtAt);
        $('#buildUpdatedLine').textContent='Last updated: '+(isNaN(built)?info.build:built.toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}));
      }
    }catch(_){}
    /* P0 hotfix 2026-09-11 (v0.99e): seed the built-in templates here, not in
       state.js — the factories (newExerciseItem etc.) only exist after every
       script has loaded, which is true by the time this init block runs. */
    workoutState.templates=[];
    /* Post-v1 storage (user 2026-09-13): restore is async (IndexedDB) — one
       async wrapper around the existing init body; everything below awaits it. */
    /* ===== BOOT (runs once on page load) ===== (#99 C5)
       This anonymous async function IS the app's entry point — all the
       top-level `$('#x').addEventListener(...)` wiring above only connects
       controls; execution starts here. The whole thing is async because the
       first step (restore) awaits IndexedDB.
       Boot order:
       1. restorePersisted() — load the saved blob (IndexedDB, localStorage backup fallback).
       2. Initial render — library + dashboard (Stats is deferred to first visit, perf).
       3. Share-route detection — a cold-opened #share= link lands on its loading landing.
       4. Initial tab — from the URL hash if present, else dashboard. */
    (async function(){
    /* v1.877 (user 2026-09-21): paint Home's loading skeleton synchronously
       before the async restore — first paint is a truthful loading state,
       never empty containers or cards from unhydrated state. */
    try{if(typeof paintHomeSkeleton==='function')paintHomeSkeleton();}catch(_){}
    await restorePersisted();
    /* v1.877: data readiness gate — Home may now render real cards. */
    try{state.homeHydrated=true;}catch(_){}
    /* Stats metric default (user 2026-09-11): the Volume|Sets toggles on the
       Stats page initialize to the saved Units → Stats default on every load.
       #357 (user 2026-09-13): all three toggles are session-only — the
       muscle-map toggle was missing from this reset. */
    state.topExercisesMode=state.muscleVolumeMode=state.muscleMapMode=(progressionSetup.statsDefaultMetric==='sets'?'sets':'volume');
/* Boot guarantee (user 2026-09-11 marathon): the swipe-sets class must
   reflect the restored setting even if the appearance-key restore above
   was skipped — otherwise the inline × stays visible on touch. */
applySwipeSets();
updateLiveWorkoutIndicator();
populateFilters(); renderLibrary(); renderDashboard();
/* User 2026-09-12 (perf): renderStats() ran at boot too, but showStats()
   re-renders every time the tab opens — the boot pass was pure waste
   (period aggregations + body-map hydration over all history). Deferred
   until first Stats visit. renderLibrary stays: showLibrary doesn't
   re-render, so the Exercises tab needs it pre-rendered. */
/* #296 (user 2026-09-12): detect a share route synchronously, BEFORE the
   initial tab render — a cold-opened share link must land directly on the
   share landing (loading state), never flash the home tab first while the
   payload decodes. */
const bootShareAttempt=(()=>{
  try{
    if(/^#share=/.test(location.hash||''))return {type:'hash'};
  }catch(_){}
  return null;
})();
if(bootShareAttempt&&typeof openSharePreviewLoading==='function')openSharePreviewLoading();
/* #506 (v1.8): first-run onboarding v2 — fresh profiles only (no persisted
   data, no share/deep-link boot). When the flow starts it owns
   the boot: no tab renders underneath it; "Enter the app" lands on Home. */
let onboardingOwnsBoot=false;
if(!bootShareAttempt){
  try{onboardingOwnsBoot=await maybeStartOnboardingV2();}catch(_){onboardingOwnsBoot=false;}
}
/* #542 (user 2026-09-17 hotfix): lift the pre-paint gate — the onboarding
   decision resolved. When the flow owns the boot, startOnboardingFlow()
   already rendered its full-screen overlay and hid .app via body.of-active
   in the same synchronous task, so removing the class here cannot paint a
   home frame. When it doesn't, the normal initial tab render below proceeds
   on a chrome that was never visibly wrong. */
try{document.documentElement.classList.remove('ob-pending');}catch(_){}
/* #32: a share link (#share=...) renders the shared workout/program
   full-screen after boot, with Start / Add actions over it. Decode is
   async (v2 links are deflated); #296 renders the landing in a loading
   state first so the home tab never flashes underneath. */
parseShareHash().then(sharePayload=>{
  if(sharePayload)openSharePreview(sharePayload);
  /* P8/E1: a share-looking hash that doesn't decode gets a visible
     message instead of silently landing on Home. */
  else if(bootShareAttempt&&bootShareAttempt.type==='hash'){dismissSharePreview();showToast('That share link didn\u2019t open \u2014 it may be broken or from an older version of the app.','error');showDashboard(false);}
  else if(/^#share=/.test(location.hash||''))showToast('That share link didn\u2019t open \u2014 it may be broken or from an older version of the app.','error');
});

/* Share links tapped while the app is already open (#214, user 2026-09-12):
   the landing is always the full page — the old modal variant is gone. A
   live draft stays intact underneath; dismissing the landing returns to it. */
window.addEventListener('hashchange',()=>{
  if(/^#share=/.test(location.hash||'')){
    parseShareHash().then(payload=>{
      /* #265: the hash navigation already pushed a history entry — opening the
         preview must not push a second one or Back takes two presses. */
      if(payload)openSharePreview(payload,{push:false});
      else showToast('That share link didn\u2019t open \u2014 it may be broken or from an older version of the app.','error');
    });
    return;
  }
  /* Persona-4 finding 4 (agent 2026-09-16): a #program deep link arriving
     mid-session (e.g. the marketing site's "Create program" CTA with the
     app already open) mirrors the boot path — route to the Program tab and
     offer the new-program modal when an active program exists. The hash
     navigation already pushed a history entry, so showProgram must not push
     a second one (#265). */
  if(safeDecodeHash()==='program'){
    /* #504 (v1.8): with no active program the empty state is the default
       landing, but the marketing site's "Create program" CTA promises the
       form — open it directly. */
    if(typeof state!=='undefined'&&!workoutState.activeProgram)state.programSetupOpen=true;
    showProgram(false);
    if(typeof maybeOfferNewProgramForDeepLink==='function')maybeOfferNewProgramForDeepLink();
  }
});
/* #562: safeDecodeHash lives in utilities.js (pure, test-covered) — the
   malformed-hash guard shared by the cold-boot, hashchange, and popstate
   routing paths. */
const initialId = safeDecodeHash();
/* #296: a cold-opened share link already rendered its loading landing above —
   don't paint a tab underneath it. */
if (bootShareAttempt) { /* share landing owns the boot */ }
else if (onboardingOwnsBoot) { /* #506: the onboarding flow owns the boot */ }
else if (initialId === 'library') showLibrary(false); else if (initialId === 'workout') showWorkouts(false); else if (initialId === 'program') { if(!workoutState.activeProgram)state.programSetupOpen=true; showProgram(false); maybeOfferNewProgramForDeepLink(); } else if (initialId === 'stats') showStats(false); else if (initialId === 'settings') showSettings(false); else if (initialId && exercises.some(x => x.id === initialId)) openExercise(initialId, false); else showDashboard(false);
/* #351 (user 2026-09-14): after an update reload, restore the workout-tab
   sub-screen stashed in sessionStorage by app-updates.js. */
if(typeof restoreRouteAfterUpdateReload==='function')restoreRouteAfterUpdateReload(bootShareAttempt);
    })(); /* end post-v1 async boot wrapper */
  