'use strict';
/* Role: catalog-logic — pins #280 (user 2026-09-13): cardio-category
   exercises default to time tracking, so conditioning movements open on the
   Seconds segment instead of Reps. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const REPO_ROOT=path.join(__dirname,'..');
const {defaultExerciseTracking}=loadRole('catalog-logic');

describe('defaultExerciseTracking (#280)',()=>{
  it('defaults cardio-category exercises to time',()=>{
    assert.equal(defaultExerciseTracking({force:'pull',category:'cardio'}),'time');
    assert.equal(defaultExerciseTracking({force:'push',category:'cardio'}),'time');
  });
  it('keeps static-force exercises on time',()=>{
    assert.equal(defaultExerciseTracking({force:'static',category:'stretching'}),'time');
  });
  it('leaves strength exercises on reps',()=>{
    assert.equal(defaultExerciseTracking({force:'push',category:'strength'}),'reps');
    assert.equal(defaultExerciseTracking({force:'pull',category:'powerlifting'}),'reps');
  });
});

describe('catalog normalization (#280)',()=>{
  const src=fs.readFileSync(path.join(REPO_ROOT,'assets','js','data','catalog.js'),'utf8');
  it('the normalize step uses defaultExerciseTracking',()=>{
    assert.ok(src.includes('tracking: defaultExerciseTracking(x)'),'normalize reads the helper, not an inline force check');
  });
});
