'use strict';
/* #380: suggestions are computed once at draft creation. If completed history
   arrives later (sync pull/adopt still in flight when Start was tapped),
   the draft must pick the suggestions up instead of rendering no suggestion
   rows while the Last chip reads the new history live. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{
  globals:{
    renderWorkoutProgression(){},
    renderWorkoutExercises(){},
    markDraftSaved(){},
    exercises:[{id:'incline-db-press',name:'Incline Dumbbell Press',equipment:'dumbbell'}],
  },
});
const {
  prepareDraftProgression, maybeRefreshDraftSuggestions,
  workoutState, state, progressionSetup,
}=role;

const EX='incline-db-press';
const PROF={mode:'reps',min:1,max:5,openTop:false,amrap:false,scheme:'rpe'};
function mkDraft(){
  return {
    programId:'p1',programWorkoutUid:'w1',name:'Chest',date:'2026-09-13',
    exercises:[{uid:'u1',exerciseId:EX,sets:[{uid:'s1',w:'',r:'',seconds:null,rpe:'',tags:[],complete:false}],progression:{...PROF}}],
    progressionSuggestions:[],
  };
}
function historyLog(){
  return mkLog('log1','2026-09-03',[mkItem(EX,[{w:70,r:8,rpe:8}],{progression:{...PROF}})],'Chest');
}

beforeEach(()=>{
  workoutState.completed=[];
  workoutState.draft=null;
  workoutState.activeProgram=null;
  progressionSetup.units='imperial';
  state.workoutEditorOpen=false;
});

describe('maybeRefreshDraftSuggestions (#380)',()=>{
  it('picks up suggestions when history arrives after draft creation',()=>{
    workoutState.draft=mkDraft();
    state.workoutEditorOpen=true;
    prepareDraftProgression(workoutState.draft,{threshold:8});
    assert.equal(workoutState.draft.progressionSuggestions.length,0);
    /* Sync pull lands the Sep 3 log after Start was tapped. */
    workoutState.completed.unshift(historyLog());
    assert.equal(maybeRefreshDraftSuggestions(),true);
    const sugs=workoutState.draft.progressionSuggestions;
    assert.equal(sugs.length,1);
    assert.equal(sugs[0].exerciseId,EX);
    /* QA batch 2026-09-22: the 5 lb increment steps each dumbbell — 70 total
       is 35 per DB, so the suggestion is 80 total (40 per DB), not the old
       70+5=75 → even-total 76. */
    assert.equal(sugs[0].nextWeight,80);
    assert.equal(sugs[0].nextReps,1);
    /* #402: refreshed suggestions wait for a tap — nothing is stamped. */
    assert.equal(workoutState.draft.exercises[0].suggestedTarget,undefined);
    assert.equal(workoutState.draft.exercises[0].sets[0].w,'');
  });
  it('leaves a draft that already has suggestions alone',()=>{
    workoutState.completed.unshift(historyLog());
    workoutState.draft=mkDraft();
    state.workoutEditorOpen=true;
    prepareDraftProgression(workoutState.draft,{threshold:8});
    assert.equal(workoutState.draft.progressionSuggestions.length,1);
    const before=workoutState.draft.progressionSuggestions[0].nextWeight;
    workoutState.completed.unshift(mkLog('log2','2026-09-10',[mkItem(EX,[{w:75,r:1,rpe:8}],{progression:{...PROF}})],'Chest'));
    assert.equal(maybeRefreshDraftSuggestions(),false);
    assert.equal(workoutState.draft.progressionSuggestions[0].nextWeight,before);
  });
  it('does not spend its one retry until relevant history exists',()=>{
    workoutState.draft=mkDraft();
    state.workoutEditorOpen=true;
    /* No history anywhere yet: the retry stays unspent … */
    assert.equal(maybeRefreshDraftSuggestions(),false);
    assert.equal(workoutState.draft.suggestionsRefreshed||false,false);
    /* … so when history finally arrives, the recompute still fires. */
    workoutState.completed.unshift(historyLog());
    assert.equal(maybeRefreshDraftSuggestions(),true);
    assert.equal(workoutState.draft.progressionSuggestions.length,1);
    /* And now the retry is spent — a second merge must not rescan. */
    assert.equal(maybeRefreshDraftSuggestions(),false);
  });
  it('never touches edit-history drafts',()=>{
    workoutState.completed.unshift(historyLog());
    workoutState.draft=mkDraft();
    workoutState.draft.editingId='log1';
    state.workoutEditorOpen=true;
    assert.equal(maybeRefreshDraftSuggestions(),false);
    assert.equal(workoutState.draft.progressionSuggestions.length,0);
  });
  it('does nothing when the editor is not open',()=>{
    workoutState.completed.unshift(historyLog());
    workoutState.draft=mkDraft();
    state.workoutEditorOpen=false;
    assert.equal(maybeRefreshDraftSuggestions(),false);
  });
});
