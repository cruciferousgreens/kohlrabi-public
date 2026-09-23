'use strict';
/* #258 (user 2026-09-12): deleting a saved workout from its editor must
   return to the saved-workouts list section — not the top of the Workouts
   page. The return decision is a pure rule (savedDeleteReturnsToList):
   only a delete of the currently-open editor routes back to the list; a
   delete from the list itself leaves the user where they are. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {savedDeleteReturnsToList}=loadRole('saved-workout-template');

describe('savedDeleteReturnsToList (#258)',()=>{
  it('returns to the list when the deleted workout is the open editor',()=>{
    assert.equal(savedDeleteReturnsToList('t1','t1'),true);
  });
  it('stays put when deleting a different workout from the list',()=>{
    assert.equal(savedDeleteReturnsToList('t2','t1'),false);
  });
  it('stays put when no editor is open',()=>{
    assert.equal(savedDeleteReturnsToList('t2',null),false);
    assert.equal(savedDeleteReturnsToList('t2',undefined),false);
  });
  it('never routes on an empty delete id',()=>{
    assert.equal(savedDeleteReturnsToList('', 't1'),false);
    assert.equal(savedDeleteReturnsToList(null,'t1'),false);
  });
});
