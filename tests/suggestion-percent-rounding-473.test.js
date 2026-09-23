'use strict';
/* #473 (user 2026-09-14, reconfirmed 2026-09-15, grid corrected 23:39 EDT):
   suggestion loads must never show decimals, and percent-increment loads must
   land on the 5 lb increment grid — the same grid fixed-lb increments snap
   to. A percent increment used to round the canonical total to a whole unit
   (#246), which put targets off any practical grid (136 lb). Per-dumbbell
   display halves the total, so new prescription loads for per-dumbbell
   exercises additionally snap to an even whole total so the shown weight
   stays whole (109 total → "54.5 lb" → 110). */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{globals:{exercises:[]}});
const {progressionForExercise,workoutState,progressionSetup}=role;

const profile=()=>({mode:'reps',min:6,max:12});
/* Top set at the rep ceiling @RPE 8 → kind 'load': the increment applies. */
const seed=(sets,prog)=>{
  const item=mkItem('db-row',sets,{progression:prog||{mode:'reps',min:6,max:12}});
  workoutState.completed=[mkLog('w1','2026-09-10',[item])];
};
beforeEach(()=>{
  /* #577: linear is now the app default; these tests exercise RPE mechanics. */
  progressionSetup.scheme='rpe';
  role.exercises.length=0;
  progressionSetup.threshold=8;
  progressionSetup.progressionOff=false;
  progressionSetup.progressAllSets=false;
  progressionSetup.incrementType='percent';
  progressionSetup.incrementValue=9;
  progressionSetup.timeStep=5;
  delete progressionSetup.dbEntry;
  workoutState.completed=[];
  workoutState.activeProgram=null;
  workoutState.draft=null;
});

describe('#473: no decimal suggestion weights in per-dumbbell display',()=>{
  it('odd whole-unit total snaps to even for a dumbbell exercise',()=>{
    role.exercises.push({id:'db-row',name:'DB Bent-Over Row',equipment:'dumbbell'});
    seed([{w:100,r:12,rpe:8}]);
    const s=progressionForExercise('db-row',profile(),null);
    assert.ok(s);
    assert.equal(s.kind,'load');
    // 100 * 1.09 = 109 → whole-unit rule gives 109 → per-db fix gives 110
    assert.equal(s.nextWeight,110);
  });
  it('per-set cascade targets snap to even too',()=>{
    role.exercises.push({id:'db-row',name:'DB Bent-Over Row',equipment:'dumbbell'});
    progressionSetup.progressAllSets=true;
    /* RPE 7 so the raw top-set RPE meets the trigger. */
    seed([{w:100,r:12,rpe:7},{w:80,r:12,rpe:7}]);
    const s=progressionForExercise('db-row',profile(),null);
    assert.ok(s&&s.setTargets);
    assert.equal(s.nextWeight,116);
    // back-off: 80 * 1.09 = 87.2 → 5 lb grid → 85 → even → 86
    // (RPE-scaled load, user 2026-09-19: RPE 7 → 1.5× → 9% × 1.5 = 13.5% →
    //  100 × 1.135 = 113.5 → 5 lb grid → 115 → even → 116)
    assert.equal(s.setTargets[1].w,86);
  });
  it('barbell exercises get the 5 lb grid percent result',()=>{
    role.exercises.push({id:'db-row',name:'Pendlay Row',equipment:'barbell'});
    seed([{w:100,r:12,rpe:8}]);
    const s=progressionForExercise('db-row',profile(),null);
    assert.ok(s);
    // 100 * 1.09 = 109 → 5 lb grid snap gives 110 (was 109 whole-unit)
    assert.equal(s.nextWeight,110);
  });
  it('lateral-raise case: 15 per DB + 5 lb suggests 20 per DB, never 18 (QA batch 2026-09-22)',()=>{
    /* The reported bug: lateral raise with a 5 lb increment suggested
       "18 lb" per dumbbell. 30 canonical = 15 per DB; the fixed 5 lb step
       must land on 40 canonical = 20 per DB. */
    role.exercises.push({id:'db-row',name:'Lateral Raise',equipment:'dumbbell'});
    progressionSetup.incrementType='lb';
    progressionSetup.incrementValue=5;
    seed([{w:30,r:12,rpe:8}]);
    const s=progressionForExercise('db-row',profile(),null);
    assert.ok(s);
    assert.equal(s.kind,'load');
    assert.equal(s.nextWeight,40);
    /* The reason string must report the per-dumbbell step (5 lb), not the
       canonical 10 lb delta. */
    assert.ok(s.reason.includes('5 lb'),`reason should say 5 lb, got: ${s.reason}`);
    assert.ok(!s.reason.includes('10 lb'),`reason must not say 10 lb, got: ${s.reason}`);
  });
});
