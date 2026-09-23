'use strict';
/* #409 (user 2026-09-14): loading skeletons + the render-path speedups behind
   them. Covers the skeleton builders/painters, the shared single-pass muscle
   aggregation, the memoized PR/history paths, and the Intl hoisting. */
const {test,describe,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole,REPO_ROOT}=require('./harness');

const catalog=[
  {id:'ex-bench',name:'Bench Press',equipment:'barbell',primary:['chest'],secondary:['triceps','front delts'],instructions:['Press up.']},
  {id:'ex-curl',name:'Curl',equipment:'dumbbell',primary:['biceps'],secondary:[],instructions:[]},
  {id:'ex-plank',name:'Plank',equipment:'body only',primary:['abs'],secondary:[],instructions:[]},
  /* Never logged — only exists so similarTo has something to return. */
  {id:'ex-incline',name:'Incline Press',equipment:'barbell',primary:['chest'],secondary:['front delts'],instructions:[]},
];
function mkWorkout(id,date,items,completedAt){
  return {id,name:'W '+id,date,isoDate:date,completedAt:completedAt||(date+'T10:00:00Z'),
    exercises:items.map(([exId,sets])=>({exerciseId:exId,sets:sets.map(s=>({w:s[0],r:s[1],seconds:s[2]??null,rpe:s[3]??null,tags:[]}))}))};
}
function fixtureWorkouts(){
  return [
    mkWorkout('w1','2026-09-01',[
      ['ex-bench',[[135,8],[135,8],[135,6]]],
      ['ex-curl',[[30,10],[30,10]]],
    ]),
    mkWorkout('w2','2026-09-05',[
      ['ex-bench',[[140,8],[140,8]]],
      ['ex-plank',[[0,0,60]]],
    ]),
    mkWorkout('w3','2026-09-10',[
      ['ex-bench',[[145,5]]],
      ['ex-curl',[[35,8]]],
    ]),
  ];
}
/* Independent brute-force reimplementation of the muscle aggregation (uses
   exercises.find per item, like the old code) — the shared single-pass
   aggregate must match it exactly. */
function bruteAggregate(workouts){
  const counts={},volumes={},setCounts={},worked=new Set();
  for(const w of workouts)for(const item of (w.exercises||[])){
    const ex=catalog.find(x=>x.id===item.exerciseId);if(!ex)continue;
    const n=(item.sets||[]).length;
    const vol=(item.sets||[]).reduce((t,s)=>t+(Number(s.w)||0)*(Number(s.r)||0),0);
    for(const m of (ex.primary||[])){counts[m]=(counts[m]||0)+n;volumes[m]=(volumes[m]||0)+vol;setCounts[m]=(setCounts[m]||0)+n;if(n)worked.add(m.toLowerCase());}
    for(const m of (ex.secondary||[])){volumes[m]=(volumes[m]||0)+vol*0.45;setCounts[m]=(setCounts[m]||0)+n;if(n)worked.add(m.toLowerCase());}
  }
  return {counts,volumes,setCounts,worked};
}
/* Persistent per-id element stub so paint/hydrate cycles can be asserted. */
function makeDocumentStub(){
  const els=new Map();
  const makeEl=()=>{
    const children=new Map();
    const el={
      _html:'',_text:'',_attrs:{},hidden:false,onclick:null,dataset:{},style:{},
      classList:{add(){},remove(){},toggle(){},contains:()=>false},
      set innerHTML(v){this._html=String(v);},
      get innerHTML(){return this._html;},
      set textContent(v){this._text=String(v);},
      get textContent(){return this._text;},
      setAttribute(k,v){this._attrs[k]=String(v);},
      getAttribute(k){return Object.hasOwn(this._attrs,k)?this._attrs[k]:null;},
      removeAttribute(k){delete this._attrs[k];},
      addEventListener(){},removeEventListener(){},
      querySelector(sel){
        if(!children.has(sel))children.set(sel,makeEl());
        return children.get(sel);
      },
      querySelectorAll(){return [];},
      appendChild(){},focus(){},closest(){return null;},
    };
    return el;
  };
  const doc={
    _els:els,
    querySelector(sel){
      const m=/^#([\w-]+)$/.exec(String(sel||''));
      if(!m)return null;
      if(!els.has(m[1]))els.set(m[1],makeEl());
      return els.get(m[1]);
    },
    querySelectorAll(){return [];},
    getElementById(id){return doc.querySelector('#'+id);},
    createElement:()=>makeEl(),
  };
  return doc;
}

/* One role per process (the harness evaluates sources into this context, so
   a second loadRole would redeclare top-level bindings). */
const role=loadRole('loading-skeletons-409',{globals:{exercises:catalog}});
const doc=makeDocumentStub();
globalThis.document=doc;
beforeEach(()=>{role.workoutState.completed=[];});

describe('stats skeleton',()=>{
  test('statsSkeletonHtml covers every hydrated region with fixed-height shimmer',()=>{
    const skel=role.statsSkeletonHtml();
    assert.deepEqual(Object.keys(skel).sort(),
      ['muscleHeatmap','muscleStats','muscleTrends','muscleVolumeBreakdown','recentPRs','statsGrid','topExercises']);
    for(const html of Object.values(skel))assert.match(html,/class="skel /);
    assert.match(skel.statsGrid,/skel-stat-card/);
    assert.match(skel.statsGrid,/skel-stat-num/);
    assert.match(skel.muscleHeatmap,/skel-map/);
    assert.match(skel.topExercises,/skel-row/);
  });
  test('paintStatsSkeleton marks regions busy',()=>{
    role.paintStatsSkeleton();
    for(const id of ['statsGrid','muscleHeatmap','muscleVolumeBreakdown','topExercises','recentPRs','muscleTrends']){
      const el=doc.querySelector('#'+id);
      assert.ok(el.innerHTML.includes('skel'),id+' has skeleton');
      assert.equal(el.getAttribute('aria-busy'),'true',id+' is aria-busy');
    }
  });
});

describe('skeleton gating — no shimmer flash on repeat visits (user 2026-09-14)',()=>{
  test('statsHydrated starts false: first Stats open gets the skeleton',()=>{
    assert.equal(role.statsHydrated,false);
  });
  test('showStats paints the skeleton only on first open (source contract)',()=>{
    const nav=fs.readFileSync(path.join(REPO_ROOT,'assets/js/core/navigation.js'),'utf8');
    const i=nav.indexOf('if(!statsHydrated){');
    assert.ok(i>=0,'showStats gates on the hydrated flag');
    const branch=nav.slice(i,i+700);
    assert.ok(branch.includes('paintStatsSkeleton()'),'skeleton inside the gated branch');
    assert.ok(branch.includes('renderStats();restoreScroll'),'repeat visits render synchronously');
  });
  test('detailHydratedFor starts null: first exercise open gets the skeleton',()=>{
    assert.equal(role.detailHydratedFor,null);
  });
  test('openExercise skeletonizes only on exercise switch (source contract)',()=>{
    const det=fs.readFileSync(path.join(REPO_ROOT,'assets/js/pages/exercise-detail.js'),'utf8');
    assert.match(det,/const detailSwitching=detailHydratedFor!==id;/,'switch detection present');
    assert.match(det,/if\(detailSwitching\)paintDetailSkeletons\(\);/,'conditional skeleton paint');
    assert.match(det,/if\(detailSwitching&&typeof requestAnimationFrame==='function'\)/,'conditional deferred hydration');
    assert.match(det,/detailHydratedFor=id;/,'flag set after hydration');
  });
});

describe('detail skeleton + hydration',()=>{
  test('paintDetailSkeletons reserves layout and neutralizes the history toggle',()=>{
    role.paintDetailSkeletons();
    const stats=doc.querySelector('#stats');
    assert.ok(stats.innerHTML.includes('skel-stat-value'));
    assert.equal(stats.getAttribute('aria-busy'),'true');
    const list=doc.querySelector('#historyList');
    assert.ok(list.innerHTML.includes('skel-row'));
    assert.equal(list.hidden,false);
    assert.equal(list.getAttribute('aria-busy'),'true');
    const toggle=doc.querySelector('#historyToggle');
    assert.equal(toggle.hidden,true);
    assert.equal(toggle.onclick,null);
    assert.equal(doc.querySelector('#historyToggleLabel').textContent,'Loading history…');
    assert.equal(doc.querySelector('#customToolsRow').innerHTML,'');
  });
  test('hydrateExerciseDetail replaces (never appends) skeletons and clears busy flags',()=>{
    role.workoutState.completed=fixtureWorkouts();
    const ex=catalog[0];
    role.paintDetailSkeletons();
    const before=doc.querySelector('#stats').innerHTML;
    assert.ok(before.includes('skel-stat-value'),'skeleton was painted first');
    role.hydrateExerciseDetail(ex.id,ex);
    const stats=doc.querySelector('#stats');
    assert.ok(!stats.innerHTML.includes('skel-stat-value'),'stat skeletons replaced');
    assert.ok(stats.innerHTML.includes('PROJECTED 1RM'),'real stat cards rendered');
    assert.equal(stats.getAttribute('aria-busy'),null,'stats busy cleared');
    const list=doc.querySelector('#historyList');
    assert.ok(!list.innerHTML.includes('skel-row'),'history skeletons replaced');
    assert.ok(list.innerHTML.includes('history-session'),'real history rendered');
    assert.equal(list.getAttribute('aria-busy'),null,'history busy cleared');
    assert.ok(doc.querySelector('#exerciseProgressChart').innerHTML.includes('<svg'),'trend chart rendered');
    assert.ok(doc.querySelector('#similarGrid').innerHTML.includes('action-row'),'similar grid rendered');
  });
});

describe('shared aggregation + exercise map',()=>{
  test('aggregateMuscleStats matches the brute-force aggregation exactly',()=>{
    const workouts=fixtureWorkouts();
    const got=role.aggregateMuscleStats(workouts),want=bruteAggregate(workouts);
    assert.deepEqual(got.counts,want.counts);
    assert.deepEqual(got.volumes,want.volumes);
    assert.deepEqual(got.setCounts,want.setCounts);
    assert.deepEqual([...got.worked].sort(),[...want.worked].sort());
  });
  test('muscleCounts/muscleVolumes/muscleSetCounts/workedMuscles wrappers stay consistent',()=>{
    const workouts=fixtureWorkouts(),agg=role.aggregateMuscleStats(workouts);
    assert.equal(role.muscleCounts(workouts),agg.counts);
    assert.equal(role.muscleVolumes(workouts),agg.volumes);
    assert.equal(role.muscleSetCounts(workouts),agg.setCounts);
    assert.equal(role.workedMuscles(workouts),agg.worked);
  });
  test('exerciseById finds by id like the old exercises.find',()=>{
    assert.equal(role.exerciseById('ex-curl'),catalog[1]);
    assert.equal(role.exerciseById('nope'),undefined);
  });
});

describe('memoized history paths',()=>{
  test('priorSetsForPR memoizes per workout and invalidates on new data',()=>{
    role.workoutState.completed=fixtureWorkouts();
    const [w1,,w3]=role.workoutState.completed;
    const first=role.priorSetsForPR(w3,'ex-bench');
    const second=role.priorSetsForPR(w3,'ex-bench');
    assert.equal(first,second,'cache hit returns the same array');
    assert.ok(first.length>0,'prior sets found');
    /* w1 is the earliest workout — nothing is prior to it. */
    assert.deepEqual(role.priorSetsForPR(w1,'ex-bench'),[]);
    /* A new workout changes length -> cache invalidates and sees it. */
    role.workoutState.completed.unshift(mkWorkout('w0','2026-08-20',[[ 'ex-bench',[[130,8]] ]]));
    const after=role.priorSetsForPR(w3,'ex-bench');
    assert.notEqual(after,first,'invalidated after data change');
    assert.equal(after.length,first.length+1,'new prior set is visible');
  });
  test('getExerciseLogs memoizes per exercise and invalidates on new data',()=>{
    role.workoutState.completed=fixtureWorkouts();
    const a=role.getExerciseLogs('ex-bench'),b=role.getExerciseLogs('ex-bench');
    assert.equal(a,b,'cache hit returns the same array');
    assert.equal(a.length,3,'three bench sessions');
    assert.ok(a[0].isoDate>='2026-09-10','newest first');
    role.workoutState.completed.unshift(mkWorkout('w4','2026-09-12',[[ 'ex-bench',[[150,5]] ]]));
    const c=role.getExerciseLogs('ex-bench');
    assert.notEqual(c,a,'invalidated after new workout');
    assert.equal(c.length,4);
    assert.equal(c[0].isoDate,'2026-09-12');
  });
  test('recentExerciseIds matches the old per-exercise scan ordering',()=>{
    const workouts=fixtureWorkouts();
    role.workoutState.completed=workouts;
    const got=role.recentExerciseIds();
    /* Old algorithm: sort ids by getExerciseLogs(id)[0] with sortByWorkoutDateDesc. */
    const brute=[...new Set(workouts.flatMap(w=>w.exercises.map(i=>i.exerciseId)))]
      .map(id=>({id,log:role.getExerciseLogs(id)[0]||{}}))
      .sort((a,b)=>role.sortByWorkoutDateDesc(a.log,b.log))
      .map(x=>x.id);
    assert.deepEqual(got,brute);
    assert.deepEqual(got,['ex-bench','ex-curl','ex-plank']);
  });
});

describe('recentPRRows early termination (#409)',()=>{
  test('finds PRs buried under recent non-PR workouts',()=>{
    const mk=(id,date,w)=>mkWorkout(id,date,[[ 'ex-bench',[[w,8],[w,8]] ]]);
    const ws=[
      mk('o1','2026-01-01',100), /* first session: no prior, no PR by rule */
      mk('o2','2026-02-01',110), /* PRs live here */
      mk('n1','2026-09-01',105), /* below best: no PR */
      mk('n2','2026-09-02',105),
      mk('n3','2026-09-03',105),
    ];
    role.workoutState.completed=ws;
    const rows=role.recentPRRows(ws);
    assert.ok(rows.length>0,'buried PRs are found');
    assert.ok(rows.every(r=>r.date<'2026-09-01'),'all rows come from the older PR workouts');
    assert.ok(rows.length<=6);
  });
  test('caps at the 6 most recent PRs, newest first',()=>{
    const ws=[];
    for(let i=0;i<10;i++)ws.push(mkWorkout('w'+i,'2026-09-'+String(i+1).padStart(2,'0'),[[ 'ex-bench',[[100+i*5,8]] ]]));
    role.workoutState.completed=ws;
    const rows=role.recentPRRows(ws);
    assert.equal(rows.length,6);
    assert.equal(rows[0].date,'2026-09-10');
    for(let i=1;i<rows.length;i++)assert.ok(rows[i-1].date>=rows[i].date,'newest-first order');
  });
});

describe('Intl hoisting',()=>{
  test('formatLogDate/formatPrettyDate still format the same strings',()=>{
    assert.equal(role.formatLogDate('2026-09-14'),'Sep 14, 2026');
    assert.equal(role.formatLogDate(''), '');
    assert.equal(role.formatPrettyDate('2026-09-14'),'Mon, Sep 14, 2026');
  });
});

describe('skeleton CSS contract',()=>{
  test('shimmer honors prefers-reduced-motion and new sizes exist',()=>{
    const css=fs.readFileSync(path.join(REPO_ROOT,'assets/styles.css'),'utf8');
    assert.match(css,/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.skel\s*\{\s*animation:\s*none;\s*\}\s*\}/);
    for(const cls of ['.skel-stat-card','.skel-stat-num','.skel-stat-label','.skel-stat-value','.skel-stat-sub','.skel-chart']){
      assert.ok(css.includes(cls),cls+' defined');
    }
  });
});
