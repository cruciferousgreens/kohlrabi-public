'use strict';
/* Always-on checkboxes in the reorder dialog (user 2026-09-22): every block
   row carries a checkbox on the left plus the reorder arrows — no Select
   button. The first tick swaps the footer from Done to group/ungroup/delete
   actions; selection is per superset block. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const R=loadRole('warmup-ui');
const {renderReorderDialog,groupReorderSelection,ungroupReorderSelection,confirmReorderDelete,
  openReorderDialog,newExerciseItem,workoutState}=R;

/* Minimal fake-DOM registry: renderReorderDialog touches the header, list,
   and footer elements; footer buttons are re-registered on every render. */
const registry={};
function fakeEl(){
  return {
    innerHTML:'',textContent:'',hidden:false,disabled:false,
    listeners:{},
    _cls:new Set(),
    classList:{toggle(c,f){f?this._s.add(c):this._s.delete(c);},contains(c){return this._s.has(c);}},
    setAttribute(){},
    addEventListener(t,fn){this.listeners[t]=fn;},
    focus(){},
    showModal(){},close(){this.closed=true;},
    querySelector(){return null;},
    querySelectorAll(){return [];},
  };
}
function wireClassList(el){el.classList._s=el._cls;return el;}
function fakeButton(attrs){
  const b=wireClassList(fakeEl());
  b.dataset=attrs||{};
  return b;
}
function fakeListEl(){
  const el=fakeEl();
  let rows=[], parsedHtml=null;
  function parse(){
    /* The app wires listeners onto the returned button fakes, so re-parse
       only when the markup changed — otherwise the test would click fresh,
       unwired fakes. */
    if(parsedHtml===el.innerHTML)return rows;
    parsedHtml=el.innerHTML;
    rows=[];
    const re=/<button[^>]*data-check-block="(\d+)"[^>]*>/g;
    let m;
    while((m=re.exec(el.innerHTML)))rows.push(fakeButton({checkBlock:m[1]}));
    return rows;
  }
  el.querySelectorAll=function(sel){
    if(sel!=='[data-check-block]')return[];
    return parse();
  };
  el.querySelector=function(sel){
    const m=/\[data-check-block="(\d+)"\]/.exec(sel);
    if(!m)return null;
    return parse().find(b=>b.dataset.checkBlock===m[1])||null;
  };
  return el;
}
function fakeFootEl(){
  const el=fakeEl();
  let html='';
  Object.defineProperty(el,'innerHTML',{get:()=>html,set:v=>{
    html=v;
    const re=/<button[^>]*id="([^"]+)"[^>]*>/g;
    let m;
    while((m=re.exec(v))){const b=fakeButton({});registry['#'+m[1]]=b;}
  }});
  return el;
}
function clickCheck(blockIdx){
  const btn=registry['#reorderExercisesList'].querySelectorAll('[data-check-block]')
    .find(b=>b.dataset.checkBlock===String(blockIdx));
  assert.ok(btn,'checkbox not found for block '+blockIdx);
  btn.listeners.click();
}
function footHtml(){return registry['#reorderExercisesFoot'].innerHTML;}

beforeEach(()=>{
  for(const k of Object.keys(registry))delete registry[k];
  registry['#reorderExercisesList']=fakeListEl();
  registry['#reorderExercisesFoot']=fakeFootEl();
  registry['#reorderExercisesDialog']=fakeEl();
  registry['#reorderExercisesTitle']=fakeEl();
  registry['#reorderExercisesSub']=fakeEl();
  globalThis.document.querySelector=(sel)=>registry[sel]||null;
  globalThis.document.querySelectorAll=()=>[];
  globalThis.CSS={escape:s=>s};
  globalThis.markDraftSaved=()=>{};
  globalThis.renderWorkoutExercises=()=>{};
  globalThis.renderWorkoutProgression=()=>{};
  R.exercises.push({id:'ex-a',name:'Bench Press'},{id:'ex-b',name:'Barbell Row'},{id:'ex-c',name:'Overhead Press'});
  const a=newExerciseItem({exerciseId:'ex-a'});
  const b=newExerciseItem({exerciseId:'ex-b'});
  const c=newExerciseItem({exerciseId:'ex-c'});
  workoutState.draft={exercises:[a,b,c]};
  workoutState.activeProgram=null;
  openReorderDialog(); /* resets selection; renders the dialog */
});

describe('reorder dialog always-on checkboxes',()=>{
  it('every row has a checkbox on the left and the reorder arrows',()=>{
    const html=registry['#reorderExercisesList'].innerHTML;
    assert.equal((html.match(/data-check-block/g)||[]).length,3,'expected 3 checkbox buttons');
    assert.ok(html.includes('reorder-arrow'),'arrow rows missing');
    assert.ok(html.includes('select-check'),'checkbox affordance missing');
    assert.equal(registry['#reorderExercisesTitle'].textContent,'Reorder exercises');
  });
  it('the first tick swaps Done for the group/delete actions',()=>{
    assert.ok(footHtml().includes('doneReorderExercises'),'footer should start with Done');
    clickCheck(0);
    const html=footHtml();
    assert.ok(html.includes('Group as superset (1)'),'group action missing after first tick');
    assert.ok(html.includes('deleteReorderSelection'),'delete action missing after first tick');
    assert.ok(!html.includes('doneReorderExercises'),'Done should leave once something is selected');
    assert.ok(/id="groupReorderSelection"[^>]*disabled/.test(html),'group should be disabled with 1 block selected');
  });
  it('ticking a second block enables grouping',()=>{
    clickCheck(0);
    clickCheck(1);
    const html=footHtml();
    assert.ok(html.includes('Group as superset (2)'),'footer count not updated to 2');
    assert.ok(!/id="groupReorderSelection"[^>]*disabled/.test(html),'group should enable with 2 blocks selected');
  });
  it('ticking again unticks and restores Done',()=>{
    clickCheck(0);
    clickCheck(0);
    assert.ok(footHtml().includes('doneReorderExercises'),'Done should return when nothing is selected');
  });
  it('group action assigns one supersetId to the selection and clears it',()=>{
    const {draft}=workoutState;
    clickCheck(0);
    clickCheck(1);
    registry['#groupReorderSelection'].listeners.click();
    const [a,b,c]=draft.exercises;
    assert.ok(a.supersetId,'a not grouped');
    assert.equal(a.supersetId,b.supersetId,'selection not in one group');
    assert.ok(!c.supersetId,'unselected exercise grouped');
    assert.ok(footHtml().includes('doneReorderExercises'),'selection not cleared after grouping');
    assert.ok(registry['#reorderExercisesList'].innerHTML.includes('Superset 1'),'new group not shown as a block');
  });
  it('ticking a group block selects the whole block and offers Ungroup',()=>{
    const {draft}=workoutState;
    const [a,b]=draft.exercises;
    a.supersetId='ss1';b.supersetId='ss1';
    renderReorderDialog();
    clickCheck(0); /* the group renders as one block */
    assert.ok(footHtml().includes('ungroupReorderSelection'),'single group selection should offer Ungroup');
    registry['#ungroupReorderSelection'].listeners.click();
    assert.equal(a.supersetId,null,'a not ungrouped');
    assert.equal(b.supersetId,null,'b not ungrouped');
    assert.ok(footHtml().includes('doneReorderExercises'),'selection not cleared after ungrouping');
  });
  it('delete asks for confirmation naming the exercises, then removes them',()=>{
    const {draft}=workoutState;
    clickCheck(0);
    clickCheck(1);
    registry['#deleteReorderSelection'].listeners.click();
    assert.equal(registry['#reorderExercisesTitle'].textContent,'Delete 2 exercises?');
    const confirm=registry['#reorderExercisesList'].innerHTML;
    assert.ok(confirm.includes('Bench Press')&&confirm.includes('Barbell Row'),'confirm does not name the exercises');
    assert.ok(confirm.includes("can't be undone"),'confirm missing undo warning');
    registry['#confirmReorderDelete'].listeners.click();
    assert.deepEqual(draft.exercises.map(e=>e.exerciseId),['ex-c'],'wrong exercises removed');
    assert.ok(registry['#reorderExercisesDialog'].closed,'dialog should close when fewer than 2 exercises remain');
  });
  it('deleting a group block removes all its members with no stray superset id',()=>{
    const {draft}=workoutState;
    const [a,b]=draft.exercises;
    a.supersetId='ss1';b.supersetId='ss1';
    renderReorderDialog();
    clickCheck(0); /* the group block */
    registry['#deleteReorderSelection'].listeners.click();
    registry['#confirmReorderDelete'].listeners.click();
    assert.deepEqual(draft.exercises.map(e=>e.exerciseId),['ex-c'],'group members not removed');
    assert.ok(draft.exercises.every(e=>!e.supersetId),'stray supersetId remains');
  });
  it('cancel on the confirm step returns with the selection intact',()=>{
    const {draft}=workoutState;
    clickCheck(0);
    registry['#deleteReorderSelection'].listeners.click();
    registry['#backReorderSelect'].listeners.click();
    assert.equal(draft.exercises.length,3,'exercise deleted on cancel');
    assert.equal(registry['#reorderExercisesTitle'].textContent,'Reorder exercises','did not return to reorder view');
    assert.ok(footHtml().includes('deleteReorderSelection'),'selection not preserved on cancel');
  });
});
