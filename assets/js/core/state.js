/* ===== module: state.js ===== */
/** Holds in-memory UI and training state. App data is persisted to localStorage by persistence.js.
    #99 B9: every field the app reads or writes on `state` / `workoutState` is
    declared in the per-domain factories below — they are the authoritative
    shape of app state. Fields that start life "absent" (first assigned later
    by their owning module) are declared with an explicit `undefined`: the
    shape is complete, while the persisted JSON is unchanged (JSON.stringify
    omits undefined values) and every boot-time read keeps its old falsy value.
    The two globals: `state` = UI state (freshLibraryState: library filters/favorites;
    freshNavState: activeView, periods, calendarWeekOffset, return routes;
    freshBuilderState: draft builder) — `workoutState` = user training data
    (freshWorkoutData: completed, templates, customExercises, tags). `progressionSetup`
    = global progression defaults (freshProgressionSetup).
    Factories return fresh objects (fresh Sets/arrays) so a reset can never
    share mutable state with a previous incarnation. */
    /* Module map (v1.006) — Key: state, workoutState, customDraft, progressionSetup, DEFAULT_PROGRESSION_SETUP, the fresh*() factories. Depends on: none (pure shape factories). */
const DEFAULT_SET_TAGS=['Warmup','Dropset','Full ROM','Slow and controlled','Cheat set','Paused','Assisted','Failure']; /* #383 (user 2026-09-13): renamed from 'To failure'. */
/* #185 (user 2026-09-13): the Warmup set tag is organizational only — a
   warm-up set counts in every calculation (volume, PRs, e1RM). The one
   exception is the progression trigger: warm-up sets never trigger a
   progression suggestion (see topSetForSession in progression.js). */
const WARMUP_TAG='Warmup';
/* True when the set carries the Warmup tag. */
function isWarmupSet(set){return !!set&&(set.tags||[]).includes(WARMUP_TAG);}
const DEFAULT_EXERCISE_TAG_PRESETS=['Main lift','Accessory','Unilateral','Straight sets','Tempo','Technique','Rehab','To failure'];
/* Library tab UI: filters, selection, user-created exercises. */
function freshLibraryState(){return {query:'',muscles:new Set(),equipment:'',favorites:new Set(),onlyFavorites:false,onlyCustom:false,selected:null,customExercises:[]};}
/* Navigation + routing-adjacent UI state (navigation.js, workout-history.js,
   app-bootstrap.js own these). */
function freshNavState(){return {activeView:'dashboard',workoutDetailReturn:'workout',workoutHistoryOpen:false,workoutEditorOpen:false,exerciseDetailReturn:null,workoutDetailExerciseId:undefined,workoutDetailExerciseReturn:undefined,dashboardPeriod:'week',statsPeriod:'week',logPeriod:'all',topExercisesMode:'volume',muscleVolumeMode:'volume',muscleMapMode:'volume',selectedDashboardDate:null,calendarWeekOffset:0,workoutSubScreen:null,programWorkoutUid:null,savedProgramPreviewId:null,returnTo:undefined,settingsPushed:undefined,settingsReturn:undefined,builderReturn:null,sharePreview:null,shareReturn:null,homeHydrated:false,scroll:{dashboard:0,library:0,'workout:start':0,'workout:editor':0,'workout:complete':0,'workout:history':0,program:0,stats:0,settings:0,detail:0},
  /* #502/#408 (user 2026-09-16): Settings section expansion state — sparse
     map of expanded sections ({appearance:true}); absence means collapsed, so
     fresh profiles start all-collapsed. Persisted locally with the rest
     of state (collectPersistable). */
  settingsSections:{}};}
/* Saved-workout builder draft state (programs.js owns these). */
function freshBuilderState(){return {builderOpen:undefined,savedBuilder:undefined,savedWorkoutId:undefined,savedFilter:undefined};}
/* #99 C1 (rule AND its exceptions): `state` = UI/session state (which tab is
   open, filters, scroll positions, dialog targets); `workoutState` = the
   training domain — the user's data, persisted locally on this device
   (completed workouts, templates, programs, drafts). Historical
   exceptions sit on `state` even though they are user data: `state.favorites`
   and `state.customExercises` (kept here for legacy reasons, but persisted
   via collectPersistable() in persistence.js).
   Everything else the user owns lives in `workoutState`. */
const state=Object.assign(freshLibraryState(),freshNavState(),freshBuilderState());
const customDraft = { primary:new Set(), secondary:new Set(), equipment:'', force:'', mechanic:'', tracking:'reps' };
/* Training data + editor targets (workout-*.js, programs.js own these). */
function freshWorkoutData(){return {
  draft:null,
  completed:[],
  templates:[], /* P0 hotfix 2026-09-11 (v0.99e): was cloneWorkoutTemplates() at
    load — but the factories it needs (workout-editor.js) load AFTER state.js,
    so that threw ReferenceError and killed the app. Built-ins are populated in
    app-bootstrap.js init instead, after every script has loaded. */
  tags:[...DEFAULT_SET_TAGS],
  exerciseTagPresets:[...DEFAULT_EXERCISE_TAG_PRESETS],
  tagTarget:null,
  exerciseTagTarget:null,
  supersetTarget:null,
  pickerMode:'draft',
  programWorkoutTarget:null,
  activeProgram:null,
  archivedPrograms:[],
  /* #392 (user 2026-09-13): saved programs sit above Archived in the Program
     tab — a home for shared programs and anything parked for later. */
  savedPrograms:[],
  /* #99 C2: the exercise-picker "swap mode" stash — written in
     workout-builder.js (openExercisePicker swap path), consumed by
     performExerciseSwap, cleared by persistence.js:286 on reset. Declared
     here as `undefined` (shape-complete, but never in the persisted JSON —
     see the banner) so the factory's "every field declared" promise holds. */
  pickerSwapUid:undefined,
  templateEditTarget:undefined
};}
const workoutState=freshWorkoutData();
/* Canonical progression defaults (efficiency pass 2026-09-12): one
   deep-copyable source. The live object is const (never reassigned), so
   resets copy fresh values INTO it — every reset path shares this. */
const DEFAULT_PROGRESSION_SETUP={threshold:8,incrementType:'lb',incrementValue:5,timeStep:5,treatment:'suggestions',scheme:'linear',percentOf1RM:75,deloadPct:60,pctWave:false,weeklyPcts:[],weeklyDeloads:[],defaultRange:{preset:'hypertrophy',min:6,max:12,openTop:false,amrap:false},undulating:false,cycleLength:0,weeklyRanges:[],units:'imperial',statsDefaultMetric:'volume',programMuscleView:'chart',warmupRungs:2,warmupLadder:[{pct:40,reps:5},{pct:60,reps:3},{pct:80,reps:2}],dbEntry:'per',dbEntryPrefs:{},singleDbPrefs:{},hideDbTotal:false,defaultSetCount:3,trainingDays:3,progressionOff:false,effortMode:'rpe'};
/* Deep-copies the default progression settings. */
function freshProgressionSetup(){return JSON.parse(JSON.stringify(DEFAULT_PROGRESSION_SETUP));}
/* QA batch (user 2026-09-22): Auto Deload removed entirely. Stored blobs
   carrying the old autoDeload/deloadEvery keys normalize to off/removed —
   the keys are deleted so nothing downstream can resurrect the schedule.
   deloadPct stays: it still sizes the manual per-week deload flags in the
   %1RM wave panel (#478). */
function normalizeProgression(p){
  if(p&&typeof p==='object'){
    delete p.autoDeload;
    delete p.deloadEvery;
  }
  /* #405: progression off-switch — boolean coercion for stored blobs written
     before the flag existed (undefined → false). */
  if(p&&typeof p==='object'&&typeof p.progressionOff!=='boolean'){
    p.progressionOff=!!p.progressionOff;
  }
  /* QA batch (user 2026-09-22): the "All sets" toggle is retired — per-set
     targets are the only path now. Delete the legacy key. (Was #400.) */
  if(p&&typeof p==='object'&&'progressAllSets' in p){
    delete p.progressAllSets;
  }
  /* QA batch (user 2026-09-22): "Advance on completion" is now the fourth
     RPE-threshold choice ("On completion") — the standalone toggle is gone.
     Stored blobs with the old flag migrate: advanceOnCompletion:true →
     threshold:'completion'. The engine still honors a legacy flag on
     program configs that never passed through here. */
  if(p&&typeof p==='object'){
    if(p.advanceOnCompletion===true)p.threshold='completion';
    delete p.advanceOnCompletion;
    const t=p.threshold;
    p.threshold=(t==='completion'||t===7||t===8||t===9)?t:(Number(t)===7||Number(t)===9?Number(t):8);
  }
  /* User 2026-09-22: the stale-basis age cap is hard-baked as
     SUGGESTION_BASIS_WEEKS (formulas/progression-analysis.js) — the stored
     setting is gone, so drop the legacy field from old blobs. */
  if(p&&typeof p==='object'){
    delete p.basisCapWeeks;
  }
  /* QA batch (user 2026-09-21): RPE/RIR effort-column display preference —
     stored blobs predate it, so coerce anything unexpected to RPE. The
     stored set value stays canonical RPE; this only changes display/entry. */
  if(p&&typeof p==='object'){
    p.effortMode=p.effortMode==='rir'?'rir':'rpe';
  }
  /* #118 (user 2026-09-16): periodization cycle length — 0 = Off, else one of
     4/6/8/12 weeks. The old "Vary rep ranges by week" toggle becomes this
     cycle picker (Off replaces the toggle). Legacy blobs that had undulating
     on keep a cycle: their own length when it is a supported one, else the
     8-week default. `undulating` stays synced as cycleLength>0 for readers
     that never migrated. */
  if(p&&typeof p==='object'){
    const n=Number(p.cycleLength);
    if(n!==4&&n!==6&&n!==8&&n!==12){
      const legacyLen=Array.isArray(p.weeklyRanges)?p.weeklyRanges.length:0;
      p.cycleLength=p.undulating?(legacyLen===4||legacyLen===6||legacyLen===8||legacyLen===12?legacyLen:8):0;
    }
    p.undulating=p.cycleLength>0;
  }
  /* #410 (user 2026-09-13): dumbbell weight entry mode — 'per' (per dumbbell,
     the default) or 'total'. dbEntryPrefs holds per-exercise overrides keyed
     by exercise id, set from the live workout's Exercise options.
     #538 (user 2026-09-17): singleDbPrefs holds the same keyed shape for the
     single-dumbbell flag (true = this exercise uses one dumbbell, so per-mode
     entry must not double); unset/absent means a pair (today's behavior). */
  if(p&&typeof p==='object'){
    if(p.dbEntry!=='per'&&p.dbEntry!=='total')p.dbEntry='per';
    /* #89 (user 2026-09-14): program muscle card default view — 'chart' or 'heatmap'. */
    if(p.programMuscleView!=='chart'&&p.programMuscleView!=='heatmap')p.programMuscleView='chart';
    if(!p.dbEntryPrefs||typeof p.dbEntryPrefs!=='object'||Array.isArray(p.dbEntryPrefs))p.dbEntryPrefs={};
    if(!p.singleDbPrefs||typeof p.singleDbPrefs!=='object'||Array.isArray(p.singleDbPrefs))p.singleDbPrefs={};
  }
  /* #506 (v1.8): onboarding days-per-week answer — 1..7, default 3. Stored
     blobs written before the field existed coerce to the default. */
  if(p&&typeof p==='object'){
    p.trainingDays=Math.min(7,Math.max(1,Math.round(Number(p.trainingDays)||3)));
  }
  /* #185: the warm-up ladder is 3 rung slots; the stepper picks 1..3. */
  if(p&&typeof p==='object'){
    const clean=Array.isArray(p.warmupLadder)?p.warmupLadder:[];
    p.warmupLadder=[0,1,2].map(i=>{
      const src=clean[i]||{},dflt=DEFAULT_PROGRESSION_SETUP.warmupLadder[i];
      return {
        pct:Math.min(100,Math.max(1,Math.round(Number(src.pct)||dflt.pct))),
        reps:Math.max(1,Math.round(Number(src.reps)||dflt.reps))
      };
    });
    p.warmupRungs=Math.min(3,Math.max(1,Math.round(Number(p.warmupRungs)||2)));
  }
  return p;
}
/* Resets progressionSetup in place to fresh defaults. */
function resetProgressionSetup(){
  const fresh=freshProgressionSetup();
  Object.keys(progressionSetup).forEach(k=>delete progressionSetup[k]);
  Object.assign(progressionSetup,fresh);
}
const progressionSetup = freshProgressionSetup();
