'use strict';
/* Chaos sweep finding 4 (persona-8): topSetForSession passed non-positive /
   non-finite weights straight through — weight:-50 prescribed "add 2 reps"
   at −50 lb, and weight:Infinity rendered a broken reason string (the weight
   vanishes mid-sentence). A non-finite or negative top-set weight is now no
   basis — same as the no-candidates path, no suggestion. Bodyweight w=0
   stays legitimate. The same sweep's RPE finding: blankRpeToNull('abc') used
   to yield NaN (10−NaN poisons the RIR math) — non-numeric RPE now coerces
   to null ("no RPE"). */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{globals:{exercises:[]}});
const {progressionForExercise,topSetForSession,blankRpeToNull,workoutState,progressionSetup}=role;

const sessionOf=sets=>({sets:sets.map(s=>({tags:[],...s}))});
const seed=(sets)=>{
  workoutState.completed=[mkLog('w1','2026-09-10',[
    mkItem('bench-press',sets,{progression:{mode:'reps',min:6,max:12}})])];
};
beforeEach(()=>{
  /* #577: linear is now the app default; these tests exercise RPE mechanics. */
  progressionSetup.scheme='rpe';
  role.exercises.length=0;
  progressionSetup.threshold=8;
  progressionSetup.progressionOff=false;
  progressionSetup.progressAllSets=false;
  progressionSetup.incrementType='lb';
  progressionSetup.incrementValue=5;
  progressionSetup.timeStep=5;
  delete progressionSetup.dbEntry;
  workoutState.completed=[];
  workoutState.activeProgram=null;
  workoutState.draft=null;
});

describe('chaos-4: garbage top-set weights are no basis',()=>{
  it('negative weight → no top set',()=>{
    assert.equal(topSetForSession(sessionOf([{w:-50,r:5,rpe:8}])),null);
  });
  it('Infinity weight → no top set',()=>{
    assert.equal(topSetForSession(sessionOf([{w:Infinity,r:5,rpe:8}])),null);
  });
  it('bodyweight w=0 stays legitimate',()=>{
    const top=topSetForSession(sessionOf([{w:0,r:10,rpe:8}]));
    assert.ok(top,'bodyweight top set survives');
    assert.equal(top.weight,0);
  });
  it('a garbage set beside a real one still yields the real top set',()=>{
    const top=topSetForSession(sessionOf([{w:-50,r:5,rpe:8},{w:100,r:5,rpe:8}]));
    assert.ok(top);
    assert.equal(top.weight,100);
  });
  it('negative top-set weight → no suggestion',()=>{
    seed([{w:-50,r:5,rpe:8}]);
    assert.equal(progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null),null);
  });
  it('Infinity top-set weight → no suggestion',()=>{
    seed([{w:Infinity,r:5,rpe:8}]);
    assert.equal(progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null),null);
  });
  it('a normal top set still suggests',()=>{
    seed([{w:100,r:8,rpe:8}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.ok(s,'guard did not swallow a healthy basis');
    assert.equal(s.kind,'reps');
  });
});

describe('chaos-4: non-numeric RPE coerces to null',()=>{
  it("blankRpeToNull('abc') is null, not NaN",()=>{
    assert.equal(blankRpeToNull('abc'),null);
  });
  it('blankRpeToNull keeps the #370/#497 contracts',()=>{
    assert.equal(blankRpeToNull(''),null,'blank is missing');
    assert.equal(blankRpeToNull(null),null);
    assert.equal(blankRpeToNull(0),0,'RPE 0 is real');
    assert.equal(blankRpeToNull('7.5'),7.5,'numeric strings parse');
  });
  it("a non-numeric RPE on the top set reads as no-RPE (#565 informational hold)",()=>{
    /* #565: a non-numeric RPE is a missing RPE — the engine holds and says
       so (non-tappable notice) instead of going silent. */
    seed([{w:100,r:8,rpe:'abc'}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.ok(s,'notice suggestion exists');
    assert.equal(s.kind,'hold');
    assert.ok(s.notice&&s.notice.title==='No RPE logged','the No-RPE notice is set');
  });
});
