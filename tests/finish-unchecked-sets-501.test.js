'use strict';
/* Role: finish-unchecked-sets-501 — pins #501 (v1.8): at finish time, sets
   that hold entered data but were never explicitly marked complete get a
   clear, explicit choice instead of being silently left unchecked. The
   review dialog lists them (exercise · Set N · entered values) with
   per-set toggles; "Mark all complete" marks them all; "Log incomplete sets"
   finishes with the data AND the unchecked flags intact — nothing is
   silently completed and nothing is discarded.
   User 2026-09-17 (revert): the missing-values variant is back to exactly
   two options — "Finish anyway" + "Keep editing" — as before the #535
   extension. "Log incomplete sets" is offered ONLY for the
   valid-but-unmarked variant. No incomplete set with null required data is
   ever logged. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

/* Fixture catalog: equipment drives the bodyweight weight-optional rule. */
const catalog=[
  {id:'squat',name:'Barbell Squat',equipment:'barbell',tracking:'reps'},
  {id:'pushup',name:'Push-Up',equipment:'body only',tracking:'reps'},
  {id:'plank',name:'Plank',equipment:'body only',tracking:'time',force:'static'},
  /* #279: machine cardio — timed tracking, non-bodyweight equipment. */
  {id:'rower',name:'Rowing, Stationary',equipment:'machine',tracking:'time'},
];

/* Fake document for the review dialog (same pattern as
   workout-history-logic.test.js): the elements record what
   showReviewSetsDialog did to them. */
function fakeReviewDocument(){
  const els={};
  const staticText={'reviewSetsCancel':'Keep editing','reviewSetsLogIncomplete':'Log incomplete sets'};
  for(const id of ['reviewSetsCopy','reviewSetsComplete','reviewSetsLogIncomplete','reviewSetsFinishAnyway','reviewSetsDelete','reviewSetsCancel','reviewSetsDialog','reviewSetsList']){
    els['#'+id]={hidden:false,textContent:staticText[id]||'',innerHTML:'',className:'',opened:false,showModal(){this.opened=true;}};
  }
  /* escapeHtml() builds a div and reads innerHTML — emulate the browser's
     textContent serialization (& first, then < > "). */
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  return {els,querySelector:sel=>els[sel]||null,staticText,
    createElement:()=>({_t:'',set textContent(v){this._t=String(v);},get innerHTML(){return esc(this._t);}})};
}

const {unmarkedSetsWithData,unmarkedSetSummary,reviewSetsListHtml,serializeCompletedSet,reviewSetsActions,showReviewSetsDialog,cloneSetFields,completedExerciseMarkup,invalidSetsIn,isEmptySet}
  /* formatVolume lives in dashboard-stats.js (outside this role) — stub it;
     the chip assertions don't depend on its output. */
  =loadRole('workout-history-logic',{globals:{exercises:catalog,document:fakeReviewDocument(),formatVolume:v=>`${v} lb`}});

const reviewDoc=globalThis.document;
function resetReviewDialog(){
  for(const [sel,el] of Object.entries(reviewDoc.els)){el.hidden=false;el.textContent=reviewDoc.staticText[sel.slice(1)]||'';el.innerHTML='';el.className='';el.opened=false;}
}
function openReviewDialog(draft){
  resetReviewDialog();
  showReviewSetsDialog(draft,invalidSetsIn(draft),[]);
  return reviewDoc.els;
}

const mkSet=(o={})=>({uid:o.uid||('s'+Math.random().toString(36).slice(2)),w:'',r:'',seconds:'',rpe:'',tags:[],complete:false,...o});
const mkItem=(exerciseId,sets,tracking,uid)=>({uid:uid||('i'+Math.random().toString(36).slice(2)),exerciseId,tracking:tracking||'reps',sets});
const mkDraft=(exercises)=>({exercises});
const valid=(o={})=>mkSet({w:'100',r:'8',...o});
const partial=()=>mkSet({w:'100'}); /* weight entered, reps missing */

describe('unmarkedSetsWithData (#501: the finish-time list)',()=>{
  it('lists only value-valid unmarked sets, with exercise and set indexes',()=>{
    const a=valid({uid:'sa'}),b=valid({uid:'sb',complete:true}),c=partial();
    const draft=mkDraft([mkItem('squat',[a,b,c],'reps','ia')]);
    const rows=unmarkedSetsWithData(draft);
    assert.equal(rows.length,1,'the complete set and the partial set are excluded');
    assert.equal(rows[0].set,a);
    assert.equal(rows[0].index,0);
    assert.equal(rows[0].exerciseIndex,0);
    assert.equal(rows[0].item.exerciseId,'squat');
  });
  it('fully-empty sets never appear in the list',()=>{
    const draft=mkDraft([mkItem('squat',[mkSet()])]);
    assert.deepEqual(unmarkedSetsWithData(draft),[],'a blank set is invalid, not completable');
  });
  it('spans exercises with correct indexes',()=>{
    const draft=mkDraft([mkItem('squat',[valid({complete:true}),valid()]),mkItem('pushup',[valid()])]);
    const rows=unmarkedSetsWithData(draft);
    assert.equal(rows.length,2);
    assert.deepEqual([rows[0].exerciseIndex,rows[0].index],[0,1]);
    assert.deepEqual([rows[1].exerciseIndex,rows[1].index],[1,0]);
  });
  it('an empty list when everything is marked',()=>{
    const draft=mkDraft([mkItem('squat',[valid({complete:true})])]);
    assert.deepEqual(unmarkedSetsWithData(draft),[]);
  });
});

describe('unmarkedSetSummary (#501: the one-line value wording)',()=>{
  const rowFor=(exerciseId,set,tracking)=>({item:mkItem(exerciseId,[set],tracking),set,index:0,exerciseIndex:0});
  it('weighted reps: "100 lb × 8 @ 7"',()=>{
    assert.equal(unmarkedSetSummary(rowFor('squat',valid({rpe:'7'}))),'100 lb × 8 @ 7');
  });
  it('RPE is omitted when blank',()=>{
    assert.equal(unmarkedSetSummary(rowFor('squat',valid())),'100 lb × 8');
  });
  it('bodyweight with no added weight reads as reps',()=>{
    assert.equal(unmarkedSetSummary(rowFor('pushup',mkSet({r:'12',rpe:'8'}))),'12 reps @ 8');
  });
  it('bodyweight with added weight keeps the + prefix',()=>{
    assert.equal(unmarkedSetSummary(rowFor('pushup',mkSet({w:'25',r:'10'}))),'+25 lb × 10');
  });
  it('timed work reads as seconds',()=>{
    assert.equal(unmarkedSetSummary(rowFor('plank',mkSet({seconds:'60',rpe:'6'}),'time')),'60 sec @ 6');
    assert.equal(unmarkedSetSummary(rowFor('rower',mkSet({seconds:'300'}),'time')),'300 sec');
  });
});

describe('reviewSetsListHtml (#501: per-set toggle rows)',()=>{
  it('renders one toggle row per set with name, set number, values and uids',()=>{
    const draft=mkDraft([mkItem('squat',[valid({uid:'sa'}),valid({uid:'sb',rpe:'9'})],'reps','ia')]);
    const html=reviewSetsListHtml(unmarkedSetsWithData(draft));
    assert.equal((html.match(/review-set-row/g)||[]).length,2,'two toggle rows');
    assert.ok(html.includes('Barbell Squat · Set 1'));
    assert.ok(html.includes('Barbell Squat · Set 2'));
    assert.ok(html.includes('100 lb × 8'));
    assert.ok(html.includes('100 lb × 8 @ 9'));
    assert.ok(html.includes('data-exercise-uid="ia"'));
    assert.ok(html.includes('data-set-uid="sa"'));
    assert.ok(html.includes('data-set-uid="sb"'));
    assert.ok(html.includes('data-exercise-index="0"'),'index fallback for the toggle handler');
    assert.ok(html.includes('data-set-index="1"'));
    assert.ok(html.includes('aria-pressed="false"'));
  });
  it('escapes exercise names',()=>{
    catalog.push({id:'evil',name:'<img src=x onerror=alert(1)>',equipment:'barbell',tracking:'reps'});
    try{
      const draft=mkDraft([mkItem('evil',[valid()])]);
      const html=reviewSetsListHtml(unmarkedSetsWithData(draft));
      assert.ok(!html.includes('<img src=x'),'raw HTML is escaped');
      assert.ok(html.includes('&lt;img'),'escaped name is present');
    }finally{
      catalog.pop();
    }
  });
  /* #548 (security audit 2026-09-19): stored XSS — a custom exercise name
     like `" autofocus onfocus="alert(1)` broke out of the quoted
     aria-label/data-* attributes because the old DOM-based escapeHtml did
     not escape quotes. The escaped name must not introduce new attributes. */
  it('escapes quotes in exercise names (no attribute breakout)',()=>{
    catalog.push({id:'evilq',name:'" autofocus onfocus="alert(1)',equipment:'barbell',tracking:'reps'});
    try{
      const draft=mkDraft([mkItem('evilq',[valid()])]);
      const html=reviewSetsListHtml(unmarkedSetsWithData(draft));
      assert.ok(!html.includes('onfocus="alert(1)"'),'no injected handler attribute');
      /* The quotes must be entity-escaped inside the attribute value, so the
         payload stays inert text instead of breaking out into attributes. */
      assert.ok(html.includes('aria-label="Mark &quot; autofocus onfocus=&quot;alert(1)'),'quotes are escaped in the attribute');
      assert.ok(html.includes('<strong>&quot; autofocus onfocus=&quot;alert(1)'),'quotes are escaped in text content');
    }finally{
      catalog.pop();
    }
  });
});

describe('reviewSetsActions showLogIncomplete (user 2026-09-17 revert: two-option missing-values dialog)',()=>{
  it('valid-but-unmarked: Log incomplete sets is offered, Mark all complete stays primary',()=>{
    const a=reviewSetsActions(mkDraft([mkItem('squat',[valid(),valid()])]));
    assert.equal(a.showLogIncomplete,true);
    assert.equal(a.primaryAction,'complete');
  });
  it('missing values: Log incomplete sets is NOT offered — Finish anyway + Keep editing only',()=>{
    const a=reviewSetsActions(mkDraft([mkItem('squat',[partial()])]));
    assert.equal(a.showLogIncomplete,false,'no null-logging path in the missing-values variant');
    assert.equal(a.showFinishAnyway,true);
    assert.equal(a.primaryAction,'finish','Finish anyway stays primary');
  });
  it('all-empty sets: Log incomplete sets is NOT offered either',()=>{
    const a=reviewSetsActions(mkDraft([mkItem('squat',[mkSet()])]));
    assert.equal(a.showLogIncomplete,false);
    assert.equal(a.showFinishAnyway,true);
  });
  it('empty exercises only: no Log incomplete sets',()=>{
    const done=()=>mkSet({w:'100',r:'8',complete:true});
    assert.equal(reviewSetsActions(mkDraft([mkItem('squat',[]),mkItem('squat',[done()])])).showLogIncomplete,false);
  });
});

describe('isEmptySet (still drives the Finish-anyway drop counts)',()=>{
  it('a set with only tags is NOT empty — tags are user-entered data',()=>{
    assert.equal(isEmptySet(mkSet({tags:['warmup']})),false);
  });
  it('a fully blank set is empty',()=>{
    assert.equal(isEmptySet(mkSet()),true);
  });
});
describe('showReviewSetsDialog (user 2026-09-17 revert: missing-values variant is two options)',()=>{
  const visibleActions=els=>{
    const order=['#reviewSetsComplete','#reviewSetsFinishAnyway','#reviewSetsLogIncomplete','#reviewSetsDelete','#reviewSetsCancel'];
    return order.filter(sel=>!els[sel].hidden);
  };
  it('valid-but-unmarked: list shows, Log incomplete sets is a real secondary button',()=>{
    const els=openReviewDialog(mkDraft([mkItem('squat',[valid(),valid()])]));
    assert.deepEqual(visibleActions(els),['#reviewSetsComplete','#reviewSetsLogIncomplete','#reviewSetsCancel']);
    assert.equal(els['#reviewSetsLogIncomplete'].textContent,'Log incomplete sets');
    assert.equal(els['#reviewSetsLogIncomplete'].className,'secondary-button');
    assert.equal(els['#reviewSetsList'].hidden,false);
    assert.equal((els['#reviewSetsList'].innerHTML.match(/review-set-row/g)||[]).length,2);
    assert.equal(els['#reviewSetsDialog'].opened,true,'the single dialog opens');
  });
  it('missing values: exactly Finish anyway + Keep editing — no list, no Log incomplete sets',()=>{
    const els=openReviewDialog(mkDraft([mkItem('squat',[partial()])]));
    assert.deepEqual(visibleActions(els),['#reviewSetsFinishAnyway','#reviewSetsCancel']);
    assert.equal(els['#reviewSetsLogIncomplete'].hidden,true);
    assert.equal(els['#reviewSetsList'].hidden,true);
  });
});

describe('serializeCompletedSet (#501: the flag is recorded, never silently completed)',()=>{
  it('keeps an unchecked set unchecked with all data intact',()=>{
    const out=serializeCompletedSet({w:'100',r:'8',seconds:'',rpe:'7',tags:['warmup'],complete:false});
    assert.deepEqual(out,{w:100,r:8,seconds:null,distance:null,rpe:7,tags:['warmup'],complete:false});
  });
  it('keeps a checked set checked',()=>{
    const out=serializeCompletedSet({w:'100',r:'8',seconds:'',rpe:'',tags:[],complete:true});
    assert.equal(out.complete,true);
    assert.equal(out.rpe,null,'the blank-RPE null mapping is unchanged');
  });
  it('the blank-to-null value mapping is unchanged',()=>{
    const out=serializeCompletedSet({w:'',r:'12',seconds:'',rpe:'',tags:[],complete:false});
    assert.equal(out.w,null);
    assert.equal(out.r,12);
  });
  it('#564: fractional reps round and absurd weights clamp',()=>{
    const out=serializeCompletedSet({w:'999999',r:'8.7',seconds:'',rpe:'7.5',tags:[],complete:true});
    assert.equal(out.r,9,'reps are whole numbers');
    assert.equal(out.w,5000,'weights clamp at the upper bound');
    assert.equal(out.rpe,7.5,'RPE keeps its decimal');
  });
  it('#564: distance survives finishing (it used to be dropped)',()=>{
    const out=serializeCompletedSet({w:'',r:'',seconds:'',distance:'1500',rpe:'8',tags:[],complete:true});
    assert.equal(out.distance,1500);
  });
});

describe("cloneSetFields forEdit (#501: editing a log must not silently complete what the finish left unchecked)",()=>{
  const base={w:100,r:8,seconds:null,rpe:7,tags:['a'],targetRpe:''};
  it('preserves complete:false from the log',()=>{
    assert.equal(cloneSetFields({...base,complete:false},'forEdit').complete,false);
  });
  it('preserves complete:true from the log',()=>{
    assert.equal(cloneSetFields({...base,complete:true},'forEdit').complete,true);
  });
});

describe('completedExerciseMarkup (#501: unchecked sets are visibly unchecked)',()=>{
  const itemFor=sets=>({exerciseId:'squat',tracking:'reps',note:'',exerciseTags:[],sets});
  const logged=(o={})=>({w:100,r:8,seconds:null,rpe:7,tags:[],complete:true,...o});
  it('an unchecked set carries the unchecked chip',()=>{
    const html=completedExerciseMarkup(itemFor([logged({complete:false})]),'w1');
    assert.ok(html.includes('done-set-unmarked'),'the chip class is present');
    assert.ok(html.includes('>unchecked<'),'the chip copy is present');
    assert.ok(html.includes('is-unmarked'),'the row carries the marker class');
  });
  it('a checked set has no chip',()=>{
    const html=completedExerciseMarkup(itemFor([logged({complete:true})]),'w1');
    assert.ok(!html.includes('done-set-unmarked'));
    assert.ok(!html.includes('is-unmarked'));
  });
  it('legacy sets without the flag are treated as completed, not flagged',()=>{
    const {complete,...legacy}=logged();
    const html=completedExerciseMarkup(itemFor([legacy]),'w1');
    assert.ok(!html.includes('done-set-unmarked'),'no chip without an explicit false');
  });
});

describe('review dialog static structure (user 2026-09-16)',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const html=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
  const dialog=html.slice(html.indexOf('id="reviewSetsDialog"'),html.indexOf('id="focusConfirmDialog"'));
  it('"Log incomplete sets" keeps its DOM slot after Mark all complete / Finish anyway',()=>{
    const iComplete=dialog.indexOf('id="reviewSetsComplete"');
    const iFinish=dialog.indexOf('id="reviewSetsFinishAnyway"');
    const iLog=dialog.indexOf('id="reviewSetsLogIncomplete"');
    assert.ok(iComplete>=0&&iFinish>=0&&iLog>=0,'buttons missing');
    /* DOM order is Complete, Finish anyway, Log incomplete sets — the
       missing-values variant hides Log incomplete sets (user 2026-09-17
       revert), the valid-but-unmarked variant hides Finish anyway, so the
       second visible button is always the variant's secondary action. */
    assert.ok(iComplete<iFinish&&iFinish<iLog,'wrong button order');
    assert.ok(dialog.includes('>Log incomplete sets</button>'),'wrong button label');
  });
  it('hairline "or" separator sits between the actions and Keep editing',()=>{
    assert.ok(dialog.includes('class="or-separator"'),'separator missing');
    assert.ok(dialog.includes('<span>or</span>'),'separator copy missing');
    const iSep=dialog.indexOf('or-separator'), iKeep=dialog.indexOf('id="reviewSetsCancel"');
    const iActions=dialog.indexOf('id="reviewSetsDelete"');
    assert.ok(iActions<iSep&&iSep<iKeep,'Keep editing is not below the separator');
  });
  it('Keep editing is a quiet text link below the separator',()=>{
    assert.ok(dialog.includes('id="reviewSetsCancel"'),'Keep editing missing');
    assert.ok(dialog.includes('class="text-link review-keep-editing" id="reviewSetsCancel"'),'Keep editing is not the quiet text link');
    assert.ok(dialog.includes('>Keep editing</button>'),'wrong Keep editing label');
  });
});
