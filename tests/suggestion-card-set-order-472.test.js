'use strict';
/* #472 (user 2026-09-15): suggestion cards must list sets in numeric order
   (Set 1, Set 2, Set 3). The All-sets card was fixed; the default top-set
   card only showed the top set's line. The top-set card now renders one
   .suggestion-set-line per basis set in numeric order, and the suggestion
   object carries a serializable basisSets copy for the top-set case too. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{
  globals:{
    exercises:[{id:'bench-press',name:'Barbell Bench Press',equipment:'barbell'}],
  },
});
const {
  progressionForExercise, suggestionCardMarkup,
  workoutState, progressionSetup,
}=role;

const EX='bench-press';
const PROF={mode:'reps',min:5,max:8,openTop:false,amrap:false,scheme:'rpe'};
/* 3 sets; the top set is Set 3 (heaviest wins the top-set race).
   RPE 7 across the session so the raw top-set RPE meets the trigger. */
function historyLog(){
  return mkLog('log1','2026-09-10',[
    mkItem(EX,[
      {w:115,r:8,rpe:7},
      {w:120,r:8,rpe:7},
      {w:125,r:8,rpe:7},
    ],{progression:{...PROF}}),
  ],'Full training');
}

beforeEach(()=>{
  workoutState.completed=[];
  workoutState.draft=null;
  workoutState.activeProgram=null;
  progressionSetup.units='imperial';
  progressionSetup.threshold=8;
  progressionSetup.progressionOff=false;
  progressionSetup.progressAllSets=false;
  progressionSetup.incrementType='percent';
  progressionSetup.incrementValue=9;
  progressionSetup.timeStep=5;
  delete progressionSetup.dbEntry;
});

describe('top-set card set ordering (#472)',()=>{
  it('carries basisSets in numeric order (per-set targets always built — QA batch 2026-09-22)',()=>{
    workoutState.completed.unshift(historyLog());
    const s=progressionForExercise(EX,{...PROF},null,true);
    assert.ok(s,'expected a suggestion');
    /* The toggle is retired — per-set targets are the only path, so
       setTargets is always present. The #472 guarantee (numeric order)
       stands for both basisSets and setTargets. */
    assert.ok(Array.isArray(s.setTargets)&&s.setTargets.length===3);
    assert.deepEqual(s.setTargets.map(t=>t.index),[0,1,2]);
    assert.ok(Array.isArray(s.basisSets));
    assert.equal(s.basisSets.length,3);
    assert.deepEqual(s.basisSets.map(b=>b.w),[115,120,125]);
    assert.deepEqual(s.basisSets.map(b=>b.r),[8,8,8]);
  });
  it('renders Set 1, Set 2, Set 3 in order on the top-set card',()=>{
    workoutState.completed.unshift(historyLog());
    const s=progressionForExercise(EX,{...PROF},null,true);
    assert.equal(typeof suggestionCardMarkup,'function','suggestionCardMarkup must be reachable via the test role');
    const html=suggestionCardMarkup(s,0,false);
    const lines=(html.match(/suggestion-set-line/g)||[]).length;
    assert.equal(lines,3,'expected one line per basis set');
    const i1=html.indexOf('Set 1'),i2=html.indexOf('Set 2'),i3=html.indexOf('Set 3');
    assert.ok(i1>=0&&i2>=0&&i3>=0,'all three set labels present');
    assert.ok(i1<i2&&i2<i3,'sets listed in numeric order: Set 1, Set 2, Set 3');
  });
  it('a single basis set renders one per-set line (QA batch 2026-09-22)',()=>{
    /* Per-set targets are the only path now, so even a single basis set
       renders the per-set line format — the old single-line special case
       is gone. */
    workoutState.completed.unshift(mkLog('log2','2026-09-10',[
      mkItem(EX,[{w:125,r:8,rpe:8}],{progression:{...PROF}}),
    ],'Full training'));
    const s=progressionForExercise(EX,{...PROF},null,true);
    assert.ok(s,'expected a suggestion');
    assert.equal(s.basisSets.length,1);
    const html=suggestionCardMarkup(s,0,false);
    const lines=(html.match(/suggestion-set-line/g)||[]).length;
    assert.equal(lines,1,'one per-set line for the single basis set');
    assert.ok(html.includes('Set 1'));
    assert.ok(!html.includes('suggestion-change'),'no single-line format');
  });
});
