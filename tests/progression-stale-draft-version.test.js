'use strict';
/* #472/#473 follow-up (user 2026-09-15): suggestions are computed once at
   draft creation and persisted with the draft. A workout started under an
   older build kept that build's suggestion data after updating, so fixed bugs
   kept showing on the phone (136 lb from the pre-#473 whole-unit rounder on a
   v1.761 phone). prepareDraftProgression stamps the computing build version;
   maybeRefreshDraftSuggestions recomputes a version-stale draft exactly once
   per build — never clobbering applied cards, typed values, or completed
   sets. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{
  globals:{
    renderWorkoutProgression(){},
    renderWorkoutExercises(){},
    markDraftSaved(){},
    exercises:[{id:'pendlay-row',name:'Pendlay Row',equipment:'barbell'}],
  },
});
const {
  prepareDraftProgression, maybeRefreshDraftSuggestions,
  workoutState, state, progressionSetup,
}=role;

const EX='pendlay-row';
const PROF={mode:'reps',min:5,max:8,openTop:false,amrap:false,scheme:'rpe'};
function mkDraft(){
  return {
    programId:'p1',programWorkoutUid:'w1',name:'Full training',date:'2026-09-15',
    exercises:[{uid:'u1',exerciseId:EX,sets:[{uid:'s1',w:'',r:'',seconds:null,rpe:'',tags:[],complete:false}],progression:{...PROF}}],
    progressionSuggestions:[],
  };
}
function historyLog(){
  return mkLog('log1','2026-09-10',[mkItem(EX,[{w:125,r:8,rpe:8}],{progression:{...PROF}})],'Full training');
}
/* A stale draft as an older build persisted it: cards computed by the old
   whole-unit rounder (125 * 1.09 = 136.25 -> 136), stamped with the old build. */
function mkStaleDraft(){
  const d=mkDraft();
  d.suggestionVersion='1.760';
  d.progressionSuggestions=[{exerciseId:EX,kind:'load',mode:'reps',nextWeight:136,nextReps:5}];
  return d;
}

beforeEach(()=>{
  workoutState.completed=[];
  workoutState.draft=null;
  workoutState.activeProgram=null;
  progressionSetup.units='imperial';
  progressionSetup.threshold=8;
  progressionSetup.progressionOff=false;
  progressionSetup.progressAllSets=false;
  progressionSetup.incrementType='percent';
  progressionSetup.incrementValue=9;
  progressionSetup.timeStep=5;
  delete progressionSetup.dbEntry;
  state.workoutEditorOpen=false;
  delete globalThis.window.BUILD_INFO;
});

describe('stale-draft suggestion refresh (#472/#473 follow-up)',()=>{
  it('recomputes a version-stale draft with the current rounding',()=>{
    globalThis.window.BUILD_INFO={appVersion:'1.763'};
    workoutState.completed.unshift(historyLog());
    workoutState.draft=mkStaleDraft();
    state.workoutEditorOpen=true;
    assert.equal(maybeRefreshDraftSuggestions(),true);
    const sugs=workoutState.draft.progressionSuggestions;
    assert.equal(sugs.length,1);
    // 125 * 1.09 = 136.25 -> 5 lb grid -> 135 (the stale 136 is gone)
    assert.equal(sugs[0].nextWeight,135);
    assert.equal(sugs[0].nextReps,5);
    assert.equal(workoutState.draft.suggestionVersion,'1.763');
    // already refreshed for this build — a second call is a no-op
    assert.equal(maybeRefreshDraftSuggestions(),false);
  });
  it('leaves a stale draft alone when a card was already applied',()=>{
    globalThis.window.BUILD_INFO={appVersion:'1.763'};
    workoutState.completed.unshift(historyLog());
    const d=mkStaleDraft();
    d.exercises[0].suggestedTarget={w:'136',r:'5',seconds:''};
    workoutState.draft=d;
    state.workoutEditorOpen=true;
    assert.equal(maybeRefreshDraftSuggestions(),false);
    assert.equal(workoutState.draft.progressionSuggestions[0].nextWeight,136);
  });
  it('refreshes a stale draft even when the user typed values (#473)',()=>{
    globalThis.window.BUILD_INFO={appVersion:'1.763'};
    workoutState.completed.unshift(historyLog());
    const d=mkStaleDraft();
    d.exercises[0].sets[0].w='130';
    workoutState.draft=d;
    state.workoutEditorOpen=true;
    /* #473 (2026-09-15): typed values no longer block the refresh —
       prepareDraftProgression only rewrites progressionSuggestions, never
       set rows. The stale 136 card is replaced; the typed 130 stays. */
    assert.equal(maybeRefreshDraftSuggestions(),true);
    assert.equal(workoutState.draft.progressionSuggestions[0].nextWeight,135);
    assert.equal(workoutState.draft.exercises[0].sets[0].w,'130');
  });
  it('refreshes a stale draft even when a set is completed (#473)',()=>{
    globalThis.window.BUILD_INFO={appVersion:'1.763'};
    workoutState.completed.unshift(historyLog());
    const d=mkStaleDraft();
    d.exercises[0].sets[0].complete=true;
    workoutState.draft=d;
    state.workoutEditorOpen=true;
    assert.equal(maybeRefreshDraftSuggestions(),true);
    assert.equal(workoutState.draft.progressionSuggestions[0].nextWeight,135);
    assert.equal(workoutState.draft.exercises[0].sets[0].complete,true);
  });
  it('does not recompute a current-version draft that already has suggestions',()=>{
    globalThis.window.BUILD_INFO={appVersion:'1.763'};
    workoutState.completed.unshift(historyLog());
    workoutState.draft=mkDraft();
    state.workoutEditorOpen=true;
    prepareDraftProgression(workoutState.draft,{threshold:8});
    assert.equal(workoutState.draft.suggestionVersion,'1.763');
    assert.equal(workoutState.draft.progressionSuggestions.length,1);
    const before=workoutState.draft.progressionSuggestions[0].nextWeight;
    assert.equal(maybeRefreshDraftSuggestions(),false);
    assert.equal(workoutState.draft.progressionSuggestions[0].nextWeight,before);
  });
  it('stamps the computing version at draft creation',()=>{
    globalThis.window.BUILD_INFO={appVersion:'1.763'};
    workoutState.draft=mkDraft();
    prepareDraftProgression(workoutState.draft,{threshold:8});
    assert.equal(workoutState.draft.suggestionVersion,'1.763');
  });
});
