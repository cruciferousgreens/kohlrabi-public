'use strict';
/* #420 (user 2026-09-13): the %1RM wave toggle (and every program-form
   control) edits a DETACHED draft — schedulePersist() persists only
   workoutState.activeProgram, so calling it from draft handlers was a no-op
   that faked persistence. Regression pins:
   - the discard-changes dialog offers a real "Save changes" action that runs
     createProgram();
   - draft-only handlers no longer call the no-op schedulePersist();
   - createProgram() copies the draft (including pctWave) onto the live
     program. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const programs=fs.readFileSync(path.join(ROOT,'assets/js/pages/programs.js'),'utf8');
const bootstrap=fs.readFileSync(path.join(ROOT,'assets/js/core/app-bootstrap.js'),'utf8');

describe('#420 detached-draft fixes',()=>{
  it('the discard-changes dialog has a "Save changes" action',()=>{
    const dlg=html.slice(html.indexOf('id="discardProgramChangesDialog"'),html.indexOf('</dialog>',html.indexOf('id="discardProgramChangesDialog"')));
    assert.ok(/id="saveProgramChangesDialog"/.test(dlg),'Save button in the dialog markup');
    assert.ok(/Save changes/.test(dlg),'Save button copy');
    assert.ok(/\$\('#saveProgramChangesDialog'\)\?\.\s*addEventListener\('click',\(\)=>\{\$\('#discardProgramChangesDialog'\)\.close\(\);createProgram\(\);\}\)/.test(programs),
      'Save wiring closes the dialog and runs createProgram()');
  });
  it('draft-only toggle handlers do not call the no-op schedulePersist()',()=>{
    const toggleLine=bootstrap.split('\n').find(l=>l.includes("$('#pctWaveToggle')")&&l.includes('addEventListener'));
    assert.ok(toggleLine,'pctWaveToggle wiring exists');
    assert.ok(!toggleLine.includes('schedulePersist'),'pctWave toggle no longer calls schedulePersist');
    const draftHandlers=['programRpePills','progressionIncrementType','progressionIncrementValue',
      'progressionPercentOf1RM',
      'programRepMin','programRepMax','programRepPresets','programSchemePills','programCyclePills','pctWaveToggle'];
    for(const id of draftHandlers){
      const hits=bootstrap.split('\n').filter(l=>l.includes("'#"+id)&&l.includes('programFormProgression')&&l.includes('schedulePersist'));
      assert.equal(hits.length,0,`#${id} draft handler has no schedulePersist`);
    }
    assert.ok(/schedulePersist\(\) persists/.test(bootstrap)&&/detached\n       programFormProgression\(\)/.test(bootstrap),
      'the why is documented at the draft-controls section');
  });
  it('week-panel editors (draft targets) do not call schedulePersist()',()=>{
    /* check for the actual CALL — comments legitimately discuss schedulePersist */
    const rangeRegion=programs.slice(programs.indexOf('function renderWeekRanges'),programs.indexOf('function renderWeekPcts'));
    assert.ok(!/schedulePersist\(\);/.test(rangeRegion),'week-range pill editor has no schedulePersist() call');
    const pctRegion=programs.slice(programs.indexOf('function renderWeekPcts'),programs.indexOf('function programRangeForWeek'));
    assert.ok(!/schedulePersist\(\);/.test(pctRegion),'week-pct / week-deload editors have no schedulePersist() call');
  });
  it('createProgram() copies the draft (with pctWave) onto the live program',()=>{
    /* #509 refactored the snapshot into programFormValues(), shared by
       createProgram() and saveProgramToLibrary() — same behavior, one
       snapshot site. */
    const reader=programs.slice(programs.indexOf('function programFormValues()'),programs.indexOf('function createProgram()'));
    assert.ok(/progression:cloneProgression\(programFormProgression\(\)\)/.test(reader),
      'the shared form reader snapshots the draft');
    assert.ok(/function createProgram\(\)[\s\S]*?const vals=programFormValues\(\);if\(!vals\)return;/.test(programs),
      'createProgram commits from the shared form reader');
    assert.ok(/Object\.assign\(workoutState\.activeProgram,\{name,length,startWeek,focus,progression\}\)/.test(programs),
      'edit path assigns the draft progression to the live program');
  });
});
