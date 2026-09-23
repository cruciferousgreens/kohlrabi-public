
/* ===== module: share.js ===== */
    /* Share-link UI, import, and launch (#32, user 2026-09-12).
       Codec + schema live in share-codec.js (loads just before this file).
       Opening a share link cold renders the shared workout/program
       full-screen; a link arriving while the app is already open pops the
       same card as a modal over the current screen (user 2026-09-12). Start
       workout (primary for signed-out) and Add to my library act over it.
       Accepting copies the workout/program into the recipient's library (any
       custom exercises it references come along too).
       Sharing is fully local: the codec payload rides in the URL hash, so
       links need no account and no server. */
       /* Module map (v1.006) — Key: renderSharePreview(), importShareCustomExercises(), addSharedTemplateToLibrary()/addSharedProgramToLibrary(), startSharedWorkout(). Depends on: share-codec (loads just before), workout-editor factories, state, persistence. */
    async function parseShareHash(){
      const m=/^#share=(.+)$/.exec(location.hash||'');
      if(!m)return null;
      try{
        const payload=await shareDecodeAny(m[1]);
        if(!validSharePayload(payload))return null;
        return payload;
      }catch(e){return null;}
    }

    /* ---- Link building + delivery (UI entry points) ---- */
    async function shareCode(payload){
      /* v2 (short) when the platform can deflate; v1 otherwise — either
         way the recipient's decoder handles both. Returns the bare code
         (no origin); callers wrap it in the long or short URL. */
      let code=null;
      if(typeof CompressionStream!=='undefined'){
        try{code=await shareEncodeV2(payload);}catch(e){code=null;}
      }
      if(!code)code=shareEncodeV1({...payload,v:1}); /* v1 legacy version, inline:
         SHARE_LEGACY_VERSION is a module-scoped const in share-codec.js and
         is not visible here (#207: this ReferenceError broke the no-deflate
         fallback on older browsers). */
      return code;
    }
    /* Delivering a share link (user 2026-09-12): the link itself must be
       visible. The old flow went straight to the system sheet, which
       prepends the workout name before the link and hides the URL itself
       ("I still don't see share links"). Now the dialog shows the bare
       link with a copy button; the native sheet — sharing the link ONLY,
       no prepended name — is one tap away inside the dialog. */
    async function deliverShareLink(payload){
      /* No account gate — sharing works for everyone. The link is a
         self-contained codec payload in the URL hash, so no server is
         needed either. */
      const field=$('#shareLinkField');
      if(field){field.value='Building link…';}
      const dlg=$('#shareLinkDialog');
      if(dlg&&!dlg.open)dlg.showModal();
      try{
        const code=await shareCode(payload);
        /* Full-length links only (server short links are gone) — built from
           the current page's origin+path so self-hosters need no config. */
        openShareLinkDialog(location.origin+location.pathname+'#share='+code);
      }catch(e){
        if(field){field.value='';}
        showToast('Could not build a share link for this workout.','error');
        dlg?.close();
      }
    }
    /* Opens the share-link dialog with the URL ready to copy. */
    function openShareLinkDialog(url){
      const field=$('#shareLinkField');
      if(field){field.value=url;}
      const sysBtn=$('#nativeShareLinkBtn');
      if(sysBtn)sysBtn.hidden=!navigator.share;
      const dlg=$('#shareLinkDialog');
      if(dlg&&!dlg.open)dlg.showModal();
    }
    /* Builds and delivers a share link for a saved workout. */
    async function shareTemplate(templateId){
      const payload=buildTemplateShare(templateId);
      if(!payload){showToast('Could not build a share link for this workout.','error');return;}
      await deliverShareLink(payload);
    }
    /* Program workouts share as saved workouts (user 2026-09-12). */
    async function shareTemplateLike(name,exerciseRows){
      const payload=buildTemplateLikeShare(name,exerciseRows);
      if(!payload){showToast('Could not build a share link for this workout.','error');return;}
      await deliverShareLink(payload);
    }
    /* Builds and delivers a share link for the active program. */
    async function shareActiveProgram(){
      const payload=buildProgramShare();
      if(!payload){showToast('No active program to share.');return;}
      await deliverShareLink(payload);
    }
    /* #459 (user 2026-09-15): share a saved (inactive) program — same
       payload machinery as the active program; the shared-program page
       already handles the non-active cases (#432: Start sets it active /
       saves to library). */
    async function shareSavedProgram(programId){
      const program=(workoutState.savedPrograms||[]).find(p=>p.id===programId);
      const payload=program?buildProgramShareFrom(program):null;
      if(!payload){showToast('No saved program to share.');return;}
      await deliverShareLink(payload);
    }
    /* Drops the #share= hash so a reload doesn't re-offer the share. */
    function clearShareHash(){
      /* Acting on (or dismissing) a share clears the hash so a reload
         doesn't re-offer it. */
      history.replaceState(null,'',location.pathname+location.search);
    }
    /* Full-screen share landing (user 2026-09-12): opening a share link
       renders the shared workout/program as its own screen — the recipient
       sees what was shared, with the actions over it. Start workout is the
       primary action on workout landings; Add to my library leads for
       programs, with Start one tap away either way. There is no
       "Not now": the × backs out to the workout start screen.
       #214: the landing opens OVER a live draft without disturbing it —
       workoutEditorOpen is left alone and the pane selector yields to the
       share preview while it's set; dismissing restores whatever was
       underneath (same principle as #187's logs-over-draft). */
    function openSharePreview(payload,opts={}){
      state.sharePreview=payload;
      /* #235: the screens underneath survive the landing — the pane selector
         suppresses history/saved/builder while the preview is up, and
         dismissing it restores whatever was underneath instead of dropping
         to "Saved workout not found." */
      $('#workoutComplete').hidden=true;
      showWorkouts(false,true);
      /* #265: one history entry per preview — system Back dismisses it
         (popstate clears the preview state via backOutOfSharePreview)
         instead of exiting the app (cold open) or leaving a stale preview
         cached (in-app). The boot loading state already pushed; the in-app
         hashchange entry covers its own Back. */
      if(opts.push!==false){
        try{if(!history.state||history.state.sub!=='share')history.pushState({view:'workout',sub:'share'},'',location.href);}catch(_){}
      }
      window.scrollTo(0,0);
    }
    /* #296 (user 2026-09-12): a cold-opened share link must land directly on
       the share landing — never flash the home tab first while the payload
       decodes (hash links) or resolves over the network (server short
       links). The landing renders immediately in a loading state; the
       resolved payload fills it in. */
    function openSharePreviewLoading(){
      /* #307: drop the pre-paint .share-boot flag — the static skeleton in
         index.html is replaced by the live one below in the same synchronous
         task, so no paint lands between them. */
      try{document.documentElement.classList.remove('share-boot');}catch(_){}
      state.sharePreview={loading:true};
      /* #235: like openSharePreview — the screens underneath survive; the
         pane selector suppresses them while the preview is up. */
      $('#workoutComplete').hidden=true;
      showWorkouts(false,true);
      /* #265: a cold-opened preview is the only history entry — without a
         push, system Back exits the app instead of dismissing the preview.
         Pushing gives Back a popstate to fire within the app. */
      try{if(!history.state||history.state.sub!=='share')history.pushState({view:'workout',sub:'share'},'',location.href);}catch(_){}
      window.scrollTo(0,0);
    }
    /* Closes the share preview and clears its hash/path. */
    function dismissSharePreview(){
      state.sharePreview=null;
      clearShareHash();
    }
    /* #265: system Back out of a share preview. Clears the preview state so
       the destination can't render with a stale preview cached, and strips
       a share hash / short path left on the destination entry so a reload
       can't re-offer a dismissed preview. The caller (popstate) then routes
       the destination normally — cold-open Back lands on Home. */
    function backOutOfSharePreview(){
      /* #433: backing out of a drilled-in program workout returns to the
         program list instead of dismissing the landing. The drill sentinel
         lets popstate stop routing there — the destination history entry is
         the share entry, which the router would otherwise resolve to the
         workout tab (user 2026-09-14: drill Back landed on Home). */
      if(state.sharePreview&&state.sharePreview._drillParent){
        state.sharePreview=state.sharePreview._drillParent;
        renderSharePreview();
        window.scrollTo(0,0);
        return 'drill';
      }
      if(!state.sharePreview)return false;
      state.sharePreview=null;
      try{
        if(/^#share=/.test(location.hash||''))history.replaceState(null,'',location.pathname+location.search);
      }catch(_){}
      return true;
    }
    /* Exercise names resolve against the payload's own custom exercises
       first — they aren't in the recipient's library until imported. */
    function shareExerciseName(item,payload){
      const custom=(payload.customExercises||[]).find(e=>e.id===item.exerciseId);
      if(custom)return custom.name||'Custom exercise';
      return resolveExercise(item.exerciseId)?.name||'Exercise';
    }
    /* One-line target summary for a shared exercise. */
    function shareExerciseSummary(item,payload){
      return exerciseTargetSummary(item,shareExerciseName(item,payload));
    }
    /* Deduped primary + secondary muscles across the shared exercises. */
    function shareMuscles(exerciseRows,payload){
      return [...new Set((exerciseRows||[]).flatMap(item=>{
        const custom=(payload.customExercises||[]).find(e=>e.id===item.exerciseId);
        const ex=custom||resolveExercise(item.exerciseId);
        return [...(ex?.primary||[]),...(ex?.secondary||[])];
      }))];
    }
    /* The share card renders as its own full-screen page (#214, user
       2026-09-12: the old modal variant is gone — a share link always lands
       on the full page, opening over a live draft without disturbing it).
       Header: a green Start button (#297) plus the bookmark icon next to the
       ×, so the actions are one tap away without scrolling.
       Footer: the full descriptive buttons in the approved pattern —
       full-width primary pill + green text link + quiet grey note.
       #213: every version uses the same pattern and the #180 order (Start
       leads on workout landings; Add leads for programs). */
    function sharePreviewCardHtml(payload){
      const isTemplate=payload.kind==='template';
      /* #433 (user 2026-09-14): a drilled-in program workout renders as the
         standard template share card; the back chevron returns to the
         program list. */
      const isDrill=!!payload._drillParent;
      const rows=isTemplate?(payload.template?.exercises||[]):[];
      const programRows=isTemplate?[]:(payload.program?.workouts||[]).flatMap(w=>w.template?.exercises||[]);
      const muscles=shareMuscles(isTemplate?rows:programRows,payload);
      const totalSets=rows.reduce((n,item)=>n+(item.sets||[]).length,0);
      const customCount=(payload.customExercises||[]).length;
      /* #349 (user 2026-09-13): chip summary, matching the saved-workout
         detail header (#320) — no more "N exercises · M sets" text line. */
      const workoutCount=(payload.program?.workouts||[]).length;
      const metaChips=isTemplate
        ?[`${rows.length} exercise${rows.length===1?'':'s'}`,`${totalSets} set${totalSets===1?'':'s'}`]
        :[`${workoutCount} workout${workoutCount===1?'':'s'}`];
      if(customCount)metaChips.push(`includes ${customCount} custom exercise${customCount===1?'':'s'}`);
      const body=isTemplate
        ?(rows.map(item=>{const s=shareExerciseSummary(item,payload);return `<div class="picker-item saved-editor-row"><span><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.meta)}</span></span></div>`;}).join('')||'<p class="section-note">No exercises in this workout.</p>')
        :((payload.program?.workouts||[]).map((w,i)=>{const n=(w.template?.exercises||[]).length;return `<div class="picker-item saved-editor-row program-workout-row"><button class="program-workout-open" type="button" data-share-act="openProgramWorkout" data-workout-idx="${i}" aria-label="Open ${escapeHtml(w.name||'Workout')}"><span><strong>${escapeHtml(w.name||'Workout')}</strong><span>${n} exercise${n===1?'':'s'}</span></span><span class="picker-state" aria-hidden="true">›</span></button></div>`;}).join('')||'<p class="section-note">No workouts in this program.</p>');
      /* #180: primary action (user 2026-09-12): Add to my library leads for
         templates; programs can't start as one workout so they lead with
         Add to my library too. (Public fork: no accounts — every user has
         a local library, so the save/dismiss controls always show.) */
      /* #179: the old two-button row read as redundant (starting already
         saves). One primary action; the other path stays one
         tap away as a quiet text action. */
      const bookmarkBtn=`<button class="share-icon-button" data-share-act="add" type="button" aria-label="Add to my library"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg></button>`;
      /* #545 (user 2026-09-17): no header Start pill on workout landings —
         it duplicated the full-width primary Start below the meta chips
         (two Start buttons). Programs keep their header Share + Start pair
         (their landing has no footer Start). The bookmark shows only for
         templates; #297's green-pill header control is retired. */
      /* User 2026-09-12: recipients get the header bookmark ribbon and a ×
         (everyone has a local library here; the × dismisses the landing
         back to the app). */
      /* #432 (user 2026-09-13): shared programs get a green Start button at
         the top with Share on its left (both actions work locally, no
         account). #432 follow-up (user 2026-09-14): the Share is the
         standard icon-button Share used elsewhere (#240), not a bare
         icon. */
      const shareProgramBtn=`<button class="icon-button" data-share-act="shareProgram" type="button" aria-label="Share this program"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 14.5v-11"/><path d="M7.6 7.4L12 3l4.4 4.4"/><path d="M6 11.5V19a1.6 1.6 0 0 0 1.6 1.6h8.8A1.6 1.6 0 0 0 18 19v-7.5"/></svg></button>`;
      const programStartBtn=`<button class="primary-button share-start-btn" data-share-act="startProgram" type="button">Start</button>`;
      const headerBtns=isTemplate
        ?bookmarkBtn
        :(shareProgramBtn+programStartBtn);
      const dismissBtn='<button class="dialog-close" data-share-act="dismiss" type="button" aria-label="Dismiss">×</button>';
      /* #433: the drill view's up affordance is a back chevron (the × stays
         on the program card, where it dismisses the whole landing). */
      const backBtn=`<button class="share-back-btn" data-share-act="backToProgram" type="button" aria-label="Back to program"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>`;
      const drillDismissBtn=isDrill?'':dismissBtn;
      const primaryBtn=isTemplate
        ?`<button class="primary-button" data-share-act="add" type="button">Add to my library</button><button class="share-alt-action" data-share-act="start" type="button">or start the workout</button>`
        :`<button class="primary-button" data-share-act="add" type="button">Add to my library</button>`;
      const actions=`<div class="share-actions">${primaryBtn}</div>`;
      const note=isTemplate
        ?`<p class="section-note">Starting also saves it to your library.</p>`
        :'<p class="section-note">Programs save to your library — open one of its workouts to train it.</p>';
      /* #212 (user 2026-09-14): on the workout landing the descriptive
         actions sit directly under the title/meta chips (above "Muscles
         worked") instead of at the bottom — the primary action is one tap
         away without scrolling. Program landings keep the footer
         treatment. */
      const topActions=`<div class="share-top-actions">${actions}${note}</div>`;
      const footerActions=`<div class="share-footer-actions">${actions}${note}</div>`;
      const context=`You opened a shared ${isTemplate?'workout':'program'} link.`; /* #179: landing context */
      return `<div class="completed-card"><span class="continue-kicker">${isTemplate?'Shared workout':'Shared program'}</span><div class="detail-title-row">${isDrill?backBtn:''}<h2>${escapeHtml(payload.name||'Shared')}</h2><div class="share-header-actions">${headerBtns}${drillDismissBtn}</div></div><p class="share-context">${context}</p><div class="meta-chips" role="list" aria-label="${isTemplate?'Workout':'Program'} summary">${metaChips.map(c=>`<span class="tag" role="listitem">${c}</span>`).join('')}</div>
      ${isTemplate?topActions:''}
      ${muscles.length?`<div class="section-head"><h3>Muscles worked</h3></div>${workoutBodyMapMarkup(muscles)}<div class="workout-muscles">${muscles.map(m=>musclePill(m)).join('')}</div>`:''}
      <div class="section-head"><h3>${isTemplate?'Exercises':'Workouts'}</h3></div>${body}
      ${isTemplate?'':footerActions}</div>`;
    }
    /* Wires the share preview's action buttons (dismiss, start, save, program drills). */
    function wireSharePreviewButtons(root,payload,onDismiss){
      const isTemplate=payload.kind==='template';
      /* Header icons and footer buttons share the same actions — wire all. */
      root.querySelectorAll('[data-share-act="dismiss"]').forEach(b=>b.addEventListener('click',onDismiss));
      root.querySelectorAll('[data-share-act="start"]').forEach(b=>b.addEventListener('click',startSharedWorkout));
      root.querySelectorAll('[data-share-act="add"]').forEach(b=>b.addEventListener('click',()=>{isTemplate?saveSharedWorkout():saveSharedProgram();}));
      /* #432: shared-program header actions. */
      root.querySelectorAll('[data-share-act="shareProgram"]').forEach(b=>b.addEventListener('click',shareSharedProgram));
      root.querySelectorAll('[data-share-act="startProgram"]').forEach(b=>b.addEventListener('click',startSharedProgram));
      /* #433: program workout rows drill in; the drill card's back chevron
         returns to the program list. */
      root.querySelectorAll('[data-share-act="openProgramWorkout"]').forEach(b=>b.addEventListener('click',()=>openSharedProgramWorkout(Number(b.dataset.workoutIdx))));
      root.querySelectorAll('[data-share-act="backToProgram"]').forEach(b=>b.addEventListener('click',backToSharedProgram));
    }
    /* #307 (user 2026-09-13): the old "Loading…" intermediate page is gone.
       The landing renders the real card layout immediately with skeleton
       placeholders that hydrate in place when the payload resolves — no
       weird intermediate, no layout jump. No × during loading for anyone
       (user 2026-09-13): if a resolve hangs, system Back exits via the
       pushed history entry. Header skeletons mirror the template landing
       (the common case); kind-specific details fill in on hydrate. */
    function sharePreviewSkeletonHtml(){
      /* No accounts — the loading skeleton mirrors the signed-out layout. */
      const headerBtns='';
      return `<div class="completed-card" aria-busy="true" aria-label="Loading shared link"><span class="continue-kicker">Shared link</span><div class="detail-title-row"><span class="skel skel-title"></span><div class="share-header-actions">${headerBtns}</div></div><p class="share-context"><span class="skel skel-line" style="width:55%"></span></p><div class="meta-chips"><span class="skel skel-pill"></span><span class="skel skel-pill"></span></div>
      <div class="share-top-actions"><div class="share-actions"><span class="skel skel-btn"></span><span class="skel skel-line" style="width:150px;margin-top:8px"></span></div><p class="section-note"><span class="skel skel-line" style="width:60%;margin:0 auto"></span></p></div>
      <div class="section-head"><span class="skel skel-line" style="width:130px"></span></div><div class="skel skel-map"></div><div class="workout-muscles"><span class="skel skel-pill"></span><span class="skel skel-pill"></span><span class="skel skel-pill"></span><span class="skel skel-pill"></span></div>
      <div class="section-head"><span class="skel skel-line" style="width:100px"></span></div><div class="skel skel-row" style="margin-bottom:8px"></div><div class="skel skel-row" style="margin-bottom:8px"></div><div class="skel skel-row"></div>
      </div>`;
    }
    /* Renders the share preview card (or its loading skeleton). */
    function renderSharePreview(){
      const host=$('#sharePreviewBody');if(!host)return;
      const payload=state.sharePreview;
      if(!payload){host.innerHTML='';return;}
      if(payload.loading){
        host.innerHTML=sharePreviewSkeletonHtml();
        return;
      }
      host.innerHTML=sharePreviewCardHtml(payload);
      hydrateBodyMaps();
      wireSharePreviewButtons(host,payload,()=>{collapseWorkoutSubScreen();});
    }
    /* Custom exercises the recipient lacks come along with the share. */
    function importShareCustomExercises(payload){
      let importedCustom=0;
      (payload.customExercises||[]).forEach(ex=>{
        if(!ex?.id||exercises.some(e=>e.id===ex.id))return;
        const copy={...ex,custom:true};
        state.customExercises.push(copy);
        exercises.unshift(copy);
        importedCustom++;
      });
      /* #563: the unshift above keeps the array identity, so the cached
         id→entry map in catalog.js is stale until invalidated — without this
         the imported exercises don't resolve until reload. */
      if(importedCustom&&typeof invalidateExerciseMap==='function')invalidateExerciseMap();
      return importedCustom;
    }
    /* Saves a received shared workout to the library. Returns {template, importedCustom}. */
    function addSharedTemplateToLibrary(payload){
      const importedCustom=importShareCustomExercises(payload);
      const src=payload.template||{};
      /* #263: suffixes stay unique across re-accepts.
         #315 (user 2026-09-13): no parenthetical suffix in the name — the
         template carries shared:true and the library renders a SHARED chip. */
      const name=uniqueSuffixedName(src.name||'Shared workout',(workoutState.templates||[]).map(t=>t.name),true);
      /* #290: the id derives from the payload content — the same share
         accepted twice yields the same id, so a re-accept on this device
         is detected (id already present) and mints a fresh id for the
         second copy (ids must stay unique). */
      const stableId=stableTemplateId(JSON.stringify({k:payload.kind,n:payload.name,t:src,c:payload.customExercises||[]}));
      const id=(workoutState.templates||[]).some(t=>t.id===stableId)?newTemplateId():stableId;
      const template={id:id,name,shared:true,
        exercises:JSON.parse(JSON.stringify(src.exercises||[]))};
      workoutState.templates.unshift(template);
      schedulePersist();refreshTemplateViews();
      return {template,importedCustom};
    }
    /* Saves a received shared program to the library. Returns {program, importedCustom}. */
    function addSharedProgramToLibrary(payload){
      const importedCustom=importShareCustomExercises(payload);
      const src=payload.program||{};
      /* #263: suffixes stay unique across re-accepts. */
      const existing=[workoutState.activeProgram,...(workoutState.archivedPrograms||[]),...(workoutState.savedPrograms||[])].filter(Boolean);
      const name=uniqueSuffixedName(src.name||'Shared program',existing.map(p=>p.name));
      /* #290: stable content-derived id — the same share accepted twice
         yields the same id, so a re-accept on this device (id already
         present) gets a fresh id for the second copy. */
      const stableId=stableProgramId(JSON.stringify({k:payload.kind,n:payload.name,p:src,c:payload.customExercises||[]}));
      const id=existing.some(p=>p.id===stableId)?newProgramId():stableId;
      /* #392 (user 2026-09-13): shared programs land in Saved programs — above
         Archived, easier to reach — instead of auto-archiving. Starting one is
         an explicit user action, never a surprise. */
      const program={id:id,name,length:src.length||4,startWeek:src.startWeek||1,shared:true,
        focus:src.focus||'',schedule:src.schedule||'',startedAt:localIsoDate(),savedAt:localIsoDate(),
        progression:src.progression||null,
        workouts:(src.workouts||[]).map(w=>({uid:newProgramWorkoutUid(),name:w.name,
          template:{name:w.template?.name,exercises:JSON.parse(JSON.stringify(w.template?.exercises||[]))}}))};
      (workoutState.savedPrograms||(workoutState.savedPrograms=[])).unshift(program);
      schedulePersist();renderProgram();renderDashboard();
      return {program,importedCustom};
    }
    /* "(+N custom exercises)" suffix for share toasts. */
    function customNoteFor(n){
      return n?` (+${n} custom exercise${n===1?'':'s'})`:'';
    }
    /* Start (user 2026-09-12): the shared workout begins immediately — and
       it's saved to the library too, so the recipient keeps it either way.
       A live draft in progress keeps its conflict guard. */
    function startSharedWorkout(){
      const payload=state.sharePreview;if(!payload||payload.kind!=='template')return;
      const name=payload.template?.name||payload.name||'Shared workout';
      requestStartWithConflict(name,()=>{
        const {template}=addSharedTemplateToLibrary(payload);
        dismissSharePreview();
        /* #217: stash the landing payload so Back from the live editor can
           return to it (one-shot, same pattern as builderReturn). The stash
           is consumed on restore; finish/discard/tab-home clear it. */
        state.shareReturn=payload;
        /* dismissSharePreview nuked this entry's state via replaceState(null)
           — re-mark it so system Back popping the unpushed editor lands on a
           recognizable share entry instead of routing to the entry below. */
        try{history.replaceState({view:'workout',sub:'share'},'',location.href);}catch(_){}
        startWorkoutFromTemplate(template.id);
      });
    }
    /* Accepts a shared workout: saves it and opens it in the saved-workout editor. */
    function saveSharedWorkout(){
      const payload=state.sharePreview;if(!payload||payload.kind!=='template')return;
      const {template,importedCustom}=addSharedTemplateToLibrary(payload);
      dismissSharePreview();
      openSavedWorkoutEditor(template.id);
      showToast(`Added "${template.name}" to your saved workouts${customNoteFor(importedCustom)}.`);
    }
    /* Accepts a shared program into the Saved programs library. */
    function saveSharedProgram(){
      const payload=state.sharePreview;if(!payload||payload.kind!=='program')return;
      const {program,importedCustom}=addSharedProgramToLibrary(payload);
      dismissSharePreview();
      showProgram(false);
      showToast(`Added "${program.name}" to your programs${customNoteFor(importedCustom)} — find it under Saved in the Program tab.`);
    }
    /* #432 (user 2026-09-13): shared programs get a Start button at the top
       (Share icon on its left). No active program → the shared program
       becomes active directly. An active program exists → a choice modal
       (set as active / save to library); setting it active asks for
       confirmation and moves the current program into Saved — never deletes
       it. (#503, user 2026-09-15, supersedes the #432 archive convention.) */
    let pendingSharedProgramPayload=null;    /* choice modal */
    let pendingConfirmProgramPayload=null;   /* are-you-sure modal */
    function sharedProgramReSharePayload(){
      const payload=state.sharePreview;if(!payload||payload.kind!=='program')return null;
      /* Re-share this program: rebuild the same payload shape
         buildProgramShare emits from the preview's program data, then run
         the normal delivery.
         shareEncodeV2 stamps v itself, so no version field is needed here. */
      const program=JSON.parse(JSON.stringify(payload.program||{}));
      return {kind:'program',name:payload.name||'Shared program',
        program,customExercises:payload.customExercises||[]};
    }
    /* Re-shares the currently previewed shared program. */
    function shareSharedProgram(){
      const repayload=sharedProgramReSharePayload();
      if(!repayload)return;
      deliverShareLink(repayload);
    }
    /* Makes a program active; the outgoing active program moves to Saved
       programs (never deleted). */
    function activateSharedProgram(program){
      /* #503 (user 2026-09-15) supersedes #432: switching programs moves the
         outgoing active program into the Saved programs library (savedAt +
         unshift onto savedPrograms, never deleted) instead of archiving it.
         Replace, never skip: the outgoing (live) object is always newer
         than a stale Saved copy with the same id, so a same-id Saved entry
         is removed first. Mirrors the saved-program "start" path in
         programs.js. */
      const saved=workoutState.savedPrograms||[];
      const idx=saved.findIndex(p=>p.id===program.id);
      if(idx>=0)saved.splice(idx,1);
      if(workoutState.activeProgram&&workoutState.activeProgram.id!==program.id){
        const outgoing=workoutState.activeProgram;
        delete outgoing.archivedAt;
        outgoing.savedAt=localIsoDate();
        const lib=workoutState.savedPrograms||(workoutState.savedPrograms=[]);
        const existing=lib.findIndex(p=>p.id===outgoing.id);
        if(existing>=0)lib.splice(existing,1);
        lib.unshift(outgoing);
      }
      workoutState.activeProgram=program;
      delete workoutState.activeProgram.archivedAt;
      delete workoutState.activeProgram.savedAt;
      schedulePersist();renderProgram();renderDashboard();
    }
    /* Accepts and immediately activates a shared program. */
    function activateSharedProgramPayload(payload){
      const {program}=addSharedProgramToLibrary(payload);
      activateSharedProgram(program);
      dismissSharePreview();
      showProgram(false);
      showToast(`"${program.name}" is now your active program.`);
    }
    /* Starts a shared program: activates directly, or confirms when one is already active. */
    function startSharedProgram(){
      const payload=state.sharePreview;if(!payload||payload.kind!=='program')return;
      if(!workoutState.activeProgram){activateSharedProgramPayload(payload);return;}
      pendingSharedProgramPayload=payload;
      showModalPinned($('#sharedProgramStartDialog'));
    }
    /* #433 (user 2026-09-14): workouts on the shared-program page are
       tappable — the workout drills in as the standard template share card
       (Start/Add, same as a shared workout link). The
       derived payload carries the parent program so the drill can navigate
       back; the drill pushes its own history entry so system Back returns
       to the program list, mirroring the in-app program page. */
    function openSharedProgramWorkout(idx){
      const payload=state.sharePreview;if(!payload||payload.kind!=='program')return;
      const w=(payload.program?.workouts||[])[idx];if(!w||!w.template)return;
      state.sharePreview={kind:'template',name:w.name||'Workout',template:w.template,
        customExercises:payload.customExercises||[],_drillParent:payload};
      try{if(!history.state||history.state.sub!=='share-drill')history.pushState({view:'workout',sub:'share-drill'},'',location.href);}catch(_){}
      window.scrollTo(0,0);
      renderSharePreview();
    }
    /* Returns from a shared-program workout drill to the program card. */
    function backToSharedProgram(){
      /* Mirror system Back: pop the drill's history entry; popstate routes
         through backOutOfSharePreview, which restores the program card. */
      try{history.back();}catch(_){backOutOfSharePreview();}
    }
    /* The choice/confirm wiring lives in wireShareProgramStartDialogs()
       below so tests can re-run it against a fake document. */
    function wireShareProgramStartDialogs(){
      const closeChoice=()=>{$('#sharedProgramStartDialog').close();};
      const closeConfirm=()=>{$('#confirmSetSharedProgramActiveDialog').close();};
      $('#closeSharedProgramStart')?.addEventListener('click',closeChoice);
      $('#sharedProgramStartDialog')?.addEventListener('close',()=>{pendingSharedProgramPayload=null;});
      $('#confirmSetSharedProgramActiveDialog')?.addEventListener('close',()=>{pendingConfirmProgramPayload=null;});
      $('#saveSharedProgramToLibrary')?.addEventListener('click',()=>{closeChoice();saveSharedProgram();});
      $('#setSharedProgramActive')?.addEventListener('click',()=>{
        /* Hand the payload to the confirm step before the choice dialog's
           close event clears it. */
        pendingConfirmProgramPayload=pendingSharedProgramPayload;
        closeChoice();
        showModalPinned($('#confirmSetSharedProgramActiveDialog'));
      });
      $('#closeConfirmSetSharedProgramActive')?.addEventListener('click',closeConfirm);
      $('#cancelSetSharedProgramActive')?.addEventListener('click',closeConfirm);
      $('#confirmSetSharedProgramActive')?.addEventListener('click',()=>{
        const payload=pendingConfirmProgramPayload;
        pendingConfirmProgramPayload=null;
        closeConfirm();
        if(payload)activateSharedProgramPayload(payload);
      });
    }
    /* One-time wiring for the share-link dialog (user 2026-09-12, #32). */
    (function wireShareLink(){
      const closeShareDlg=()=>$('#shareLinkDialog').close();
      $('#closeShareLinkDialog')?.addEventListener('click',closeShareDlg);
      $('#copyShareLinkBtn')?.addEventListener('click',async()=>{
        const field=$('#shareLinkField');
        try{await navigator.clipboard.writeText(field?field.value:'');showToast('Share link copied.');}
        catch(e){field?.select?.();showToast('Copy the link above.');}
      });
      /* Native sheet from inside the dialog: the link ONLY, no prepended
         workout name (user 2026-09-12). */
      $('#nativeShareLinkBtn')?.addEventListener('click',async()=>{
        const url=$('#shareLinkField')?.value||'';
        if(!url||!navigator.share)return;
        try{await navigator.share({url});}
        catch(e){/* dismiss = abort, dialog stays open */}
      });
      /* #432: shared-program start flow (Start button / Share icon in the
         program landing header, choice modal, are-you-sure confirm). */
      wireShareProgramStartDialogs();
    })();
