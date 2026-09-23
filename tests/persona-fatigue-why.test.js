'use strict';
/* Persona QA 2026-09-16 (expert pass): 3x5 @ 135 lb, RPE 8, threshold 8
   produced no suggestion card under the #490 fatigue gate (3 work sets
   added 0.4 effective RPE -> 8.4 > 8). User decision the same day: the
   RPE trigger uses the RAW top-set RPE — accumulated fatigue no longer
   blocks progression. 3x5 @ RPE 8 now suggests 140x1; the why-copy names
   only genuine raw-RPE holds and never mentions fatigue.
   Role: progression-logic (real engine + real why-copy). */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{
  globals:{exercises:[{id:'bench-mg',name:'Barbell Bench Press \u2013 Medium Grip',equipment:'barbell'}]},
});
const {
  progressionForExercise,progressionSummaryForOptions,fatigueForBasis,
  workoutState,progressionSetup,
}=role;

const EX='bench-mg';
const PROF={mode:'reps',min:1,max:5,scheme:'rpe',incrementType:'lb',incrementValue:5};
function history335at8(){
  return mkLog('log1','2026-09-10',[
    mkItem(EX,[{w:135,r:5,rpe:8},{w:135,r:5,rpe:8},{w:135,r:5,rpe:8}],{progression:{...PROF}}),
  ],'Chest day');
}
function item(){
  return {uid:'u1',exerciseId:EX,progression:{...PROF}};
}

beforeEach(()=>{
  workoutState.completed=[];
  workoutState.draft=null;
  workoutState.activeProgram=null;
  progressionSetup.threshold=8;
  progressionSetup.progressionOff=false;
});

describe('raw-RPE trigger: the expert 3x5 @ RPE 8 case',()=>{
  it('the engine suggests on 3x5 @ RPE 8 at threshold 8 (raw top-set RPE)',()=>{
    workoutState.completed=[history335at8()];
    const sugg=progressionForExercise(EX,{...PROF});
    assert.ok(sugg,'raw 8 meets the trigger: accumulated fatigue no longer blocks');
    assert.equal(sugg.kind,'load');
    assert.equal(sugg.nextWeight,140,'one 5 lb increment over 135');
    assert.equal(sugg.nextReps,1,'reset to the bottom of the 1–5 range');
    assert.ok(!sugg.reason.includes('fatigue'),
      'reasons never name the fatigue adjustment: '+sugg.reason);
  });
  it('fatigueForBasis still accounts (reported, not gating)',()=>{
    const f=fatigueForBasis(
      history335at8().exercises[0].sets.map(s=>({...s})),
      {rpe:8,index:0},
    );
    assert.equal(f.effectiveRpe,8.4,'the accounting is unchanged');
  });
  it('a genuine over-threshold hold names the raw RPE (no fatigue mention)',()=>{
    const log=mkLog('log1','2026-09-10',[
      mkItem(EX,[{w:135,r:5,rpe:9}],{progression:{...PROF}}),
    ],'Chest day');
    workoutState.completed=[log];
    /* QA batch (user 2026-09-21, #11): the hold now surfaces as a notice. */
    const s=progressionForExercise(EX,{...PROF});
    assert.ok(s,'a hold notice is produced');
    assert.equal(s.notice?.title,'Held at RPE 9');
    const html=progressionSummaryForOptions(item());
    assert.ok(html.includes('above your RPE 8 trigger'),'raw over-threshold copy');
    assert.ok(html.includes('Latest top set was RPE 9'));
    assert.ok(!html.includes('fatigue'),'no fatigue language in holds');
    assert.ok(!html.includes('not enough valid data'));
  });
  it('no RPE still gets the no-RPE hold copy',()=>{
    const log=mkLog('log1','2026-09-10',[
      mkItem(EX,[{w:135,r:5,rpe:null}],{progression:{...PROF}}),
    ],'Chest day');
    workoutState.completed=[log];
    const html=progressionSummaryForOptions(item());
    assert.ok(html.includes('No RPE on the latest top set'));
    assert.ok(!html.includes('fatigue'));
  });
  it('a single work set at the trigger still progresses (unchanged)',()=>{
    const log=mkLog('log1','2026-09-10',[
      mkItem(EX,[{w:135,r:5,rpe:8}],{progression:{...PROF}}),
    ],'Chest day');
    workoutState.completed=[log];
    const sugg=progressionForExercise(EX,{...PROF});
    assert.ok(sugg,'one set at RPE 8: suggestion fires');
  });
});
