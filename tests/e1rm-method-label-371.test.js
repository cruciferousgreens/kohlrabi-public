'use strict';
/* Role: exercise-math — pins #371: the PROJECTED 1RM stat must label its
   method honestly. estimate1RM only folds RPE in when an RPE was actually
   logged; a missing RPE falls back to plain Epley, so the sub-label must
   say "Epley estimate" instead of "RPE-adjusted" in that case. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {projected1rmSubLabel}=loadRole('exercise-math');

describe('projected1rmSubLabel — #371 honest 1RM method label',()=>{
  it('logged RPE → RPE-adjusted with the basis set',()=>{
    assert.equal(projected1rmSubLabel({w:140,r:8,rpe:7}),'RPE-adjusted · 140 × 8 @ 7');
  });
  it('missing RPE → Epley estimate, no RPE claim',()=>{
    assert.equal(projected1rmSubLabel({w:140,r:8,rpe:null}),'Epley estimate · 140 × 8');
    assert.equal(projected1rmSubLabel({w:140,r:8,rpe:''}),'Epley estimate · 140 × 8');
    assert.equal(projected1rmSubLabel({w:140,r:8}),'Epley estimate · 140 × 8');
  });
  it('never claims RPE-adjusted without an RPE',()=>{
    for(const set of [{w:140,r:8,rpe:null},{w:140,r:8,rpe:''}]){
      assert.ok(!projected1rmSubLabel(set).includes('RPE-adjusted'));
    }
  });
});
