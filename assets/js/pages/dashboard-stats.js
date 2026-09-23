
/* ===== module: dashboard-stats.js ===== */
    /** Produces dashboard calendars, charts, and muscle-volume analysis from completed workouts. */
    /* Module map (v1.006) — Key: renderDashboard(), renderStats(), workoutsForPeriod(), muscleVolumes(), dashboardWeekModel(), dayChipHtml(). Depends on: workoutState.completed (state.js), date/format/volume helpers (utilities.js), navigation scroll restore. */
    /* User 2026-09-22: the Home calendar/date selector is back — it was
       hidden earlier the same day because Home looked fine without it, then
       restored because Home looked too empty. */
    const HOME_CALENDAR_ENABLED=true;
    /* #99 L12: isoForDate removed — use the canonical localIsoDate(date) from utilities.js. */
    function workoutsForPeriod(period) {
      const now=new Date(), today=localIsoDate(now); let start=null;
      if(period==='today') start=today;
      if(period==='week'){const d=new Date(now);d.setDate(now.getDate()-((now.getDay()+6)%7));start=localIsoDate(d);} /* #99 C15: Monday-start math — getDay() is Sunday-first (Sun=0), so (getDay()+6)%7 shifts it to a Monday-first offset. */
      if(period==='month') start=`${today.slice(0,7)}-01`;
      if(period==='year') start=`${today.slice(0,4)}-01-01`;
      return (Array.isArray(workoutState.completed)?workoutState.completed:[])
        .filter(w=>w&&(!start||w.date>=start)&&w.date<=today); /* #chaos (2026-09-15): null entries in completed must not throw. */
    }
    /* Splits completed workouts into current and previous period windows for trend comparison. Returns {current, previous, label}. */
    function comparisonPeriods(period) {
      const now=new Date(); now.setHours(12,0,0,0);
      let currentStart, currentEnd, previousStart, previousEnd, label;
      if(period==='today'){
        currentStart=new Date(now); currentEnd=new Date(now); currentEnd.setDate(now.getDate()+1);
        previousStart=new Date(now); previousStart.setDate(now.getDate()-1); previousEnd=new Date(now);
        label='today vs yesterday';
      }else if(period==='week'){
        currentStart=new Date(now); currentStart.setDate(now.getDate()-((now.getDay()+6)%7)); currentEnd=new Date(currentStart); currentEnd.setDate(currentStart.getDate()+7);
        previousStart=new Date(currentStart); previousStart.setDate(currentStart.getDate()-7); previousEnd=new Date(currentStart);
        label='this week vs last week';
      }else if(period==='month'){
        currentStart=new Date(now.getFullYear(),now.getMonth(),1,12); currentEnd=new Date(now.getFullYear(),now.getMonth()+1,1,12);
        previousStart=new Date(now.getFullYear(),now.getMonth()-1,1,12); previousEnd=new Date(currentStart);
        label='this month vs last month';
      }else if(period==='year'){
        currentStart=new Date(now.getFullYear(),0,1,12); currentEnd=new Date(now.getFullYear()+1,0,1,12);
        previousStart=new Date(now.getFullYear()-1,0,1,12); previousEnd=new Date(currentStart);
        label='this year vs last year';
      }else if(period==='all'){
        /* #99 M12: 'all' means every logged workout. There is no "previous"
           all-time to compare against, so previous is empty (trends render
           as "New", which is honest). */
        currentStart=new Date(2000,0,1,12); currentEnd=new Date(now); currentEnd.setDate(now.getDate()+1);
        previousStart=new Date(now); previousEnd=new Date(now);
        label='all time';
      }else{
        currentEnd=new Date(now); currentEnd.setDate(now.getDate()+1); currentStart=new Date(currentEnd); currentStart.setDate(currentEnd.getDate()-28);
        previousEnd=new Date(currentStart); previousStart=new Date(previousEnd); previousStart.setDate(previousEnd.getDate()-28);
        label='last 4 weeks vs prior 4 weeks';
      }
      /* #409: the four boundary dates were recomputed per workout (O(W)
         Intl-free but still 4 localIsoDate calls each) — hoist once. */
      const cs=localIsoDate(currentStart), ce=localIsoDate(currentEnd), ps=localIsoDate(previousStart), pe=localIsoDate(previousEnd);
      const inWindow=(workout,start,end)=>workout.date>=start&&workout.date<end;
      return {current:workoutState.completed.filter(workout=>inWindow(workout,cs,ce)),previous:workoutState.completed.filter(workout=>inWindow(workout,ps,pe)),label};
    }
    /* Builds up to 6 recent-PR rows (newest first) from the period's workouts: timed holds, bodyweight rep bests, and e1RM/heaviest-set PRs. */
    function recentPRRows(workouts) {
      const rows=[];
      /* #409: only the 6 most recent PRs are ever shown (see slice below),
         so walking newest-first we can stop the scan as soon as 6 rows are
         found — identical result, a fraction of the pairs in the common
         case where recent training holds PRs. */
      const ordered=workouts.slice().sort(sortByRecencyDesc);
      for(const workout of ordered){
        /* #409: the old code called priorSetsForPR per (workout, exercise) —
           each call re-scanned every prior row's exercises, O(W^2·E) per
           render. Build the exercise→prior-sets map once per workout from
           the memoized prior-row filter; the extraction order and predicate
           are identical to repeated priorSetsForPR calls. */
        const priorByExercise=new Map();
        for(const row of priorRowsForWorkout(workout)){
          for(const entry of (row.exercises||[])){
            /* #539: group prior sets under the canonical id. */
            const ecid=(typeof canonicalExerciseId==='function')?canonicalExerciseId(entry.exerciseId):entry.exerciseId;
            let arr=priorByExercise.get(ecid);
            if(!arr)priorByExercise.set(ecid,arr=[]);
            for(const set of (entry.sets||[]))arr.push(set);
          }
        }
        workout.exercises.forEach(item=>{
        const itemCid=(typeof canonicalExerciseId==='function')?canonicalExerciseId(item.exerciseId):item.exerciseId;
        const prior=priorByExercise.get(itemCid)||[];
        /* #282: timed PRs — longest hold at a given load, same celebration. */
        if((item.tracking||'reps')==='time'){
          const current=item.sets.filter(set=>Number(set.seconds)>0); if(!current.length)return;
          if(!prior.length||!detectTimedPRs(current,prior))return;
          const best=Math.max(...current.map(set=>Number(set.seconds)));
          rows.push({exerciseId:itemCid,date:workout.date,kind:'Longest hold PR',value:`${best} sec`});
          return;
        }
        /* #372: bodyweight rep PRs — a new best unweighted rep set gets the
           same celebration. Checked independently of the weighted path: a
           workout can hold both (weighted and bodyweight work on the same
           movement are different classes). */
        const currentBW=item.sets.filter(set=>!(Number(set.w)>0)&&Number(set.r)>0);
        if(currentBW.length&&detectBodyweightPRs(currentBW,prior)){
          const bestBW=Math.max(...currentBW.map(set=>Number(set.r)));
          rows.push({exerciseId:itemCid,date:workout.date,kind:'Best rep set PR',value:`${bestBW} reps`});
        }
        const current=item.sets.filter(set=>Number(set.w)>0&&Number(set.r)>0); if(!current.length)return;
        /* #99 A15 + #158: compare against prior sessions — all other records
           except the current one, including earlier same-day sessions (never
           later ones). priorSetsForPR matches the live PR banner's definition. */
        const priorWeighted=prior.filter(set=>Number(set.w)>0&&Number(set.r)>0);
        if(!priorWeighted.length)return;
        const kind=detectExercisePRs(current,priorWeighted);
        const label=kind==='e1rm'?'Estimated 1RM PR':kind==='heaviest'?'Heaviest set PR':'';
        if(label){const best=Math.max(...current.map(estimate1RM)),weight=Math.max(...current.map(set=>Number(set.w)));const isDb=exerciseById(item.exerciseId)?.equipment==='dumbbell';const displayValue=label.startsWith('Estimated')?`${Math.round(dbDisplayWeight(best,item.exerciseId,null,isDb))} ${weightUnit()}`:`${dbDisplayWeight(weight,item.exerciseId,null,isDb)} ${weightUnit()}`;rows.push({exerciseId:itemCid,date:workout.date,kind:label,value:displayValue});}
        });
        if(rows.length>=6)break;
      }
      return rows.slice(0,6);
    }    /* #99 B18: renderMuscleAnalysis decomposed by pure code motion into one
       component per panel — muscle breakdown, top exercises, recent PRs,
       stat-exercise link wiring (shared by the first three, so it runs after
       them), and muscle trends. renderMuscleAnalysis only orchestrates the
       same steps in the same order. */
    function renderMuscleBreakdown(workouts){
      /* Volume|Sets toggle for the muscle breakdown (user 2026-09-11) —
         mirrors the #14 Top Exercises segmented control. #357 (user
         2026-09-13): all three Stats metric toggles are session-only —
         they initialize to the saved Units → Stats default on every load
         and never persist (the Top-exercises toggle's old schedulePersist
         was the odd one out). */
      const byMuscleSets=state.muscleVolumeMode==='sets';
      /* #170 (user 2026-09-14): in volume mode a muscle driven only by
         bodyweight has 0 volume but real sets — it stays visible, shown by
         sets instead of "0 lb". */
      const breakdownVolumes=muscleVolumes(workouts), breakdownSets=muscleSetCounts(workouts);
      const rows=Object.keys(Object.assign({},breakdownVolumes,breakdownSets))
        .map(muscle=>({muscle,volume:breakdownVolumes[muscle]||0,sets:breakdownSets[muscle]||0}))
        .filter(r=>byMuscleSets?r.sets>0:(r.volume>0||r.sets>0))
        .sort((a,b)=>byMuscleSets?b.sets-a.sets:((b.volume-a.volume)||(b.sets-a.sets)));
      const max=Math.max(1,...rows.map(r=>byMuscleSets?r.sets:Math.max(r.volume,1)));
      document.querySelectorAll('#muscleVolumeMode [data-muscle-mode]').forEach(btn=>{
        btn.setAttribute('aria-pressed',String(btn.dataset.muscleMode===(byMuscleSets?'sets':'volume')));
        btn.onclick=()=>{const mode=btn.dataset.muscleMode;if(state.muscleVolumeMode===mode)return;const y=window.scrollY;state.muscleVolumeMode=mode;renderStats();window.scrollTo(0,y);};
      });
      $('#muscleVolumeNote').textContent=byMuscleSets
        ?'Completed sets per muscle, primary and secondary.'
        :'Weighted volume. Secondary muscles receive 45% of the set\u2019s volume.';
      /* #7: muscle rows are tappable — expanding shows the top exercises
         driving that muscle in the period (sorted by the active metric),
         each opening the exercise detail (which carries its own e1RM
         chart + history). */
      $('#muscleVolumeBreakdown').innerHTML=rows.length?rows.slice(0,10).map((row)=>{
        const muscle=row.muscle;
        const isOpen=expandedMuscle===muscle;
        const drivers=isOpen?exercisesForMuscle(muscle,workouts,byMuscleSets):[];
        const drill=drivers.length?`<div class="muscle-drilldown">${drivers.map(([id,entry])=>{const setsLabel=`${entry.sets} set${entry.sets===1?'':'s'}`;const volLabel=formatVolume(entry.volume);/* #170: unweighted bodyweight drivers show sets only; added load shows volume like any weighted exercise. */const bwNoLoadDrill=entry.bodyweight&&!(entry.volume>0);const valueLabel=byMuscleSets?`${setsLabel} · ${volLabel}`:(bwNoLoadDrill?setsLabel:`${volLabel} · ${setsLabel}`);return `<button class="drilldown-row" type="button" data-stat-exercise="${escapeHtml(id)}"><span>${escapeHtml(exerciseById(id)?.name||'Exercise')}</span><span class="drilldown-value">${valueLabel}</span><span aria-hidden="true">›</span></button>`;}).join('')}</div>`:'';
        const valueLabel=byMuscleSets?`${row.sets} set${row.sets===1?'':'s'}`:(row.volume>0?formatVolume(row.volume):`${row.sets} set${row.sets===1?'':'s'}`);
        return `<div class="muscle-volume-group"><button class="muscle-volume-row${isOpen?' is-open':''}" type="button" data-muscle-drill="${escapeHtml(muscle)}" aria-expanded="${isOpen}"><strong class="analysis-label">${escapeHtml(muscle)}</strong><span class="analysis-track"><i class="analysis-fill" style="width:${Math.max(3,((byMuscleSets?row.sets:Math.max(row.volume,1))/max)*100).toFixed(1)}%"></i></span><span class="analysis-value">${valueLabel}</span><span class="drill-chevron" aria-hidden="true">›</span></button>${drill}</div>`;
      }).join(''):`<p class="section-note">${periodEmptyNote(byMuscleSets)}</p>`;
      document.querySelectorAll('[data-muscle-drill]').forEach(btn=>btn.addEventListener('click',()=>{
        const y=window.scrollY;
        expandedMuscle=expandedMuscle===btn.dataset.muscleDrill?null:btn.dataset.muscleDrill;
        renderStats();
        window.scrollTo(0,y);
      }));
    }
    /* Renders the Top-exercises panel (top 6 by volume or sets), with the metric segmented control. */
    function renderTopExercises(workouts){
      /* Top exercises metric dropdown (#14). */
      const exerciseStats={};workouts.forEach(workout=>workout.exercises.forEach(item=>{const _cid=(typeof canonicalExerciseId==='function')?canonicalExerciseId(item.exerciseId):item.exerciseId;const entry=exerciseStats[_cid]||(exerciseStats[_cid]={volume:0,sets:0});entry.volume+=item.sets.reduce((sum,set)=>sum+setVolume(set,exerciseById(item.exerciseId)),0);entry.sets+=item.sets.length;})); /* #498: non-volume work contributes zero */
      const bySets=state.topExercisesMode==='sets';
      /* #170 (user 2026-09-14): unweighted bodyweight work generates no
         volume — it ranks and displays by sets in volume mode. Added load
         counts as real volume (setVolume already yields 0 for w=0). */
      const isBodyweightExercise=id=>exerciseById(id)?.equipment==='body only';
      const bwNoLoad=(id,entry)=>isBodyweightExercise(id)&&!(entry.volume>0);
      const topMetric=(id,entry)=>(bySets||bwNoLoad(id,entry))?entry.sets:entry.volume;
      const top=Object.entries(exerciseStats).filter(([id,entry])=>topMetric(id,entry)>0).sort((a,b)=>topMetric(b[0],b[1])-topMetric(a[0],a[1])).slice(0,6);
      /* #14: compact two-option segmented control with fixed button widths —
         the old text-swapping button changed width on every tap and jumped. */
      document.querySelectorAll('#topExercisesMode [data-top-mode]').forEach(btn=>{
        btn.setAttribute('aria-pressed',String(btn.dataset.topMode===(bySets?'sets':'volume')));
        btn.onclick=()=>{const mode=btn.dataset.topMode;if(state.topExercisesMode===mode)return;const y=window.scrollY;state.topExercisesMode=mode;renderStats();window.scrollTo(0,y);}; /* #357: session-only like the other Stats toggles — no schedulePersist. */
      });
      $('#topExercises').innerHTML=top.length?`<div class="action-list">${top.map(([id,entry])=>{const showSets=bySets||bwNoLoad(id,entry);return `<button class="action-row" type="button" data-stat-exercise="${escapeHtml(id)}"><span><strong>${escapeHtml(exerciseById(id)?.name||'Exercise')}</strong><span>Open history and trend</span></span><span class="action-row-value">${showSets?`${entry.sets} set${entry.sets===1?'':'s'}`:formatVolume(entry.volume)}</span></button>`;}).join('')}</div>`:`<p class="section-note">${periodEmptyNote(bySets)}</p>`;
    }
    /* Renders the recent-PRs panel from recentPRRows. */
    function renderRecentPRs(workouts){
      const prs=recentPRRows(workouts);
      $('#recentPRs').innerHTML=prs.length?`<div class="action-list">${prs.map(pr=>`<button class="action-row" type="button" data-stat-exercise="${escapeHtml(pr.exerciseId)}"><span><strong>${escapeHtml(exerciseById(pr.exerciseId)?.name||'Exercise')}</strong><span>${escapeHtml(pr.kind)} · ${escapeHtml(formatLogDate(pr.date))}</span></span><span class="action-row-value">${escapeHtml(pr.value)}</span></button>`).join('')}</div>`:'<p class="section-note">No new PRs in this period.</p>';
    }
    /* Wires tap-to-open-exercise on every [data-stat-exercise] button in the Stats panels. */
    function wireStatExerciseLinks(){
      document.querySelectorAll('[data-stat-exercise]').forEach(button=>button.addEventListener('click',()=>openExercise(button.dataset.statExercise)));
    }
    /* Renders per-muscle current-vs-previous period trend rows with % change. */
    function renderMuscleTrends(period){
      const comparison=comparisonPeriods(period), current=muscleVolumes(comparison.current), previous=muscleVolumes(comparison.previous);
      const trendRows=[...new Set([...Object.keys(current),...Object.keys(previous)])].map(muscle=>({muscle,current:Number(current[muscle]||0),previous:Number(previous[muscle]||0)})).filter(row=>row.current>0||row.previous>0).sort((a,b)=>b.current-a.current).slice(0,8);
      $('#muscleTrendNote').textContent=titleCase(comparison.label);
      $('#muscleTrends').innerHTML=trendRows.length?trendRows.map(row=>{const change=row.previous?Math.round((row.current-row.previous)/row.previous*100):null;const changeText=change==null?(row.current?'New':'—'):`${change>0?'+':''}${change}%`;const direction=change>0?'up':change<0?'down':'';return `<div class="trend-row"><div><strong>${escapeHtml(row.muscle)}</strong><span>${formatVolume(row.current)} now · ${formatVolume(row.previous)} before</span></div><span class="trend-change ${direction}">${changeText}</span></div>`;}).join(''):'<p class="section-note">No muscle trend is available for these periods.</p>';
    }
    /* Orchestrates the Stats muscle panels: breakdown, top exercises, recent PRs, link wiring, trends. */
    function renderMuscleAnalysis(workouts,period) {
      renderMuscleBreakdown(workouts);
      /* #126 (user 2026-09-11): Training focus panel removed — rep-range share carried no real info. */
      renderTopExercises(workouts);
      renderRecentPRs(workouts);
      wireStatExerciseLinks();
      renderMuscleTrends(period);
    }
    /* #409 (user 2026-09-14): the Stats/Dashboard aggregations each scanned
       every workout AND ran exercises.find() per item — renderStats alone
       did up to 7 scans. One cached id→exercise map plus one single-pass
       aggregation shared by every caller. Cache keys are array identity +
       length: every mutation site reassigns or changes length, so staleness
       is impossible by construction. */
    let _exerciseByIdCache={list:null,map:new Map()};
    function exerciseById(id){
      const list=(typeof exercises!=='undefined')?exercises:[];
      if(_exerciseByIdCache.list!==list){
        const map=new Map();
        for(const ex of list)if(ex&&ex.id!=null&&!map.has(ex.id))map.set(ex.id,ex);
        _exerciseByIdCache={list,map};
      }
      /* #539: resolve variant ids to their canonical exercise. */
      const cid=(typeof canonicalExerciseId==='function')?canonicalExerciseId(id):id;
      return _exerciseByIdCache.map.get(cid);
    }
    let _muscleAggCache={list:null,len:-1,result:null};
    /* Single-pass aggregation shared by muscleCounts/muscleVolumes/muscleSetCounts/workedMuscles: per-muscle set counts, volumes, and the worked-muscle set. Cached by array identity + length. */
    function aggregateMuscleStats(workouts){
      const list=workouts||[];
      if(_muscleAggCache.list!==list||_muscleAggCache.len!==list.length){
        const counts={},volumes={},setCounts={},worked=new Set();
        for(const w of list){
          const items=w.exercises||[];
          for(const item of items){
            const ex=exerciseById(item.exerciseId);if(!ex)continue;
            const n=(item.sets||[]).length;
            const volume=(item.sets||[]).reduce((total,set)=>total+setVolume(set,ex),0); /* #498 */
            for(const m of (ex.primary||[])){
              counts[m]=(counts[m]||0)+n;
              volumes[m]=(volumes[m]||0)+volume;
              setCounts[m]=(setCounts[m]||0)+n;
              if(n)worked.add(String(m).toLowerCase());
            }
            for(const m of (ex.secondary||[])){
              volumes[m]=(volumes[m]||0)+(volume*SECONDARY_MUSCLE_WEIGHT);
              setCounts[m]=(setCounts[m]||0)+n;
              if(n)worked.add(String(m).toLowerCase());
            }
          }
        }
        _muscleAggCache={list,len:list.length,result:{counts,volumes,setCounts,worked}};
      }
      return _muscleAggCache.result;
    }
    /* #409: thin wrappers — the names and return shapes are unchanged, they
       now read from the shared single-pass aggregation instead of scanning. */
    function muscleCounts(workouts) { return aggregateMuscleStats(workouts).counts; }
    function muscleVolumes(workouts) { return aggregateMuscleStats(workouts).volumes; }
    function muscleSetCounts(workouts) { return aggregateMuscleStats(workouts).setCounts; }
    function workedMuscles(workouts) { return aggregateMuscleStats(workouts).worked; }
    /* Formats a volume value with the current unit, abbreviating ≥1000 ("1.5k lb"). */
    function formatVolume(value) {
      const n=displayVolume(value), unit=weightUnit(), rounded=Math.round(n);
      return rounded>=1000?`${(rounded/1000).toFixed(rounded>=10000?0:1)}k ${unit}`:`${rounded.toLocaleString()} ${unit}`;
    }
    /* Heat rank 1–5 for a muscle value against the period max (square-root scaled); 0 when empty. */
    function heatLevel(value,max) {
      if(!value||!max)return 0;
      return Math.max(1,Math.min(5,Math.ceil(Math.sqrt(value/max)*5)));
    }
    /* Sasha anatomical body map (restored 2026-09-10 at user's request; the
       style revisit is pinned in UX-BACKLOG.md). SVG regions carry data-muscle;
       this maps them to the exercise library's muscle names. */
    /* Region -> muscle names it represents. A region may cover several of the
       user's muscle names (e.g. the traps region also lights for "upper
       back", user 2026-09-12), so values are arrays. */
    /* #136: the three delt heads + rhomboids light their regions (common
       aliases included). Rhomboids have no dedicated region — the traps
       region is the closest visual proxy.
       #194 (user 2026-09-12): adductors, abductors, middle back and neck
       have no dedicated SVG region either, so they light the closest one —
       a bodyweight adductor session must fill the map, not vanish. */
    const bodyMapMuscleAliases={
      'upper-chest':['chest'],'lower-chest':['chest'],
      'front-delts':['shoulders','front delts','front delt','front deltoid','anterior delts','anterior deltoid'],
      'rear-delts':['shoulders','rear delts','rear delt','rear deltoid','posterior delts','posterior deltoid'],
      'side-delts':['shoulders','side delts','side delt','lateral delts','lateral deltoid','middle delts'],
      'quads':['quadriceps','adductors'],'hamstrings':['hamstrings'],'glutes':['glutes','abductors'],'forearms':['forearms'],'abs':['abdominals'],
      'lats':['lats'],'lower-back':['lower back'],'traps':['traps','upper back','rhomboids','rhomboid','middle back','neck'],'triceps':['triceps'],'biceps':['biceps'],'calves':['calves'],'obliques':['abdominals']
    };
    /* Sum a per-muscle map across every muscle name a region represents. */
    function regionMuscleTotal(map,region){
      return (bodyMapMuscleAliases[region.dataset.muscle]||[]).reduce((sum,m)=>sum+Number(map[m]||0),0);
    }
    let bodyMapTemplatePromise;
    /* Fetches the Sasha body-map SVG once (memoized); resolves null on failure. */
    function loadBodyMapTemplate(){
      if(!bodyMapTemplatePromise)bodyMapTemplatePromise=fetch('data/sasha-male-body.svg').then(response=>{if(!response.ok)throw new Error('Body map unavailable');return response.text();}).catch(()=>null);
      return bodyMapTemplatePromise;
    }
    /* Applies a heat class and tooltip title to one body-map SVG region. */
    function paintBodyRegion(region,level,label){
      region.classList.add(`heat-${level}`);
      const title=document.createElementNS('http://www.w3.org/2000/svg','title');
      title.textContent=label;region.prepend(title);
    }
    /* Injects the body-map SVG into every unhydrated .anatomy-map host and paints regions from its data attributes (volumes, worked muscles, or per-exercise primary/secondary). Returns a promise that resolves when done. */
    function hydrateBodyMaps(){
      /* Volume heat maps (dashboard + stats): data-volumes holds {muscle: volume}.
         Returns a promise that resolves when hydration completes (user 2026-09-11:
         callers need to wait so scroll restoration happens after the async SVG inject). */
      const volumeHosts=[...document.querySelectorAll('.anatomy-map[data-volumes]:not([data-hydrated])')];
      /* Per-exercise maps (exercise detail): data-primary/data-secondary hold
         comma-separated library muscle names; primary = full heat, secondary = soft. */
      const exerciseHosts=[...document.querySelectorAll('.anatomy-map[data-primary]:not([data-hydrated])')];
      /* Completed-workout maps: data-worked holds comma-separated library muscle
         names; every worked region gets one flat highlight, no heat ranking. */
      const workedHosts=[...document.querySelectorAll('.anatomy-map[data-worked]:not([data-hydrated])')];
      const hosts=volumeHosts.concat(exerciseHosts,workedHosts);
      if(!hosts.length)return Promise.resolve();
      return loadBodyMapTemplate().then(template=>{
        hosts.forEach(host=>{
          /* #164: the injected SVG is decorative — the muscle lists and legend
             beside it carry the information. Hide the whole host from
             assistive tech so a screen reader doesn't walk dozens of region
             <title> nodes, and keep the SVG out of the tab order. */
          if(!template){host.innerHTML='<div class="chart-empty">Body map unavailable.</div>';host.setAttribute('data-hydrated','true');return;}
          host.setAttribute('aria-hidden','true');
          host.innerHTML=template;
          host.setAttribute('data-hydrated','true');
          /* User 2026-09-13: mark the host hydrated so the CSS pre-hydration
             reserve (min-height + 760/614 aspect-ratio, #182) releases and the
             host hugs the injected SVG — without this the compact home map
             kept its tall ratio box under the 160px-capped SVG, leaving dead
             space between the map and the legend. */
          host.querySelectorAll('svg').forEach(svgNode=>{svgNode.setAttribute('aria-hidden','true');svgNode.setAttribute('focusable','false');});
          const regions=[...host.querySelectorAll('[data-muscle]')];
          /* #170: a volume map may ALSO carry data-worked (comma-separated
             lowercase muscle names with >=1 completed set). Zero-volume but
             worked regions — bodyweight work — get the flat heat-worked
             highlight instead of staying dark. */
          if(host.dataset.primary!==undefined){
            const primary=new Set(host.dataset.primary.split(',').filter(Boolean));
            const secondary=new Set(host.dataset.secondary.split(',').filter(Boolean));
            regions.forEach(region=>{
              const candidates=bodyMapMuscleAliases[region.dataset.muscle]||[];
              const kind=candidates.some(m=>primary.has(m))?'primary':candidates.some(m=>secondary.has(m))?'secondary':null;
              paintBodyRegion(region,kind==='primary'?5:kind==='secondary'?2:0,`${titleCase(candidates[0]||region.dataset.muscle)}${kind?` · ${kind}`:' · not targeted'}`);
            });
          }else if(host.dataset.volumes!==undefined){
            const volumes=JSON.parse(decodeURIComponent(host.dataset.volumes));
            const worked=new Set((host.dataset.worked||'').split(',').filter(Boolean));
            const bySets=host.dataset.metric==='sets';
            const regionValue=region=>regionMuscleTotal(volumes,region);
            const valueLabel=value=>bySets?`${value} set${value===1?'':'s'}`:formatVolume(value);
            const max=Math.max(1,...regions.map(regionValue));
            regions.forEach(region=>{
              const value=regionValue(region);
              if(value>0){
                paintBodyRegion(region,heatLevel(value,max),`${titleCase((bodyMapMuscleAliases[region.dataset.muscle]||[])[0]||region.dataset.muscle)} · ${valueLabel(value)}`);
              }else{
                const hit=(bodyMapMuscleAliases[region.dataset.muscle]||[]).find(m=>worked.has(m));
                if(hit){
                  region.classList.add('heat-worked');
                  const title=document.createElementNS('http://www.w3.org/2000/svg','title');
                  title.textContent=titleCase(hit);region.prepend(title);
                }
              }
            });
          }else if(host.dataset.worked!==undefined){
            const worked=new Set(host.dataset.worked.split(',').filter(Boolean));
            regions.forEach(region=>{
              const hit=(bodyMapMuscleAliases[region.dataset.muscle]||[]).find(m=>worked.has(m));
              if(hit){
                region.classList.add('heat-worked');
                const title=document.createElementNS('http://www.w3.org/2000/svg','title');
                title.textContent=titleCase(hit);region.prepend(title);
              }
            });
          }
          host.dataset.hydrated='true';
        });
      });
    }
    /* #319 (user 2026-09-13): the Stats Volume|Sets toggle also switches
       the muscle map — `bySets` renders per-muscle set counts (heat ranking,
       value labels, tooltips) instead of volume. The dashboard's compact map
       stays volume-only (it has no toggle). */
    function muscleHeatmapMarkup(volumes,worked,compact=false,bySets=false,withReset=false) {
      /* Anatomical muscle map, always the worked view (user 2026-09-11:
         the #72 Worked/Unworked toggle was removed).
         #170: `worked` is the Set of lowercase muscle names with at least one
         completed set in the period (workedMuscles) — bodyweight work has
         volume 0 but must still light its regions (flat heat-worked, no
         volume ranking). */
      const valueLabel=value=>bySets?`${value} set${value===1?'':'s'}`:formatVolume(value);
      const rows=Object.entries(volumes).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
      const workedList=[...(worked||[])];
      /* user 2026-09-16: the anatomical map stays visible with no activity —
         an empty period renders the blank map (no lit regions) with the
         empty note beside it, instead of hiding the map entirely. */
      const empty=!rows.length&&!workedList.length;
      const max=Math.max(1,...rows.map(([,v])=>v));
      const shown=compact?rows.slice(0,4):rows;
      const encoded=encodeURIComponent(JSON.stringify(volumes));
      const workedAttr=workedList.map(m=>String(m).toLowerCase()).join(',');
      const map=`<div class="anatomy-map" data-volumes="${encoded}" data-worked="${escapeHtml(workedAttr)}"${bySets?' data-metric="sets"':''}><div class="chart-empty">Loading anatomical map\u2026</div></div>`;
      const list=shown.map(([muscle,value])=>`<div class="heatmap-row"><i class="heatmap-swatch heat-${heatLevel(value,max)}"></i><span>${escapeHtml(titleCase(muscle))}</span><strong>${valueLabel(value)}</strong></div>`).join('');
      const note=empty
        ?`<p class="section-note">${withReset?periodEmptyNote(bySets):(bySets?'No completed sets in this period.':'No weighted volume in this period.')}</p>`
        :((!rows.length&&!bySets)?'<p class="section-note">Bodyweight work only — no weighted volume this period.</p>':'');
      /* #238 (user 2026-09-12): the Less/More legend was duplicative — the
         swatches and volume numbers already carry the scale. */
      return `<div class="heatmap-shell">${map}<div>${list?`<div class="heatmap-list">${list}</div>`:''}${note}</div></div>`;
    }
    /* Completed-workout body map (user phone QA 2026-09-12): data-worked holds
       comma-separated library muscle names; every worked region gets ONE flat
       highlight — no heat ranking. Muscles with no map region stay visible as
       pills below the map, so there are no blind spots. */
    function workoutBodyMapMarkup(muscles){
      const worked=muscles.map(m=>String(m).toLowerCase()).join(',');
      return `<div class="anatomy-map workout-map" data-worked="${escapeHtml(worked)}"><div class="chart-empty">Loading anatomical map…</div></div>`;
    }
    /* Per-exercise body map for the exercise detail page (user 2026-09-10).
       The legend carries the actual muscle names with their colors, so the
       "muscles worked" live with the map instead of the top of the page. */
    function exerciseBodyMapMarkup(ex){
      const primary=(ex.primary||[]).join(','),secondary=(ex.secondary||[]).join(',');
      /* #454 (parked for 2.0): the legend pills are static labels — the
         dedicated muscle pages are out of scope for 1.x. */
      const pill=(m,kind)=>`<span class="muscle-pill">${escapeHtml(titleCase(m))}</span>`;
      const pPills=(ex.primary||[]).map(m=>pill(m,'primary')).join('');
      const sPills=(ex.secondary||[]).map(m=>pill(m,'secondary')).join('');
      const legend=[pPills?`<span class="legend-row"><i class="heatmap-swatch heat-5"></i><span class="legend-kind">Primary</span>${pPills}</span>`:'',sPills?`<span class="legend-row"><i class="heatmap-swatch heat-2"></i><span class="legend-kind">Secondary</span>${sPills}</span>`:''].join('');
      return `<div class="anatomy-map exercise-map" data-primary="${escapeHtml(primary)}" data-secondary="${escapeHtml(secondary)}"><div class="chart-empty">Loading anatomical map\u2026</div></div><div class="exercise-map-legend">${legend}</div>`;
    }

    /* #4: tapping a future calendar date shows the upcoming program workout
       for that date — the program week it falls in plus the next suggested
       session, with a one-tap start. */
    function upcomingProgramMarkup(selDate){
      const program=workoutState.activeProgram;
      if(!program)return '<p>Nothing logged for this date.</p>';
      const week=programWeekAtDate(program,selDate), next=suggestedProgramWorkout(program);
      const exerciseCount=next?.template?.exercises?.length||0;
      /* #559: the Start button carries the displayed week — the click handler
         passes it to startProgramWorkout so the started session inherits the
         week the card showed, not the current week. */
      const startBtn=`<button class="secondary-button" id="startUpcomingProgramWorkout" type="button" data-upcoming-week="${week}">Start this workout</button>`;
      return `<div class="upcoming-program"><p class="upcoming-kicker">Upcoming · ${escapeHtml(program.name)}</p>${next?`<p class="upcoming-name"><strong>${escapeHtml(next.name)}</strong></p><p class="section-note">Week ${week} of ${program.length}${exerciseCount?` · ${exerciseCount} exercise${exerciseCount===1?'':'s'}`:''}</p>${startBtn}`:`<p class="section-note">Week ${week} of ${program.length}. Add exercises to a program workout to get a suggestion here.</p>`}</div>`;
    }
    /* #99: single canonical period-tab renderer — replaces the duplicated
       dashboard + stats tab markups. */
    const PERIOD_LABELS={today:'Today',week:'Week',month:'Month',year:'Year',all:'All time'};
    function periodTabs(dataAttr, activePeriod) {
      return Object.entries(PERIOD_LABELS).map(([key,label])=>`<button class="period-tab" type="button" ${dataAttr}="${key}" aria-pressed="${activePeriod===key}">${label}</button>`).join('');
    }
    /* #504 (v1.8): filtered-void reset — the selected period is empty but
       logged data exists outside it. Distinct from the first-use state
       (no data at all): it resets the filter instead of offering first
       steps. */
    function periodEmptyNote(bySets){
      return `${bySets?'No completed sets in this period.':'No weighted volume in this period.'} <button class="text-link" type="button" data-period-reset>View all time</button>`;
    }
    /* Wires the "View all time" filtered-void reset buttons in the Stats view. */
    function wirePeriodResets(){
      document.querySelectorAll('#statsView [data-period-reset]').forEach(button=>button.addEventListener('click',()=>{
        state.statsPeriod='all';schedulePersist();renderStats();window.scrollTo(0,0);
      }));
    }
    /* Compact stat numbers (user 2026-09-12, #149): huge totals stay in their
       third of the 3-card row by abbreviating — volume only at ≥1M ("1M+");
       below that the full total shows with thousands separators. Sets ≥10K
       shows "10K+". Tapping an abbreviated card toggles the true total in
       smaller text; tapping again restores. */
    function compactStat(value,tiers){
      const v=Math.round(value);
      for(const [threshold,divisor,suffix] of tiers){
        if(v>=threshold) return {short:Math.floor(v/divisor)+suffix+'+',full:v.toLocaleString()};
      }
      return {short:v.toLocaleString(),full:null};
    }
    /* Renders one stat card with the abbreviated value; tappable to reveal the exact total when one exists. */
    function statValuePanel(value,tiers,label){
      const c=compactStat(value,tiers);
      if(!c.full) return `<div class="stats-panel"><strong>${escapeHtml(c.short)}</strong><span>${escapeHtml(label)}</span></div>`;
      return `<button type="button" class="stats-panel stats-panel-link stat-toggle" data-short="${escapeHtml(c.short)}" data-full="${escapeHtml(c.full)}" aria-label="${escapeHtml(label)}: ${escapeHtml(c.full)}. Activate to show the exact total."><strong>${escapeHtml(c.short)}</strong><span>${escapeHtml(label)}</span></button>`;
    }
    /* Tappable abbreviated stat numbers (user 2026-09-12): the number's box
       is locked to its natural (abbreviated) height — measured once per
       render — so showing the full total can never move the label below or
       knock the number out of line with the other cards. The full total
       shrink-to-fits instead of cutting off. */
    function fitStatToggle(btn){
      const strong=btn.querySelector('strong');
      if(!strong)return;
      if(!strong.dataset.naturalH)strong.dataset.naturalH=strong.offsetHeight;
      strong.style.minHeight=strong.dataset.naturalH+'px';
      strong.style.fontSize='';
      let size=parseFloat(getComputedStyle(strong).fontSize)||14,guard=60;
      while(strong.scrollWidth>strong.clientWidth+1&&size>9&&guard--){
        size-=0.5;
        strong.style.fontSize=size+'px';
      }
    }
    /* Wires the abbreviated-stat tap-to-expand toggles under a root element. */
    function wireStatToggles(root){
      if(!root)return;
      root.querySelectorAll('.stat-toggle').forEach(btn=>{
        fitStatToggle(btn);
        btn.addEventListener('click',()=>{
          const show=btn.classList.toggle('show-full');
          btn.querySelector('strong').textContent=show?btn.dataset.full:btn.dataset.short;
          fitStatToggle(btn);
        });
      });
    }
    const VOLUME_TIERS=[[1e6,1e6,'M']], SETS_TIERS=[[1e4,1e3,'K']];    /* #99 B17: renderDashboard decomposed by pure code motion. The week date
       math moved verbatim into dashboardWeekModel; the calendar strip, summary
       line, program card, period tabs, at-a-glance stats, and recent-workout
       panel each moved verbatim into their own render/wire helper.
       renderDashboard only orchestrates the same steps in the same order and
       still returns the body-map hydration promise. */
    function dashboardWeekModel(now){
      const start=new Date(now);start.setHours(12,0,0,0);start.setDate(now.getDate()-((now.getDay()+6)%7)+(state.calendarWeekOffset*7));
      const end=new Date(start);end.setDate(start.getDate()+6);
      return {start,end};
    }
    /* Home streak (user 2026-09-19): consecutive calendar days with ≥1
       completed workout, anchored at today — or at yesterday when today has
       no workout yet (the streak stays alive until a full rest day breaks
       it). Future-dated logs never count. Pure so tests can pin it. */
    function shiftIsoDate(iso,deltaDays){
      const parts=String(iso).split('-').map(Number);
      const dt=new Date(parts[0],parts[1]-1,parts[2]);
      dt.setDate(dt.getDate()+deltaDays);
      return localIsoDate(dt);
    }
    /* Consecutive calendar days with ≥1 completed workout, anchored at today (or yesterday when today is empty); future logs never count. */
    function currentStreakDayCount(completed,todayIso){
      const days=new Set();
      for(const w of (completed||[])){
        const d=w&&w.date;
        if(typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<=todayIso)days.add(d);
      }
      let cursor=days.has(todayIso)?todayIso:shiftIsoDate(todayIso,-1);
      if(!days.has(cursor))return 0;
      let n=0;
      while(days.has(cursor)){n++;cursor=shiftIsoDate(cursor,-1);}
      return n;
    }
    /* #356: week-strip gesture thresholds. A tap with a small drift must
       still register as a tap — setPointerCapture on the strip retargets the
       gesture to the strip itself, swallowing the day-chip's click. Capture
       only engages once the movement is committed to a week-page swipe
       (same 45px bar as the swipe decision), so drifted taps fall through to
       the buttons. Pure so tests can pin it. */
    const WEEK_STRIP_SWIPE_PX=45;
    function weekStripCaptureAt(dx){return Math.abs(dx)>WEEK_STRIP_SWIPE_PX;}
    /* Swipe decision for the week strip: horizontal direction past the swipe threshold, 0 otherwise. */
    function weekStripSwipeDirection(dx,dy){return (Math.abs(dx)>WEEK_STRIP_SWIPE_PX&&Math.abs(dx)>Math.abs(dy))?Math.sign(dx):0;}
    /* #409: week-strip Intl formatters, hoisted (see comment at renderDashboardCalendar). */
    const DASH_MONTH_FMT=new Intl.DateTimeFormat('en-US',{month:'short'});
    const DASH_DAY_FMT=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'});
    const DASH_DATE_FMT=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'});
    const DASH_ARIA_FMT=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric'});
    const DASH_WEEKDAY_FMT=new Intl.DateTimeFormat('en-US',{weekday:'short'});
    /* One day chip's markup, extracted as a pure builder so tests can pin it
       without a DOM. opts: {date, iso, isToday, hasWorkout, selected}. */
    function dayChipHtml(opts){
      const cls='day-chip'+(opts.isToday?' today':'')+(opts.hasWorkout?' has-workout':'')+(opts.selected?' selected':'');
      return `<button type="button" class="${cls}" data-calendar-date="${opts.iso}" aria-pressed="${!!opts.selected}" aria-label="${DASH_ARIA_FMT.format(opts.date)}${opts.hasWorkout?' · Workout logged':''}"><span>${DASH_WEEKDAY_FMT.format(opts.date)}</span><strong>${opts.date.getDate()}</strong><em aria-hidden="true">${opts.hasWorkout?'<i></i>':''}</em></button>`;
    }
    /* Renders the Home week-strip calendar: month label, 7 day chips with workout dots/rest labels, and week paging + swipe gestures. */
    function renderDashboardCalendar(now,start,end){
      const strip=$('#weekStrip');
      const sameMonth=start.getMonth()===end.getMonth();
      /* #409: 21+ per-render Intl constructions (3 per day chip plus the
         label) dominated week-strip render — hoisted formatters. The 7
         per-day full-list filters are a single pass building a date set. */
      const startIso=localIsoDate(start), endIso=localIsoDate(end);
      const daysWithWorkouts=new Set();
      for(const w of (workoutState.completed||[]))if(w.date>=startIso&&w.date<=endIso)daysWithWorkouts.add(w.date);
      $('#calendarWeekLabel').textContent=sameMonth?`${DASH_MONTH_FMT.format(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`:`${DASH_DAY_FMT.format(start)} – ${DASH_DATE_FMT.format(end)}`;
      $('#nextWeek').disabled=state.calendarWeekOffset>=0;
      strip.innerHTML=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const iso=localIsoDate(d);return dayChipHtml({date:d,iso,isToday:d.toDateString()===now.toDateString(),hasWorkout:daysWithWorkouts.has(iso),selected:state.selectedDashboardDate===iso});}).join('');
      document.querySelectorAll('[data-calendar-date]').forEach(button=>button.addEventListener('click',()=>{const date=button.dataset.calendarDate;state.selectedDashboardDate=state.selectedDashboardDate===date?null:date;rerenderDashboardKeepingPlace('[data-calendar-date="'+date+'"]');}));
      $('#previousWeek').onclick=()=>{state.calendarWeekOffset-=1;state.selectedDashboardDate=null;rerenderDashboardKeepingPlace('#previousWeek');};
      $('#nextWeek').onclick=()=>{if(state.calendarWeekOffset<0){state.calendarWeekOffset+=1;state.selectedDashboardDate=null;rerenderDashboardKeepingPlace('#nextWeek');}};
      let weekSwipeStart=null;
      strip.onpointerdown=event=>{weekSwipeStart={x:event.clientX,y:event.clientY,id:event.pointerId};};
      strip.onpointermove=event=>{if(!weekSwipeStart||event.pointerId!==weekSwipeStart.id)return;if(weekStripCaptureAt(event.clientX-weekSwipeStart.x))strip.setPointerCapture?.(event.pointerId);};
      strip.onpointercancel=()=>{weekSwipeStart=null;};
      strip.onpointerup=event=>{if(!weekSwipeStart||event.pointerId!==weekSwipeStart.id)return;const dir=weekStripSwipeDirection(event.clientX-weekSwipeStart.x,event.clientY-weekSwipeStart.y);weekSwipeStart=null;if(dir>0)$('#previousWeek').click();else if(dir<0)$('#nextWeek').click();};
    }
    /* Renders the summary line under the calendar (selected-day count or "Go to this week") and retitles the recent-workouts card. */
    function renderDashboardSummary(selectedWorkouts,selectedIsFuture){
      if(state.selectedDashboardDate){const iso=state.selectedDashboardDate,label=formatLogDate(iso);const summaryText=selectedIsFuture?`${label} · Upcoming program`:`${label} · ${selectedWorkouts.length?`${selectedWorkouts.length} workout${selectedWorkouts.length===1?'':'s'}`:'No workouts'}`;$('#calendarSummary').innerHTML=`<span>${escapeHtml(summaryText)}</span>`;$('#dashRecentTitle').textContent=selectedIsFuture?'Upcoming':label;}else{const summary=$('#calendarSummary');if(state.calendarWeekOffset===0){summary.textContent='';}else{summary.innerHTML='<button type="button" class="link-button" id="gotoThisWeek">Go to this week.</button>';const go=$('#gotoThisWeek');if(go)go.addEventListener('click',()=>{state.calendarWeekOffset=0;state.selectedDashboardDate=null;rerenderDashboardKeepingPlace(null);});}$('#dashRecentTitle').textContent='Recent workouts';}
    }
    /* Renders the Home active-program card (or the create-program empty state). */
    function renderDashboardProgram(){
      const p=workoutState.activeProgram;
      if(!p){
        $('#dashboardProgram').innerHTML='<p>No active program yet. Build a training block when you’re ready.</p><button class="secondary-button" id="openDashboardProgram" type="button">Create program</button>';
        $('#openDashboardProgram').addEventListener('click',()=>showProgram());
        return;
      }
      /* #233 (user 2026-09-13): quick jump into the next program workout.
         #436 (user 2026-09-14): the quick jump is the same program-next
         card as the Workout tab's program button (kicker + title + meta +
         chevron), not a solid-green pill — the #417 ring is obsolete.
         User 2026-09-14: the quick jump lives at the top of Home
         (renderDashboardContinueProgram), not nested in this card. */
      const week=programWeek(p);
      $('#dashboardProgram').innerHTML=`<p><strong>${escapeHtml(p.name)}</strong><br>Week ${week} of ${p.length}<br><span class="section-note">${p.workouts.length} workouts in rotation</span></p><div class="dash-program-actions"><button class="secondary-button" id="openDashboardProgram" type="button">Open program</button></div>`;
      $('#openDashboardProgram').addEventListener('click',()=>showProgram());
    }
    /* #457 (user 2026-09-14): the next program workout, shared by the Home
       top slot and the empty-hero card. Null when there is no active program,
       no next workout, or a live draft (the live session owns the top slot). */
    function dashboardNextWorkout(){
      const p=workoutState.activeProgram;
      const next=(p&&!workoutState.draft)?suggestedProgramWorkout(p):null;
      return next?{p,next}:null;
    }
    /* Markup for the "Continue program" quick-jump card (kicker, next workout name, week/exercise meta, chevron). */
    function continueProgramCardHtml(p,next,btnId){
      const week=programWeek(p);
      const exCount=next?.template?.exercises?.length||0;
      return `<button class="program-next-main" id="${btnId}" type="button"><span><span class="program-next-kicker">Continue program</span><strong>${escapeHtml(next.name||'next workout')}</strong><small>Week ${week} · ${exCount} exercise${exCount===1?'':'s'} · ${escapeHtml(programWorkoutRangeLabel(p,next,week))}</small></span><span class="program-next-arrow" aria-hidden="true">›</span></button>`;
    }
    /* User 2026-09-14: the Continue-program quick jump sits at the top of
       Home (below the week strip, under the Workout-in-progress card), not
       nested inside the Active program card. Shown only when no live draft
       exists — a live session already owns the top slot.
       #457: when the empty hero already embeds the card (fresh account with
       an active program), this standalone slot stays hidden — no duplicate. */
    function renderDashboardContinueProgram(){
      const slot=$('#dashboardContinueProgram');if(!slot)return;
      /* #457: the empty hero embeds the same card (id="startHeroNext") when
         an active program has a next workout — the standalone slot stays
         hidden so the card doesn't show twice. Checking the hero's own
         markup (not the whole document) keeps this honest. */
      const heroHtml=$('#dashEmptyHero')?.innerHTML||'';
      if(heroHtml.includes('id="startHeroNext"')){slot.innerHTML='';slot.hidden=true;return;}
      const found=dashboardNextWorkout();
      if(!found){slot.innerHTML='';slot.hidden=true;return;}
      const {p,next}=found;
      slot.hidden=false;
      slot.innerHTML=continueProgramCardHtml(p,next,'startDashboardNext');
      $('#startDashboardNext').addEventListener('click',()=>startProgramWorkout(p,next));
    }
    /* #491: calendar taps re-render the whole dashboard, destroying the
       tapped control while it has focus — the iOS focus-drop scroll jump.
       Same guard as the dashboard period tabs below: blur the tapped
       control, pin the scroll position across the render, and refocus the
       control's replacement (when it survives the render) with
       preventScroll. The body-map SVG hydrates async, so the scroll restore
       waits a frame like the period tabs do. */
    function rerenderDashboardKeepingPlace(refocusSel){
      const scrollY=window.scrollY;
      const focused=document.activeElement;
      if(focused&&focused!==document.body)focused.blur();
      const restoreScroll=()=>requestAnimationFrame(()=>window.scrollTo(0,scrollY));
      const hyd=renderDashboard();
      if(hyd&&hyd.then)hyd.then(restoreScroll,restoreScroll);else restoreScroll();
      if(refocusSel)document.querySelector(refocusSel)?.focus({preventScroll:true});
    }
    /* Renders the Home period tabs and wires period switching with scroll-restore + focus guard. */
    function wireDashboardPeriodTabs(){
      $('#dashPeriodTabs').innerHTML=periodTabs('data-dash-period',state.dashboardPeriod);
      document.querySelectorAll('[data-dash-period]').forEach(button=>button.addEventListener('click',()=>{
        if(state.dashboardPeriod===button.dataset.dashPeriod)return;
        state.dashboardPeriod=button.dataset.dashPeriod;schedulePersist();
        const scrollY=window.scrollY;
        /* Different periods render different content heights — restore the
           scroll position so the page doesn't jump (user 2026-09-11).
           The body-map SVG hydrates async, so wait for it before restoring. */
        const restoreScroll=()=>requestAnimationFrame(()=>window.scrollTo(0,scrollY));
        const hyd=renderDashboard();
        if(hyd&&hyd.then)hyd.then(restoreScroll,restoreScroll);else restoreScroll();
        /* The re-render destroys the tapped button; refocus its replacement so iOS
           Safari doesn't drop focus to <body> and scroll to the top (user 2026-09-10). */
        document.querySelector('[data-dash-period="'+state.dashboardPeriod+'"]')?.focus({preventScroll:true});
      }));
    }
    /* #195 (user 2026-09-12): the At-a-glance Workouts card opens the logs
       list filtered to the dashboard's selected period. */
    function openLogsForDashboardPeriod(){
      state.logPeriod=state.dashboardPeriod||'week';
      schedulePersist();
      showWorkouts(false);showWorkoutHistory();
    }
    /* Renders the Home At-a-glance cards (workouts/sets/volume), muscle pills, heat map, and streak. Returns the body-map hydration promise. */
    function renderDashboardStats(){
      const periodWorkouts=workoutsForPeriod(state.dashboardPeriod), periodSets=periodWorkouts.flatMap(w=>w.exercises.flatMap(e=>(e.sets||[]).map(set=>({set,ex:exerciseById(e.exerciseId)})))), volume=periodSets.reduce((n,{set,ex})=>n+setVolume(set,ex),0); /* #498: non-volume work contributes zero */
      const periodLabel=PERIOD_LABELS[state.dashboardPeriod]||'';
      $('#dashboardStats').innerHTML=`<button class="stats-panel stats-panel-link" id="dashWorkoutsCard" type="button" aria-label="View workout logs for ${escapeHtml(periodLabel)}"><strong>${periodWorkouts.length}</strong><span>${periodWorkouts.length===1?'Workout':'Workouts'}</span></button>${statValuePanel(periodSets.length,SETS_TIERS,periodSets.length===1?'Set':'Sets')}${statValuePanel(displayVolume(volume),VOLUME_TIERS,`Volume (${weightUnit()})`)}`;
      $('#dashWorkoutsCard').onclick=openLogsForDashboardPeriod;
      wireStatToggles($('#dashboardStats'));
      const muscles=muscleCounts(periodWorkouts),volumes=muscleVolumes(periodWorkouts);$('#dashboardMuscles').innerHTML=Object.keys(muscles).length?Object.entries(muscles).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([m,n])=>musclePill(m,` · ${n}`)).join(''):'<span class="section-note">No muscles logged in this period.</span>';
      $('#dashboardHeatmap').innerHTML=muscleHeatmapMarkup(volumes,workedMuscles(periodWorkouts),true);
      const dashHydration=hydrateBodyMaps();
      renderBlindspots(volumes,workedMuscles(periodWorkouts),'#dashBlindspots');
      /* Home streak (user 2026-09-19): consecutive training days in the
         At-a-glance header — only when the streak is ≥ 2 days. */
      const streakEl=$('#dashStreak');
      if(streakEl){
        const streak=currentStreakDayCount(workoutState.completed,localIsoDate());
        if(streak>=2){streakEl.hidden=false;streakEl.innerHTML=`<strong>${streak}-day streak</strong><small>Current streak</small>`;}
        else{streakEl.hidden=true;streakEl.innerHTML='';}
      }
      return dashHydration;
    }
    /* User 2026-09-14: fresh profiles (no workout data) get an empty-state
       hero at the top of Home — a Start-workout card in the same
       program-next styling as the Active-program quick jump, and a bold
       guide link (new tab).
       #504 (v1.8): the headline states the state with the value explanation
       under it, per the empty-state copy rules. #506 (v1.8): the headline is
       the onboarding flow's "Ready?" — the flow lands here on completion. */
    /* #457 (user 2026-09-14): pure hero builder so the card order is
       unit-testable. Order: Ready? → Continue program (when an
       active program has a next workout) → Log your first workout →
       Set up your first program (#449: no active program yet) →
       See how it works. */
    /* user 2026-09-16: the Home empty state speaks the Workout tab's
       no-data card register (section.training-hero) — a heading that states
       the state, one short description, the primary workout action, then the
       option cards. Workout and Program stay first-class options: the
       primary button starts a blank workout, the option cards carry the
       program-continue card (active program) and the Create-a-program card
       (no program yet). Order: heading → primary action → option cards →
       See how it works. */
    function dashEmptyHeroHtml({starterCardHtml,continueCardHtml,programCardHtml}){
      /* #457: the Continue-program card sits directly under the heading,
         above the Start-workout action — the program workout is the primary
         action when one is due. */
      const options=programCardHtml
        ?`<div class="workout-start-options">${programCardHtml}</div>`
        :'';
      return `<section class="training-hero"><h2>No workouts yet</h2>`
        +`<p>Your training week, program, and progress will live here.</p>`
        +(continueCardHtml||'')
        +`<div class="training-hero-actions">${starterCardHtml}</div>`
        +options
        +`<p class="dash-empty-guide"><strong><a href="https://cruciferousgreens.com/getting-started" target="_blank" rel="noopener">See how it works</a></strong></p></section>`;
    }
    /* Renders the fresh empty-state hero (Start workout / Continue program / Create program), hidden once any workout is logged. */
    function renderDashEmptyHero(){
      const hero=$('#dashEmptyHero');if(!hero)return;
      const view=$('#dashboardView');
      /* #437 (user 2026-09-14): fresh empty profiles see ONLY the hero — the
         calendar strip and the dashboard cards below stay hidden until the
         first workout is logged. */
      if(workoutState.completed.length){
        hero.hidden=true;hero.innerHTML='';
        if(view)view.classList.remove('dash-is-empty');
        return;
      }
      if(view)view.classList.add('dash-is-empty');
      hero.hidden=false;
      /* User 2026-09-14: when a live draft exists, the hero's starter card IS
         the Workout-in-progress card (the same green card as Home/Workout
         tab) — the Blank-workout starter would clobber the live session. */
      const liveDraft=(workoutState.draft&&workoutState.draft.exercises)?workoutState.draft:null;
      /* user 2026-09-16: the hero's primary action is the Workout option — a
         blank-workout button in the Workout tab's no-data register. A live
         draft keeps priority and the starter IS the Workout-in-progress
         card (the Blank-workout starter would clobber the live session). */
      const starterCard=liveDraft
        ?`<button class="continue-workout-card" id="heroWorkoutInProgress" type="button" aria-label="Continue ${escapeHtml(liveDraft.name||'workout')}">${continueWorkoutCardHtml(liveDraft,draftProgramLine(liveDraft))}</button>`
        :`<button class="primary-button" id="startFirstWorkout" type="button">Start blank workout</button>`;
      /* #457: with an active program + next workout, the Continue-program
         card sits directly under "Ready?", above the Start-workout card —
         the program workout is the primary action. (A live draft implies no
         next workout, so this never doubles the WIP card.) */
      const progNext=dashboardNextWorkout();
      const continueCardHtml=progNext?continueProgramCardHtml(progNext.p,progNext.next,'startHeroNext'):'';
      /* #449 (user 2026-09-14): fresh profile with no program yet — the
         Program option is a "Create a program" option card in the Workout
         tab's no-data register ("Create a program / Structure your training
         into a plan."), sitting in the hero's option grid. Skipped when an
         active program already exists (its Continue card already owns that
         slot). */
      const programCardHtml=workoutState.activeProgram?'':`<button class="start-option" id="startHeroProgramSetup" type="button"><strong>Create a program</strong><span>Structure your training into a plan.</span></button>`;
      hero.innerHTML=dashEmptyHeroHtml({starterCardHtml:starterCard,continueCardHtml,programCardHtml});
      /* #457: the hero's continue card starts the program workout. */
      if(progNext)$('#startHeroNext')?.addEventListener('click',()=>startProgramWorkout(progNext.p,progNext.next));
      /* #449: the hero's program card opens the program builder (no active
         program → the setup form shows). */
      if(!workoutState.activeProgram)$('#startHeroProgramSetup')?.addEventListener('click',()=>showProgram());
      /* #154: the first-run one-tap start — the hero owns it now. */
      $('#startFirstWorkout')?.addEventListener('click',()=>{showWorkouts();startBlankWorkout();});
      /* The hero's workout card returns straight to the live session. */
      $('#heroWorkoutInProgress')?.addEventListener('click',()=>{showWorkouts();state.workoutEditorOpen=true;renderWorkoutScreen();window.scrollTo({top:0});});
    }
    /* User 2026-09-14: Home shows a "Workout in progress" card whenever a
       live session is active — tapping it returns to the workout. */
    /* User 2026-09-14: ONE card builder for the live session, shared by Home
       and the Workout start screen. The two renderers had drifted apart (Home
       counted set.done, Workout counted set.complete), so the X/N sets line
       disagreed between pages. Both pages render this exact builder — the
       long-standing green continue card (kicker, title, program line, counts,
       arrow) — and both pass draftProgramLine(draft), the draft's own program
       line, so the cards are identical. */
    function continueWorkoutCardHtml(draft,programLine){
      const exCount=(draft.exercises||[]).length;
      let totalSets=0,doneSets=0;
      (draft.exercises||[]).forEach(item=>{
        (item.sets||[]).forEach(set=>{
          totalSets++;
          if(set.complete)doneSets++;
        });
      });
      const subtitle=exCount
        ? `${exCount} exercise${exCount===1?'':'s'} · ${doneSets}/${totalSets} sets done`
        : 'Empty draft — tap to add exercises';
      return `<span><span class="continue-kicker">Workout in progress</span>`
        + `<strong>${escapeHtml(draft.name||'Workout')}</strong>`
        + (programLine?`<small class="continue-program">${programLine}</small>`:'')
        + `<small>${escapeHtml(subtitle)}</small></span>`
        + `<span class="continue-arrow" aria-hidden="true">›</span>`;
    }
    /* Shows the "Workout in progress" continue card on Home whenever a live draft exists. */
    function renderWorkoutInProgressCard(){
      const card=$('#workoutInProgressCard');if(!card)return;
      const draft=workoutState.draft;
      /* #443 (user 2026-09-14): surface the card for ANY live draft, even an
         empty one — an untouched blank workout still counts as in progress.
         User 2026-09-14: on the empty-data screen the hero renders the
         workout card itself — don't show it twice. */
      if(!draft||!draft.exercises||!(workoutState.completed||[]).length){
        card.hidden=true;
        return;
      }
      /* User 2026-09-14: Home shows the long-standing green continue card —
         kicker, title, program line, counts, arrow — the same card as the
         Workout start screen. */
      /* draftProgramLine (workout-editor.js): the draft's own program line —
         identical to the Workout start screen's. (A previous version gated on
         a getActiveProgram() helper that no longer exists, so the Home
         program line silently never rendered.) */
      const programLine=draftProgramLine(draft);
      card.innerHTML=continueWorkoutCardHtml(draft,programLine);
      card.hidden=false;
      if(!card.dataset.wired){
        card.dataset.wired='1';
        card.addEventListener('click',()=>{
          /* Mirror the Live chip: land straight in the editor, not the
             start screen. */
          showWorkouts();
          state.workoutEditorOpen=true;
          renderWorkoutScreen();
          window.scrollTo({top:0});
        });
      }
    }
    /* Renders the Home recent-workouts card: selected day's logs (or the upcoming-program card for future dates), plus "See all". */
    function renderDashboardRecent(selectedWorkouts,selectedIsFuture){
      const selDate=state.selectedDashboardDate, todayIso=localIsoDate();
      /* #4: future dates render the upcoming program workout (see
         upcomingProgramMarkup) instead of the dead "nothing logged" note. */
      const futureDateCopy=selectedIsFuture?upcomingProgramMarkup(selDate):'';
      const emptyDateCopy=futureDateCopy||(selDate===todayIso?'<p>No workout logged yet today. <button class="filter-clear" id="startSelectedDateWorkout" type="button">Start workout</button></p>':'<p>No workout logged for this date. <button class="filter-clear" id="startSelectedDateWorkout" type="button">Log a workout</button></p>');
      /* User 2026-09-14: with zero completed workouts the start CTA lives
         in the "Ready?" hero, so the recent card keeps just the note. */
      $('#dashboardRecent').innerHTML=selectedWorkouts.length?selectedWorkouts.map(w=>{const setCount=w.exercises.flatMap(e=>e.sets).length;const detail=state.selectedDashboardDate?`${w.exercises.length} exercise${w.exercises.length===1?'':'s'} · ${setCount} set${setCount===1?'':'s'}`:null;return recentWorkoutButton(w,'data-workout-id',detail);}).join(''):state.selectedDashboardDate?emptyDateCopy:'<p>No logs yet.</p>';
      document.querySelectorAll('[data-workout-id]').forEach(b=>b.addEventListener('click',()=>{state.workoutDetailReturn=ROUTES.DETAIL_RETURN.DASHBOARD;showWorkouts(false);renderCompletedWorkout(workoutState.completed.find(w=>w.id===b.dataset.workoutId),{push:true});}));
      $('#startSelectedDateWorkout')?.addEventListener('click',()=>{const date=state.selectedDashboardDate;showWorkouts();startBlankWorkout();workoutState.draft.date=date;renderWorkoutScreen();});
      /* #154: the first-run one-tap start moved into the "Ready?" hero
         (wired in renderDashEmptyHero) — the recent card keeps just the
         note when there is nothing to list. */
      /* User 2026-09-12: "See all" on the recent-workouts card jumps to the
         full workout logs (same destination as the Stats card, #128). */
      $('#seeAllWorkouts').onclick=()=>{showWorkouts(false);showWorkoutHistory();};
      /* #4: one-tap start for the upcoming program workout shown on future dates. */
      /* #559: the button carries the displayed week so the started workout
         inherits that week's ranges, not the current week's. */
      $('#startUpcomingProgramWorkout')?.addEventListener('click',(e)=>{const program=workoutState.activeProgram,next=program&&suggestedProgramWorkout(program);if(program&&next)startProgramWorkout(program,next,e.currentTarget?.dataset?.upcomingWeek);});
    }
    /* Renders the Home tab: hydration gate, calendar, summary, program card, period tabs, stats, hero, WIP card, continue-program, recent. Returns the body-map hydration promise. */
    function renderDashboard() {
      /* v1.877 (user 2026-09-21): Home hydration gate — never render cards
         from unhydrated state. Until the boot restore completes
         (state.homeHydrated), keep the neutral skeleton; the real render
         runs only after data readiness. */
      if(!state.homeHydrated){paintHomeSkeleton();return null;}
      /* v1.877: real render — clear the boot skeleton markers. */
      const viewEl=$('#dashboardView');
      if(viewEl){delete viewEl.dataset.homeSkel;viewEl.removeAttribute('aria-busy');}
      for(const id of ['dashEmptyHero','dashboardStats','dashboardRecent']){
        const el=document.getElementById(id);if(el)el.removeAttribute('aria-busy');
      }
      const now=new Date();
      const {start,end}=dashboardWeekModel(now);
      /* User 2026-09-22: the Home calendar is back on — show the section and
         render it. (While it was hidden, a leftover selectedDashboardDate
         would have invisibly filtered Home content, so it was cleared; the
         clear below only runs while the feature is off.) */
      for(const sel of ['#dashboardView .calendar-toolbar','#weekStrip']){const el=document.querySelector(sel);if(el)el.hidden=!HOME_CALENDAR_ENABLED;}
      if(HOME_CALENDAR_ENABLED)renderDashboardCalendar(now,start,end);
      if(!HOME_CALENDAR_ENABLED){state.selectedDashboardDate=null;state.calendarWeekOffset=0;}
      /* #544 (user 2026-09-17): Home's recent-4 follows workout-date recency
         (isoDate-first, #274's rule) like the Logs list — a late-logged or
         backfilled entry sits by when the workout happened, not when it was
         saved; completedAt only breaks same-day ties. Supersedes #273's
         completedAt-first for this list. Repeat-last keeps completedAt-first
         (#99 A13) — it's "the workout just finished", not a date list. */
      const selectedWorkouts=state.selectedDashboardDate?workoutState.completed.filter(w=>w.date===state.selectedDashboardDate):workoutState.completed.slice().sort(sortByWorkoutDateDesc).slice(0,4);
      /* #4: future dates show the upcoming program workout instead of history. */
      const selectedIsFuture=!!state.selectedDashboardDate&&state.selectedDashboardDate>localIsoDate();
      renderDashboardSummary(selectedWorkouts,selectedIsFuture);
      renderDashboardProgram();
      wireDashboardPeriodTabs();
      const dashHydration=renderDashboardStats();
      renderDashEmptyHero();
      renderWorkoutInProgressCard();
      renderDashboardContinueProgram();
      renderDashboardRecent(selectedWorkouts,selectedIsFuture);
      return dashHydration;
    }
    /* Muscle blindspots: library muscles with zero weighted volume in the
       period, always visible as dashed pills (user 2026-09-10 — no toggle).
       #13 (user 2026-09-11): sectioned out — a horizontal divider, then a
       "Blind spots" label, then the pills. Shared by the Stats muscle map
       and the Home At-a-glance card. */
    /* #194 (user 2026-09-12): blind spots are muscles with NO work at all in
       the period — bodyweight sets count as work even though their volume
       is 0. Pure so tests can pin it. */
    function blindspotMuscles(volumes,worked){
      const allMuscles=[...new Set(exercises.flatMap(ex=>[...(ex.primary||[]),...(ex.secondary||[])].map(m=>String(m).toLowerCase())))].sort();
      return allMuscles.filter(m=>!volumes[m]&&!(worked&&worked.has(m)));
    }
    /* Renders the "Blind spots" section (library muscles with no work in the
       period). B2 (pixel-peeper PP2): reuses the Home muscle chip
       (musclePill → .tag.primary) with an explicit 0 count, instead of the
       dim gray dashed pills. */
    function renderBlindspots(volumes,worked,wrapSelector){
      const wrap=$(wrapSelector||'#blindspotWrap');if(!wrap)return;
      const missing=blindspotMuscles(volumes,worked);
      if(!missing.length){wrap.innerHTML='';return;}
      wrap.innerHTML=`<div class="blindspot-section"><hr class="blindspot-rule"><p class="blindspot-label">Blind spots</p><div class="tag-row blindspot-list">${missing.map(m=>musclePill(titleCase(m),' · 0')).join('')}</div></div>`;
    }
    /* #409 (user 2026-09-14): Stats loading skeleton — prevents layout shift
       on first open and during cloud-merge re-renders. paintStatsSkeleton()
       writes the skeleton synchronously; the real renderStats() runs on a
       later frame so the skeleton actually paints first. Fixed heights match
       the real cards so hydration doesn't move the layout. */
    function statsSkeletonHtml(){
      const statCard='<div class="stats-panel skel-stat-card" aria-hidden="true"><span class="skel skel-stat-num"></span><span class="skel skel-stat-label"></span></div>';
      const rows=n=>Array.from({length:n},()=>'<div class="skel skel-row" aria-hidden="true"></div>').join('');
      return {statsGrid:statCard.repeat(3),
        muscleHeatmap:'<div class="skel skel-map" aria-hidden="true"></div>',
        muscleStats:'<div class="skel skel-line" style="width:60%" aria-hidden="true"></div>',
        muscleVolumeBreakdown:rows(5), topExercises:rows(4), recentPRs:rows(4), muscleTrends:rows(5)};
    }
    /* #409 (user 2026-09-14): the skeleton paints only until the first real
       render — repeat visits re-render synchronously over existing content,
       so there's no shimmer flash and no deferred frame on every tab open. */
    let statsHydrated=false;
    function paintStatsSkeleton(){
      const skel=statsSkeletonHtml();
      for(const id of Object.keys(skel)){
        const el=document.getElementById(id);
        if(el){el.innerHTML=skel[id];el.setAttribute('aria-busy','true');}
      }
    }
    /* v1.877 (user 2026-09-21): Home boot skeleton — paints synchronously
       before the async restore so first paint is a truthful loading state,
       not empty containers or stale cards. Uses the shared .skel shimmer.
       Cleared by the first real renderDashboard() once state.homeHydrated. */
    function paintHomeSkeleton(){
      const view=$('#dashboardView');if(!view||view.dataset.homeSkel==='1')return;
      view.dataset.homeSkel='1';
      const hero=$('#dashEmptyHero');
      if(hero){hero.hidden=false;hero.innerHTML='<div class="skel skel-title" aria-hidden="true"></div><div class="skel skel-line" style="width:75%;margin-top:10px" aria-hidden="true"></div><div class="skel skel-btn" style="margin-top:14px" aria-hidden="true"></div>';hero.setAttribute('aria-busy','true');}
      const stats=$('#dashboardStats');
      if(stats){stats.innerHTML='<div class="skel skel-stat-card" aria-hidden="true"><span class="skel skel-stat-num"></span><span class="skel skel-stat-label"></span></div>';stats.setAttribute('aria-busy','true');}
      const recent=$('#dashboardRecent');
      if(recent){recent.innerHTML='<div class="skel skel-row" aria-hidden="true"></div><div class="skel skel-row" style="margin-top:8px" aria-hidden="true"></div>';recent.setAttribute('aria-busy','true');}
      view.setAttribute('aria-busy','true');
    }
    /* Renders the Stats tab: period tabs, stat cards, muscle map + toggle, breakdown, top exercises, recent PRs, trends. */
    function renderStats() {
      /* #409: a skeleton may be showing (first open / cloud-merge swap) —
         the real render replaces it and clears the busy flags. */
      for(const id of ['statsGrid','muscleHeatmap','muscleStats','muscleVolumeBreakdown','topExercises','recentPRs','muscleTrends']){
        document.getElementById(id)?.removeAttribute('aria-busy');
      }
      $('#statsPeriodTabs').innerHTML=periodTabs('data-stats-period',state.statsPeriod);
      document.querySelectorAll('[data-stats-period]').forEach(button=>button.addEventListener('click',()=>{
        if(state.statsPeriod===button.dataset.statsPeriod)return;
        state.statsPeriod=button.dataset.statsPeriod;schedulePersist();renderStats();
        /* Same focus-drop scroll-to-top guard as the dashboard tabs (user 2026-09-10). */
        document.querySelector('[data-stats-period="'+state.statsPeriod+'"]')?.focus({preventScroll:true});
      }));
      const workouts=workoutsForPeriod(state.statsPeriod), sets=workouts.flatMap(w=>w.exercises.flatMap(e=>(e.sets||[]).map(set=>({set,ex:exerciseById(e.exerciseId)})))), volume=sets.reduce((n,{set,ex})=>n+setVolume(set,ex),0); /* #498 */
      /* #504 (v1.8): first-use empty state — one explained state with direct
         actions, replacing the five dead-end "No … in this period." notes
         for accounts with no logged workouts at all. */
      const hasAnyData=(workoutState.completed||[]).length>0;
      const statsEmptyHost=$('#statsEmpty');
      if(!hasAnyData){
        if(statsEmptyHost){
          statsEmptyHost.hidden=false;
          statsEmptyHost.innerHTML=emptyStateHtml({
            title:'No stats yet',
            description:'Charts, volume, and muscle maps appear after your first logged workout.',
            primaryHtml:emptyStatePrimary('statsEmptyStart','Log a workout'),
            secondaryHtml:emptyStateSecondary('statsEmptyBrowse','Browse exercises')
          });
          $('#statsEmptyStart')?.addEventListener('click',()=>{showWorkouts();startBlankWorkout();});
          $('#statsEmptyBrowse')?.addEventListener('click',()=>showLibrary());
        }
        $('#statsView')?.classList.add('stats-is-empty');
        statsHydrated=true;
        return;
      }
      $('#statsView')?.classList.remove('stats-is-empty');
      if(statsEmptyHost){statsEmptyHost.hidden=true;statsEmptyHost.innerHTML='';}
      /* User 2026-09-12 (#128): the Completed-workouts stat is the Stats-tab
         door to the workout logs — tapping it jumps to the full list. */
      $('#statsGrid').innerHTML=`<button class="stats-panel stats-panel-link" id="statsCompletedWorkouts" type="button"><strong>${workouts.length}</strong><span>${workouts.length===1?'Workout':'Workouts'}</span></button>${statValuePanel(sets.length,SETS_TIERS,sets.length===1?'Set':'Sets')}${statValuePanel(displayVolume(volume),VOLUME_TIERS,`Volume (${weightUnit()})`)}`;
      $('#statsCompletedWorkouts').onclick=()=>{
        /* #330 (user 2026-09-13): logs opened from Stats filter to Stats'
           selected period — mirror the dashboard card (#195), which sets
           logPeriod from dashboardPeriod. */
        state.logPeriod=state.statsPeriod||'week';
        schedulePersist();
        showWorkouts(false);showWorkoutHistory();
      };
      wireStatToggles($('#statsGrid'));
      /* #409: one shared single-pass aggregation for every consumer below —
         muscle heatmap, blind spots, breakdown and (via wrappers) the muscle
         cards. Was 5+ separate scans per render. */
      const agg=aggregateMuscleStats(workouts), muscles=agg.counts, volumes=agg.volumes, worked=agg.worked;
      /* #319 (user 2026-09-13): the muscle map has its OWN Volume|Sets toggle
         (independent of the Volume-by-muscle list toggle below it).
         #323: the volume option is labeled Volume, not Weight. */
      const mapBySets=state.muscleMapMode==='sets';
      document.querySelectorAll('#muscleMapMode [data-map-mode]').forEach(btn=>{
        btn.setAttribute('aria-pressed',String(btn.dataset.mapMode===(mapBySets?'sets':'volume')));
        btn.onclick=()=>{const mode=btn.dataset.mapMode;if(state.muscleMapMode===mode)return;const y=window.scrollY;state.muscleMapMode=mode;renderStats();window.scrollTo(0,y);};
      });
      $('#muscleHeatmap').innerHTML=muscleHeatmapMarkup(mapBySets?agg.setCounts:volumes,worked,false,mapBySets,true);hydrateBodyMaps();
      /* #322 (user 2026-09-12): the set-count chips under the stats muscle map
         are gone — the map stands alone. */
      $('#muscleStats').innerHTML=Object.keys(muscles).length?'':(workouts.length?'<p class="section-note">Complete a workout to start building muscle-level stats.</p>':`<p class="section-note">${periodEmptyNote(true)}</p>`);
      renderBlindspots(volumes,worked);
      renderMuscleAnalysis(workouts,state.statsPeriod);
      /* #504: wire the filtered-void "View all time" resets after every
         stats render. */
      wirePeriodResets();
      /* #126 (user 2026-09-11): Weekly volume chart removed from Stats. */
      statsHydrated=true;
    }
    /* #7: which exercises drove a muscle's volume in the period (primary =
       full set volume, secondary = SECONDARY_MUSCLE_WEIGHT, matching muscleVolumes). */
    function exercisesForMuscle(muscle, workouts, bySets=false) {
      const m=String(muscle).toLowerCase(), stats={};
      workouts.forEach(w=>w.exercises.forEach(item=>{
        const ex=exerciseById(item.exerciseId); if(!ex)return;
        const lower=a=>(a||[]).map(s=>String(s).toLowerCase());
        const isPrimary=lower(ex.primary).includes(m), isSecondary=lower(ex.secondary).includes(m);
        if(!isPrimary&&!isSecondary)return;
        const vol=item.sets.reduce((sum,s)=>sum+setVolume(s,ex),0)*(isPrimary?1:SECONDARY_MUSCLE_WEIGHT); /* #498: non-volume work contributes zero */
        /* #539: merge variant history under the canonical id. */
        const cid=(typeof canonicalExerciseId==='function')?canonicalExerciseId(item.exerciseId):item.exerciseId;
        const entry=stats[cid]||(stats[cid]={volume:0,sets:0,bodyweight:ex.equipment==='body only'});
        entry.volume+=vol; entry.sets+=item.sets.length;
      }));
      /* #7 drill-down: in Sets mode bodyweight work (volume 0, sets > 0)
         must still appear, and drivers sort by the active metric.
         #170 (user 2026-09-14): in volume mode only UNWEIGHTED bodyweight
         drivers rank by sets — added load is real volume. */
      const drillMetric=e=>bySets?e.sets:((e.bodyweight&&!(e.volume>0))?e.sets:e.volume);
      return Object.entries(stats).filter(([,e])=>drillMetric(e)>0).sort((a,b)=>drillMetric(b[1])-drillMetric(a[1])).slice(0,4);
    }
    /* #7: muscle drill-down expansion state (session-only). */
    let expandedMuscle=null;
    