'use strict';
/* #579 (agent 2026-09-20, beta v1.870 browser QA): a linear suggestion card
   read "Apply suggestion 5 lb · 8 reps" — the raw +5 lb increment minted as
   the absolute target — because the in-zone basis session's top set had no
   weight (0 lb × 8). Tapping it wrote 5 lb into every set. A basis with no
   load is no basis for a linear load increment: the engine must fall through
   to the next basis instead of fabricating a load. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{globals:{exercises:[]}});
const {progressionForExercise,workoutState,progressionSetup}=role;

const profile=(over)=>Object.assign({mode:'reps',min:8,max:12},over);

beforeEach(()=>{
  progressionSetup.scheme='linear';
  progressionSetup.threshold=8;
  progressionSetup.progressionOff=false;
  progressionSetup.progressAllSets=false;
  progressionSetup.incrementType='lb';
  progressionSetup.incrementValue=5;
  progressionSetup.timeStep=5;
  progressionSetup.advanceOnCompletion=false;
  workoutState.completed=[];
  workoutState.activeProgram=null;
  workoutState.draft=null;
});

/* Weightless in-zone session (0 lb × 8, in the 8–12 zone) is older; the
   weighted session (150 lb × 6) is newer but out of zone. */
const seedWeightlessZonePlusWeighted=()=>{
  workoutState.completed=[
    mkLog('w2','2026-09-19',[mkItem('bench-press',[{w:150,r:6}],{progression:profile()})]),
    mkLog('w1','2026-09-18',[mkItem('bench-press',[{w:0,r:8}],{progression:profile()})]),
  ];
};

describe('#579: weightless basis never mints the increment as a load',()=>{
  it('falls through to the fresh most-recent log and rebases into the range',()=>{
    seedWeightlessZonePlusWeighted();
    const s=progressionForExercise('bench-press',profile());
    assert.ok(s,'a suggestion is still produced from the weighted session');
    /* QA batch (user 2026-09-21, #11): the weighted session's 150x6 sits below
       the 8-12 range, so "Back into range" now rebases from the estimated 1RM
       (Epley 180) onto mid-range 10 at 135 — the old 155x8 clamp is retired. */
    assert.equal(s.kind,'backrange');
    assert.equal(s.nextWeight,135,'load rebases from the estimated 1RM, not from 0');
    assert.equal(s.nextReps,10,'middle of the 8-12 range');
    assert.equal(s.sourceDate,'2026-09-19','the basis is the weighted session');
    assert.notEqual(s.nextWeight,5,'the raw increment is never the prescription');
  });
  it('with only a weightless basis there is no suggestion, not a 5 lb card',()=>{
    workoutState.completed=[
      mkLog('w1','2026-09-18',[mkItem('bench-press',[{w:0,r:8}],{progression:profile()})]),
    ];
    const s=progressionForExercise('bench-press',profile());
    assert.equal(s,null,'no load baseline → no linear suggestion');
  });
  it('a weighted in-zone basis still progresses normally',()=>{
    workoutState.completed=[
      mkLog('w1','2026-09-19',[mkItem('bench-press',[{w:150,r:8}],{progression:profile()})]),
    ];
    const s=progressionForExercise('bench-press',profile());
    assert.ok(s);
    assert.equal(s.nextWeight,155);
    assert.equal(s.nextReps,8);
  });
  it('blank-string weight (unfilled input) counts as weightless',()=>{
    workoutState.completed=[
      mkLog('w1','2026-09-18',[mkItem('bench-press',[{r:8}],{progression:profile()})]),
    ];
    const s=progressionForExercise('bench-press',profile());
    assert.equal(s,null,'missing weight is not a load baseline');
  });
});
