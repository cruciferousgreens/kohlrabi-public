'use strict';
/* F3 — sessionBestLabel headlined an estimate for 0-rep sets: it took
   Math.max(0, ...sets.map(estimate1RM)) with no rep filter, and
   estimate1RM with r=0 degenerates to w, so a 200×0 session printed
   "Best estimate 200 lb" while the same page's PROJECTED 1RM stat (via
   statsFor, which filters Number(set.r)>0) showed nothing. The headline now
   filters to r>0 sets and returns '' when none survive — the honest empty
   it already used for timed/unweighted sessions. Role: exercise-detail-logic. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {sessionBestLabel}=loadRole('exercise-detail-logic');

const repSet=(w,r)=>({w,r,seconds:null,rpe:null,tags:[]});

describe('F3 — sessionBestLabel ignores zero-rep sets',()=>{
  it('a 200×0 session yields the honest empty (the F3 repro)',()=>{
    assert.equal(sessionBestLabel({tracking:'reps',sets:[repSet(200,0)]}),'');
  });
  it('a real 200×5 session keeps its estimate headline',()=>{
    const label=sessionBestLabel({tracking:'reps',sets:[repSet(200,5)]});
    assert.ok(label.startsWith('Best estimate '),label);
  });
  it('a 0-rep set mixed with real sets does not warp the headline',()=>{
    const withZero=sessionBestLabel({tracking:'reps',sets:[repSet(200,0),repSet(150,5)]});
    const withoutZero=sessionBestLabel({tracking:'reps',sets:[repSet(150,5)]});
    assert.equal(withZero,withoutZero);
  });
});
