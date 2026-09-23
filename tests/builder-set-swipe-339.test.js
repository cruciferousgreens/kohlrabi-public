'use strict';
/* #339: the saved-workout builder's set rows support swipe-to-delete like the
   live editor — the swipe-item wrapper + delete rail around each builder set
   row, the rail wired to the same removal as the inline ×, and the gesture
   installed after renderSavedBuilder. The inline × stays as the delete path
   when swipe is off (desktop) and hides when swipe is on (touch). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const saved=fs.readFileSync(path.join(ROOT,'assets/js/pages/saved-workouts.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');

describe('#339 builder set rows swipe to delete',()=>{
  it('builder set rows are wrapped in the swipe-item pattern with a delete rail',()=>{
    assert.ok(saved.includes('class="swipe-item set-swipe" data-builder-set-swipe='),
      'builder set row has the swipe-item wrapper');
    assert.ok(saved.includes('class="swipe-delete-action delete-builder-set-swipe"'),
      'builder set row has the swipe delete rail');
    assert.ok(saved.includes('<div class="swipe-content"><div class="builder-set-row">'),
      'swipe-content wraps the builder set row (P1 QA 2026-09-22: tag chips sit inside the swipe wrapper)');
  });
  it('the rail deletes through the same removal as the inline ×',()=>{
    const m=saved.match(/function wireBuilderDeleteSet\(host,findItem\)\{([\s\S]*?)\n    \}/);
    assert.ok(m,'wireBuilderDeleteSet found');
    assert.ok(m[1].includes('.delete-builder-set-swipe'),
      'the rail button is wired');
    assert.ok(m[1].includes('removeSet(btn.dataset.builderUid,btn.dataset.builderSet)'),
      'the rail uses the shared removal');
    assert.ok(m[1].includes('removeSet(btn.dataset.builderUid,btn.dataset.builderDelSet)'),
      'the inline × uses the shared removal');
  });
  it('renderSavedBuilder installs the swipe gesture',()=>{
    const m=saved.match(/function renderSavedBuilder\(\)\{([\s\S]*?)\n    function applyBuilderFocus/);
    assert.ok(m,'renderSavedBuilder found');
    assert.ok(m[1].includes('attachSwipeDelete(host)'),
      'attachSwipeDelete(host) runs after the builder renders');
  });
  it('the inline × hides when swipe is on and the grid drops its column',()=>{
    assert.ok(css.includes('.is-touch.swipe-sets .builder-set-row .builder-x{display:none;}'),
      'inline × hides when swipe-to-delete is on');
    assert.ok(css.includes('.is-touch.swipe-sets .builder-set-row{grid-template-columns:44px minmax(0,1fr);}'),
      'row grid drops the × column when swipe is on');
  });
});
