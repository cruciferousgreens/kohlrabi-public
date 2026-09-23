'use strict';
/* #430 (user 2026-09-13): suggestion cards ignored the per-dumbbell display
   mode — a "Suggestions for this workout" card for a dumbbell exercise showed
   the TOTAL combined weight (80 lb, 130 lb) while the set cards correctly
   showed per-dumbbell values. suggestionCardMarkup must run weights through
   dbDisplayWeight like every other display path. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const role=loadRole('progression-logic',{
  globals:{exercises:[
    {id:'dumbbell-bench-press',name:'Dumbbell Bench Press',equipment:'dumbbell'},
    {id:'bench-press',name:'Barbell Bench Press',equipment:'barbell'},
  ]},
});
const {suggestionCardMarkup,workoutState,progressionSetup}=role;

const card=(exerciseId,latest,nextWeight,nextReps)=>suggestionCardMarkup({
  exerciseId,kind:'range',freeform:false,mode:'reps',amrap:false,
  latest,nextWeight,nextReps,nextSeconds:0,
},0,false);

beforeEach(()=>{
  workoutState.completed=[];
  workoutState.activeProgram=null;
  workoutState.draft=null;
  progressionSetup.units='imperial';
  progressionSetup.dbEntry='per';
  progressionSetup.dbEntryPrefs={};
});

describe('#430: suggestion cards honor the dumbbell entry mode',()=>{
  it("the user's case: 110 lb total renders as 55 lb per dumbbell",()=>{
    const html=card('dumbbell-bench-press',{weight:110,reps:10},130,5);
    assert.ok(html.includes('55 lb'),'latest shows per-dumbbell');
    assert.ok(html.includes('65 lb'),'target shows per-dumbbell');
    assert.ok(!html.includes('110 lb'),'no total weight leaks');
    assert.ok(!html.includes('130 lb'),'no total weight leaks');
  });
  it('barbell exercises are untouched',()=>{
    const html=card('bench-press',{weight:135,reps:5},140,5);
    assert.ok(html.includes('135 lb'));
    assert.ok(html.includes('140 lb'));
  });
  it("'total' mode shows the combined weight",()=>{
    progressionSetup.dbEntry='total';
    const html=card('dumbbell-bench-press',{weight:110,reps:10},130,5);
    assert.ok(html.includes('110 lb'));
    assert.ok(html.includes('130 lb'));
  });
  it('per-exercise draft override wins over the Settings default',()=>{
    progressionSetup.dbEntry='total';
    workoutState.draft={exercises:[{exerciseId:'dumbbell-bench-press',
      progression:{dbEntry:'per'}}]};
    const html=card('dumbbell-bench-press',{weight:110,reps:10},130,5);
    assert.ok(html.includes('55 lb'),'exercise-level per wins');
  });
});
