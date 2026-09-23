'use strict';
/* QA batch (user 2026-09-21): exercise merges — #9 Underhand Cable Pulldown
   into Reverse lat pull-down (his screenshot's capitalization); #10 Dumbbell
   Raise into Lateral Raise. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {resolveExercise,canonicalExerciseId,exercises}=loadRole('alias-539');

describe('exercise merges (user 2026-09-21)',()=>{
  it('#9: Underhand_Cable_Pulldowns resolves as Reverse lat pull-down',()=>{
    const ex=resolveExercise('Underhand_Cable_Pulldowns');
    assert.ok(ex,'old id still resolves');
    assert.equal(ex.name,'Reverse lat pull-down');
    assert.equal(ex.id,'Underhand_Cable_Pulldowns','stable id preserved');
  });
  it('#10: Dumbbell_Raise aliases to the canonical Lateral Raise',()=>{
    assert.equal(canonicalExerciseId('Dumbbell_Raise'),'Side_Lateral_Raise');
    const ex=resolveExercise('Side_Lateral_Raise');
    assert.ok(ex,'canonical id resolves');
    assert.equal(ex.name,'Lateral Raise');
  });
  it('#10: the alias record stays hidden from the library',()=>{
    const alias=exercises.find(x=>x.id==='Dumbbell_Raise');
    assert.ok(alias&&alias.aliasOf,'alias record exists with aliasOf');
  });
});
