'use strict';
/* #574 (user 2026-09-20): stale progression basis — a session older than the
   age cap is memory, not advice. A stale same-zone basis is rejected: the
   engine falls through to the fresh most-recent log when one exists, and
   shows no suggestion at all when every usable session is stale.
   User 2026-09-22: the cap is hard-baked as SUGGESTION_BASIS_WEEKS
   (formulas/progression-analysis.js) — the Settings pills are gone. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const role=loadRole('progression-logic',{
  globals:{exercises:[{id:'deadlift',name:'Deadlift'}]},
});
const {progressionForExercise,workoutState,progressionSetup}=role;

const CFG=()=>({scheme:'rpe',threshold:8,incrementType:'lb',incrementValue:5,timeStep:5});
const profile={mode:'reps',min:6,max:12};
/* Workout dates relative to the real today, so the suite is robust whenever
   it runs. */
function daysAgo(n){const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10);}
const STALE=()=>daysAgo(100), FRESH=()=>daysAgo(3), FRESH_IN_ZONE=()=>daysAgo(10);

function historyWith({stale=true,fresh=true,freshInZone=false}={}){
  const logs=[];
  if(stale)logs.push(mkLog('w-old',STALE(),[mkItem('deadlift',[{w:145,r:8,rpe:7}],{progression:profile})]));
  if(fresh)logs.push(mkLog('w-new',FRESH(),[mkItem('deadlift',[{w:245,r:1,rpe:8}],{progression:{mode:'reps',min:1,max:5}})]));
  if(freshInZone)logs.push(mkLog('w-new',FRESH_IN_ZONE(),[mkItem('deadlift',[{w:150,r:8,rpe:7}],{progression:profile})]));
  workoutState.completed=logs;
}

beforeEach(()=>{
  /* #577: linear is now the app default; these tests exercise RPE mechanics. */
  progressionSetup.scheme='rpe';
  workoutState.completed=[];
  workoutState.activeProgram=null;
  progressionSetup.units='imperial';
});

describe('#574: stale same-zone basis is rejected',()=>{
  it('a 100-day-old in-zone basis loses to the fresh most-recent log',()=>{
    historyWith({stale:true,fresh:true});
    const s=progressionForExercise('deadlift',profile,CFG());
    assert.ok(s,'a suggestion still comes from the fresh log');
    assert.equal(s.sourceDate,FRESH(),'basis is the fresh session, not the stale one');
    assert.ok(s.nextWeight>=245||s.kind==='hold','no regression to the stale 145 lb basis: '+JSON.stringify({kind:s.kind,nextWeight:s.nextWeight}));
  });
  it('all-stale history yields no suggestion (ghosts are memory, not advice)',()=>{
    historyWith({stale:true,fresh:false});
    const s=progressionForExercise('deadlift',profile,CFG());
    assert.equal(s,null,'no suggestion card when every usable session is stale');
  });
  it('a fresh in-zone basis is still used normally',()=>{
    historyWith({stale:true,fresh:false,freshInZone:true});
    const s=progressionForExercise('deadlift',profile,CFG());
    assert.ok(s,'suggestion exists');
    assert.equal(s.sourceDate,FRESH_IN_ZONE(),'basis is the fresh in-zone session');
    assert.equal(s.nextWeight,150,'progresses from the fresh basis');
  });
  /* User 2026-09-22: the setting is gone — the cap is hard-baked as
     SUGGESTION_BASIS_WEEKS. A legacy basisCapWeeks value (e.g. 0 = the old
     "never expires") must be ignored: the stale basis stays rejected. */
  it('a legacy basisCapWeeks=0 (old "never expires") is ignored',()=>{
    progressionSetup.basisCapWeeks=0;
    historyWith({stale:true,fresh:true});
    const s=progressionForExercise('deadlift',profile,CFG());
    assert.ok(s,'suggestion exists');
    assert.equal(s.sourceDate,FRESH(),'the stale in-zone basis is still rejected');
  });
  it('a legacy basisCapWeeks=4 is ignored',()=>{
    progressionSetup.basisCapWeeks=4;
    historyWith({stale:true,fresh:true});
    const s=progressionForExercise('deadlift',profile,CFG());
    assert.ok(s&&s.sourceDate===FRESH(),'fresh log is the basis');
  });
});

describe('SUGGESTION_BASIS_WEEKS (user 2026-09-22)',()=>{
  it('is hard-baked at 8 weeks',()=>{
    assert.equal(SUGGESTION_BASIS_WEEKS,8,'the stale-basis age cap is 8 weeks');
  });
});
