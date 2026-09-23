'use strict';
/* #497 (agent, REMOVED by the user 2026-09-19): RPE 0 used to mean
   "trivially easy — not a work set", holding the top set so it never
   reached the #387 headroom formula (10−0 would have minted a +10 rep jump).
   The user's call: "you should always be able to advance" — RPE 0 now flows
   through the normal RPE trigger like any RPE ≤ threshold, with the jump
   clamped to the conservative trigger-sized step (never the 10-RIR jump).
   Above-threshold holds and the missing-RPE hold/notice are unchanged. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{globals:{exercises:[]}});
const {progressionForExercise,topSetForSession,workoutState,progressionSetup}=role;

const seed=(sets,prog)=>{
  const item=mkItem('bench-press',sets,{progression:prog||{mode:'reps',min:6,max:12}});
  workoutState.completed=[mkLog('w1','2026-09-10',[item])];
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

describe('#497 (removed): RPE 0 is a progression signal',()=>{
  it('RPE 0 is not confused with missing RPE (#370)',()=>{
    const top=topSetForSession({sets:[{w:'100',r:'8',rpe:0,tags:[]}]});
    assert.equal(top.rpe,0,'RPE 0 survives as a real RPE, not null');
  });
  it('RPE 0 on the top set advances with the trigger-sized jump, not +10',()=>{
    seed([{w:100,r:8,rpe:0}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.ok(s,'a suggestion card exists');
    assert.equal(s.kind,'reps');
    assert.equal(s.nextReps,10,'RPE 0 earns the threshold-sized +2, never the 10-RIR jump');
  });
  it('timed: RPE 0 adds the trigger-sized time jump',()=>{
    const item=mkItem('bench-press',[{w:0,seconds:40,rpe:0}],{tracking:'time',progression:{mode:'time',timeMin:30,timeMax:90}});
    workoutState.completed=[mkLog('w1','2026-09-10',[item])];
    const s=progressionForExercise('bench-press',{mode:'time',timeMin:30,timeMax:90},null);
    assert.ok(s&&s.kind==='time','timed work advances off RPE 0');
    assert.equal(s.nextSeconds,50,'40s + 10s (trigger-sized), not a 10-jump blowout');
  });
  it('range change + RPE 0 rebases off the estimated 1RM like any RPE ≤ trigger',()=>{
    seed([{w:100,r:10,rpe:0}],{progression:{mode:'reps',min:6,max:12}});
    const s=progressionForExercise('bench-press',{mode:'reps',min:1,max:5,custom:true},null);
    assert.ok(s,'rebase proceeds');
    assert.equal(s.kind,'range');
    assert.equal(s.nextReps,5);
    assert.ok(s.nextWeight>100,'rebased load never regresses below the handled top set');
  });
  it('above-threshold RPE still holds — now as a notice (user 2026-09-21, #11)',()=>{
    seed([{w:100,r:8,rpe:9}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.ok(s,'a hold notice is produced');
    assert.equal(s.kind,'hold');
    assert.equal(s.notice?.title,'Held at RPE 9');
  });
  it('all-sets: an RPE-0 top set advances; RPE-0 back-offs still sit out the cascade',()=>{
    progressionSetup.progressAllSets=true;
    seed([{w:100,r:8,rpe:0},{w:80,r:8,rpe:0}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.ok(s,'top set progressed');
    assert.equal(s.kind,'reps');
    assert.equal(s.nextReps,10);
    const back=s.setTargets[1];
    assert.equal(back.kind,'hold','RPE-0 back-off holds');
    assert.equal(back.r,8,'RPE-0 back-off reps unchanged');
    assert.equal(back.changed,false,'RPE-0 back-off not marked changed');
  });
  it('all-sets independent path: an RPE-0 back-off holds while a real one progresses',()=>{
    progressionSetup.progressAllSets=true;
    /* Control: top set above the trigger stalls; back-off at RPE 7 still
       earns its #387 jump (80×8 + 3). */
    seed([{w:100,r:8,rpe:9},{w:80,r:8,rpe:7}]);
    const ctrl=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.ok(ctrl&&ctrl.setTargets,'independent path produces targets');
    assert.equal(ctrl.setTargets[1].r,11,'RPE 7 back-off progresses');
    /* RPE-0 back-off: holds, never a rep jump. The all-hold outcome is now
       a hold notice (QA batch 2026-09-22: hold explanations survive when
       no set advances), not null — what matters is nothing moves. */
    seed([{w:100,r:8,rpe:9},{w:80,r:8,rpe:0}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.ok(s,'an above-trigger hold produces its notice');
    assert.equal(s.kind,'hold','trivially-easy back-off moves nothing');
    assert.equal(s.setTargets[1].r,8,'back-off reps unchanged');
    assert.equal(s.setTargets[1].changed,false,'back-off not marked changed');
    assert.equal(s.notice?.title,'Held at RPE 9','the hold is explained');
  });
  it('all-sets cascade: an RPE-0 back-off sits out the top set\'s rep jump',()=>{
    progressionSetup.progressAllSets=true;
    seed([{w:100,r:8,rpe:6},{w:80,r:8,rpe:0}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.ok(s&&s.setTargets,'top set progressed');
    assert.equal(s.nextReps,12,'top set earned its +4 (#387)');
    const back=s.setTargets[1];
    assert.equal(back.kind,'hold','RPE-0 back-off holds');
    assert.equal(back.r,8,'RPE-0 back-off reps unchanged');
    assert.equal(back.changed,false,'RPE-0 back-off not marked changed');
  });
  it('RPE 1 is still a progression signal',()=>{
    seed([{w:100,r:8,rpe:1}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.ok(s,'RPE 1 still earns progression');
    assert.notEqual(s.kind,'hold','RPE 1 is not a hold');
  });
});
