'use strict';
/* Persona 8 chaos sweep (2026-09-15): workoutsForPeriod threw on a null
   entry in workoutState.completed (TypeError reading w.date), breaking
   Dashboard/Stats period filtering; and non-finite weights ('1e309' ->
   Infinity) flowed through setVolume/displayVolume into "Infinity" renders.
   Pins: null entries are skipped at read time, non-finite inputs degrade
   to 0 exactly like NaN/blank already did. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const catalog=require('./fixtures/catalog');
const {
  workoutsForPeriod, setVolume, displayVolume, localIsoDate,
  workoutState, progressionSetup,
}=loadRole('stats-math',{globals:{exercises:catalog}});

function W(id,date){return {id,date,isoDate:date,name:'W '+id,exercises:[]};}
beforeEach(()=>{
  workoutState.completed=[];
  progressionSetup.units='imperial';
});

describe('workoutsForPeriod skips null entries',()=>{
  it('does not throw on null/undefined entries',()=>{
    const today=localIsoDate(new Date());
    workoutState.completed=[null,undefined,W('good',today)];
    assert.doesNotThrow(()=>workoutsForPeriod('today'));
    const ids=workoutsForPeriod('today').map(w=>w.id);
    assert.deepEqual(ids,['good']);
  });
  it('does not throw when completed is not an array',()=>{
    workoutState.completed='oops';
    assert.doesNotThrow(()=>workoutsForPeriod('today'));
    assert.deepEqual(workoutsForPeriod('today'),[]);
  });
});

describe('setVolume degrades non-finite inputs to 0',()=>{
  it('finite inputs unchanged',()=>{
    assert.equal(setVolume({w:100,r:5}),500);
    assert.equal(setVolume({w:'50',r:'10'}),500);
    assert.equal(setVolume({w:'abc',r:2}),0);
    assert.equal(setVolume({w:'',r:2}),0);
  });
  it('Infinity / -Infinity degrade to 0',()=>{
    assert.equal(setVolume({w:'1e309',r:'2'}),0);
    assert.equal(setVolume({w:Infinity,r:2}),0);
    assert.equal(setVolume({w:100,r:'1e309'}),0);
    assert.equal(setVolume({w:-Infinity,r:2}),0);
  });
});

describe('displayVolume degrades non-finite inputs to 0',()=>{
  it('finite inputs unchanged (imperial + metric)',()=>{
    assert.equal(displayVolume(500),500);
    assert.equal(displayVolume('abc'),0);
    assert.equal(displayVolume(''),0);
    assert.equal(displayVolume(null),0);
    progressionSetup.units='metric';
    assert.equal(displayVolume(100),100*0.45359237);
  });
  it('Infinity degrades to 0 in both unit systems',()=>{
    assert.equal(displayVolume('1e309'),0);
    progressionSetup.units='metric';
    assert.equal(displayVolume('1e309'),0);
  });
});
