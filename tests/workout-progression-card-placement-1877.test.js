'use strict';
/* User 2026-09-22: the workout-page progression info sits UNDER "Exercise
   options" — nested inside the advanced-options disclosure body, matching
   the saved-workout builder. (Supersedes the v1.877 pin, which had it as a
   sibling before the disclosure; that placement rendered above Exercise
   options.) Pins the source-text placement in workout-editor.js: the
   ${progressionSummaryForOptions(item)} interpolation must sit inside the
   <div class="advanced-options-body">. Also pins that the card itself
   (utilities.js) is a <details class="progression-card"> with no `open`
   attribute. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const editor=fs.readFileSync(path.join(ROOT,'assets/js/workout/workout-editor.js'),'utf8');
const utils=fs.readFileSync(path.join(ROOT,'assets/js/lib/utilities.js'),'utf8');

describe('progression card placement (workout page)',()=>{
  it('progression card is nested inside the Exercise options body',()=>{
    const advStart=editor.indexOf('<details class="advanced-options"');
    assert.ok(advStart>=0,'advanced-options disclosure missing from workout-editor.js');
    const advBodyStart=editor.indexOf('<div class="advanced-options-body">',advStart);
    const advEnd=editor.indexOf('</details>',advBodyStart);
    const body=editor.slice(advBodyStart,advEnd);
    assert.ok(body.includes('${progressionSummaryForOptions(item)}'),
      'progression card must be nested inside advanced-options-body');
  });
  it('progression card does not render before the Exercise options disclosure',()=>{
    const cardAt=editor.indexOf('${progressionSummaryForOptions(item)}');
    const advAt=editor.indexOf('<details class="advanced-options"');
    assert.ok(cardAt>=0,'progressionSummaryForOptions interpolation missing from workout-editor.js');
    assert.ok(cardAt>advAt,'progression card must not render BEFORE <details class="advanced-options">');
  });
  it('the card is a collapsed-by-default details disclosure',()=>{
    assert.ok(utils.includes('<details class="progression-card">'),
      'progressionSummaryForOptions must render <details class="progression-card">');
    assert.ok(!utils.includes('<details class="progression-card" open'),
      'progression card must not be open by default');
  });
});
