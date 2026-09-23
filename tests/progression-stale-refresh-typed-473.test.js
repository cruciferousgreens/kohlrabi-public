'use strict';
/* #473 (user 2026-09-15): the stale-draft refresh guard used to bail when the
   draft had ANY typed set values or completed sets — so an in-progress draft
   kept showing old cards (stale 136 lb) after an update. The refresh only
   rewrites draft.progressionSuggestions and never touches set rows, so typed
   values / completed sets are safe and must NOT block it. Only an applied
   card (suggestedTarget) blocks the refresh — suggestion.applied=true lives
   on the suggestion objects the recompute would replace, and refreshing
   after apply would lose the "Applied ✓" state. */
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
  maybeRefreshDraftSuggestions,
  workoutState, state, progressionSetup,
}=role;

const EX='pendlay-row';
const PROF={mode:'reps',min:5,max:8,openTop:false,amrap:false,scheme:'rpe'};
/* A stale draft as an older build persisted it: cards computed by the old
   whole-unit rounder (125 * 1.09 = 136.25 -> 136), stamped with the old
   build — with TYPED set values but no applied card. */
function mkTypedStaleDraft(){
  return {
    programId:'p1',programWorkoutUid:'w1',name:'Full training',date:'2026-09-15',
    suggestionVersion:'1.760',
    progressionSuggestions:[{exerciseId:EX,kind:'load',mode:'reps',nextWeight:136,nextReps:5}],
    exercises:[{uid:'u1',exerciseId:EX,sets:[{uid:'s1',w:'125',r:'8',seconds:null,rpe:'',tags:[],complete:false}],progression:{...PROF}}],
  };
}
function historyLog(){
  return mkLog('log1','2026-09-10',[mkItem(EX,[{w:125,r:8,rpe:8}],{progression:{...PROF}})],'Full training');
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

describe('stale-draft refresh with typed values (#473)',()=>{
  it('refreshes a stale draft whose sets have typed values',()=>{
    globalThis.window.BUILD_INFO={appVersion:'1.763'};
    workoutState.completed.unshift(historyLog());
    workoutState.draft=mkTypedStaleDraft();
    state.workoutEditorOpen=true;
    assert.equal(maybeRefreshDraftSuggestions(),true);
    // 125 * 1.09 = 136.25 -> 5 lb grid -> 135 (the stale 136 is gone)
    assert.equal(workoutState.draft.progressionSuggestions[0].nextWeight,135);
    assert.equal(workoutState.draft.suggestionVersion,'1.763');
  });
  it('leaves the typed set values untouched by the refresh',()=>{
    globalThis.window.BUILD_INFO={appVersion:'1.763'};
    workoutState.completed.unshift(historyLog());
    workoutState.draft=mkTypedStaleDraft();
    state.workoutEditorOpen=true;
    maybeRefreshDraftSuggestions();
    const item=workoutState.draft.exercises[0];
    assert.equal(item.sets[0].w,'125');
    assert.equal(item.sets[0].r,'8');
    assert.equal(item.sets[0].complete,false);
  });
  it('still blocks the refresh when a card was applied (suggestedTarget set)',()=>{
    globalThis.window.BUILD_INFO={appVersion:'1.763'};
    workoutState.completed.unshift(historyLog());
    const d=mkTypedStaleDraft();
    d.exercises[0].suggestedTarget={w:'136',r:'5',seconds:''};
    workoutState.draft=d;
    state.workoutEditorOpen=true;
    assert.equal(maybeRefreshDraftSuggestions(),false);
    assert.equal(workoutState.draft.progressionSuggestions[0].nextWeight,136);
  });
});
