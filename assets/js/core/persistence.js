/* ===== module: persistence.js ===== */
/** Durable localStorage persistence for app data: workouts, drafts, templates, programs, settings. */
/* Module map (v1.006) — Key: PERSIST_KEY, collectPersistable(), schedulePersist()/persistNow(), restorePersisted(), exportWorkoutData(), wipeLocalUserData(). Depends on: state.js field shapes; PERSISTED_KEYS is the restored persisted-key list. */
const PERSIST_KEY='workout-app:v1';
/* Post-v1 storage (user 2026-09-13, one build): the blob lives in IndexedDB
   (see storage.js). LS_BACKUP_KEY is the renamed localStorage copy kept until
   the switch is verified — drop it only in a later build once IDB is proven.
   PERSIST_SIGNAL_KEY is the cross-tab ping: IDB has no storage events, so a
   tiny LS timestamp tells other tabs to re-read after a save. */
const LS_BACKUP_KEY=PERSIST_KEY+'.ls-backup';
const PERSIST_SIGNAL_KEY=PERSIST_KEY+':sig';
/* #520 (v1.803): wipe generation clock. A wipe bumps a monotonic generation,
   persisted here synchronously (before the wipe's first await) and stamped
   on every blob via collectPersistable(). A peer that observes a newer
   generation — through this key or a blob — clears its own memory instead
   of union-merging: the union treats an empty incoming array as a no-op,
   which let a stale tab keep (and re-write) wiped data after the v1.801
   plant. Blobs older than this tab's generation are pre-wipe and are never
   merged. */
const WIPE_GEN_KEY='workout-app:wipe-gen';
/* Change-detection: the 5s interval used to re-serialize the full blob on the
   main thread forever. payloadHash excludes savedAt (it changes every call);
   persistNow skips the write when the hash matches the last durable write. */
let lastWrittenHash=null;
/* Hashes the persist payload (excluding savedAt) for change detection. */
function payloadHash(payload){
  try{
    const copy={};
    for(const k in payload)if(k!=='savedAt')copy[k]=payload[k];
    return cyrb53(JSON.stringify(copy));
  }catch(_){return null;}
}
let persistTimer=null;
/* Builds the persist blob from live state, with cross-tab possession flags. */
function collectPersistable(){
  /* Persona-5 finding 2: the possession flag travels with the blob so a
     receiving tab can tell an explicit clear (null from a world that once
     had a program) from a fresh tab's empty blob. */
  if(workoutState.activeProgram!=null)activeProgramWasSet=true;
  return {
    /* #414: stamped from SCHEMA_VERSION (was hardcoded 1) so the boot
       guard's future-version check sees the real writer version. */
    version:SCHEMA_VERSION,
    savedAt:Date.now(),
    wipeGen:wipeGeneration,
    completed:workoutState.completed,
    templates:workoutState.templates,
    tags:workoutState.tags,
    exerciseTagPresets:workoutState.exerciseTagPresets,
    activeProgram:workoutState.activeProgram,
    activeProgramWasSet:activeProgramWasSet,
    archivedPrograms:workoutState.archivedPrograms,
    savedPrograms:workoutState.savedPrograms||[],
    draft:workoutState.draft,
    /* Saved-workout builder draft (user 2026-09-11): autosaved like the live
       draft, local-only (not in PERSISTED_KEYS). Backing out of the builder
       never loses work; the Discard button deletes it explicitly. */
    savedBuilder:state.savedBuilder,
    customExercises:state.customExercises,
    favorites:[...state.favorites],
    /* #502/#408 (user 2026-09-16): Settings section expansion state —
       sparse {key:true} map, persisted locally like the other UI prefs. */
    settingsSections:{...(state.settingsSections||{})},
    progressionSetup:progressionSetup,
    dashboardPeriod:state.dashboardPeriod,
    statsPeriod:state.statsPeriod,
    logPeriod:state.logPeriod,
    /* #357 (user 2026-09-13): the Stats Volume|Sets toggles are session-only
       (they initialize to the Units → Stats default on every load), so the
       Top-exercises toggle's persisted mode is gone — it was the odd one out. */
    /* v0.99al: saved-workout list filter (muscle pills + "In a program").
       Local-only UI state, like the draft. */
    savedFilter:{muscles:[...((state.savedFilter&&state.savedFilter.muscles)||[])],inProgram:!!(state.savedFilter&&state.savedFilter.inProgram)}
  };
}
/* #99 A4: persist functions return success/failure — callers (and the user)
   can tell saved from unsaved. A failed local write surfaces a visible
   "couldn't save" state instead of a silently broken autosave.
   Storage-blocked contexts (private browsing, quota exhaustion) must never
   crash the app. */
let persistFailStreak=0;
/* #289 (user 2026-09-12): cross-tab reconciliation. Two tabs share the one
   PERSIST_KEY; without coordination a stale tab's debounced autosave (or the
   5s interval persist) can overwrite a newer write from another tab.
   lastSeenSavedAt tracks the newest blob this tab has incorporated (own
   writes, boot read, merges). persistNow() re-reads the blob first: when
   another tab persisted newer state, it is union-merged into live memory
   before this tab writes, so the stale tab adopts rather than clobbers.
   The storage listener stashes the same signal for the (rare) case where
   the re-read itself fails — the event's newValue still carries the blob. */
let lastSeenSavedAt=0;
/* #520 (v1.803): this tab's wipe generation — the newest wipe it has
   adopted. Monotonic; seeded from the LS key and the boot blob. A blob (or
   LS key) carrying a newer generation means a wipe happened elsewhere. */
let wipeGeneration=0;
/* Reads the persisted wipe-generation clock (0 when absent). */
function readWipeGen(){
  try{
    const v=parseInt(localStorage.getItem(WIPE_GEN_KEY),10);
    return (isFinite(v)&&v>0)?v:0;
  }catch(_){return 0;}
}
/* Writes the wipe-generation clock synchronously. */
function writeWipeGen(g){
  try{localStorage.setItem(WIPE_GEN_KEY,String(g));}catch(_){}
}
/* Adopt a wipe observed from another tab: clear this tab's user-data memory
   (the memory-only half of wipeLocalUserData — no storage deletes, no
   reload) so the next persistNow writes the emptied state instead of
   re-writing stale data. */
function adoptWipeGeneration(gen){
  clearUserDataMemory();
  wipeGeneration=gen;
  writeWipeGen(gen);
  lastSeenSavedAt=Date.now();
}
/* Persona-5 finding 2 (cross-tab program clear): tracks whether a program
   ever existed in this tab's world — set when this tab holds one, seeded
   from the boot blob, and OR-ed in from merged blobs. Monotonic: once true
   it stays true. Lets mergeExternalBlob tell an explicit null (a real
   clear) apart from a fresh tab's empty blob. */
let activeProgramWasSet=false;
let pendingExternalBlob=null;
/* Stashes a newer external blob for the next persistNow read-before-write merge. */
function noteExternalBlob(blob){
  if(!blob||typeof blob!=='object')return;
  const at=Number(blob.savedAt)||0;
  if(at>lastSeenSavedAt&&blob.version===SCHEMA_VERSION)pendingExternalBlob=blob;
}
if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
  window.addEventListener('storage',function(e){
    if(!e||!e.key)return;
    if(e.key===PERSIST_KEY&&e.newValue){
      /* Legacy path: a tab on the localStorage backend wrote the blob. */
      try{noteExternalBlob(JSON.parse(e.newValue));}catch(_){}
      return;
    }
    if(e.key===PERSIST_SIGNAL_KEY){
      /* IDB path: another tab saved — flag a re-read on the next persistNow.
         (IDB has no storage events; this tiny timestamp is the ping.) */
      pendingExternalCheck=true;
    }
  });
}
let pendingExternalCheck=false;
/* Union-merge another tab's newer blob into live memory. Record collections
   merge by id — the newer (external) version wins an id conflict, because a
   stale tab must not clobber fresher state. Tags/favorites union. Scalars
   adopt the newer values. The local-only draft, builder draft, and list
   filter stay this tab's (ephemeral per-tab state, unchanged behavior).
   Public fork: the old cross-device tombstone hooks are gone, so the merge
   is a plain last-write-wins union — a record deleted in one tab resurfaces
   only if another tab's stale autosave still holds it, which the wipe
   generation gate (#520) already guards against for the wipe case. */
function mergeExternalBlob(blob){
  if(!blob||typeof blob!=='object'||blob.version!==SCHEMA_VERSION)return false;
  /* #520 (v1.803): generation gate. A newer generation means a wipe happened
     in another tab — clear this tab's memory instead of union-merging (the
     union treats an empty incoming array as a no-op, so it would keep the
     wiped records and re-write them on the next autosave). A blob older than
     this tab's generation is pre-wipe — ignore it entirely, so a stale
     tab's autosave can never resurrect wiped data. */
  const eg=Number(blob.wipeGen)||0;
  if(eg>wipeGeneration){adoptWipeGeneration(eg);return true;}
  if(eg<wipeGeneration)return false;
  /* #99 C11: unionById's per-key phases:
     1) Id conflicts: the incoming (newer-tab) version wins.
     2) Ids only the other tab has are appended. */
  const unionById=function(key,local,incoming){
    let base=Array.isArray(local)?local:[];
    if(!Array.isArray(incoming)||!incoming.length)return base;
    const localIds=new Set(base.map(function(r){return r&&r.id;}));
    const incomingById={};
    incoming.forEach(function(r){if(r&&r.id!=null)incomingById[r.id]=r;});
    const merged=base.map(function(r){
      if(!(r&&r.id!=null&&incomingById[r.id]))return r;
      return incomingById[r.id];
    });
    incoming.forEach(function(r){
      if(!(r&&r.id!=null)||localIds.has(r.id))return;
      merged.push(r);
    });
    return merged;
  };
  workoutState.completed=unionById('completed',workoutState.completed,blob.completed);
  workoutState.templates=unionById('templates',workoutState.templates,blob.templates);
  workoutState.archivedPrograms=unionById('archivedPrograms',workoutState.archivedPrograms,blob.archivedPrograms);
  /* #392: saved programs merge on import like archived ones. */
  workoutState.savedPrograms=unionById('savedPrograms',workoutState.savedPrograms||[],blob.savedPrograms);
  state.customExercises=unionById('customExercises',state.customExercises,blob.customExercises);
  if(blob.activeProgram&&typeof blob.activeProgram==='object')workoutState.activeProgram=blob.activeProgram;
  else if(blob.activeProgram===null&&'activeProgram' in blob){
    /* Persona-5 finding 2: an explicit clear must propagate cross-tab —
       the old truthy-only check dropped it, so a stale sibling tab
       resurrected the cleared program on its next write. Adopt the null
       only from a blob that is newer than everything this tab has seen
       (last-write-wins, same guard as the read-before-write above) AND
       whose world previously possessed a program (activeProgramWasSet) — a
       fresh tab's empty blob must never null out a live program. */
    if((Number(blob.savedAt)||0)>lastSeenSavedAt&&blob.activeProgramWasSet)workoutState.activeProgram=null;
  }
  /* The possession flag is monotonic: once any incorporated blob saw a
     program, this tab's future blobs carry it, so a clear keeps reading as
     a clear as it propagates tab to tab. */
  if(blob.activeProgramWasSet)activeProgramWasSet=true;
  if(Array.isArray(blob.tags))workoutState.tags=mergeTagLists(workoutState.tags,blob.tags);
  if(Array.isArray(blob.exerciseTagPresets))workoutState.exerciseTagPresets=mergeTagLists(workoutState.exerciseTagPresets,blob.exerciseTagPresets);
  if(Array.isArray(blob.favorites)){
    const favs=state.favorites instanceof Set?state.favorites:new Set();
    /* #539: fold variant favorites into their canonical exercise. */
    const canon=id=>(typeof canonicalExerciseId==='function')?canonicalExerciseId(id):id;
    blob.favorites.forEach(function(f){if(typeof f==='string')favs.add(canon(f));});
    state.favorites=favs;
  }
  if(blob.progressionSetup&&typeof blob.progressionSetup==='object'){
    try{Object.assign(progressionSetup,blob.progressionSetup);}catch(_){}
    /* QA batch (user 2026-09-22): Auto Deload removed — normalizeProgression
       deletes the old autoDeload/deloadEvery keys from stored blobs. */
    try{normalizeProgression(progressionSetup);}catch(_){}
  }
  /* QA batch (user 2026-09-22): same Auto Deload key cleanup for stored
     program progressions. */
  try{
    if(workoutState.activeProgram&&workoutState.activeProgram.progression)normalizeProgression(workoutState.activeProgram.progression);
    (workoutState.archivedPrograms||[]).forEach(function(ap){if(ap&&ap.progression)normalizeProgression(ap.progression);});
    (workoutState.savedPrograms||[]).forEach(function(ap){if(ap&&ap.progression)normalizeProgression(ap.progression);});
  }catch(_){}
  ['dashboardPeriod','statsPeriod','logPeriod'].forEach(function(k){
    if(blob[k]!==undefined)state[k]=blob[k];
  });
  try{if(typeof mergeCustomExercises==='function')mergeCustomExercises();}catch(_){}
  return true;
}
/* LS→IDB migration (runs once, first boot on the IDB backend). Silent unless
   it fails: read the LS blob → write to IDB → read back and byte-compare →
   rename the LS copy to LS_BACKUP_KEY (kept, not deleted). Any failure keeps
   the app on localStorage exactly as before. Returns 'already' | 'migrated' |
   'fresh' (nothing to move) | 'unavailable' (IDB failed; caller falls back). */
async function migrateBlobToIdb(){
  let existing;
  try{existing=await Storage.idbGet(PERSIST_KEY);}catch(_){return 'unavailable';}
  if(existing!==undefined&&existing!==null)return 'already';
  if(existing===undefined)return 'unavailable';
  let lsRaw=null;
  try{lsRaw=localStorage.getItem(PERSIST_KEY);}catch(_){}
  if(!lsRaw)return 'fresh';
  let wrote=false;
  try{wrote=await Storage.idbSet(PERSIST_KEY,lsRaw);}catch(_){}
  if(!wrote)return 'unavailable';
  let back;
  try{back=await Storage.idbGet(PERSIST_KEY);}catch(_){return 'unavailable';}
  if(back!==lsRaw)return 'unavailable';
  try{
    localStorage.setItem(LS_BACKUP_KEY,lsRaw);
    localStorage.removeItem(PERSIST_KEY);
  }catch(_){/* backup best-effort; the IDB copy is verified */}
  return 'migrated';
}
/* Writes the blob (read-before-write cross-tab merge first); returns true when durable. */
async function persistNow(){
  /* #414: a future-version blob is on disk — this build must not write over
     it. The 5s autosave would otherwise clobber newer data with this build's
     empty state. Writes stay held until the user reloads into the newer
     build (which reads the untouched blob normally). */
  if(futureVersionHold)return false;
  /* #289: read-before-write — fold in any newer cross-tab state first. */
  pendingExternalCheck=false;
  let external=null;
  try{
    let raw=await Storage.loadBlob(PERSIST_KEY);
    /* Unload safety net: another tab may have pagehidden with dirty state
       after this tab's last read — its synchronous localStorage copy is the
       newest blob until this tab's next successful write. */
    try{if(Storage.backend==='idb')raw=newerBlob(raw,localStorage.getItem(PERSIST_KEY));}catch(_){}
    if(raw){
      const current=JSON.parse(raw);
      if(current&&current.version===SCHEMA_VERSION&&(Number(current.savedAt)||0)>lastSeenSavedAt)external=current;
    }
  }catch(_){}
  if(!external&&pendingExternalBlob&&(Number(pendingExternalBlob.savedAt)||0)>lastSeenSavedAt)external=pendingExternalBlob;
  pendingExternalBlob=null;
  /* #520 (v1.803): wipe generation check before the union merge. The LS key
     is authoritative even when the storage read returned a pre-wipe blob —
     a stale tab's autosave can land between the wipe's plant and this read,
     so the blob alone can't be trusted. A newer generation clears this tab's
     memory and the emptied state is written below. (mergeExternalBlob
     applies the same gate to the blob itself, so a pre-wipe external is
     dropped there too.) */
  const lsGenNow=readWipeGen();
  if(lsGenNow>wipeGeneration){
    adoptWipeGeneration(lsGenNow);
    external=null;
  }
  if(external){
    mergeExternalBlob(external);
    /* Monotonic: a generation adoption inside the merge may have raised
       lastSeenSavedAt to now — never move it backward to the blob's time. */
    lastSeenSavedAt=Math.max(lastSeenSavedAt,Number(external.savedAt)||0);
    /* #380: cross-tab history arriving mid-draft can unlock suggestions that
       were empty at draft creation. */
    if(typeof maybeRefreshDraftSuggestions==='function'){try{maybeRefreshDraftSuggestions();}catch(_){}}
  }
  const payload=collectPersistable();
  /* Change-detection: skip the write (and the main-thread serialize) when
     nothing changed since the last durable write. */
  const hash=payloadHash(payload);
  if(hash!==null&&hash===lastWrittenHash)return true;
  payload.savedAt=Date.now();
  const ok=await Storage.saveBlob(PERSIST_KEY,JSON.stringify(payload));
  if(ok){
    persistFailStreak=0;
    lastWrittenHash=hash;
    lastSeenSavedAt=Math.max(lastSeenSavedAt,Number(payload.savedAt)||0);
    /* The unload safety-net copy is superseded by this durable write — drop
       it so localStorage doesn't carry a stale duplicate forever. Guarded by
       savedAt: a persist that collected BEFORE another tab's pagehide write
       must not delete that tab's newer copy. (IDB backend only — on the
       localStorage backend PERSIST_KEY *is* the store.) */
    if(Storage.backend==='idb'){
      try{
        const lsRaw=localStorage.getItem(PERSIST_KEY);
        if(lsRaw&&savedAtOf(lsRaw)<=Number(payload.savedAt))localStorage.removeItem(PERSIST_KEY);
      }catch(_){}
    }
    /* Cross-tab ping (IDB has no storage events): other tabs re-read on
       their next persistNow. Best-effort — a missed ping only delays a
       merge, it never loses data. */
    try{localStorage.setItem(PERSIST_SIGNAL_KEY,String(Date.now()));}catch(_){}
  }else{
    persistFailStreak+=1;
    /* First failure toasts immediately; repeats are throttled (~1/min on the
       5s interval) so a broken-storage session isn't a toast firehose. */
    if(persistFailStreak===1||persistFailStreak%12===0){
      if(typeof showToast==='function'){
        try{showToast(persistFailStreak===1
          ?"Couldn't save — storage is unavailable. Your changes are not being saved."
          :"Couldn't save — your changes still aren't being saved.",'error');}catch(_){}
      }
    }
  }
  return ok;
}
/* Debounced save: coalesces rapid writes (every keystroke) into one localStorage write
   250ms later. */
function schedulePersist(){
  clearTimeout(persistTimer);
  persistTimer=setTimeout(persistNow,250);
}
/* Blob recency helpers for the unload safety net. savedAtOf returns -1 for
   anything unparseable, so a corrupt blob always loses to a valid one. */
function savedAtOf(raw){
  try{
    const d=JSON.parse(raw);
    return (d&&typeof d==='object'&&typeof d.version==='number')?(Number(d.savedAt)||0):-1;
  }catch(_){return -1;}
}
/* Returns the newer of two raw blobs by savedAt. */
function newerBlob(a,b){
  if(!a)return b;
  if(!b)return a;
  return savedAtOf(b)>savedAtOf(a)?b:a;
}
/* Unload safety net (persona QA 2026-09-16: an in-progress workout vanished
   when the tab reloaded before the debounced async IndexedDB write landed).
   pagehide is the last reliable moment to run code and IndexedDB is
   async-only, so stash a synchronous localStorage copy — but only when there
   are unwritten changes (hash differs from the last durable write), so an
   idle unload leaves no stale copy behind. Boot and persistNow's
   read-before-write take the newer of the IDB blob and this copy by savedAt.
   futureVersionHold blocks it: this build must never clobber a newer build's
   blob, even on unload. */
function persistSyncForUnload(){
  if(futureVersionHold)return;
  try{
    const payload=collectPersistable();
    const hash=payloadHash(payload);
    if(hash!==null&&hash===lastWrittenHash)return;
    payload.savedAt=Date.now();
    localStorage.setItem(PERSIST_KEY,JSON.stringify(payload));
  }catch(_){/* quota/privacy mode — the async IDB attempt stays the fallback */}
}
/* Shared local wipe (efficiency pass 2026-09-12): "Delete all data" clears
   state in-memory FIRST (so the 5s/pagehide persist can't resurrect
   anything), then localStorage (#99 C1). */
/* #520 (v1.803): the memory-only half of the wipe, shared with
   adoptWipeGeneration (a peer tab honoring a wipe it observed elsewhere).
   No storage deletes, no reload — just in-memory state, so the next
   persistNow writes the emptied state instead of re-writing stale data. */
function clearUserDataMemory(){
  workoutState.completed=[];workoutState.templates=[];workoutState.tags=[];workoutState.exerciseTagPresets=[];workoutState.draft=null;workoutState.activeProgram=null;workoutState.archivedPrograms=[];workoutState.savedPrograms=[];
  workoutState.tagTarget=null;workoutState.exerciseTagTarget=null;workoutState.supersetTarget=null;workoutState.pickerMode='draft';workoutState.programWorkoutTarget=null;workoutState.pickerSwapUid=null;
  /* The saved-workout builder draft is persisted too — leaving it would
     resurrect a builder session through a pre-reload pagehide persist. */
  state.savedBuilder=null;state.builderReturn=null;state.builderOpen=false;
  state.sharePreview=null;state.shareReturn=null; /* #217: no landing may survive a full wipe. */
  state.workoutEditorOpen=false;state.savedWorkoutId=null;state.workoutHistoryOpen=false;state.programWorkoutUid=null;
  state.customExercises=[];exercises=exercises.filter(ex=>!ex.custom);
  /* Favorites are user data too: clear them in memory so a pre-reload persist
     can't resurrect them. */
  if(state.favorites&&typeof state.favorites.clear==='function')state.favorites.clear();
  /* #502/#408: Settings section expansion state is user data too. */
  state.settingsSections={};
  state.query='';state.muscles.clear();state.equipment='';state.onlyFavorites=false;state.onlyCustom=false;state.selected=null;
  resetProgressionSetup();
}
/* Deletes all local user data (memory + storage); returns a durability promise. */
function wipeLocalUserData(){
  /* #520 (v1.803): bump the wipe generation FIRST and synchronously —
     before the first await and before planting the emptied payload.
     Peers observe it via the LS key or the stamped blob and clear their own
     memory instead of union-merging the empty plant (the union treats an
     empty incoming array as a no-op, which defeated the v1.801 plant).
     Max with the LS key in case another tab wiped while this tab was open. */
  wipeGeneration=Math.max(wipeGeneration,readWipeGen())+1;
  writeWipeGen(wipeGeneration);
  clearUserDataMemory();
  /* The blob may live in IndexedDB — delete from both stores, ALWAYS
     attempting the IDB delete (never gated on the memoized probe). #520
     post-mortem (2026-09-16, real-browser retest on v1.799): the v1.798
     wipe only deleted from IDB when Storage.backend==='idb'. The probe is
     per-session — if it failed this session (slow/blocked IDB open) the
     app ran on localStorage while a full blob sat in IndexedDB; the wipe
     skipped IDB, and the next boot's successful probe resurrected the
     "deleted" blob. deleteBlobDurable now attempts the raw delete+verify
     unconditionally and reports unreachable IDB as unverified (never
     success). The returned promise settles only after all of this, so
     callers awaiting it (the delete-all confirm) reload only once the wipe
     is durable. */
  /* #520 (2026-09-17, instrumented retest on v1.801-diag): the delete itself
     was proven durable — durable:true, IDB re-read null, boot took the empty
     branch. The resurrection came from a hidden peer tab whose 5s persistNow
     tick fired in the post-wipe empty window: with storage ABSENT it saw a
     null external, skipped its read-before-write merge, and blind-wrote its
     stale full memory with a fresh savedAt, which this tab then adopted.
     Fix: plant the emptied payload to localStorage SYNCHRONOUSLY — before the
     first await, ungated by lastWrittenHash (persistSyncForUnload would skip
     it as "clean") — so no execution context ever observes absent storage
     post-wipe. A peer's read-before-write takes the newer of the IDB blob
     and this LS copy and adopts the explicit empty, the same convergence the
     two-tab case already shows. The plant self-cleans: persistNow drops the
     LS copy once it durably writes anything newer (savedAt-guarded), and
     boot's migrateBlobToIdb moves it into IDB. */
  try{
    const payload=collectPersistable();
    payload.savedAt=Date.now();
    /* #537 (v1.811): stamp the #520 empty-plant so the onboarding first-run
       gate can tell it apart from real user data — without the stamp, "any
       stored blob" reads as a returning profile and the flow never resurfaces
       after a wipe. */
    payload.wipedAt=Date.now();
    localStorage.setItem(PERSIST_KEY,JSON.stringify(payload));
  }catch(_){/* quota/privacy mode — the async delete stays the fallback */}
  let idbDelete=null;
  try{
    idbDelete=(async function(){
      const durable=await Storage.deleteBlobDurable(PERSIST_KEY);
      /* Post-verify plant: a peer tick already in flight during the wipe may
         have blind-written its stale blob to IDB after the first plant. The
         verified delete (with its retry) removed it; re-plant with a fresh
         savedAt so boot's newest-copy selection prefers this empty state
         over anything that landed before the verify. */
      try{
        const payload=collectPersistable();
        payload.savedAt=Date.now();
        payload.wipedAt=Date.now(); /* #537 (v1.811): stamp the re-plant too */
        localStorage.setItem(PERSIST_KEY,JSON.stringify(payload));
        try{lastWrittenHash=payloadHash(collectPersistable());}catch(_){lastWrittenHash=null;}
      }catch(_){/* quota/privacy mode — nothing more we can do */}
      return durable;
    })().catch(function(){});
  }catch(_){}
  /* Post-v1 storage: the migration backup must die too, or a reload would
     resurrect the wiped data from LS_BACKUP_KEY. */
  try{localStorage.removeItem(LS_BACKUP_KEY);}catch(_){}
  /* #537 (2026-09-17): a wiped profile is a fresh profile — the onboarding
     first-run gate resets with it, so the flow resurfaces after delete-all.
     Guarded: onboarding.js loads after this module (see index.html script
     order), but every wipe path runs long after boot, so the function is
     present at call time. */
  if(typeof clearOnboardingDone==='function'){try{clearOnboardingDone();}catch(_){}}
  /* Awaitable durability: callers that reload after the wipe (the delete-all
     confirm) await this before location.reload(). Callers that don't await
     keep the old fire-and-forget behavior. */
  /* Seed change-detection with the emptied state: the 5s interval and the
     pagehide safety net must see the wipe as "clean" and not rewrite it. */
  try{lastWrittenHash=payloadHash(collectPersistable());}catch(_){lastWrittenHash=null;}
  return idbDelete;
}
/* Merges state.customExercises into the live exercises list (deduped by id). */
function mergeCustomExercises(){
  if(!Array.isArray(state.customExercises)||!state.customExercises.length)return;
  const ids=new Set(state.customExercises.map(ex=>ex.id));
  exercises=exercises.filter(ex=>!ids.has(ex.id));
  exercises=[...state.customExercises,...exercises];
}
/** Merge saved tag strings onto defaults: defaults first, then saved customs, deduped case-insensitively. */
function mergeTagLists(defaults,saved){
  const seen=new Set(defaults.map(tag=>String(tag).toLowerCase()));
  const merged=[...defaults];
  (Array.isArray(saved)?saved:[]).forEach(tag=>{
    if(typeof tag!=='string'||!tag.trim()||seen.has(tag.toLowerCase()))return;
    seen.add(tag.toLowerCase());merged.push(tag);
  });
  return merged;
}
/* #99 B29: central migration pipeline. The persisted blob carries `version`;
   every boot-time upgrade of that payload lives in MIGRATIONS as
   {id, from, migrate}, applied in order inside restorePersisted BEFORE any
   feature module hydrates. Read-time normalizations (uid backfill in the live
   editor, 'seconds'→'time' in exerciseTracking) deliberately stay at their
   read paths — they also cover share payloads that never pass through
   this pipeline. */
const SCHEMA_VERSION=1;
/* #99 C20: `from` records the schema generation that first shipped the affected
   shape — it is metadata, not a gate. Every entry below runs on EVERY boot
   (the guard is only the `version` check in restorePersisted; see M5). All
   entries currently read `from:1` because SCHEMA_VERSION is still 1. */
const MIGRATIONS=[
  /* v0.99al: the saved-workout list filter shape was hardened after it
     shipped — normalize it on the payload, not in the hydrate path. */
  {id:'normalize-saved-filter',from:1,migrate(data){
    if(data.savedFilter&&typeof data.savedFilter==='object'){
      data.savedFilter={
        muscles:Array.isArray(data.savedFilter.muscles)?data.savedFilter.muscles.filter(x=>typeof x==='string'):[],
        inProgram:!!data.savedFilter.inProgram
      };
    }
  }},
  /* #315 (user 2026-09-13): shared workouts used to carry "(shared)" in the
     name; they now carry shared:true and render a SHARED chip. Strip the
     legacy suffix and set the flag. */
  {id:'shared-workout-chip',from:1,migrate(data){
    /* Pre-prod caution (user): "Leg Day (shared)" + "Leg Day (shared 2)" must
       not collapse to two "Leg Day"s — the loser takes neutral (2)/(3). */
    const templates=(data.templates||[]).filter(t=>t&&typeof t.name==='string');
    const taken=new Set(templates.map(t=>t.name));
    templates.forEach(t=>{
      const m=/^(.*) \(shared(?: (\d+))?\)$/.exec(t.name);
      if(!m)return;
      taken.delete(t.name);
      let name=m[1],n=2;
      while(taken.has(name))name=`${m[1]} (${n++})`;
      t.name=name;t.shared=true;taken.add(name);
    });
  }},
  /* #383 (user 2026-09-13): the 'To failure' set tag is now 'Failure'.
     Remap it in the tag list and on every set that carries it (logs,
     templates, live draft, saved builder, programs). A set carrying both
     keeps a single 'Failure'. */
  {id:'set-tag-failure-rename',from:1,migrate(data){
    const rename=tags=>Array.isArray(tags)?[...new Set(tags.map(t=>t==='To failure'?'Failure':t))]:tags;
    if(Array.isArray(data.tags))data.tags=rename(data.tags);
    const walkSets=exercises=>{(exercises||[]).forEach(item=>{(item.sets||[]).forEach(set=>{set.tags=rename(set.tags);});});};
    (data.completed||[]).forEach(log=>walkSets(log.exercises));
    (data.templates||[]).forEach(t=>walkSets(t.exercises));
    if(data.draft)walkSets(data.draft.exercises);
    if(data.savedBuilder)walkSets(data.savedBuilder.exercises);
    [data.activeProgram].concat(data.archivedPrograms||[],data.savedPrograms||[]).forEach(program=>{
      (program?.workouts||[]).forEach(w=>walkSets(w.template?.exercises));
    });
  }},
  /* #312 (user 2026-09-13): program shells added before v1.032 carry no
     sourceTemplateId, so the saved-list dedup can't see them — they keep
     rendering as duplicate cards next to their template. Backfill the link
     where a shell matches exactly one live template by name + exercise
     structure (exercise ids in order + set counts; values may have been
     edited since, so they don't participate). Ambiguous matches (two
     templates with the same name+structure) are left alone — a missed link
     just keeps the old two-card look, while a wrong link would hide a
     legitimate program-only workout. Shells from past sessions
     (sourceWorkoutId) are genuinely program-only and never link. */
  {id:'program-shell-template-link',from:1,migrate(data){
    const templates=(data.templates||[]).filter(t=>t&&!t.archivedAt);
    const programs=[data.activeProgram].concat(data.archivedPrograms||[]).filter(p=>p&&Array.isArray(p.workouts));
    const sig=rows=>(rows||[]).map(item=>`${item.exerciseId||''}:${(item.sets||[]).length}`).join('|');
    const byKey=new Map();
    templates.forEach(t=>{
      const key=`${t.name||''}\n${sig(t.exercises)}`;
      byKey.set(key,byKey.has(key)?null:t); /* null = ambiguous, never links */
    });
    programs.forEach(p=>p.workouts.forEach(w=>{
      if(!w||w.sourceTemplateId||w.sourceWorkoutId)return;
      const t=byKey.get(`${w.name||''}\n${sig(w.template&&w.template.exercises)}`);
      if(t)w.sourceTemplateId=t.id;
    }));
  }},
  /* (user 2026-09-14): Home → At a glance now defaults to Week, not Today.
     One-shot: blobs persisting the old 'today' default move to 'week' on the
     next boot. A deliberate Today re-tap afterwards is the user's own choice
     and is left alone on subsequent boots. */
  {id:'dash-period-week-default',from:1,migrate(data){
    try{
      if(localStorage.getItem('workout-app:dash-week-default')==='1')return;
      if(data&&data.dashboardPeriod==='today')data.dashboardPeriod='week';
      localStorage.setItem('workout-app:dash-week-default','1');
    }catch(_){}
  }},
];
/* Applies every blob migration to the payload in order. */
function runBlobMigrations(data){
  MIGRATIONS.forEach(m=>{try{m.migrate(data);}catch(_){}});
  return data;
}
/* Standalone localStorage keys (kept outside the blob for the pre-paint
   head script): migrated once per boot, before the features that read them. */
const LOCAL_KEY_MIGRATIONS=[
  /* Early builds stored the Catppuccin/Rosé Pine working names. */
  {id:'legacy-theme-names',migrate(){
    try{
      const n=localStorage.getItem('workout-theme-name');
      if(n==='latte')localStorage.setItem('workout-theme-name','rosepine');
      else if(n==='frappe')localStorage.setItem('workout-theme-name','macchiato');
    }catch(_){}
  }},
];
/* Applies the standalone-localStorage-key migrations. */
function runLocalKeyMigrations(){LOCAL_KEY_MIGRATIONS.forEach(m=>{try{m.migrate();}catch(_){}});}
/* #99 A5: a corrupt/unparseable blob is QUARANTINED under its own key —
   never silently dropped. Booting to defaults is safe because the 5s/pagehide
   autosave only ever writes PERSIST_KEY, so the quarantined copy survives
   until the user decides what to do with it. Nothing quarantined is ever
   auto-adopted back into state. */
let corruptQuarantineKey=null;
/* #414: set while a future-version blob is on disk — persistNow() refuses
   all writes until the user reloads into the newer build. */
let futureVersionHold=false;
/* Moves an unreadable persist blob to a timestamped quarantine key and
   prompts the user; the corrupt copy survives until they decide. */
async function quarantineCorruptBlob(raw){
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  corruptQuarantineKey=PERSIST_KEY+':corrupt-'+stamp;
  let ok=false;
  try{ok=await Storage.saveBlob(corruptQuarantineKey,raw);}catch(_){}
  if(!ok)corruptQuarantineKey=null;
  if(!corruptQuarantineKey)return; /* storage itself is broken — nothing more to do */
  /* Recovery prompt, matching the app's dialog patterns. Export keeps the
     quarantine (the user may export first, then decide); Discard removes the
     quarantined copy; closing the dialog keeps it set aside safely. */
  const dlg=typeof $==='function'?$('#corruptDataDialog'):null;
  if(dlg&&!dlg.open){try{dlg.showModal();}catch(_){}}
}
/* #414: the persisted blob was written by a NEWER app build — e.g. a stale
   tab (older cached code) booting against state the updated build saved.
   The data is valid, just newer than this build understands, so it is left
   completely untouched on disk: never quarantined, and never overwritten
   (futureVersionHold blocks persistNow above). We force a service-worker
   update check and prompt the user to reload into the newer build, which
   reads the blob normally. Booting continues with empty state behind the
   modal; "Not now" just dismisses it — nothing is saved until a reload. */
async function holdForFutureVersion(foundVersion){
  futureVersionHold=true;
  /* The issue's reg.update(): kick the download off while the user reads the
     prompt. (The window-load register() also checks, but this runs first.)
     skipWaiting()+clients.claim() in sw.js mean the reloaded page is
     controlled by the new worker. */
  try{
    if(typeof navigator!=='undefined'&&'serviceWorker' in navigator){
      const reg=await navigator.serviceWorker.getRegistration();
      if(reg&&typeof reg.update==='function'){try{await reg.update();}catch(_){}}
    }
  }catch(_){}
  const dlg=typeof $==='function'?$('#futureVersionDialog'):null;
  if(dlg&&!dlg.open){try{dlg.showModal();}catch(_){}}
}
/* Boot: reads the blob (IndexedDB, migrating from localStorage once with
   read-back verification), quarantines corrupt blobs for user download, runs
   migrations, then hydrates state + workoutState. Async — boot awaits it. */
async function restorePersisted(){
  await Storage.probe();
  let raw=null;
  if(Storage.backend==='idb'){
    try{
      const mig=await migrateBlobToIdb();
      if(mig!=='unavailable')raw=await Storage.loadBlob(PERSIST_KEY);
    }catch(_){}
    /* Unload safety net (persona QA 2026-09-16): the async IDB write can be
       killed mid-flight by a fast unload; pagehide stashes a synchronous
       localStorage copy in that case. Take whichever blob is newer by savedAt.
       (When raw is null this also covers the old "migration failed
       mid-flight" localStorage fallback.) */
    try{raw=newerBlob(raw,localStorage.getItem(PERSIST_KEY));}catch(_){}
  }else{
    try{raw=localStorage.getItem(PERSIST_KEY);}catch(_){}
  }
  /* Last resort: the .ls-backup from the migration (e.g. IDB wedged after
     the rename). Data beats a clean boot. */
  if(!raw){try{raw=localStorage.getItem(LS_BACKUP_KEY);}catch(_){}}
  if(!raw){
    /* #520 (v1.803): no blob, but a wipe may still be on record — adopt its
       generation so a pre-wipe blob that lands later can't merge in. */
    wipeGeneration=Math.max(wipeGeneration,readWipeGen());
    return;
  }
  let data=null;
  try{data=JSON.parse(raw);}catch(_){await quarantineCorruptBlob(raw);return;}
  /* #414: three-way version guard. A blob from a NEWER build is valid data —
     never quarantine it (that's data loss by misclassification); force a
     service-worker update check and prompt the user to reload instead. A blob
     from an OLDER build runs the migration pipeline (its design intent:
     MIGRATIONS carry {id, from, migrate} for exactly this). Only unreadable
     garbage is quarantined. */
  if(!data||typeof data!=='object'||typeof data.version!=='number'){await quarantineCorruptBlob(raw);return;}
  if(data.version>SCHEMA_VERSION){await holdForFutureVersion(data.version);return;}
  /* #520 (v1.803): the wipe-generation LS key is authoritative over the
     blob. A stale tab's autosave can overwrite the wipe's plant after the
     wipe; if the LS generation is newer than the blob's, the blob is
     pre-wipe — ignore it and boot empty. Otherwise adopt the newest
     generation seen from any source. */
  const bootLsGen=readWipeGen();
  const blobGen=Number(data.wipeGen)||0;
  if(bootLsGen>blobGen){
    wipeGeneration=bootLsGen;
    try{lastWrittenHash=payloadHash(collectPersistable());}catch(_){lastWrittenHash=null;}
    return;
  }
  wipeGeneration=Math.max(wipeGeneration,blobGen,bootLsGen);
  lastSeenSavedAt=Number(data.savedAt)||0; /* #289: boot read counts as seen */
  /* Persona-5 finding 2: seed the possession flag from the boot blob so a
     clear written by this tab after a reload still reads as an explicit
     clear on the receiving tab. */
  if(data.activeProgramWasSet||data.activeProgram!=null)activeProgramWasSet=true;
  runBlobMigrations(data);
  PERSISTED_KEYS.forEach(key=>{if(key in data)setPersistedValue(key,data[key]);});
  if(data.draft&&typeof data.draft==='object'&&data.draft!==null)workoutState.draft=data.draft;
  if(data.savedBuilder&&typeof data.savedBuilder==='object'&&data.savedBuilder!==null)state.savedBuilder=data.savedBuilder;
  /* v0.99al: the saved-workout list filter (local-only); shape normalized by
     the 'normalize-saved-filter' migration above. */
  if(data.savedFilter&&typeof data.savedFilter==='object'&&data.savedFilter!==null)state.savedFilter=data.savedFilter;
  mergeCustomExercises();
  /* Seed change-detection: the just-loaded state is "clean". */
  try{lastWrittenHash=payloadHash(collectPersistable());}catch(_){lastWrittenHash=null;}
}
/* ===== persisted key accessors ===== */
/** Keys restored from the persist blob into live memory. The live draft is
    deliberately excluded: it is ephemeral, in-progress state. Appearance
    (theme) travels as one key so it follows the persisted profile; the
    standalone workout-theme* localStorage keys remain the local read path. */
const PERSISTED_KEYS=['completed','templates','tags','exerciseTagPresets','activeProgram','archivedPrograms','savedPrograms','customExercises','favorites','progressionSetup','dashboardPeriod','statsPeriod','logPeriod','appearance','settingsSections'];
/** Read one persisted key from live in-memory state. */
function getSyncableValue(key){
  switch(key){
    case 'completed':return workoutState.completed;
    case 'templates':return workoutState.templates;
    case 'tags':return workoutState.tags;
    case 'exerciseTagPresets':return workoutState.exerciseTagPresets;
    case 'activeProgram':return workoutState.activeProgram;
    case 'archivedPrograms':return workoutState.archivedPrograms;
    case 'savedPrograms':return workoutState.savedPrograms||[];
    case 'customExercises':return state.customExercises;
    case 'favorites':return state.favorites instanceof Set?[...state.favorites]:[];
    case 'progressionSetup':return progressionSetup;
    case 'dashboardPeriod':return state.dashboardPeriod;
    case 'statsPeriod':return state.statsPeriod;
    case 'logPeriod':return state.logPeriod;
    case 'appearance':return (typeof getAppearanceState==='function')?getAppearanceState():undefined;
    /* #502/#408: Settings section expansion — sparse {key:true} map. */
    case 'settingsSections':return {...(state.settingsSections||{})};
    default:return undefined;
  }
}
/** Apply one syncable key to live in-memory state, using the same merge guards
    as restorePersisted. Callers re-run mergeCustomExercises() afterwards when
    the customExercises key was applied. */
function setPersistedValue(key,value){
  switch(key){
    case 'completed':if(Array.isArray(value))workoutState.completed=value;break;
    case 'templates':
      /* Templates: built-ins were removed 2026-09-13 — only the user's own
         saved templates merge in; any persisted built-ins are dropped. */
      if(Array.isArray(value)){
        const savedUser=value.filter(t=>t&&!t.builtIn);
        const ids=new Set(savedUser.map(t=>t.id));
        workoutState.templates=[...savedUser];
      }
      break;
    case 'tags':if(Array.isArray(value))workoutState.tags=mergeTagLists(DEFAULT_SET_TAGS,value);break;
    case 'exerciseTagPresets':if(Array.isArray(value))workoutState.exerciseTagPresets=mergeTagLists(DEFAULT_EXERCISE_TAG_PRESETS,value);break;
    case 'activeProgram':if(value&&typeof value==='object')workoutState.activeProgram=value;break;
    case 'archivedPrograms':if(Array.isArray(value))workoutState.archivedPrograms=value;break;
    case 'savedPrograms':if(Array.isArray(value))workoutState.savedPrograms=value;break;
    case 'customExercises':if(Array.isArray(value))state.customExercises=value;break;
    case 'favorites':if(Array.isArray(value))state.favorites=new Set(value.filter(x=>typeof x==='string').map(x=>(typeof canonicalExerciseId==='function')?canonicalExerciseId(x):x));break; /* #539: fold variant favorites into canonical */
    case 'progressionSetup':
      if(value&&typeof value==='object'){
        const incoming=value;
        Object.assign(progressionSetup,incoming);
        if(incoming.defaultRange&&typeof incoming.defaultRange==='object')progressionSetup.defaultRange={...progressionSetup.defaultRange,...incoming.defaultRange};
        if(Array.isArray(incoming.weeklyRanges))progressionSetup.weeklyRanges=incoming.weeklyRanges;
      }
      break;
    case 'dashboardPeriod':if(typeof value==='string')state.dashboardPeriod=value;break;
    case 'statsPeriod':if(typeof value==='string')state.statsPeriod=value;break;
    case 'logPeriod':if(typeof value==='string')state.logPeriod=value;break;
    case 'appearance':if(value&&typeof value==='object'&&typeof setAppearanceState==='function')setAppearanceState(value);break;
    /* #502/#408: sparse expanded-section map — only `true` values are
       meaningful; garbage never breaks the read path since
       applySettingsSectionsState only checks known keys for explicit true. */
    case 'settingsSections':{
      if(value&&typeof value==='object'&&!Array.isArray(value)){
        const clean={};
        for(const [k,v] of Object.entries(value))if(typeof k==='string'&&v===true)clean[k]=true;
        state.settingsSections=clean;
      }
      break;
    }
  }
}
/* Serializes the persist blob as pretty-printed JSON. */
function exportWorkoutData(){
  return JSON.stringify(collectPersistable(),null,2);
}
/* Downloads the persist blob as a JSON backup file. */
function downloadWorkoutBackup(){
  const blob=new Blob([exportWorkoutData()],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  const stamp=new Date().toISOString().slice(0,10);
  link.href=url;link.download=`workout-app-backup-${stamp}.json`;
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
/* #99 A5 recovery-prompt wiring (dialog markup lives in index.html, next to
   the other custom-dialogs). Export downloads the raw quarantined string and
   leaves the quarantine in place; Discard removes it. Closing via × keeps the
   copy set aside — it survives until the user decides. */
function corruptDataDownload(){
  if(!corruptQuarantineKey)return;
  Storage.loadBlob(corruptQuarantineKey).then(function(raw){
    const blob=new Blob([raw||''],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=`workout-app-corrupt-data-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }).catch(function(){});
}
$('#corruptDataExport')?.addEventListener('click',()=>{
  corruptDataDownload();
  if(typeof showToast==='function'){try{showToast('Damaged copy exported.');}catch(_){}}
  /* Stay open so "Discard it" is still one tap away after exporting. */
});
$('#corruptDataDiscard')?.addEventListener('click',()=>{
  if(corruptQuarantineKey){Storage.deleteBlob(corruptQuarantineKey).catch(function(){});}
  corruptQuarantineKey=null;
  $('#corruptDataDialog')?.close();
  if(typeof showToast==='function'){try{showToast('Damaged copy discarded.');}catch(_){}}
});
$('#closeCorruptData')?.addEventListener('click',()=>$('#corruptDataDialog')?.close());
/* Safety net: flush to localStorage every 5s and on page hide. Explicit schedulePersist()/persistNow() hooks remain the primary path. */
setInterval(persistNow,5000);
window.addEventListener('pagehide',persistSyncForUnload);
window.addEventListener('pagehide',persistNow);
