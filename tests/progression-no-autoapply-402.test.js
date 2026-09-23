'use strict';
/* #402 (user 2026-09-13): progression suggestions must never auto-apply.
   Starting a program workout (or the #380 late-history refresh) used to loop
   over every suggestion and stamp it onto the draft as a ghosted target, so
   the user never chose anything. #406 (user 2026-09-16) moved the suggestion
   UI into the exercise cards: each card renders its own tap-to-apply row
   (cardSuggestionHtml, wired by wireLiveCardSuggestions) and the separate
   banner is retired. The #402 guarantee is unchanged — nothing applies
   without a tap — only the surface moved. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const programs=fs.readFileSync(path.join(ROOT,'assets/js/pages/programs.js'),'utf8');
const progression=fs.readFileSync(path.join(ROOT,'assets/js/workout/progression.js'),'utf8');
const editor=fs.readFileSync(path.join(ROOT,'assets/js/workout/workout-editor.js'),'utf8');

function fnBody(src,name){
  const start=src.indexOf(`function ${name}(`);
  assert.ok(start!==-1,`${name} exists`);
  return src.slice(start,src.indexOf('\n    function ',start+10));
}

describe('#402 program start does not auto-apply suggestions',()=>{
  it('doStartProgramWorkout computes suggestions but applies none',()=>{
    const body=fnBody(programs,'doStartProgramWorkout');
    assert.ok(body.includes('prepareDraftProgression(workoutState.draft,progressionContext)'),
      'suggestions are still computed at start');
    assert.ok(!body.includes('applyProgressionSuggestion('),
      'no suggestion is stamped onto the draft at start');
    assert.ok(!body.includes('autoAppliedProgression'),
      'the auto-applied flag is gone');
  });
  it('the program cover no longer advertises auto-apply',()=>{
    assert.ok(!programs.includes('Auto-applied on start'),
      'cover tag removed');
  });
});

describe('#402 the #380 late-history refresh does not auto-apply either',()=>{
  it('maybeRefreshDraftSuggestions recomputes and renders only',()=>{
    const body=fnBody(progression,'maybeRefreshDraftSuggestions');
    assert.ok(body.includes('prepareDraftProgression(draft,config)'),
      'suggestions are still recomputed when history arrives');
    assert.ok(!body.includes('applyProgressionSuggestion('),
      'refreshed suggestions wait for a tap');
  });
});

describe('#402/#406 suggestions are tap-to-apply inside the exercise cards',()=>{
  it('the banner is retired — renderWorkoutProgression hides the box',()=>{
    const body=fnBody(progression,'renderWorkoutProgression');
    assert.ok(!body.includes('autoAppliedProgression'),
      'no auto-applied branch remains');
    assert.ok(!body.includes('Suggestions for this workout'),
      'the banner headline is gone');
    assert.ok(!body.includes('data-real-suggestion'),
      'the banner tap handler is gone');
    assert.ok(body.includes('box.hidden=true'),
      'the banner box stays hidden');
  });
  it('each exercise card renders its own suggestion row',()=>{
    assert.ok(progression.includes('function cardSuggestionHtml(item,suggestion)'),
      'cardSuggestionHtml builder exists');
    const cardBody=fnBody(editor,'liveExerciseCardHtml');
    assert.ok(cardBody.includes('cardSuggestionHtml(item,cardSuggestion)'),
      'the card template renders the suggestion row');
    assert.ok(cardBody.includes("draft.progressionSuggestions"),
      'the row reads the draft suggestion list');
    assert.ok(cardBody.includes('draft?.editingId?null'),
      'no suggestion row while editing a completed workout (#148)');
  });
  it('the in-card row is tap-to-apply with per-set copy (#400)',()=>{
    const rowBody=fnBody(progression,'cardSuggestionHtml');
    assert.ok(rowBody.includes('data-card-suggestion'),
      'the row carries the tap hook');
    assert.ok(rowBody.includes('tap to apply'),
      'tap-to-apply copy present');
    /* QA batch 2026-09-22: per-set targets are the only path — the copy is
       always the per-set variant; the #402 guarantee (never auto-applied)
       stands. */
    assert.ok(rowBody.includes('own target')&&!rowBody.includes('its target to every set'),
      'per-set tap-to-apply copy only, no top-set-everywhere variant');
    assert.ok(rowBody.includes('suggestion.applied'),
      'the applied row renders quiet and untappable');
  });
  it('the tap applies without auto-applying anything else',()=>{
    const wireBody=fnBody(editor,'wireLiveCardSuggestions');
    assert.ok(wireBody.includes('applyProgressionSuggestion(draft,suggestion,false)'),
      'tap applies exactly the tapped suggestion, no re-render side effects');
    assert.ok(wireBody.includes('suggestion.applied'),
      'an already-applied row is a no-op');
    assert.ok(wireBody.includes('swapExerciseCard(item)'),
      'the tap swaps just the card — no full-list rebuild, no jank');
  });
});

describe('#406 the row sits with the history line in the card body',()=>{
  it('liveExerciseCardHtml renders the row right after the last-session-line',()=>{
    const body=fnBody(editor,'liveExerciseCardHtml');
    const lastIdx=body.indexOf('last-session-line');
    const rowIdx=body.indexOf('cardSuggestionHtml(item,cardSuggestion)');
    const labelsIdx=body.indexOf('log-labels');
    assert.ok(lastIdx>=0,'the history line is rendered');
    assert.ok(rowIdx>lastIdx,'the suggestion row follows the history line');
    assert.ok(labelsIdx>rowIdx,'both sit above the set labels');
  });
});
