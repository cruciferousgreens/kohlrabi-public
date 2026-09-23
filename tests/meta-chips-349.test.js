'use strict';
/* #349 (user 2026-09-13): the program-workout page and the share landing card
   use the same chip summary as the saved-workout detail header (#320) —
   "N exercises" / "M sets" as .tag pills — instead of the old
   "N exercises · M sets" text line. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const shareSrc=fs.readFileSync(path.join(ROOT,'assets/js/share/share.js'),'utf8');
const programsSrc=fs.readFileSync(path.join(ROOT,'assets/js/pages/programs.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');

const cardStart=shareSrc.indexOf('function sharePreviewCardHtml(payload){');
assert.ok(cardStart!==-1,'sharePreviewCardHtml found');
const card=shareSrc.slice(cardStart);
const pageStart=programsSrc.indexOf('function renderProgramWorkoutPage(program,workout');
assert.ok(pageStart!==-1,'renderProgramWorkoutPage found');
const page=programsSrc.slice(pageStart,pageStart+4000);

describe('share landing: chip summary, no text line (#349)',()=>{
  it('renders a meta-chips list with tag pills',()=>{
    assert.ok(card.includes('class="meta-chips" role="list" aria-label="${isTemplate?\'Workout\':\'Program\'} summary"'),
      'chips row with an accessible list label');
    assert.ok(card.includes('metaChips.map(c=>`<span class="tag" role="listitem">${c}</span>`).join(\'\')'),
      'each chip is a .tag listitem');
  });
  it('templates chip exercise + set counts',()=>{
    assert.ok(card.includes('`${rows.length} exercise${rows.length===1?\'\':\'s\'}`'),'exercise-count chip');
    assert.ok(card.includes('`${totalSets} set${totalSets===1?\'\':\'s\'}`'),'set-count chip');
  });
  it('programs chip workout counts',()=>{
    assert.ok(card.includes('`${workoutCount} workout${workoutCount===1?\'\':\'s\'}`'),'workout-count chip');
  });
  it('custom exercises get their own chip instead of a · suffix',()=>{
    assert.ok(card.includes('metaChips.push(`includes ${customCount} custom exercise${customCount===1?\'\':\'s\'}`)'),
      'custom-exercise chip');
    assert.ok(!card.includes('${escapeHtml(meta)}'),'no escaped text-line meta remains');
  });
  it('loading skeleton mirrors chips with pill skeletons',()=>{
    const skel=shareSrc.slice(shareSrc.indexOf('function sharePreviewSkeletonHtml()'));
    assert.ok(skel.includes('class="meta-chips"'),'skeleton has the chips row');
    assert.ok(skel.includes('class="skel skel-pill"'),'skeleton chips are pill skeletons');
    assert.ok(!skel.includes('class="completed-meta"'),'no text-line skeleton remains');
  });
});

describe('program-workout page: chip summary, no text line (#349)',()=>{
  it('renders meta-chips with exercise + set tags',()=>{
    assert.ok(page.includes('class="meta-chips" role="list" aria-label="Workout summary"'),
      'chips row with an accessible list label');
    assert.ok(page.includes('<span class="tag" role="listitem">${rows.length} exercise${rows.length===1?\'\':\'s\'}</span>'),
      'exercise-count chip');
    assert.ok(page.includes('<span class="tag" role="listitem">${totalSets} set${totalSets===1?\'\':\'s\'}</span>'),
      'set-count chip');
  });
  it('no "N exercises · M sets" text line remains on the page',()=>{
    assert.ok(!page.includes('exercise${rows.length===1?\'\':\'s\'} · ${totalSets}'),
      'the ·-separated text line is gone');
  });
});

describe('chip CSS still present',()=>{
  it('.meta-chips layout rule ships in the stylesheet',()=>{
    assert.ok(css.includes('.meta-chips'),'meta-chips rule present');
  });
});
