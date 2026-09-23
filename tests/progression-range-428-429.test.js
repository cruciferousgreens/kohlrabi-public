'use strict';
/* #428 + #429 (user 2026-09-13): the week-range e1RM rebase minted 1-rep
   max-test cards (110x10 → 130x1) and the suggestion chip read "New range"
   instead of surfacing the load increase. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{
  globals:{exercises:[{id:'dumbbell-bench-press',name:'Dumbbell Bench Press'}]},
});
const {progressionForExercise,suggestionCardMarkup,workoutState,progressionSetup}=role;

const CFG=()=>({scheme:'rpe',threshold:8,incrementType:'lb',incrementValue:5,timeStep:5});

beforeEach(()=>{
  /* #577: linear is now the app default; these tests exercise RPE mechanics. */
  progressionSetup.scheme='rpe';
  workoutState.completed=[];
  workoutState.activeProgram=null;
  progressionSetup.units='imperial';
});

describe('#428: week-range rebase prescribes the load\'s own rep count, never 1',()=>{
  it("the user's screenshot trio: 7.5x12 → 10x5, 70x8 → 80x5, 110x10 → 130x5",()=>{
    // e1RM (RPE 8): 7.5×(1+14/30)=11 → 11/(1+5/30)=9.43 → snap 10
    workoutState.completed=[mkLog('w1','2026-09-12',[
      mkItem('cable-external-rotation',[{w:7.5,r:12,rpe:8}],
        {progression:{mode:'reps',min:6,max:12}})])];
    const s1=progressionForExercise('cable-external-rotation',
      {mode:'reps',min:1,max:5,custom:true},CFG());
    assert.equal(s1.kind,'range');
    assert.equal(s1.nextWeight,10);
    assert.equal(s1.nextReps,5);

    // e1RM: 70×(1+(8+2)/30)=93.3 → 93.3/(1+5/30)=80 → snap 80
    workoutState.completed=[mkLog('w1','2026-09-12',[
      mkItem('incline-dumbbell-press',[{w:70,r:8,rpe:8}],
        {progression:{mode:'reps',min:6,max:12}})])];
    const s2=progressionForExercise('incline-dumbbell-press',
      {mode:'reps',min:1,max:5,custom:true},CFG());
    assert.equal(s2.kind,'range');
    assert.equal(s2.nextWeight,80);
    assert.equal(s2.nextReps,5);

    // e1RM: 110×(1+(10+2)/30)=154 → 154/(1+5/30)=132 → snap 130
    workoutState.completed=[mkLog('w1','2026-09-12',[
      mkItem('dumbbell-bench-press',[{w:110,r:10,rpe:8}],
        {progression:{mode:'reps',min:6,max:12}})])];
    const s3=progressionForExercise('dumbbell-bench-press',
      {mode:'reps',min:1,max:5,custom:true},CFG());
    assert.equal(s3.kind,'range');
    assert.equal(s3.nextWeight,130);
    assert.equal(s3.nextReps,5);
  });
  it('hypertrophy rebase: the load is computed for the range top and prescribed there',()=>{
    // Endurance history rebased into hypertrophy: the e1RM load is computed
    // for 12 reps, so the card prescribes 12 reps — self-consistent, never 1.
    workoutState.completed=[mkLog('w1','2026-09-12',[
      mkItem('dumbbell-bench-press',[{w:100,r:18,rpe:8}],
        {progression:{mode:'reps',min:12,max:20}})])];
    const s=progressionForExercise('dumbbell-bench-press',
      {mode:'reps',min:6,max:12,custom:true},CFG());
    assert.equal(s.kind,'range');
    assert.ok(s.nextReps>1,'reps are never 1');
    assert.equal(s.nextReps,12,'the load is computed for the range top');
    assert.ok(s.nextWeight>=100,'#250: never below the top set');
  });
  it('open-top rebase still targets the floor (15+ has no max)',()=>{
    workoutState.completed=[mkLog('w1','2026-09-11',[
      mkItem('cable-external-rotation',[{w:7.5,r:12,rpe:8}],
        {progression:{mode:'reps',min:6,max:12}})])];
    const s=progressionForExercise('cable-external-rotation',
      {mode:'reps',min:15,openTop:true,custom:true},CFG());
    assert.equal(s.kind,'range');
    assert.equal(s.nextReps,15);
  });
});

describe('#429: the chip names the headline change',()=>{
  const chipFor=(kind,nextWeight,nextReps,freeform)=>{
    const html=suggestionCardMarkup({
      exerciseId:'dumbbell-bench-press',kind,freeform:!!freeform,
      mode:'reps',amrap:false,
      latest:{weight:100,reps:10},
      nextWeight,nextReps,nextSeconds:0,
    },0,false);
    const m=html.match(/<span>([^<]+)<\/span><\/div><div class="suggestion-change">/);
    assert.ok(m,'chip span found');
    return m[1];
  };
  it('a range rebase with a load increase reads "Add weight" (program context)',()=>{
    assert.equal(chipFor('range',130,5,false),'Add weight');
  });
  it('a range rebase with a load increase reads "Add weight" (freestyle)',()=>{
    assert.equal(chipFor('range',105,5,true),'Add weight');
  });
  it('a range rebase that only moves reps keeps the range chip',()=>{
    assert.equal(chipFor('range',100,12,false),'New range');
    assert.equal(chipFor('range',100,12,true),'New range');
  });
  it('other kinds are untouched',()=>{
    assert.equal(chipFor('load',105,6,false),'Add weight');
    assert.equal(chipFor('reps',100,11,false),'Add reps');
    assert.equal(chipFor('hold',100,10,false),'Hold');
  });
});
