'use strict';
/* #405 (user 2026-09-14): progression off-switch — a global default, a
   per-program flag, and the per-exercise scheme 'off'. While off: no
   suggestions, no ghosted targets; the last-session ghost (holdPerf) stays.
   The global flag is a MASTER KILL: an active program's config must not
   shadow it (phone QA 2026-09-14 — suggestions kept showing with the Settings
   switch off because programConfig resolved program-first). The program
   cover shows a single "Progression off" tag instead of the prescription
   tags. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const ROOT=path.resolve(__dirname,'..');
const src=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');
const stateJs=src('assets/js/core/state.js');
const progressionJs=src('assets/js/workout/progression.js');
const programsJs=src('assets/js/pages/programs.js');
const bootstrapJs=src('assets/js/core/app-bootstrap.js');
const indexHtml=src('index.html');
const css=src('assets/styles.css');

const role=loadRole('progression-logic',{globals:{exercises:[]}});
const {progressionForExercise,prepareDraftProgression,workoutState,progressionSetup}=role;

const seed=(sets,prog)=>{
  const item=mkItem('bench-press',sets,{progression:prog||{mode:'reps',min:6,max:12}});
  workoutState.completed=[mkLog('w1','2026-09-10',[item])];
};
beforeEach(()=>{
  progressionSetup.threshold=8;
  progressionSetup.progressionOff=false;
  workoutState.completed=[];
  workoutState.activeProgram=null;
});

describe('#405: progression off-switch',()=>{
  it('DEFAULT_PROGRESSION_SETUP carries progressionOff:false',()=>{
    assert.ok(stateJs.includes('progressionOff:false'),'default flag present');
  });
  it('normalizeProgression coerces the flag to boolean',()=>{
    assert.ok(stateJs.includes("typeof p.progressionOff!=='boolean'"),'coercion present');
  });
  it('progressionForExercise returns null when the program flag is off',()=>{
    seed([{w:100,r:8,rpe:8,complete:true}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},{progressionOff:true});
    assert.equal(s,null,'no suggestion while off');
  });
  it('progressionForExercise returns null for per-exercise scheme off',()=>{
    seed([{w:100,r:8,rpe:8,complete:true}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12,scheme:'off'},null);
    assert.equal(s,null,'no suggestion for scheme off');
  });
  it('progressionForExercise still suggests when everything is on',()=>{
    seed([{w:100,r:8,rpe:8,complete:true}]);
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.ok(s,'suggestion present when on');
  });
  it('global off is a master kill: an active program config without the flag still yields no suggestion',()=>{
    /* Phone QA 2026-09-14: the Settings switch was off but suggestions kept
       showing — programConfig resolved to the active program's progression
       (no flag) and shadowed the global default. */
    seed([{w:100,r:8,rpe:8,complete:true}]);
    progressionSetup.progressionOff=true;
    workoutState.activeProgram={id:'p1',name:'P',length:4,progression:{threshold:8,scheme:'rpe'}};
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.equal(s,null,'global off shadows the active-program config');
  });
  it('prepareDraftProgression empties suggestions when globally off with an active program',()=>{
    progressionSetup.progressionOff=true;
    workoutState.activeProgram={id:'p1',name:'P',length:4,progression:{threshold:8,scheme:'rpe'}};
    const draft={exercises:[{exerciseId:'bench-press',progression:{mode:'reps',min:6,max:12}}]};
    prepareDraftProgression(draft,workoutState.activeProgram.progression);
    assert.deepEqual(draft.progressionSuggestions,[],'no suggestions while globally off');
  });
  it('program-level off still suppresses when the global switch is on (control)',()=>{
    seed([{w:100,r:8,rpe:8,complete:true}]);
    workoutState.activeProgram={id:'p1',name:'P',length:4,progression:{threshold:8,scheme:'rpe',progressionOff:true}};
    const s=progressionForExercise('bench-press',{mode:'reps',min:6,max:12},null);
    assert.equal(s,null,'program flag still suppresses');
  });
  it('prepareDraftProgression empties suggestions while off',()=>{
    assert.ok(progressionJs.includes('effectiveConfig?.progressionOff'),'prepare gate present');
  });
  it('Settings has the Progression master switch',()=>{
    assert.ok(indexHtml.includes('id="progressionOffToggle"'),'settings toggle exists');
    assert.ok(indexHtml.includes('Progression</strong>'),'settings toggle label exists');
  });
  it('program setup has the per-program switch',()=>{
    assert.ok(indexHtml.includes('id="programProgressionOffToggle"'),'program toggle exists');
    assert.ok(indexHtml.includes('Progression for this program'),'program toggle label exists');
  });
  it('dimming rule covers both sections, sparing the switch rows',()=>{
    assert.ok(css.includes('#progressionDefaultsCard.progression-off'),'Settings dim rule exists');
    assert.ok(css.includes('section.program-progression.progression-off'),'program dim rule exists');
    assert.ok(css.includes(':not(#progressionOffRow)'),'Settings switch row spared');
    assert.ok(css.includes(':not(#programProgressionOffRow)'),'program switch row spared');
  });
  it('engine gates are in progression.js',()=>{
    assert.ok(progressionJs.includes("progressionSetup.progressionOff||programConfig?.progressionOff||profile?.scheme==='off')return null"),'progressionForExercise gate present (global master kill)');
    assert.ok(progressionJs.includes('progressionSetup.progressionOff||effectiveConfig?.progressionOff'),'prepareDraftProgression gate present (global master kill)');
  });
  it('program-cover summary shows an Off tag when the program is off',()=>{
    assert.ok(programsJs.includes("(progressionSetup.progressionOff||program.progression?.progressionOff)?'<span class=\"tag\">Progression off</span>'"),'Off tag present (global or program)');
  });
  it('program-cover Off replaces the normal prescription tags (not appended)',()=>{
    const i=programsJs.indexOf('program-progression-meta');
    const seg=programsJs.slice(i,i+400);
    // the ternary's else-branch wraps the normal tags, so Off is exclusive
    assert.ok(seg.includes("progressionOff)?'<span class=\"tag\">Progression off</span>':(`"),'Off is a ternary branch, not a prefix');
  });
  it('bootstrap wires both toggles',()=>{
    assert.ok(bootstrapJs.includes("$('#progressionOffToggle')"),'Settings toggle wired');
    assert.ok(bootstrapJs.includes("$('#programProgressionOffToggle')"),'program toggle wired');
  });
  it('syncProgramForm syncs the per-program toggle state',()=>{
    assert.ok(programsJs.includes("$('#programProgressionOffToggle')"),'program toggle synced in form');
  });
});
