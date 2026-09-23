'use strict';
/* Why-copy for suppressed suggestions: the engine suppresses no-change cards
   (#79), discarding its own reason — the Exercise-options basis line must name
   the real cause instead of the generic "not enough valid data" copy
   (user 2026-09-13). Covers the reps-only hold, the RPE gate, and missing RPE. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const {
  progressionSummaryForOptions, workoutState, wireRepsOnlyToggle,
}=loadRole('progression-logic',{globals:{
  exercises:[{id:'incline-db-press',name:'Incline Dumbbell Press',tracking:'reps'}],
  schedulePersist:()=>{},
}});

beforeEach(()=>{
  workoutState.completed=[];
  workoutState.draft={progressionSuggestions:[],editingId:null};
  workoutState.activeProgram=null;
});

describe('reps-only hold why-copy',()=>{
  it('names the setting when reps-only suppresses the suggestion past the range top',()=>{
    const item=mkItem('incline-db-press',[{w:'70',r:'8',rpe:'8'}],{progression:{mode:'reps',min:1,max:5,repsOnly:true,scheme:'rpe'}});
    workoutState.completed=[mkLog('log1','2026-09-12',[mkItem('incline-db-press',[{w:'70',r:'8',rpe:'8'}])])];
    const html=progressionSummaryForOptions(item);
    assert.ok(html.includes('Increase reps only is on'),'names the setting');
    assert.ok(html.includes('1–5 reps'),'names the range');
    assert.ok(html.includes('70'),'names the held top set');
  });
  it('keeps the generic copy when reps-only is off',()=>{
    const item=mkItem('incline-db-press',[{w:'70',r:'8',rpe:'8'}],{progression:{mode:'reps',min:1,max:5,scheme:'rpe'}});
    workoutState.completed=[mkLog('log1','2026-09-12',[mkItem('incline-db-press',[{w:'70',r:'8',rpe:'8'}])])];
    const html=progressionSummaryForOptions(item);
    assert.ok(html.includes('not enough valid data'),'generic copy');
    assert.ok(!html.includes('Increase reps only is on'));
  });
  it('keeps the no-history copy when there are no logs',()=>{
    const item=mkItem('incline-db-press',[],{progression:{mode:'reps',min:1,max:5,repsOnly:true,scheme:'rpe'}});
    const html=progressionSummaryForOptions(item);
    assert.ok(html.includes('No completed history'));
  });
  it('names the RPE gate when the top set beat the trigger',()=>{
    const item=mkItem('incline-db-press',[{w:'70',r:'5',rpe:'9'}],{progression:{mode:'reps',min:1,max:5,scheme:'rpe'}});
    workoutState.completed=[mkLog('log1','2026-09-12',[mkItem('incline-db-press',[{w:'70',r:'5',rpe:'9'}])])];
    const html=progressionSummaryForOptions(item);
    assert.ok(html.includes('RPE 9'),'names the top-set RPE');
    assert.ok(html.includes('above your RPE 8 trigger'),'names the gate');
  });
  it('names the missing RPE when the top set has none',()=>{
    const item=mkItem('incline-db-press',[{w:'70',r:'5'}],{progression:{mode:'reps',min:1,max:5,scheme:'rpe'}});
    workoutState.completed=[mkLog('log1','2026-09-12',[mkItem('incline-db-press',[{w:'70',r:'5'}])])];
    const html=progressionSummaryForOptions(item);
    assert.ok(html.includes('No RPE on the latest top set'));
  });
});

describe('reps-only toggle in Exercise options (#395)',()=>{
  const itemFor=(prog)=>{
    const item=mkItem('incline-db-press',[],{progression:{mode:'reps',min:1,max:5,scheme:'rpe',...prog}});
    item.uid='u1';
    return item;
  };
  it('renders pressed when reps-only is on, unpressed when off',()=>{
    assert.ok(progressionSummaryForOptions(itemFor({repsOnly:true})).includes('aria-pressed="true"'));
    assert.ok(progressionSummaryForOptions(itemFor({})).includes('aria-pressed="false"'));
  });
  it('is hidden for %1RM scheme and time-based exercises',()=>{
    assert.ok(!progressionSummaryForOptions(itemFor({scheme:'onerm'})).includes('data-reps-only-toggle'));
    const timeItem=itemFor({}); timeItem.progression.mode='time'; timeItem.tracking='time';
    assert.ok(!progressionSummaryForOptions(timeItem).includes('data-reps-only-toggle'));
  });
  it('flips the flag and notifies the host',()=>{
    const item=itemFor({});
    let clicked=null, afterChanged=null;
    const btn={dataset:{repsOnlyToggle:'u1'},addEventListener:(ev,fn)=>{clicked=fn;}};
    const scope={querySelectorAll:(sel)=>sel==='[data-reps-only-toggle]'?[btn]:[]};
    wireRepsOnlyToggle(scope,(uid)=>uid==='u1'?item:null,(it)=>{afterChanged=it;});
    clicked();
    assert.equal(item.progression.repsOnly,true);
    assert.equal(afterChanged,item);
    clicked();
    assert.equal(item.progression.repsOnly,false);
  });
});
