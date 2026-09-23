'use strict';
/* #246 (user 2026-09-14): strength-like builder ranges (a defined max of 5
   or fewer) need at least 2 sets. Role: picker-scroll (workout-builder.js
   loads clean under the stub DOM). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const ROOT=path.resolve(__dirname,'..');
const builderJs=fs.readFileSync(path.join(ROOT,'assets/js/workout/workout-builder.js'),'utf8');

const {strengthLikeMinSets}=loadRole('picker-scroll');

describe('#246: strength-like builder ranges need at least 2 sets',()=>{
  it('max ≤ 5 → minimum 2 (strength-like)',()=>{
    assert.equal(strengthLikeMinSets({mode:'reps',min:1,max:5}),2);
    assert.equal(strengthLikeMinSets({mode:'reps',min:3,max:3}),2);
  });
  it('hypertrophy ranges → minimum 1',()=>{
    assert.equal(strengthLikeMinSets({mode:'reps',min:6,max:12}),1);
    assert.equal(strengthLikeMinSets({mode:'reps',min:8,max:20}),1);
  });
  it('AMRAP / open-top (no max) are not strength-like',()=>{
    assert.equal(strengthLikeMinSets({mode:'reps',min:6,max:null,amrap:true}),1);
    assert.equal(strengthLikeMinSets({mode:'reps',min:15,max:null,openTop:true}),1);
  });
  it('time mode is not strength-like',()=>{
    assert.equal(strengthLikeMinSets({mode:'time',timeMin:30,timeMax:60}),1);
  });
  it('the Sets input floor and the edit clamp both use the helper',()=>{
    assert.ok(builderJs.includes('min="${minSets}"'),'input min follows the helper');
    assert.ok(builderJs.includes('strengthLikeMinSets(profile)'),'markup + handler share the helper');
  });
});
