'use strict';
/* #472 (user 2026-09-14): progression suggestion cards list sets out of
   order — a stalled top set's "Hold" line led the card regardless of
   position (Set 3, Set 1, Set 2). Set lines now render in numeric order. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const role=loadRole('progression-logic',{globals:{exercises:[]}});
const {suggestionCardMarkup,workoutState}=role;

function seedExercise(id,name,equipment){
  role.exercises.push({id,name,equipment:equipment||'barbell'});
}
function cardFor(suggestion){
  return suggestionCardMarkup(suggestion,0,true).replace('data-demo-suggestion','data-real-suggestion');
}
/* Hand-built all-sets suggestion: top set is Set 3 (index 2) and holds,
   Sets 1–2 move. Mirrors the shape progressionForExercise emits. */
function stalledTopSuggestion(){
  return {
    exerciseId:'db-bench',mode:'reps',kind:'load',applied:false,
    latest:{weight:50,reps:8},
    nextWeight:55,nextReps:6,nextSeconds:0,
    topIndex:2,
    setTargets:[
      {index:0,w:55,r:6,seconds:0,kind:'load',changed:true,oldW:50,oldR:8,oldSeconds:0},
      {index:1,w:55,r:6,seconds:0,kind:'load',changed:true,oldW:50,oldR:8,oldSeconds:0},
      {index:2,w:50,r:8,seconds:0,kind:'hold',changed:false,oldW:50,oldR:8,oldSeconds:0},
    ],
  };
}
function setLineOrder(html){
  const order=[];
  const re=/<span>Set (\d+)<\/span>/g;
  let m;
  while((m=re.exec(html)))order.push(Number(m[1]));
  return order;
}

beforeEach(()=>{
  role.exercises.length=0;
  workoutState.completed=[];
  workoutState.activeProgram=null;
  workoutState.draft=null;
  seedExercise('db-bench','Dumbbell Bench Press','dumbbell');
});

describe('#472: suggestion card set lines in numeric order',()=>{
  it('stalled top set (Set 3) renders last, not first',()=>{
    const html=cardFor(stalledTopSuggestion());
    assert.deepEqual(setLineOrder(html),[1,2,3]);
  });
  it('the Hold line sits in its numeric position',()=>{
    const html=cardFor(stalledTopSuggestion());
    const holdIdx=html.indexOf('is-hold');
    const set1Idx=html.indexOf('<span>Set 1</span>');
    const set2Idx=html.indexOf('<span>Set 2</span>');
    assert.ok(set1Idx<set2Idx&&set2Idx<holdIdx,'Set 1 < Set 2 < Set 3 (Hold)');
  });
  it('a moving top set still leads when it is Set 1',()=>{
    const s=stalledTopSuggestion();
    s.topIndex=0;
    s.setTargets=[
      {index:0,w:55,r:6,seconds:0,kind:'load',changed:true,oldW:50,oldR:8,oldSeconds:0},
      {index:1,w:55,r:6,seconds:0,kind:'load',changed:true,oldW:50,oldR:8,oldSeconds:0},
      {index:2,w:55,r:6,seconds:0,kind:'load',changed:true,oldW:50,oldR:8,oldSeconds:0},
    ];
    assert.deepEqual(setLineOrder(cardFor(s)),[1,2,3]);
  });
});
