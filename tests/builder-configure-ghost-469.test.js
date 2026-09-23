'use strict';
/* #469: the builder's Configure dialog writes the RANGE onto the exercise's
   progression profile — never preset numbers into the sets. Per the #353
   ghost convention the range shows as a ghost placeholder on the set
   inputs, and the untouched-completion path saves the range floor when a
   set is finished untouched. Blank sets stay blank; explicitly typed
   per-set targets are never clobbered. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const catalog=[
  {id:'bench-press',name:'Bench Press',tracking:'reps'},
  {id:'plank',name:'Plank',tracking:'time'},
];
const {applyBuilderConfigureRange,rangePlaceholder}=
  loadRole('saved-workout-template',{globals:{exercises:catalog,schedulePersist:()=>{}}});

let uidN=0;
const mkItem=(overrides={})=>({
  uid:'ex-'+(++uidN),exerciseId:'bench-press',tracking:'reps',note:'',
  progression:null,
  sets:[{r:'',w:'',seconds:'',uid:'s1'},{r:'',w:'',seconds:'',uid:'s2'}],
  ...overrides,
});

describe('applyBuilderConfigureRange (#469)',()=>{
  it('writes the range profile and leaves blank sets blank',()=>{
    const item=mkItem();
    const p=applyBuilderConfigureRange(item,false,'6','12');
    assert.equal(p.min,6);assert.equal(p.max,12);
    assert.equal(p.amrap,false);assert.equal(p.openTop,false);assert.equal(p.custom,true);
    assert.equal(item.progression,p);
    assert.ok(item.sets.every(s=>s.r===''),'no preset numbers typed: '+JSON.stringify(item.sets.map(s=>s.r)));
    assert.deepEqual(rangePlaceholder(p,false),{text:'6–12',value:'6'},
      'the range ghosts; the floor is the untouched-completion fallback');
  });
  it('AMRAP writes min with no max and never types values',()=>{
    const item=mkItem();
    const p=applyBuilderConfigureRange(item,false,'6','');
    assert.equal(p.amrap,true);assert.equal(p.min,6);assert.equal(p.max,null);
    assert.ok(item.sets.every(s=>s.r===''),'AMRAP never types values');
    assert.deepEqual(rangePlaceholder(p,false),{text:'AMRAP from 6',value:''});
  });
  it('time mode writes the time range and leaves seconds blank',()=>{
    const item=mkItem({exerciseId:'plank',tracking:'time'});
    const p=applyBuilderConfigureRange(item,true,'30','45');
    assert.equal(p.timeMin,30);assert.equal(p.timeMax,45);
    assert.ok(item.sets.every(s=>s.seconds===''),'no preset seconds typed');
    assert.deepEqual(rangePlaceholder(p,true),{text:'30–45 sec',value:'30'});
  });
  it('never clobbers explicitly typed per-set targets',()=>{
    const item=mkItem();
    item.sets[0].r='10';item.sets[1].r='8';
    applyBuilderConfigureRange(item,false,'6','12');
    assert.deepEqual(item.sets.map(s=>s.r),['10','8'],
      'typed targets are explicit user input — Configure sets the range, not values');
  });
  it('clearing the range leaves sets alone (fixed-reps blank state)',()=>{
    const item=mkItem();
    applyBuilderConfigureRange(item,false,'','');
    assert.equal(item.progression.min,null);assert.equal(item.progression.max,null);
    assert.ok(item.sets.every(s=>s.r===''));
  });
});
