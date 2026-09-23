'use strict';
/* Role: picker-scroll — pins #364 and #366 for the exercise picker.
   #364: swapping an exercise clears the old movement's per-exercise note
   and exercise tags (swapCarryoverReset) instead of silently
   misattributing them to the replacement — and performExerciseSwap calls it.
   #366: add/swap picker rows show the Custom badge for custom exercises,
   like the Exercises tab does. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole,REPO_ROOT}=require('./harness');

const {swapCarryoverReset,pickerCustomBadge}=loadRole('picker-scroll');

describe('swapCarryoverReset — #364 swap clears note and tags',()=>{
  it('clears note, noteOpen, and exerciseTags',()=>{
    const item={note:'keep chest up',noteOpen:true,exerciseTags:['compound','push']};
    const out=swapCarryoverReset(item);
    assert.equal(out.note,'');
    assert.equal(out.noteOpen,false);
    assert.deepEqual(out.exerciseTags,[]);
  });
  it('mutates the item in place (the swap keeps its set structure)',()=>{
    const item={uid:'u1',note:'x',noteOpen:false,exerciseTags:['a'],sets:[1,2,3]};
    assert.equal(swapCarryoverReset(item),item);
    assert.deepEqual(item.sets,[1,2,3]);
  });
  it('performExerciseSwap routes through swapCarryoverReset',()=>{
    const src=fs.readFileSync(path.join(REPO_ROOT,'assets','js','workout','workout-builder.js'),'utf8');
    const start=src.indexOf('function performExerciseSwap');
    assert.ok(start>0,'performExerciseSwap exists');
    const body=src.slice(start,src.indexOf('if(swapped)showToast',start));
    assert.ok(body.includes('swapCarryoverReset(item)'),'swap calls the carryover reset');
  });
});

describe('pickerCustomBadge — #366 Custom badge in picker rows',()=>{
  it('custom exercises get the badge',()=>{
    assert.equal(pickerCustomBadge({id:'c1',custom:true}),'<span class="tag custom">Custom</span>');
  });
  it('library exercises get nothing',()=>{
    assert.equal(pickerCustomBadge({id:'bench'}),'');
    assert.equal(pickerCustomBadge(null),'');
  });
  it('renderPickerList stamps the badge on each row',()=>{
    const src=fs.readFileSync(path.join(REPO_ROOT,'assets','js','workout','workout-builder.js'),'utf8');
    const start=src.indexOf('function renderPickerList');
    assert.ok(start>0,'renderPickerList exists');
    const body=src.slice(start,start+8000);
    assert.ok(body.includes('pickerCustomBadge(ex)'),'picker rows use the badge helper');
  });
});
