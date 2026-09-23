'use strict';
/* #452 (user 2026-09-14): exercise ball, foam roll(er), and "other"
   equipment are weight-optional like bodyweight/bands — the load is
   bodyweight-ish or unknown. Pins the shared helper against the exact
   equipment strings in data/exercises-db.js. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {exerciseWeightOptional}=loadRole('warmup-ui');

describe('#452 exerciseWeightOptional',()=>{
  it('ball, foam roll(er), and other are weight-optional',()=>{
    assert.equal(exerciseWeightOptional({equipment:'exercise ball'}),true);
    assert.equal(exerciseWeightOptional({equipment:'foam roll'}),true);
    assert.equal(exerciseWeightOptional({equipment:'foam roller'}),true);
    assert.equal(exerciseWeightOptional({equipment:'other'}),true);
  });
  it('existing behavior is unchanged',()=>{
    assert.equal(exerciseWeightOptional({equipment:'body only'}),true);
    assert.equal(exerciseWeightOptional({equipment:'bands'}),true);
    assert.equal(exerciseWeightOptional({equipment:'barbell'}),false);
    assert.equal(exerciseWeightOptional({equipment:'dumbbell'}),false);
    assert.equal(exerciseWeightOptional({equipment:'cable'}),false);
    assert.equal(exerciseWeightOptional({equipment:'machine'}),false);
    assert.equal(exerciseWeightOptional({equipment:'kettlebells'}),false);
    assert.equal(exerciseWeightOptional({equipment:'medicine ball'}),false);
    assert.equal(exerciseWeightOptional({equipment:'e-z curl bar'}),false);
    assert.equal(exerciseWeightOptional(null),false);
    assert.equal(exerciseWeightOptional({}),true); /* hotfix 2026-09-15: no equipment recorded → like bodyweight */
    assert.equal(exerciseWeightOptional({equipment:''}),true);
    assert.equal(exerciseWeightOptional({name:'Custom move'}),true);
  });
});
