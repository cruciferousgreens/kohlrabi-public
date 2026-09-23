'use strict';
/* #547 (user 2026-09-19): tapping a workout focus pill recomputed the
   suggestions (prepareDraftProgression) and refreshed the rep-range
   placeholders, but the per-card suggestion rows kept showing the old
   targets — renderWorkoutProgression() only hides the retired banner, and
   the rows live inside each exercise card. Structural pins: the focus
   applier must refresh the rows, and the row refresher must be surgical
   (no full-list teardown per #92, no set-row rebuild). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

const bootSrc=fs.readFileSync(path.join(__dirname,'..','assets','js','core','app-bootstrap.js'),'utf8');
const editorSrc=fs.readFileSync(path.join(__dirname,'..','assets','js','workout','workout-editor.js'),'utf8');

function fnBody(src,name){
  const start=src.indexOf(`    function ${name}(`);
  assert.ok(start>0,`${name} exists`);
  return src.slice(start,src.indexOf('\n    function ',start+10));
}

describe('#547: workout focus pill refreshes the visible suggestion rows',()=>{
  it('applyWorkoutFocus refreshes the per-card suggestion rows',()=>{
    const fn=fnBody(bootSrc,'applyWorkoutFocus');
    assert.ok(fn.includes('prepareDraftProgression'),'suggestions are recomputed');
    assert.ok(fn.includes('refreshCardSuggestionRows'),'the visible rows are refreshed');
  });
  it('refreshCardSuggestionRows is surgical — no full re-render, no card teardown',()=>{
    const fn=fnBody(editorSrc,'refreshCardSuggestionRows');
    assert.ok(fn.includes('cardSuggestionHtml'),'rows are rebuilt from the fresh suggestion');
    assert.ok(fn.includes('wireLiveCardSuggestions'),'refreshed rows stay tappable');
    assert.ok(fn.includes('.suggestion-inline'),'only the suggestion row is swapped');
    const code=fn.replace(/\/\*[\s\S]*?\*\//g,'');
    assert.ok(!code.includes('renderWorkoutExercises('),'never triggers the #92 full-list flash');
    assert.ok(!code.includes('swapExerciseCard('),'never rebuilds set rows');
    assert.ok(!code.includes('liveExerciseCardHtml('),'never rebuilds the card');
  });
  it('swapExerciseCard keeps its #334 shape (the pins above slice its body)',()=>{
    const fn=fnBody(editorSrc,'swapExerciseCard');
    assert.ok(fn.includes('card.replaceWith(newCard)'),'only the affected card is replaced');
    assert.ok(!fn.includes('refreshCardSuggestionRows'),'row refresh stays a separate helper');
  });
});
