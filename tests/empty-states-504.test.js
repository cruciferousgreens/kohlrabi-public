'use strict';
/* #504 (v1.8) — better empty data screens. Every empty state states the
   condition, always offers an action, and follows the copy rules (sentence
   case, no exclamation points, no "please"). Filtered-void states carry a
   reset action, distinct from first-use states. This file pins the copy and
   the action wiring for all seven states. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const role=loadRole('empty-states-504',{globals:{
  exercises:[
    {id:'e1',name:'Barbell Squat',primary:['quads'],secondary:['glutes'],equipment:'barbell',custom:false},
    {id:'e2',name:'Bench Press',primary:['chest'],secondary:['triceps'],equipment:'barbell',custom:false},
    {id:'e3',name:'Dumbbell Curl',primary:['biceps'],secondary:[],equipment:'dumbbell',custom:false},
  ],
}});
const {workoutState,state}=role;
const {
  emptyStateHtml,emptyStatePrimary,emptyStateSecondary,
  dashEmptyHeroHtml,renderWorkoutHistoryList,
  renderLibrary,clearLibraryFilters,
  renderProgram,renderSavedPrograms,
  workoutHomeLayout,renderWorkoutProgramSuggestion,
  renderStats,periodEmptyNote,
}=role;

/* Fake DOM: $ auto-vivifies one stub element per selector, so listeners
   attach and fire like the boot-wired app (same proxy pattern as the
   dash-empty-hero tests). */
function makeFakeEl(){
  const listeners={};
  const classes=new Set();
  return {
    innerHTML:'',hidden:false,value:'',textContent:'',
    dataset:{},style:{},max:'',_classes:classes,
    addEventListener(t,fn){(listeners[t]=listeners[t]||[]).push(fn);},
    removeEventListener(){},setAttribute(){},getAttribute:()=>null,removeAttribute(){},
    scrollIntoView(){},focus(){},click(){(listeners.click||[]).forEach(fn=>fn());},
    /* Element-level querySelector returns a stub (the real DOM parses
       innerHTML, so freshly rendered nodes are queryable); the
       ::closest() container override in $ handles id lookups specially. */
    querySelector:()=>makeFakeEl(),querySelectorAll:()=>[],closest:()=>null,
    appendChild(){},after(){},remove(){},
    classList:{add:(c)=>classes.add(c),remove:(c)=>classes.delete(c),
      toggle:(c,f)=>{if(f===undefined){classes.has(c)?classes.delete(c):classes.add(c);}else if(f)classes.add(c);else classes.delete(c);},
      contains:(c)=>classes.has(c)},
    _listeners:listeners,
  };
}
let els,actions,created;
function $(sel){
  if(!els[sel])els[sel]=makeFakeEl();
  const el=els[sel];
  /* host.closest('.workout-start-options') returns the real options
     container in the app; the container's querySelector finds cards added
     via host.after(), so blankAsHero creation is idempotent. */
  el.closest=(arg)=>$(sel+'::closest('+arg+')');
  if(sel.includes('::closest('))el.querySelector=(q)=>{
    if(q[0]==='#'){const hit=created.find(c=>c.id===q.slice(1));return hit||null;}
    return makeFakeEl();
  };
  return el;
}
function fireClick(sel){$(sel).click();}

/* Installed once: utilities.js's $ resolves document.querySelector at call
   time, so tagging the element with its selector lets the modal probe below
   identify which dialog opened. */
globalThis.document.querySelector=(sel)=>{const el=$(sel);el._sel=sel;return el;};
globalThis.document.querySelectorAll=()=>[];
globalThis.document.getElementById=(id)=>{const el=$('#'+id);el._sel='#'+id;return el;};
globalThis.document.createElement=(tag)=>{
  /* escapeHtml() round-trips through document.createElement('div'):
     textContent set → innerHTML reads the escaped markup. Emulate that. */
  const el=makeFakeEl();el.tagName=tag;created.push(el);
  let tc='';
  Object.defineProperty(el,'textContent',{
    get:()=>tc,
    set:(v)=>{tc=String(v==null?'':v);el.innerHTML=tc
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');},
  });
  return el;
};

beforeEach(()=>{
  els={};actions=[];created=[];
  globalThis.schedulePersist=()=>{};
  globalThis.showWorkouts=()=>actions.push('showWorkouts');
  globalThis.startBlankWorkout=()=>actions.push('startBlankWorkout');
  globalThis.showLibrary=()=>actions.push('showLibrary');
  globalThis.showProgram=()=>actions.push('showProgram');
  globalThis.showModalPinned=(dlg)=>actions.push('showModalPinned:'+(dlg&&dlg._sel||'?'));
  globalThis.openCustomDialog=()=>actions.push('openCustomDialog');
  globalThis.openCsvImport=()=>actions.push('openCsvImport');
  /* workoutSummary (workout-history.js) and shareActiveProgram (share.js)
     live outside this role's file set; the empty states under test only need
     them to exist, not their real behavior. */
  globalThis.workoutSummary=()=>'';
  globalThis.shareActiveProgram=()=>actions.push('shareActiveProgram');
  /* syncProgramIncrementUnit (app-bootstrap.js) only syncs a Settings unit
     label; the empty states under test don't need it. */
  globalThis.syncProgramIncrementUnit=()=>{};
  globalThis.suggestedProgramWorkout=()=>null;
  workoutState.completed=[];
  workoutState.draft=null;
  workoutState.activeProgram=null;
  workoutState.savedPrograms=[];
  workoutState.archivedPrograms=[];
  Object.assign(state,{query:'',equipment:'',onlyFavorites:false,onlyCustom:false,
    logPeriod:'all',statsPeriod:'week',programSetupOpen:false,
    savedProgramPreviewId:null,programWorkoutUid:null,workoutHistoryOpen:false});
  state.muscles=new Set();state.favorites=new Set();
});

function completedWorkout(date){
  return {id:'w-'+date,name:'Push day',date,exercises:[
    {exerciseId:'e1',sets:[{weight:135,reps:5,complete:true},{weight:135,reps:5,complete:true}]},
  ]};
}

describe('#504 shared empty-state builder',()=>{
  it('renders title, description, primary and secondary actions',()=>{
    const html=emptyStateHtml({title:'No logs yet',description:'Finished workouts land here.',
      primaryHtml:emptyStatePrimary('a','Start a workout'),secondaryHtml:emptyStateSecondary('b','Import past workouts')});
    assert.ok(html.includes('<h2 class="empty-state-title">No logs yet</h2>'),'title');
    assert.ok(html.includes('<p class="empty-state-sub">Finished workouts land here.</p>'),'description');
    assert.ok(html.includes('<button class="primary-button" id="a" type="button">Start a workout</button>'),'primary');
    assert.ok(html.includes('<button class="text-link" id="b" type="button">Import past workouts</button>'),'secondary');
  });
  it('escapes markup in every slot',()=>{
    const html=emptyStateHtml({title:'<b>x</b>',description:'<i>y</i>',
      primaryHtml:emptyStatePrimary('"><script>','<go>')});
    assert.ok(!html.includes('<b>x</b>'),'title not escaped');
    assert.ok(!html.includes('<i>y</i>'),'description not escaped');
    assert.ok(html.includes('&lt;go&gt;'),'label not escaped');
    assert.ok(!html.includes('"><script>'),'id not escaped');
  });
  it('omits the description and action row when absent',()=>{
    const html=emptyStateHtml({title:'No saved programs'});
    assert.ok(!html.includes('empty-state-sub'),'description rendered');
    assert.ok(!html.includes('empty-state-actions'),'action row rendered');
  });
});

describe('#504 Home hero copy',()=>{
  function heroHtml(){
    return dashEmptyHeroHtml({signedIn:true,starterCardHtml:'<button id="startFirstWorkout">x</button>',continueCardHtml:'',programCardHtml:''});
  }
  it('states the condition in the shared empty-state register',()=>{
    const html=heroHtml();
    assert.ok(html.includes('<h2>No workouts yet</h2>'),'headline');
    assert.ok(html.includes('Your training week, program, and progress will live here.'),'value sub');
    assert.ok(!html.includes('Ready?'),'Ready? must be gone');
  });
  it('carries no illustration — the cards speak for themselves',()=>{
    const html=heroHtml();
    assert.ok(!html.includes('dash-empty-mark'),'arrow mark must be gone');
  });
  it('offers the key-task actions',()=>{
    const html=dashEmptyHeroHtml({signedIn:true,starterCardHtml:'<button id="startFirstWorkout"><strong>Log your first workout</strong></button>',continueCardHtml:'',programCardHtml:''});
    assert.ok(html.includes('Log your first workout'),'primary action');
    assert.ok(html.includes('>See how it works</a>'),'secondary action');
    assert.ok(html.includes('https://cruciferousgreens.com/getting-started'),'guide URL');
    assert.ok(html.includes('target="_blank"'),'new tab');
  });
  it('copy follows the rules: no exclamation points, no "please"',()=>{
    const html=heroHtml();
    assert.ok(!html.includes('!'),'exclamation point');
    assert.ok(!/please/i.test(html),'"please"');
  });
});

describe('#504 Logs empty states',()=>{
  it('first use: explained state with direct actions',()=>{
    renderWorkoutHistoryList();
    const html=$('#workoutHistoryList').innerHTML;
    assert.ok(html.includes('No logs yet'),'title');
    assert.ok(html.includes('Finished workouts land here with every set, rep, and PR.'),'description');
    assert.ok(html.includes('id="logsEmptyStart"')&&html.includes('>Start a workout</button>'),'primary');
    assert.ok(html.includes('id="logsEmptyImport"')&&html.includes('>Import past workouts</button>'),'secondary');
  });
  it('first-use actions: Start a workout begins one, Import opens the importer',()=>{
    renderWorkoutHistoryList();
    fireClick('#logsEmptyStart');
    assert.ok(actions.includes('startBlankWorkout'),'start not called');
    assert.equal(state.workoutHistoryOpen,false,'still on the logs sub-screen');
    fireClick('#logsEmptyImport');
    assert.ok(actions.includes('openCsvImport'),'import not opened');
  });
  it('filtered void (search): reset action, distinct from first use',()=>{
    workoutState.completed=[completedWorkout('2026-09-10')];
    $('#historySearch').value='zzz-no-match';
    renderWorkoutHistoryList();
    const html=$('#workoutHistoryList').innerHTML;
    assert.ok(html.includes('No workouts match your search.'),'search note');
    assert.ok(html.includes('id="logsClearSearch"')&&html.includes('>Clear search</button>'),'reset');
    assert.ok(!html.includes('No logs yet'),'first-use state leaked in');
    fireClick('#logsClearSearch');
    assert.equal($('#historySearch').value,'','search not cleared');
    assert.ok($('#workoutHistoryList').innerHTML.includes('Push day'),'list not restored');
  });
  it('filtered void (period): View-all-time reset, distinct from first use',()=>{
    workoutState.completed=[completedWorkout('2026-09-10')];
    state.logPeriod='today';
    renderWorkoutHistoryList();
    const html=$('#workoutHistoryList').innerHTML;
    assert.ok(html.includes('No logs in this period.'),'period note');
    assert.ok(html.includes('id="logsViewAll"')&&html.includes('>View all time</button>'),'reset');
    fireClick('#logsViewAll');
    assert.equal(state.logPeriod,'all','period not reset');
    assert.ok($('#workoutHistoryList').innerHTML.includes('Push day'),'list not restored');
  });
});

describe('#504 exercise library zero results',()=>{
  it('filtered empty: explained state with reset and custom-exercise route',()=>{
    state.query='zzz-no-match';
    renderLibrary();
    const html=$('#exerciseResults').innerHTML;
    assert.ok(html.includes('No movements found'),'title');
    assert.ok(html.includes('Nothing matches with the current search and filters.'),'description');
    assert.ok(html.includes('id="clearLibraryFiltersBtn"')&&html.includes('>Clear search and filters</button>'),'reset');
    assert.ok(html.includes('id="addCustomFromEmptyBtn"')&&html.includes('>+ Add it as a custom exercise</button>'),'custom route');
  });
  it('reset clears every filter, syncs the controls, and restores the list',()=>{
    /* NB: onlyFavorites with an empty favorites set routes to the separate
       "No favorites yet" state (pinned below); the filtered-empty reset
       path is reached through the other filters. */
    state.query='squat';state.equipment='dumbbell';state.muscles.add('chest');
    state.onlyCustom=true;
    /* onlyFavorites with a non-empty favorites set still reaches the
       filtered-empty path (the empty-favorites set has its own state). */
    state.favorites.add('e1');state.onlyFavorites=true;
    $('#searchInput').value='squat';$('#equipmentFilter').value='dumbbell';
    renderLibrary();
    assert.ok(!$('#exerciseResults').innerHTML.includes('Barbell Squat'),'precondition: filtered out');
    fireClick('#clearLibraryFiltersBtn');
    assert.equal(state.query,'','query not cleared');
    assert.equal(state.equipment,'','equipment not cleared');
    assert.equal(state.muscles.size,0,'muscles not cleared');
    assert.equal(state.onlyFavorites,false,'favorites-only not cleared');
    assert.equal(state.onlyCustom,false,'custom-only not cleared');
    assert.equal($('#searchInput').value,'','search input not synced');
    assert.equal($('#equipmentFilter').value,'','equipment control not synced');
    assert.ok($('#exerciseResults').innerHTML.includes('Barbell Squat'),'list not restored');
  });
  it('custom-exercise action opens the custom dialog',()=>{
    state.query='zzz-no-match';
    renderLibrary();
    fireClick('#addCustomFromEmptyBtn');
    assert.ok(actions.includes('openCustomDialog'),'custom dialog not opened');
  });
  it('the Favorites first-use state is untouched',()=>{
    state.onlyFavorites=true;state.favorites=new Set();
    renderLibrary();
    const html=$('#exerciseResults').innerHTML;
    assert.ok(html.includes('No favorites yet'),'favorites state gone');
    assert.ok(!html.includes('clearLibraryFiltersBtn'),'reset leaked into favorites state');
  });
});

describe('#504 Program tab first-use state',()=>{
  it('no program: explained state, setup form hidden',()=>{
    renderProgram();
    const html=$('#programEmpty').innerHTML;
    assert.equal($('#programEmpty').hidden,false,'empty state hidden');
    assert.ok(html.includes('No active program'),'title');
    assert.ok(html.includes('A program lays out your workouts across weeks and shows what is next.'),'description');
    assert.ok(html.includes('id="programEmptyCreate"')&&html.includes('>Create a program</button>'),'primary');
    assert.ok(html.includes('id="programEmptyGuide"')&&html.includes('>How programs work</button>'),'secondary');
    assert.equal($('#programSetup').hidden,true,'setup form shown');
  });
  it('[Create a program] reveals the setup form',()=>{
    renderProgram();
    fireClick('#programEmptyCreate');
    assert.equal($('#programSetup').hidden,false,'form not revealed');
    assert.equal($('#programEmpty').hidden,true,'empty state not hidden');
  });
  it('a #program deep link opens the form directly',()=>{
    state.programSetupOpen=true;
    renderProgram();
    assert.equal($('#programSetup').hidden,false,'form not opened');
    assert.equal($('#programEmpty').hidden,true,'empty state shown');
    assert.equal(state.programSetupOpen,false,'flag not consumed');
  });
  it('a cold #program deep link seeds the form (no bare defaults)',()=>{
    state.programSetupOpen=true;
    renderProgram();
    assert.equal($('#programSetup').hidden,false,'form not opened');
    assert.equal($('#programEmpty').hidden,true,'empty state shown');
    /* seedProgramForm ran: the draft exists and the controls carry the
       progression defaults, not untouched markup. */
    assert.equal(String($('#progressionIncrementValue').value),'5','form not seeded');
    assert.equal(state.programSetupOpen,false,'flag not consumed');
  });
  it('an active program shows the cover, never the empty state',()=>{
    workoutState.activeProgram={id:'p1',name:'Base',length:8,startWeek:1,workouts:[],startedAt:'2026-09-01',progression:{}};
    renderProgram();
    assert.equal($('#programEmpty').hidden,true,'empty state shown with an active program');
    assert.equal($('#programCover').hidden,false,'cover hidden');
    assert.ok($('#programCover').innerHTML.includes('Base'),'cover missing program name');
  });
  it('creating a program after the empty state showed hides the empty state',()=>{
    renderProgram();
    assert.equal($('#programEmpty').hidden,false,'empty state not shown first');
    workoutState.activeProgram={id:'p1',name:'Base',length:8,startWeek:1,workouts:[],startedAt:'2026-09-01',progression:{}};
    renderProgram();
    assert.equal($('#programEmpty').hidden,true,'empty state leaked under the cover');
    assert.equal($('#programCover').hidden,false,'cover hidden');
  });
  it('no program: the duplicate blank card hides and Create a program takes its slot',()=>{
    renderWorkoutProgramSuggestion(workoutHomeLayout({hasProgram:false,hasLastWorkout:false}));
    assert.equal($('#startBlankWorkout').hidden,true,'duplicate blank card shown');
    assert.ok(created.some(el=>el.id==='createProgramCard'),'create-program card missing');
    assert.equal(workoutHomeLayout({hasProgram:false,hasLastWorkout:false}).blankAsHero,true,'layout flag wrong');
  });
  it('with a program: the blank card is restored',()=>{
    workoutState.activeProgram={id:'p1',name:'Base',length:8,startWeek:1,workouts:[],startedAt:'2026-09-01',progression:{}};
    renderWorkoutProgramSuggestion(workoutHomeLayout({hasProgram:false,hasLastWorkout:false}));
    renderWorkoutProgramSuggestion(workoutHomeLayout({hasProgram:true,hasLastWorkout:true}));
    assert.equal($('#startBlankWorkout').hidden,false,'blank card not restored');
  });
});

describe('#504 saved programs empty state',()=>{
  it('active program, none saved: explained state with Create a program',()=>{
    workoutState.activeProgram={id:'p1',name:'Base',length:8,startWeek:1,workouts:[],startedAt:'2026-09-01',progression:{}};
    renderSavedPrograms();
    assert.equal($('#savedPrograms').hidden,false,'section hidden');
    const html=$('#savedProgramList').innerHTML;
    assert.ok(html.includes('No saved programs'),'title');
    assert.ok(html.includes('Programs you create or open from a shared link stay here for later.'),'description');
    assert.ok(html.includes('id="savedEmptyCreate"')&&html.includes('>Create a program</button>'),'primary');
  });
  it('with an active program, Create a program offers the start-new modal',()=>{
    workoutState.activeProgram={id:'p1',name:'Base',length:8,startWeek:1,workouts:[],startedAt:'2026-09-01',progression:{}};
    renderSavedPrograms();
    fireClick('#savedEmptyCreate');
    assert.ok(actions.some(a=>a==='showModalPinned:#programDeepLinkDialog'),'start-new modal not offered');
  });
  it('totally fresh account: the section stays hidden (no doubled CTA)',()=>{
    renderSavedPrograms();
    assert.equal($('#savedPrograms').hidden,true,'section shown for a fresh account');
  });
  it('no active program but archived history: section shows, Create opens the form',()=>{
    workoutState.archivedPrograms=[{id:'a1',name:'Old block',length:4,workouts:[],archivedAt:'2026-08-01'}];
    renderSavedPrograms();
    assert.equal($('#savedPrograms').hidden,false,'section hidden');
    assert.ok($('#savedProgramList').innerHTML.includes('No saved programs'),'empty state missing');
    fireClick('#savedEmptyCreate');
    assert.equal($('#programSetup').hidden,false,'form not opened');
  });
  it('saved programs still list when present',()=>{
    workoutState.savedPrograms=[{id:'s1',name:'Nippard',length:8,workouts:[{uid:'u1'}]}];
    renderSavedPrograms();
    assert.equal($('#savedPrograms').hidden,false,'section hidden');
    assert.ok($('#savedProgramList').innerHTML.includes('Nippard'),'saved program missing');
    assert.ok(!$('#savedProgramList').innerHTML.includes('No saved programs'),'empty state leaked');
  });
});

describe('#504 Stats empty states',()=>{
  it('first use: explained state replaces the dead-end panels',()=>{
    renderStats();
    assert.ok($('#statsView')._classes.has('stats-is-empty'),'tab body not marked empty');
    const html=$('#statsEmpty').innerHTML;
    assert.equal($('#statsEmpty').hidden,false,'empty state hidden');
    assert.ok(html.includes('No stats yet'),'title');
    assert.ok(html.includes('Charts, volume, and muscle maps appear after your first logged workout.'),'description');
    assert.ok(html.includes('id="statsEmptyStart"')&&html.includes('>Log a workout</button>'),'primary');
    assert.ok(html.includes('id="statsEmptyBrowse"')&&html.includes('>Browse exercises</button>'),'secondary');
  });
  it('first-use actions route to the key tasks',()=>{
    renderStats();
    fireClick('#statsEmptyStart');
    assert.ok(actions.includes('showWorkouts'),'workout tab not opened');
    assert.ok(actions.includes('startBlankWorkout'),'blank workout not started');
    fireClick('#statsEmptyBrowse');
    assert.ok(actions.includes('showLibrary'),'library not opened');
  });
  it('filtered void: the period note carries a View-all-time reset',()=>{
    const note=periodEmptyNote(true);
    assert.ok(note.includes('No completed sets in this period.'),'sets copy');
    assert.ok(note.includes('data-period-reset')&&note.includes('>View all time</button>'),'reset');
    assert.ok(periodEmptyNote(false).includes('No weighted volume in this period.'),'volume copy');
  });
  it('a selected-but-empty period keeps the data (reset, not first use)',()=>{
    workoutState.completed=[completedWorkout('2026-09-10')];
    state.statsPeriod='today';
    renderStats();
    assert.equal($('#statsEmpty').hidden,true,'first-use state shown for a filtered period');
    const body=$('#muscleVolumeBreakdown').innerHTML+$('#topExercises').innerHTML;
    assert.ok(body.includes('data-period-reset'),'reset missing from filtered panels');
  });
});
