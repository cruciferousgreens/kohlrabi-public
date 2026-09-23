'use strict';
/* #473 (user 2026-09-15, grid corrected 23:39 EDT): percent-increment formula
   targets must land on the 5 lb increment grid — the SAME grid fixed-lb
   increments snap to. The old whole-unit snap put them off any practical grid
   (125x8 rebased into a 3-5 zone suggested 136 lb), and per-dumbbell display
   could expose decimals (109 total -> "54.5 lb"). Percent now snaps to the
   nearest 5 lb, so 125 lb @ 9% (136.25) suggests 135, never 136. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{
  globals:{exercises:[{id:'pendlay-row',name:'Pendlay Row'},{id:'db-bent-row',name:'DB Bent-Over Row',equipment:'dumbbell'}]},
});
const {progressionForExercise,workoutState,progressionSetup}=role;

/* percent 2.5%: top set at RPE 8 -> 'load' path; rebase profile differs from
   the stored profile so the range-change rebase fires. */
const PERCENT_CFG=()=>({scheme:'rpe',threshold:8,incrementType:'percent',incrementValue:2.5,timeStep:5});
const seed=(exerciseId,sets)=>{
  workoutState.completed=[mkLog('w1','2026-09-15',[
    mkItem(exerciseId,sets,{progression:{mode:'reps',min:6,max:12}})])];
};
const onGrid=w=>Math.abs(w/5-Math.round(w/5))<1e-9;

beforeEach(()=>{
  /* #577: linear is now the app default; these tests exercise RPE mechanics. */
  progressionSetup.scheme='rpe';
  role.exercises.length=0;
  role.exercises.push({id:'pendlay-row',name:'Pendlay Row'});
  progressionSetup.threshold=8;
  progressionSetup.progressionOff=false;
  progressionSetup.progressAllSets=false;
  progressionSetup.incrementType='percent';
  progressionSetup.incrementValue=2.5;
  progressionSetup.timeStep=5;
  delete progressionSetup.dbEntry;
  progressionSetup.units='imperial';
  workoutState.completed=[];
  workoutState.activeProgram=null;
  workoutState.draft=null;
});

describe('#473: percent-increment targets land on the 5 lb grid',()=>{
  it('the user\'s 136 lb case: 125x8 rebased to 5s suggests 135, not 136',()=>{
    seed('pendlay-row',[{w:125,r:8}]);
    const s=progressionForExercise('pendlay-row',
      {mode:'reps',min:3,max:5,custom:true},PERCENT_CFG());
    assert.ok(s,'got a suggestion');
    assert.equal(s.kind,'range');
    // No RPE logged: e1RM ~158.3 -> 5-rep target 135.7 -> grid snap 135
    // (the old whole-unit snap gave 136).
    assert.equal(s.nextWeight,135);
    assert.ok(onGrid(s.nextWeight));
  });
  it('direct percent increment: 125 lb @ 9% (136.25) snaps to 135',()=>{
    const {roundedIncrement}=role;
    assert.equal(roundedIncrement(125,'percent',9),135);
  });
  it('a 54.29 raw target snaps clean for per-dumbbell display',()=>{
    role.exercises.push({id:'db-bent-row',name:'DB Bent-Over Row',equipment:'dumbbell'});
    seed('db-bent-row',[{w:50,r:8}]);
    const s=progressionForExercise('db-bent-row',
      {mode:'reps',min:3,max:5,custom:true},PERCENT_CFG());
    assert.ok(s,'got a suggestion');
    assert.equal(s.kind,'range');
    // 54.29 -> 55 on the grid -> 56 even total so per-db shows whole "28 lb".
    assert.equal(s.nextWeight,56);
  });
  it('the grid invariant holds across a sweep of rebase scenarios',()=>{
    // High-rep history rebased into lower-rep ranges: the rebase raises the
    // load, so a real suggestion (not a hold-suppressed card) comes back.
    const cases=[
      [{w:100,r:10},3,5],[{w:100,r:10},1,6],
      [{w:135,r:6},3,5],[{w:135,r:9},2,6],
      [{w:50,r:8},3,5],[{w:200,r:8},4,6],
      [{w:72.5,r:9},3,5],[{w:90,r:11},1,5],
    ];
    for(const [set,mn,mx] of cases){
      seed('pendlay-row',[{w:set.w,r:set.r,rpe:8}]);
      const s=progressionForExercise('pendlay-row',
        {mode:'reps',min:mn,max:mx,custom:true},PERCENT_CFG());
      assert.ok(s,'suggestion exists for '+JSON.stringify(set));
      // On-grid means multiples of 5 — the same grid fixed-lb increments use.
      assert.ok(onGrid(s.nextWeight),
        `on the 5 lb grid: ${s.nextWeight} for ${JSON.stringify(set)}`);
    }
  });
});
