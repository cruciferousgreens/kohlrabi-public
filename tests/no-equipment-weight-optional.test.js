'use strict';
/* Hotfix (user 2026-09-15): exercises with no equipment recorded are treated
   like bodyweight — added weight is optional. Covers the custom-exercise case
   (customDraft.equipment defaults to '') and any library entry missing the
   field, while a null (not found) exercise keeps the old required behavior. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {exerciseWeightOptional}=loadRole('warmup-ui');

describe('no-equipment weight-optional hotfix',()=>{
  it('missing/empty equipment is weight-optional like bodyweight',()=>{
    assert.equal(exerciseWeightOptional({equipment:''}),true);
    assert.equal(exerciseWeightOptional({}),true);
    assert.equal(exerciseWeightOptional({name:'My custom move',equipment:''}),true);
    assert.equal(exerciseWeightOptional({equipment:undefined}),true);
  });
  it('listed and loaded equipment behavior is unchanged',()=>{
    assert.equal(exerciseWeightOptional({equipment:'body only'}),true);
    assert.equal(exerciseWeightOptional({equipment:'bands'}),true);
    assert.equal(exerciseWeightOptional({equipment:'barbell'}),false);
    assert.equal(exerciseWeightOptional({equipment:'dumbbell'}),false);
    assert.equal(exerciseWeightOptional(null),false);
  });
});
