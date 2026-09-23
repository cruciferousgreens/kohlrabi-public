'use strict';
/* #455 (user 2026-09-14): saved programs are viewable/openable, and
   activating one follows the #432 confirmation flow.
   - "Save to library" routes to Saved programs, never the archive (the
     share.js side is pinned by share-program-start-432.test.js; here the
     Saved-section home and the archive boundary are pinned).
   - The Saved list mirrors the Archived card: same rows, same separators,
     "N weeks · N workouts" meta, "Set active" pill (not "Restore"), no
     program-history disclosure (a saved program was never active). Tapping
     a row opens the read-only preview (program header, muscle map, workout
     list with read-only workout pages). Delete lives in the preview.
   - The row's "Set active" pill and the preview's "Set as active" both go
     through the #432 "Set as active program?" confirm dialog when an active
     program exists; with no active program they activate directly.
   - Confirming moves the program Saved -> Active and moves the outgoing
     active program into Saved (savedAt + unshift, never deleted; #503
     supersedes the #432 archive convention). */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

/* Fake DOM: canned elements per selector, dialogs fire close events. */
function makeEl(id){
  const handlers={};
  const el={
    id, hidden:false, innerHTML:'', value:'', open:false,
    dataset:{}, style:{},
    classList:{add(){},remove(){},toggle(){},contains:()=>false},
    addEventListener(ev,fn){(handlers[ev]=handlers[ev]||[]).push(fn);},
    removeEventListener(){},
    showModal(){el.open=true;},
    close(){el.open=false;(handlers['close']||[]).forEach(fn=>fn());},
    click(){(handlers['click']||[]).forEach(fn=>fn());},
    appendChild(){return {};},
    setAttribute(){}, getAttribute:()=>null,
  };
  /* Mimic the DOM bit escapeHtml relies on: setting textContent populates a
     (escaped) innerHTML. */
  let _text='';
  Object.defineProperty(el,'textContent',{
    get:()=>_text,
    set:v=>{_text=String(v);el.innerHTML=String(v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');},
  });
  return el;
}
let els={};
function fakeDocument(){
  els={};
  return {
    querySelector(sel){return els[sel]||(els[sel]=makeEl(sel));},
    querySelectorAll:()=>[],
    addEventListener(){}, removeEventListener(){},
    createElement:()=>makeEl('anon'), hidden:false, title:'',
  };
}

const calls={persist:0,renderProgram:0,renderDashboard:0,toasts:[]};
const role=loadRole('program-muscle-view',{globals:{
  document:fakeDocument(),
  schedulePersist(){calls.persist++;},
  renderProgram(){calls.renderProgram++;},
  renderDashboard(){calls.renderDashboard++;},
  showToast(msg){calls.toasts.push(String(msg));},
}});
const {state,workoutState,requestActivateSavedProgram,activateSavedProgramById,
  openSavedProgramPreview,savedProgramPreviewHtml,renderSavedPrograms,
  renderProgramWorkoutPage,wireSavedProgramActivation}=role;

const SAVED={id:'sp-1',name:'Saved Plan',length:4,startWeek:1,focus:'hypertrophy',
  shared:true,savedAt:'2026-09-14',
  workouts:[{uid:'w-1',name:'Day One',template:{name:'Day One',exercises:[]}}]};
const CURRENT={id:'cur-1',name:'Current Program',length:6,startWeek:1,focus:'strength',workouts:[]};

function reset(){
  for(const k of Object.keys(els))delete els[k];
  calls.persist=0;calls.renderProgram=0;calls.renderDashboard=0;calls.toasts=[];
  workoutState.activeProgram=null;
  workoutState.savedPrograms=[];
  workoutState.archivedPrograms=[];
  workoutState.completed=[];
  state.savedProgramPreviewId=null;
  state.programWorkoutUid=null;
  /* Re-run the confirm wiring against the fresh fake document (production
     wires once at load; the share.js dialog owner is not in this role). */
  wireSavedProgramActivation();
}
beforeEach(reset);

function saved(){return JSON.parse(JSON.stringify(SAVED));}
function current(){return JSON.parse(JSON.stringify(CURRENT));}

describe('#455: activating a saved program follows the #432 confirm flow',()=>{
  it('no active program -> Start activates directly, no modal',()=>{
    workoutState.savedPrograms=[saved()];
    requestActivateSavedProgram('sp-1');
    assert.strictEqual(els['#confirmSetSharedProgramActiveDialog']?.open,false,'no confirm dialog shown');
    assert.strictEqual(workoutState.activeProgram?.name,'Saved Plan','saved program is now active');
    assert.strictEqual(workoutState.savedPrograms.length,0,'left Saved');
    assert.strictEqual(workoutState.archivedPrograms.length,0,'nothing archived (there was nothing active)');
    assert.strictEqual(workoutState.activeProgram.savedAt,undefined,'savedAt cleared on activation');
    assert.ok(calls.persist>=1,'state persisted');
    assert.ok(calls.toasts.some(t=>t.includes('now your active program')),'toast confirms activation');
  });
  it('active program -> Start opens the confirm dialog and changes nothing',()=>{
    workoutState.activeProgram=current();
    workoutState.savedPrograms=[saved()];
    requestActivateSavedProgram('sp-1');
    assert.strictEqual(els['#confirmSetSharedProgramActiveDialog'].open,true,'confirm dialog shown');
    assert.strictEqual(workoutState.activeProgram.name,'Current Program','active program untouched');
    assert.strictEqual(workoutState.savedPrograms.length,1,'still in Saved');
    assert.strictEqual(workoutState.archivedPrograms.length,0,'nothing archived yet');
  });
  it('confirming moves Saved -> Active and the outgoing program moves into Saved (#503)',()=>{
    workoutState.activeProgram=current();
    workoutState.savedPrograms=[saved()];
    requestActivateSavedProgram('sp-1');
    els['#confirmSetSharedProgramActive'].click();
    assert.strictEqual(workoutState.activeProgram.name,'Saved Plan','saved program is now active');
    assert.strictEqual(workoutState.savedPrograms.length,1,'outgoing program moved into Saved');
    assert.strictEqual(workoutState.savedPrograms[0].name,'Current Program','the saved one is the old active program');
    assert.ok(workoutState.savedPrograms[0].savedAt,'saved program carries savedAt');
    assert.strictEqual(workoutState.savedPrograms[0].archivedAt,undefined,'no archivedAt on the moved program');
    assert.strictEqual(workoutState.archivedPrograms.length,0,'nothing archived');
    assert.strictEqual(workoutState.activeProgram.archivedAt,undefined,'new active has no archivedAt');
    assert.strictEqual(workoutState.activeProgram.savedAt,undefined,'new active has no savedAt');
    assert.ok(calls.toasts.some(t=>t.includes('now your active program')),'toast confirms activation');
  });
  it('dismissing the dialog clears the pending with no side effects',()=>{
    workoutState.activeProgram=current();
    workoutState.savedPrograms=[saved()];
    requestActivateSavedProgram('sp-1');
    els['#confirmSetSharedProgramActiveDialog'].close(); /* x / cancel / Esc */
    els['#confirmSetSharedProgramActive'].click(); /* a stale click must be a no-op */
    assert.strictEqual(workoutState.activeProgram.name,'Current Program','active program untouched');
    assert.strictEqual(workoutState.savedPrograms.length,1,'still in Saved');
    assert.strictEqual(workoutState.archivedPrograms.length,0,'nothing archived');
  });
  it('unknown id is a no-op',()=>{
    workoutState.activeProgram=current();
    assert.strictEqual(activateSavedProgramById('nope'),false);
    assert.strictEqual(workoutState.activeProgram.name,'Current Program','active program untouched');
    assert.strictEqual(workoutState.archivedPrograms.length,0,'nothing archived');
  });
  it('activating the already-active program does not archive anything',()=>{
    workoutState.activeProgram=current();
    workoutState.savedPrograms=[saved()];
    assert.strictEqual(activateSavedProgramById('cur-1'),false,'not in Saved -> no move');
    assert.strictEqual(workoutState.archivedPrograms.length,0,'nothing archived');
  });
});

describe('#455: Saved is the home for saved programs, archive is for replaced actives',()=>{
  it('a saved program renders in the Saved section, mirroring the Archived card',()=>{
    workoutState.savedPrograms=[saved()];
    renderSavedPrograms();
    assert.strictEqual(els['#savedPrograms'].hidden,false,'Saved section visible');
    const html=els['#savedProgramList'].innerHTML;
    assert.ok(html.includes('Saved Plan'),'saved program listed');
    assert.ok(html.includes('archive-row-wrap'),'rows separated like the archived list');
    assert.ok(html.includes('archive-row'),'same row layout as the archived card');
    assert.ok(html.includes('4 weeks · 1 workout'),'meta line mirrors the archive format');
    assert.ok(html.includes('built-in-label'),'Shared chip kept');
    assert.ok(html.includes('open-saved-program'),'tapping the row opens the program');
    assert.ok(html.includes('set-active-saved'),'Set active pill present');
    assert.ok(html.includes('>Set active<'),'pill reads "Set active", not "Restore"');
    assert.ok(!html.includes('>Restore<'),'no Restore pill in the Saved list');
    assert.ok(!html.includes('delete-saved-program'),'no Delete on the row — it lives in the preview');
    assert.ok(!html.includes('archive-history'),'no program-history disclosure for saved programs');
  });
  it('the Saved section stays hidden with nothing saved',()=>{
    renderSavedPrograms();
    assert.strictEqual(els['#savedPrograms'].hidden,true,'Saved section hidden when empty');
  });
  it('switching programs never touches the archive (#503)',()=>{
    /* The archive is for ended/restored programs only. The only writers of
       archivedPrograms for program switches are gone — activation now moves
       the outgoing program into Saved. A program that was never active
       carries no archivedAt. */
    workoutState.activeProgram=current();
    workoutState.savedPrograms=[saved()];
    requestActivateSavedProgram('sp-1');
    els['#confirmSetSharedProgramActive'].click();
    assert.strictEqual(workoutState.archivedPrograms.length,0,'the switch wrote nothing to the archive');
    assert.strictEqual(workoutState.savedPrograms.length,1,'outgoing program landed in Saved');
    assert.ok(workoutState.savedPrograms.every(p=>p.savedAt),'everything moved into Saved was stamped on the way in');
  });
});

describe('#455: saved-program preview (view/open)',()=>{
  it('opening a preview records the id for renderProgram',()=>{
    workoutState.savedPrograms=[saved()];
    openSavedProgramPreview('sp-1');
    assert.strictEqual(state.savedProgramPreviewId,'sp-1','preview id set');
    assert.ok(calls.renderProgram>=1,'program view re-rendered');
  });
  it('opening an unknown id is a no-op',()=>{
    openSavedProgramPreview('nope');
    assert.strictEqual(state.savedProgramPreviewId,null,'no preview opened');
  });
  it('preview markup: SAVED PROGRAM kicker, Set as active, no edit controls',()=>{
    const html=savedProgramPreviewHtml(saved());
    assert.ok(html.includes('SAVED PROGRAM'),'preview kicker present');
    assert.ok(html.includes('Saved Plan'),'program name present');
    assert.ok(html.includes('id="setSavedProgramActive"'),'"Set as active" present');
    assert.ok(html.includes('Day One'),'workout listed');
    assert.ok(html.includes('data-program-workout="w-1"'),'workout opens');
    assert.ok(!html.includes('id="editProgram"'),'no Edit button');
    assert.ok(!html.includes('id="shareProgramBtn"'),'no active-program Share button');
    /* #459 (user 2026-09-15): the saved preview carries its own Share. */
    assert.ok(html.includes('id="shareSavedProgramBtn"'),'"Share" present on the saved preview');
    assert.ok(!html.includes('id="addProgramWorkoutBtn"'),'no add-workout button');
    assert.ok(!html.includes('id="endProgram"'),'no Archive-program button');
  });
  it('preview workout page is read-only',()=>{
    const program=saved();
    const workout=program.workouts[0];
    renderProgramWorkoutPage(program,workout,{readOnly:true});
    const html=els['#programCover'].innerHTML;
    assert.ok(html.includes('Day One'),'workout name present');
    assert.ok(!html.includes('id="startProgramWorkoutBtn"'),'no Start button');
    assert.ok(!html.includes('id="editProgramWorkoutBtn"'),'no Edit button');
    assert.ok(!html.includes('id="duplicateProgramWorkoutBtn"'),'no Duplicate button');
    assert.ok(!html.includes('id="archiveProgramWorkoutBtn"'),'no Archive button');
    assert.ok(!html.includes('id="deleteProgramWorkoutBtn"'),'no delete button');
  });
  it('programRangeLabel tolerates a missing defaultRange (share-imported programs carry progression:null)',()=>{
    /* Browser QA 2026-09-14: activating a shared program with no progression
       blanked the Program tab — programRangeLabel(undefined) threw, killing
       the cover render. It must fall back to the hypertrophy default. */
    assert.equal(role.programRangeLabel(undefined),'6–12 reps');
    assert.equal(role.programRangeLabel(null),'6–12 reps');
    assert.equal(role.programRangeLabel({min:6,max:12}),'6–12 reps');
    assert.equal(role.programRangeLabel({min:5,max:5}),'5 reps');
  });
  it('the active-program workout page keeps its controls (control)',()=>{
    const program=saved();
    const workout=program.workouts[0];
    renderProgramWorkoutPage(program,workout);
    const html=els['#programCover'].innerHTML;
    assert.ok(html.includes('id="editProgramWorkoutBtn"'),'Edit button present when not read-only');
    assert.ok(html.includes('id="deleteProgramWorkoutBtn"'),'delete button present when not read-only');
  });
});
