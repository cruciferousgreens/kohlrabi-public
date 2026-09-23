'use strict';
/* ROLE -> app source files. THE ONLY file that changes when the tree
   restructures: test files must never import app sources by path — only
   via this map (loaded through tests/harness.js). Paths are repo-rooted.
   Post-v1.000 current paths (csv-import.js / share-codec.js
   are the B1/B16 splits). */
const SHARE_FACTORY_STUBS=`
/* Test-only stubs for the share-codec role. newSet/newExerciseItem live in
   workout-editor.js (DOM-heavy, not loaded here); these mirror the shapes
   cloneExerciseItemFromShare relies on (uid + exercise/set fields). */
globalThis.__testUidCounter=0;
function newSet(){return {uid:'set-test-'+(++globalThis.__testUidCounter),w:'',r:'',seconds:'',distance:'',rpe:'',targetRpe:'',tags:[],complete:false};}
function newExerciseItem(opts){opts=opts||{};return {uid:'ex-test-'+(++globalThis.__testUidCounter),exerciseId:opts.exerciseId||'',tracking:opts.tracking||'reps',metrics:Array.isArray(opts.metrics)?[...opts.metrics]:null,note:opts.note||'',noteOpen:false,exerciseTags:opts.exerciseTags||[],supersetId:opts.supersetId||null,progression:opts.progression||null,sets:opts.sets||[]};}
`;
const WARMUP_UI_STUBS=`
/* Test-only DOM stubs for the warmup-ui role. The app's own \$(…) (utilities.js)
   delegates to document.querySelector, so point that at a fake element with a
   settable innerHTML; querySelectorAll stays [] so wire-up loops no-op. */
function __warmupFakeEl(){
  return {
    set innerHTML(v){this._html=String(v);}, get innerHTML(){return this._html||'';},
    set textContent(v){this._text=String(v);}, get textContent(){return this._text||'';},
    querySelector:()=>__warmupFakeEl(), querySelectorAll:()=>[],
    addEventListener(){}, removeEventListener(){},
    setAttribute(){}, getAttribute:()=>null, remove(){},
    showModal(){}, close(){}, focus(){}, scrollIntoView(){},
    classList:{add(){},remove(){},toggle(){},contains:()=>false},
    style:{}, dataset:{}, disabled:false, hidden:false, value:'',
  };
}
document.querySelector=(sel)=>__warmupFakeEl();
document.getElementById=(id)=>__warmupFakeEl();
const CSS={escape:(s)=>String(s)};
/* persistence.js is not in this role; the editor only calls schedulePersist
   (a debounced save) after warm-up mutations, so a no-op is faithful. */
function schedulePersist(){}
/* Minimal exercise catalog: the live editor only needs id/equipment/name. */
const exercises=[
  {id:'bench-press',name:'Barbell Bench Press',equipment:'barbell'},
  {id:'plank',name:'Plank',equipment:'body only'},
];
`;
const FOCUS_PRESET_STUBS=WARMUP_UI_STUBS+`
/* Focus-preset role extras: navigation + the heavy render passes are outside
   this role — the focus wiring only needs the draft object, so they no-op. */
function showWorkouts(){}
function renderWorkoutScreen(){}
function renderCompletedWorkout(){}
function renderProgram(){}
function renderLibrary(){}
function renderDashboard(){}
function renderStats(){}
function updateTopBar(){}
function persistNow(){}
function markDraftSaved(){}
function showToast(){}
const ROUTES={DETAIL_RETURN:{WORKOUT:'workout',PROGRAM:'program',LOG:'log'}};
`;
/* Scroll-jank cluster #488/#491/#496: set-tags.js calls these two persist
   hooks; neither backing module is in the tag-dialog-jank role, so they
   no-op. */
const TAG_DIALOG_JANK_STUBS=`
function schedulePersist(){}
function markDraftSaved(){}
`;
module.exports={
  /* v1.878 restructure: the v1.867 trainer workspace prototype was removed in
     v1.877; its module-map role (referencing deleted files) is deleted too. */
  /* Catalog normalization (#280, user 2026-09-13): defaultExerciseTracking
     defaults cardio-category exercises to time tracking. Loads the bundled
     data + catalog; the stub window has no FREE_EXERCISE_DB so the
     coreExercises fallback is used (no DOM needed). */
  'catalog-logic':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/data/exercise-data.js',
    'assets/js/data/catalog.js',
  ]},
  /* Kettlebell equipment vocabulary (#485, user 2026-09-15): loads the real
     bundled database (data/exercises-db.js sets window.FREE_EXERCISE_DB on
     the stub, exactly like index.html's script order) before
     exercise-data.js/catalog.js, so `exercises` is the full catalog rather
     than the 24-row coreExercises fallback. utilities.js is included for
     exerciseWeightOptional. */
  'catalog-db-logic':{files:[
    'data/exercises-db.js',
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/data/exercise-data.js',
    'assets/js/data/catalog.js',
  ]},
  /* #539 (user 2026-09-17): exercise-name consolidation. Variant entries
     carry aliasOf -> canonical id; lookups resolve to the canonical and
     listings exclude variants. Needs the library (filteredExercises,
     getExerciseLogs) over the real DB. */
  'alias-539':{files:[
    'data/exercises-db.js',
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/data/exercise-data.js',
    'assets/js/data/catalog.js',
    'assets/js/pages/exercise-library.js',
  ]},
  /* Save-as-template (#240, user 2026-09-12): saveCompletedAsTemplate stamps
     the log id on the template and swaps the completed view's button to
     Start. Needs state (workoutState) + utilities (ids, cloning, dates). */
  'saved-workout-template':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/workout/supersets.js',
    'assets/js/pages/saved-workouts.js',
  ]},
  /* Progression engine: needs state (workoutState/progressionSetup),
     utilities (units, rounding deps), exercise-library (real getExerciseLogs
     over workoutState.completed), exercise-metrics (metric
     helpers), exercise-detail (estimate1RM), programs
     (programPctForWeek/isDeloadWeek), then progression itself. */
  'progression-logic':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/pages/exercise-library.js',
    'assets/js/workout/exercise-metrics.js',
    'assets/js/pages/exercise-detail.js',
    'assets/js/pages/programs.js',
    'assets/js/workout/progression.js',
  ]},
  /* Superset grouping logic (#116): normalizeSupersets + the group-toggle rule
     against state/utilities only — no DOM. */
  'superset-logic':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/workout/supersets.js',
  ]},
  /* Warm-up UI integration (#185): renders liveExerciseCardHtml and drives
     the real addWarmupSets/doRemoveWarmups against stubbed DOM. Needs the
     full editor chain (state → utilities → exercise-detail → exercise-library
     → programs → progression → supersets/set-tags → workout-editor). */
  'warmup-ui':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/pages/exercise-library.js',
    'assets/js/workout/exercise-metrics.js',
    'assets/js/pages/exercise-detail.js',
    'assets/js/pages/programs.js',
    'assets/js/workout/progression.js',
    'assets/js/workout/supersets.js',
    'assets/js/workout/set-tags.js',
    'assets/js/workout/workout-editor.js',
    'assets/js/pages/saved-workouts.js',
  ],inject:WARMUP_UI_STUBS},
  /* Focus auto-select (user 2026-09-13): drives the real doStartProgramWorkout /
     startWorkoutFromTemplate / finishWorkout against stubbed DOM + stubbed
     navigation/render collaborators, asserting draft.focusPreset is set from
     the program week range, the template focusKey, and the finished log. */
  'focus-preset':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/pages/exercise-library.js',
    'assets/js/workout/exercise-metrics.js',
    'assets/js/pages/exercise-detail.js',
    'assets/js/pages/programs.js',
    'assets/js/workout/progression.js',
    'assets/js/workout/supersets.js',
    'assets/js/workout/set-tags.js',
    'assets/js/workout/workout-editor.js',
    'assets/js/pages/saved-workouts.js',
    'assets/js/workout/workout-history.js',
  ],inject:FOCUS_PRESET_STUBS},
  /* Share-link codec: state (state.customExercises) + utilities (uid,
     defaultExerciseProgression, cloneExerciseItemFromShare, cleanTargetRpe)
     + the codec. Factories stubbed (see above). */
  'share-codec':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/share/share-codec.js',
  ],inject:SHARE_FACTORY_STUBS},
  /* CSV/XLSX import parse layer: obCsvFuzzy reads the global `exercises`
     catalog — tests inject the fixture catalog as a global. The global
     EXERCISE_ALIASES from data/exercise-aliases.js rides along so alias
     assertions exercise the real bundled alias table. */
  'csv-import':{files:[
    'data/exercise-aliases.js',
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/csv-import.js',
  ]},
  /* Shared helpers: state (progressionSetup) + exercise-detail (estimate1RM,
     needed by detectExercisePRs) + utilities. */
  'utilities':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/pages/exercise-detail.js',
  ]},
  /* Exercise math: estimate1RM + chart helpers. chartXLabels calls
     escapeHtml, so utilities (and its state.js dependency) ride along. */
  'exercise-math':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/pages/exercise-detail.js',
  ]},
  /* Stats math: state (workoutState) + utilities (localIsoDate, setVolume,
     SECONDARY_MUSCLE_WEIGHT, weightUnit, displayVolume) + dashboard-stats.
     Tests inject the fixture catalog as global `exercises`. */
  'stats-math':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/pages/dashboard-stats.js',
  ]},
  /* Loading skeletons (#409, user 2026-09-14): skeleton builders/painters,
     the shared aggregation + exercise map, and the memoized history paths.
     dashboard-stats rides along so exerciseById/hydrateBodyMaps exist for
     exercise-detail's renderHistory/hydrateExerciseDetail. */
  'loading-skeletons-409':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/pages/dashboard-stats.js',
    'assets/js/pages/exercise-library.js',
    'assets/js/pages/exercise-detail.js',
  ]},
  /* Route restore (#351, user 2026-09-14): the update-reload stash/restore
     pair in app-updates.js. Tests drive stashRouteForUpdateReload /
     restoreRouteAfterUpdateReload directly against a stubbed
     sessionStorage; showWorkouts is stubbed by the test. */
  'route-restore':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/core/app-updates.js',
  ]},
  /* Workout-history logic: invalidSetsIn/isEmptySet (finish-review rules),
     deleteCompletedWorkoutLanding (#188: delete from logs stays on logs),
     reviewDeleteEmptiesOutcome (#189: no second modal when the rest is
     value-valid). navigation.js rides along for ROUTES/returnRouteKey.
     Tests inject the fixture catalog as global `exercises`. */
  'workout-history-logic':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/core/navigation.js',
    'assets/js/workout/workout-history.js',
    'assets/js/workout/exercise-metrics.js',
  ]},
  /* Exercise-picker scroll anchor (#192, user 2026-09-12): the pure
     close-scroll rule lives in workout-builder.js next to the picker
     session state. workout-builder.js loads clean under the stub DOM. */
  'picker-scroll':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/workout/workout-builder.js',
  ]},
  /* Workout-screen pane selection (#187, user 2026-09-12): workoutPaneSelection
     (workout-editor.js) — the logs list opens over a live draft — plus the
     #196 no-program home layout decision (workoutHomeLayout).
     workout-editor.js loads clean under the stub DOM. */
  'workout-screen-logic':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/workout/supersets.js',
    'assets/js/workout/workout-editor.js',
    'assets/js/workout/exercise-metrics.js',
  ]},
  /* #563: share import mutates the catalog in place (unshift), so the test
     needs the real catalog.js map cache in the same scope as share.js to
     prove the imported exercises resolve without a reload. */
  'share-import-logic':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/data/exercise-data.js',
    'assets/js/data/catalog.js',
    'assets/js/share/share-codec.js',
    'assets/js/share/share.js',
  ]},
  /* Timed PR label (#282, user 2026-09-12): livePRLabel over timed history.
     workout-editor rides on exercise-library's real getExerciseLogs. */
  'pr-label-logic':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/workout/supersets.js',
    'assets/js/workout/workout-editor.js',
    'assets/js/pages/exercise-library.js',
    'assets/js/workout/exercise-metrics.js',
    'assets/js/pages/exercise-detail.js',
  ]},
  /* Exercise-detail timed logic (#278/#281, user 2026-09-12): statsFor,
     exerciseTrendData, and sessionBestLabel over timed-only history.
     Needs exercise-library for the real getExerciseLogs. */
  'exercise-detail-logic':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/pages/exercise-library.js',
    'assets/js/workout/exercise-metrics.js',
    'assets/js/pages/exercise-detail.js',
  ]},
  /* #504 (v1.8) empty states: the shared emptyStateHtml builder (utilities),
     the logs first-use/filtered-void states (workout-editor), the library
     zero-results reset (exercise-library), and the program/saved-program
     first-use states (programs). dashboard-stats rides along for
     workoutsForPeriod/periodTabs/muscleHeatmapMarkup; exercise-detail rides
     along for the same reason as program-muscle-view. */
  'empty-states-504':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/workout/supersets.js',
    'assets/js/workout/workout-editor.js',
    'assets/js/pages/exercise-library.js',
    'assets/js/workout/exercise-metrics.js',
    'assets/js/pages/exercise-detail.js',
    'assets/js/pages/dashboard-stats.js',
    'assets/js/workout/progression.js',
    'assets/js/pages/programs.js',
  ]},
  /* Program muscle card view (#89, user 2026-09-14): the card renders one
     view — Chart or the Stats anatomical Heat map — chosen only by
     Settings → Units → "Program muscle card" (no card toggle). Tests pin
     the pure builders + view resolution over the real muscleHeatmapMarkup
     (dashboard-stats) and programMuscles (programs). */
  'program-muscle-view':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/pages/dashboard-stats.js',
    'assets/js/pages/programs.js',
    'assets/js/pages/exercise-library.js',
    'assets/js/pages/exercise-detail.js',
  ]},
  /* Set tags in saved workout templates (#210, user 2026-09-12): the
     template clone chain must carry set tags (builder persist +
     template start), and the builder UI must route the shared tag dialog
     to the builder's sets. */
  /* Scroll-jank cluster #488/#491/#496: drives the real tag-dialog tap
     handlers against a fake DOM, asserting taps never rebuild the dialog
     (the iOS focus-drop scroll jump). Minimal role: state + utilities +
     set-tags; persistence.js / workout-editor.js are not loaded, so the two
     persist hooks they provide are stubbed here. */
  /* Set tags in saved workout templates (#210, user 2026-09-12): the
     template clone chain must carry set tags (builder persist +
     template start), and the builder UI must route the shared tag dialog
     to the builder's sets. */
  'template-set-tags':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
  ],inject:SHARE_FACTORY_STUBS},
  /* Scroll-jank cluster #488/#491/#496: drives the real tag-dialog tap
     handlers against a fake DOM, asserting taps never rebuild the dialog
     (the iOS focus-drop scroll jump). Minimal role: state + utilities +
     set-tags; persistence.js / workout-editor.js are not loaded, so the two
     persist hooks they provide are stubbed here. */
  'tag-dialog-jank':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/workout/set-tags.js',
  ],inject:TAG_DIALOG_JANK_STUBS},
  /* Onboarding flow v2 (#506, v1.8): the first-run gating decision, the
     branch settings application, and the Done summary are pure over
     state.js + utilities.js + onboarding.js. applyRepPreset (programs.js)
     and schedulePersist (persistence.js) are absent, so onboarding.js's
     guarded fallback paths run — the settings assertions exercise them. */
  'onboarding-506':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/pages/onboarding.js',
  ]},
  /* Persistence unload durability (public fork): wipeLocalUserData() must
     await IndexedDB durability before callers reload, and pagehide must
     stash a synchronous localStorage copy when debounced IDB writes are
     still in flight. Same file set the old subscriptions-511 role carried. */
  'persistence-unload':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/core/storage.js',
    'assets/js/core/persistence.js',
    'assets/js/pages/onboarding.js',
  ]},
  /* Persist-path coalescing (#527/#528, agent QA 2026-09-17): rapid successive
     settings changes must all land in the one debounced write, a change that
     lands while persistNow's async read is in flight must survive, the
     pagehide safety net must carry never-debounced changes, and
     programMuscleView must round-trip through the blob. The file set covers
     the persistence chain (persistence.js + storage.js) without onboarding.js. */
  'persist-settings-527-528':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/core/storage.js',
    'assets/js/core/persistence.js',
  ],inject:`let exercises=[];`},
  /* Distance metrics (#498): distance/time/load metric profiles, distance
     suggestions/cards, distance share round-trips, and the non-volume
     exclusion. Full chain so distance progression runs against real
     getExerciseLogs; tests inject the fixture catalog as global `exercises`. */
  'exercise-metrics':{files:[
    'assets/js/formulas/units.js',
    'assets/js/formulas/volume.js',
    'assets/js/formulas/rpe.js',
    'assets/js/formulas/e1rm.js',
    'assets/js/formulas/increments.js',
    'assets/js/formulas/prs.js',
    'assets/js/formulas/program-math.js',
    'assets/js/formulas/progression-analysis.js',
    'assets/js/components/empty-states.js',
    'assets/js/core/state.js',
    'assets/js/lib/utilities.js',
    'assets/js/pages/exercise-library.js',
    'assets/js/workout/exercise-metrics.js',
    'assets/js/pages/exercise-detail.js',
    'assets/js/pages/programs.js',
    'assets/js/workout/progression.js',
    'assets/js/share/share-codec.js',
    'assets/js/workout/workout-editor.js',
    'assets/js/workout/workout-history.js',
  ]},
};
