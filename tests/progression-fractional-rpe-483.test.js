'use strict';
/* #483 (user 2026-09-15): the RPE field accepts 0.5 steps, so the #387
   RPE-headroom jump (10-rpe) could come out fractional — RPE 7.5 suggested
   "90 lb x 8 reps -> 90 lb x 10.5 reps" with reason text "add 2.5 reps", and
   timed work printed "add 17.5 seconds" / 57.5s targets. Reps and seconds are
   discrete: the jump now resolves to the nearest whole rep (half up, never
   below the #387 floor of 2) in the top set, the open-top branch, the
   all-sets cascade, and the all-sets independent path; timed jumps resolve
   to whole seconds. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{globals:{exercises:[]}});
const {progressionForExercise,suggestionCardMarkup,workoutState,progressionSetup}=role;

const seed=(sets,opts)=>{
  const item=mkItem('bench-press',sets,{progression:{mode:'reps',min:6,max:12},...(opts||{})});
  workoutState.completed=[mkLog('w1','2026-09-10',[item])];
};
beforeEach(()=>{
  /* #577: linear is now the app default; these tests exercise RPE mechanics. */
  progressionSetup.scheme='rpe';
  progressionSetup.threshold=8;
  progressionSetup.progressionOff=false;
  progressionSetup.incrementType='lb';
  progressionSetup.incrementValue=5;
  progressionSetup.timeStep=5;
  progressionSetup.progressAllSets=false;
  workoutState.completed=[];
  workoutState.activeProgram=null;
});

describe('#483: fractional RPE resolves to whole-rep jumps',()=>{
  it('RPE 7.5 → +3 reps (2.5 rounds half up), never 10.5',()=>{
    seed([{w:90,r:8,rpe:7.5}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.equal(s.kind,'reps');
    assert.equal(s.nextReps,11);
    assert.ok(Number.isInteger(s.nextReps),'no fractional reps: '+s.nextReps);
    assert.ok(s.reason.includes('add 3 reps'),'reason names the whole jump: '+s.reason);
    assert.ok(!s.reason.includes('2.5'),'reason never says "2.5 reps": '+s.reason);
  });
  it('RPE 6.5 → +4 reps; RPE 7.6 → +2 reps',()=>{
    seed([{w:90,r:8,rpe:6.5}]);
    assert.equal(progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null).nextReps,12);
    seed([{w:90,r:8,rpe:7.6}]);
    assert.equal(progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null).nextReps,10);
  });
  it('the #387 floor still holds for fractional RPE near the trigger',()=>{
    progressionSetup.threshold=9;
    seed([{w:90,r:8,rpe:8.5}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.equal(s.nextReps,10,'max(2, round(1.5)) = 2, never a +1');
  });
  it('open-top: fractional RPE jump is whole',()=>{
    seed([{w:90,r:8,rpe:7.5}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:null,openTop:true},null);
    assert.equal(s.nextReps,11);
    assert.ok(!s.reason.includes('2.5'),'open-top reason is clean: '+s.reason);
  });
  it('timed: fractional RPE scales to whole seconds',()=>{
    seed([{w:0,seconds:40,rpe:6.5}],{tracking:'time'});
    const s=progressionForExercise('bench-press',{mode:'time',timeMin:30,timeMax:90},null);
    assert.equal(s.kind,'time');
    assert.equal(s.nextSeconds,60,'40 + round(5*4) = 60, never 57.5');
    assert.ok(Number.isInteger(s.nextSeconds));
    assert.ok(s.reason.includes('add 20 seconds'),'reason names whole seconds: '+s.reason);
    assert.ok(!s.reason.includes('17.5'),'reason never says "17.5 seconds"');
  });
  it('timed: a fractional time step still lands on whole seconds',()=>{
    progressionSetup.timeStep=2.5;
    seed([{w:0,seconds:40,rpe:7.5}],{tracking:'time'});
    const s=progressionForExercise('bench-press',{mode:'time',timeMin:30,timeMax:90,timeStep:2.5},null);
    assert.ok(Number.isInteger(s.nextSeconds),'whole seconds: '+s.nextSeconds);
  });
  it('all-sets cascade: back-off targets stay whole under fractional top-set RPE',()=>{
    progressionSetup.progressAllSets=true;
    seed([{w:90,r:8,rpe:7.5},{w:80,r:8,rpe:7}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.ok(s.setTargets,'all-sets targets computed');
    for(const t of s.setTargets){
      if(t&&t.kind==='reps')assert.ok(Number.isInteger(t.r),'back-off reps whole: '+t.r);
    }
  });
  it('all-sets independent path: a stalled top set with fractional back-off RPE stays whole',()=>{
    progressionSetup.progressAllSets=true;
    /* Top set above the trigger stalls; back-off at RPE 7.5 is evaluated
       independently — its jump must be whole. */
    seed([{w:90,r:8,rpe:9},{w:80,r:8,rpe:7.5}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.ok(s&&s.setTargets,'independent path produced targets');
    const back=s.setTargets.find(t=>t&&t.index===1);
    assert.ok(back&&Number.isInteger(back.r),'back-off reps whole: '+(back&&back.r));
    assert.equal(back.r,11,'80 lb x 8 + 3');
  });
  it('suggestion cards never print fractional reps',()=>{
    seed([{w:90,r:8,rpe:7.5}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    const html=suggestionCardMarkup({exerciseId:'bench-press',kind:s.kind,freeform:true,
      mode:'reps',amrap:false,latest:{weight:90,reps:8},
      nextWeight:s.nextWeight,nextReps:s.nextReps,nextSeconds:0},0,false);
    assert.ok(html.includes('11 reps'),'card shows the whole target');
    assert.ok(!html.includes('10.5'),'card never shows 10.5');
  });
});
