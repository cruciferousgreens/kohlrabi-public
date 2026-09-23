'use strict';
/* User 2026-09-22: %1RM keeps the latest top-set reps (clamped to the rep
   range) instead of dropping to the range minimum — 270x5 stays 270x5, not
   270x1. Also pins: below/above-range clamping, no-history with a manual
   training max, the #79 suppression of an identical prescription (v1.883:
   the %1RM bypass of #79 was reverted — no user approval found for it),
   and the deload-week variant. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{
  globals:{exercises:[{id:'bench-press',name:'Bench Press'}]},
});
const {progressionForExercise,workoutState,progressionSetup}=role;

const CFG=()=>({scheme:'onerm',threshold:8,incrementType:'lb',incrementValue:5,timeStep:5});
const PROF=(over={})=>Object.assign({mode:'reps',min:6,max:12,scheme:'onerm',percentOf1RM:85},over);
beforeEach(()=>{
  progressionSetup.scheme='linear';
  workoutState.completed=[];
  workoutState.activeProgram=null;
  progressionSetup.units='imperial';
});
function hist(sets){
  workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',sets,{progression:{mode:'reps',min:6,max:12}})])];
}

describe('%1RM preserves the latest top-set reps (user 2026-09-22)',()=>{
  it('270x5 applies as 270x5, not 270x1',()=>{
    /* The range must include 5 — %1RM needs a same-zone basis (no interpolation). */
    hist([{w:270,r:5,rpe:8}]);
    const s=progressionForExercise('bench-press',Object.assign(PROF(),{min:5,max:10}),CFG());
    assert.ok(s&&s.kind==='onerm','still a %1RM prescription: '+JSON.stringify(s&&s.kind));
    assert.equal(s.nextReps,5,'latest reps kept, not the range minimum: '+JSON.stringify({nextWeight:s.nextWeight,nextReps:s.nextReps}));
  });
  it('below-range reps clamp to the range minimum',()=>{
    /* A manual TM provides the basis (zone matching excludes the out-of-zone
       1-rep top set itself); the preserved reps still clamp to the floor. */
    hist([{w:270,r:1,rpe:8}]);
    const s=progressionForExercise('bench-press',PROF({trainingMax:300}),CFG());
    assert.ok(s&&s.kind==='onerm','still a %1RM prescription');
    assert.equal(s.nextReps,6,'1 rep clamps to the 6–12 minimum: '+JSON.stringify({nextReps:s.nextReps}));
  });
  it('above-range reps clamp to the range maximum',()=>{
    /* Reachable via openTop: zone matching otherwise excludes an out-of-range
       top set from the basis entirely (correct — no interpolation). */
    const open=PROF({openTop:true});
    workoutState.completed=[mkLog('w1','2026-09-12',[mkItem('bench-press',[{w:270,r:20,rpe:8}],{progression:{mode:'reps',min:6,max:12,openTop:true}})])];
    const s=progressionForExercise('bench-press',open,CFG());
    assert.ok(s&&s.kind==='onerm','still a %1RM prescription');
    assert.equal(s.nextReps,12,'20 reps clamp to the 6–12 maximum: '+JSON.stringify({nextReps:s.nextReps}));
  });
  it('no history + manual training max prescribes at the range floor',()=>{
    const s=progressionForExercise('bench-press',PROF({trainingMax:300}),CFG());
    assert.ok(s,'a manual training max is a valid basis with no history');
    assert.equal(s.kind,'onerm');
    assert.equal(s.nextWeight,255,'85% of 300 lb TM, snapped to the 5 lb grid');
    assert.equal(s.nextReps,6,'no latest reps to keep — falls back to the minimum');
    assert.equal(s.tmSource,'manual');
  });
  it('equal load/equal reps is suppressed by #79 like every other scheme',()=>{
    /* v1.883: the %1RM bypass of #79 is reverted (no user approval found).
       85% of a 300 lb TM is 255 — identical to the 255x8 top set — so the
       no-change suppression applies and no card renders. */
    hist([{w:255,r:8,rpe:8}]);
    const s=progressionForExercise('bench-press',PROF({trainingMax:300}),CFG());
    assert.equal(s,null,'a prescription identical to the latest top set is noise, not guidance: '+JSON.stringify(s&&{kind:s.kind,nextWeight:s.nextWeight,nextReps:s.nextReps}));
  });
  it('an explicit stored % beats the default',()=>{
    /* History 265x8 keeps this out of #79 territory: 90% of 300 is 270,
       a real change from the 265 top set, so the card renders. */
    hist([{w:265,r:8,rpe:8}]);
    const s=progressionForExercise('bench-press',PROF({percentOf1RM:90,trainingMax:300}),CFG());
    assert.ok(s&&s.kind==='onerm');
    assert.equal(s.pct,90,'stored 90% wins over the 85% default: '+JSON.stringify({pct:s.pct}));
    assert.equal(s.nextWeight,270,'90% of 300 lb TM');
    assert.equal(s.nextReps,8,'reps still preserved under the override');
  });
});

describe('%1RM manual deload week (user 2026-09-22)',()=>{
  const DELOAD_CFG=()=>Object.assign(CFG(),{currentWeek:2,pctWave:true,weeklyDeloads:[false,true],deloadPct:60});
  it('the reduced load keeps the latest rep target, not the range minimum',()=>{
    hist([{w:270,r:8,rpe:8}]);
    const s=progressionForExercise('bench-press',PROF({trainingMax:300}),DELOAD_CFG());
    assert.ok(s,'scheduled deload reduces the manual-TM prescription');
    assert.equal(s.kind,'deload');
    assert.equal(s.nextWeight,155,'60% of 255 lb, snapped to the 5 lb grid');
    assert.equal(s.nextReps,8,'deload keeps the latest 8 reps — this was the contradiction (min) before the fix');
  });
  it('deload reps still clamp to the rep range',()=>{
    hist([{w:270,r:1,rpe:8}]);
    const s=progressionForExercise('bench-press',PROF({trainingMax:300}),DELOAD_CFG());
    assert.ok(s&&s.kind==='deload');
    assert.equal(s.nextReps,6,'1 rep clamps to the 6–12 minimum on a deload week too');
  });
});
