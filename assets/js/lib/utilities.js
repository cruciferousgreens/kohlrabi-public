
/* ===== module: utilities.js ===== */
    /** Shared DOM, formatting, ID, and date helpers used by the feature modules below. */
    /* Module map (v1.006) — Key: $, escapeHtml(), uid/new*Id(), localIsoDate(), cloneSetFields()/cloneExerciseSets(). Depends on: none (loads right after catalog; everything below builds on it).
       v1.878: displayWeight()/storageWeight()/isMetric()/weightUnit() → formulas/units.js; setVolume()/displayVolume() → formulas/volume.js; detectExercisePRs()/detectTimedPRs()/detectBodyweightPRs()/PR_E1RM_TOLERANCE → formulas/prs.js; emptyStateHtml() → components/empty-states.js. This module still CALLS displayWeight()/storageWeight() — they're defined in formulas/units.js. */
    /* #161 (user 2026-09-12): freeze rule — once a set is checked complete its
       form inputs are read-only until the set is un-checked; the only actions
       on a completed set are un-complete and delete. Single source of truth:
       the live set-row renderer (workout-editor.js liveExerciseCardHtml) and
       the checkbox toggle (wireLiveCompleteSet) both derive the frozen state
       from this helper, so render and toggle can never disagree. */
    function setIsFrozen(set){return !!set&&set.complete===true;}
    const $ = (s) => document.querySelector(s);
    const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const tokenize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
    /* Query synonyms as alternative phrases: an exact-key query scores each phrase
       separately and takes the best, so "ohp" ranks "Barbell Shoulder Press"
       (via "shoulder press") above names that merely stack more synonym words.
       Ties break toward the name closest to the bare phrase (fewest extra
       words), so the canonical lift outranks "Alternating Cable …". */
    const searchSynonyms = {
      'knee extension':['leg extension'], 'knee extensions':['leg extension'], 'quad extension':['leg extension'],
      'smith bench':['smith machine bench press'], 'smith press':['smith machine bench press'],
      'ohp':['overhead press','military press','shoulder press'], 'overhead press':['overhead press','military press','shoulder press'],
      'rdl':['romanian deadlift'], 'lat pull down':['lat pulldown'],
      'pull up':['pullup','chinup'], 'rear delt':['reverse fly','posterior deltoid'], 'calf raise':['calf raise']
    };
    /* Levenshtein edit distance for fuzzy name matching. */
    function levenshtein(a,b){const m=a.length,n=b.length,row=Array.from({length:n+1},(_,i)=>i);for(let i=1;i<=m;i+=1){let prev=row[0];row[0]=i;for(let j=1;j<=n;j+=1){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[n];}
    /* Canonical muscle vocabulary: the pickers derive options from exercise
       data, but the user's own vocabulary may include muscles no exercise
       uses yet (user 2026-09-12: "upper back" as an option). Unioned into
       every muscle picker so it's always selectable, e.g. for custom
       exercises. */
    /* #136: rhomboids + the three delt heads are selectable vocabulary (custom
       exercises, filters) even though no stock exercise names them. */
    const EXTRA_MUSCLES=['upper back','rhomboids','front delts','side delts','rear delts'];
    /* Every muscle named in the library (primary + secondary), deduped and sorted. */
    function allMuscleOptions(){
      /* A8 (#99): soft-deleted customs stay in the store but leave the filter UI. */
      return [...new Set([...exercises.filter(x=>!exerciseDeleted(x)).flatMap(x=>[...(x.primary||[]),...(x.secondary||[])]),...EXTRA_MUSCLES])].filter(Boolean).sort();
    }
    /* Scores an exercise against a search phrase (exact/prefix/substring/token tiers). */
    function phraseScore(ex,phrase){
      const qTokens=tokenize(phrase), normQ=normalize(phrase);
      const name=ex.name.toLowerCase(), normName=normalize(ex.name);
      const haystack=[ex.name,ex.id,...ex.primary,...ex.secondary,ex.equipment].join(' ').toLowerCase();
      /* #155: normalized exact tier — "push up" and "Pushups" differ only by
         spacing/punctuation, so they must count as the same query. A lone
         trailing "s" is also ignored ("Pushups" is exact for "push up"). */
      const pluralExact=normQ.length>2&&normName.length>2&&(normName===normQ+'s'||normQ===normName+'s');
      if(normQ&&(normName===normQ||pluralExact))return 100;
      if(name===phrase)return 100;
      /* Normalized prefix tier — "pushup…" outranks any partial-token hit. */
      if(normQ&&normName.startsWith(normQ))return 85;
      if(phrase&&name.includes(phrase))return 80;
      if(phrase&&haystack.includes(phrase))return 75;
      const words=tokenize(haystack); let score=0,matched=0;
      qTokens.forEach(token=>{
        /* Plural-insensitive full-token match: "curls" matches "curl" and back. */
        const singular=token.length>3&&token.endsWith('s')?token.slice(0,-1):null;
        const fullHit=words.some(word=>word===token||word===singular||(token.length>3&&word===token+'s'));
        if(fullHit){score+=15;matched++;}
        /* Substring either way — but not via 1–2 letter fragments: the "t"
           in "T-Bar" must not match every token containing a t. */
        else if(token.length>=3&&words.some(word=>word.length>=3&&(word.includes(token)||token.includes(word)))){score+=9;matched++;}
        else{const best=Math.min(...words.map(word=>levenshtein(token,word)));if(best<=Math.max(1,Math.floor(token.length*.34))){score+=5;matched++;}}
      });
      /* Weak hits don't count: every query token must match at least fuzzily,
         and a lone fuzzy token (e.g. one near-miss letter) is not a match. */
      if(!matched||matched<qTokens.length)return 0;
      if(qTokens.length===1&&score<15)return 0;
      return score;
    }
    /* Scores an exercise against a query, expanding known synonyms first. */
    function exerciseSearchScore(ex,query){
      const raw=(query||'').toLowerCase().trim(); if(!raw)return 1;
      const keys=Object.keys(searchSynonyms);
      if(searchSynonyms[raw])return Math.max(...searchSynonyms[raw].map(phrase=>phraseScore(ex,phrase)));
      const alias=keys.map(key=>({key,distance:levenshtein(raw,key)})).sort((a,b)=>a.distance-b.distance)[0];
      if(alias&&alias.distance<=Math.max(1,Math.floor(raw.length*.18)))return Math.max(...searchSynonyms[alias.key].map(phrase=>phraseScore(ex,phrase)));
      return phraseScore(ex,raw);
    }
    /* A8 (#99): custom exercises soft-delete via a deletedAt timestamp.
       The record stays in the store so history/stats/PR lookups keep
       resolving; listings filter it. */
    function exerciseDeleted(ex){return !!ex?.deletedAt;}
    /* Returns catalog exercises ranked by search score, filtered by query. */
    function rankedExerciseMatches(query,limit=80){
      if(!query)return exercises.slice(0,limit);
      const raw=(query||'').toLowerCase().trim(), phrases=searchSynonyms[raw]||[raw];
      /* #155: tiebreak on normalized closeness — "pushups" is one char past
         "pushup", "push up to side plank" is eleven past it, so the plain
         lift sorts first when scores tie. */
      const extraChars=name=>{const nn=normalize(name);let best=Infinity;phrases.forEach(p=>{const nq=normalize(p);if(nq&&nn.includes(nq))best=Math.min(best,nn.length-nq.length);});return best;};
      /* #155: favorites float only within a relevance tier — a favorite must
         never outrank an exact/prefix match. Tiers: 0 = normalized exact,
         1 = prefix, 2 = substring, 3 = token matches. */
      const tier=score=>score>=100?0:score>=85?1:score>=75?2:3;
      const notFav=id=>state.favorites.has(id)?0:1;
      /* #508: standard equipment floats within a relevance tier — the same
         pattern as the #155 favorites float: a standard-equipment version
         must never outrank a better relevance tier. Barbell, dumbbell, and
         bodyweight ('body only' in the catalog) versions of a lift sort
         above cable/machine/band/etc. versions of the same tier. Favorites
         still win over standard-ness (the user's own pin beats the
         generality heuristic). Kettlebell stays non-standard for now (TBD). */
      const STANDARD_EQUIPMENT=new Set(['barbell','dumbbell','bodyonly']);
      const notStandard=ex=>STANDARD_EQUIPMENT.has(normalize(ex.equipment))?0:1;
      /* User 2026-09-16: the plain barbell/dumbbell variant of a lift ranks
         first in search — "Barbell Bench Press" and "Dumbbell Bench Press"
         top a "bench press" search, ahead of chains/bands/powerlifting
         variants. A canonical match is a name that is just the query,
         optionally prefixed by its equipment word. Canonical matches sort
         above every relevance tier (they ARE the lift being searched for);
         favorites still float within the canonical group per #155, and the
         #508 within-tier float below is unchanged. */
      const canonicalLift=name=>{const nn=normalize(name);return phrases.some(p=>{const nq=normalize(p);if(!nq)return false;return nn===nq||nn==='barbell'+nq||nn==='dumbbell'+nq;});};
      const notCanonical=ex=>canonicalLift(ex.name)?0:1;
      /* user 2026-09-17: the plain barbell/dumbbell variant of a lift ranks
         first even for broad queries — "bench" must top Barbell Bench Press
         and Dumbbell Bench Press (not 8th/9th behind Bench Dips and Bench
         Sprint), "row" must top barbell/dumbbell rows (not Rowing,
         Stationary). The canonical rule above only fires when the query IS
         the lift name; this fires when the name merely CONTAINS the query as
         a whole word and the equipment is barbell or dumbbell. It sits above
         the relevance tiers (it IS the lift being searched for), below the
         canonical exact matches. Body-only/cable/machine versions keep their
         within-tier float. */
      const PLAIN_VARIANT_EQUIPMENT=new Set(['barbell','dumbbell']);
      const wordsOf=s=>String(s||'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const plainVariant=ex=>{
        if(!PLAIN_VARIANT_EQUIPMENT.has(normalize(ex.equipment)))return false;
        const words=wordsOf(ex.name);
        return phrases.some(p=>{const pw=wordsOf(p);if(!pw.length)return false;return words.some((_,i)=>pw.every((w,j)=>words[i+j]===w));});
      };
      const notPlainVariant=ex=>plainVariant(ex)?0:1;
      /* Within the plain-variant group the most "just the lift" name wins:
         strip a leading equipment word, then count words past the query —
         "Barbell Bench Press" (1 past) tops "Incline Bench Pull" (2 past)
         and "Bench Press with Chains" (3 past). extraChars breaks remaining
         ties. Favorites still float within the group per #155. */
      const plainExtraWords=name=>{
        const words=wordsOf(name);
        const pwLen=Math.max(0,...phrases.map(p=>wordsOf(p).length));
        const lead=(words[0]==='barbell'||words[0]==='dumbbell')?1:0;
        return words.length-pwLen-lead;
      };
      const plainOrder=(a,b)=>{
        if(notPlainVariant(a.ex)!==0||notPlainVariant(b.ex)!==0)return 0;
        return (notFav(a.ex.id)-notFav(b.ex.id))||(plainExtraWords(a.ex.name)-plainExtraWords(b.ex.name))||(a.extra-b.extra);
      };
      return exercises.map(ex=>({ex,score:exerciseSearchScore(ex,query),extra:extraChars(ex.name)})).filter(row=>row.score>0&&!exerciseDeleted(row.ex)&&!row.ex.aliasOf).sort((a,b)=>notCanonical(a.ex)-notCanonical(b.ex)||notPlainVariant(a.ex)-notPlainVariant(b.ex)||plainOrder(a,b)||tier(a.score)-tier(b.score)||notFav(a.ex.id)-notFav(b.ex.id)||notStandard(a.ex)-notStandard(b.ex)||b.score-a.score||a.extra-b.extra||a.ex.name.localeCompare(b.ex.name)).slice(0,limit).map(row=>row.ex);
    }
    const titleCase = (s) => s ? s.replace(/\b\w/g, c => c.toUpperCase()) : '—';
    /* #99 B28: ID generation. Old ids (any format) keep resolving everywhere —
       ids are only ever compared with === (sync union, share payloads,
       tombstones), never parsed — so the generator format is free to change. */
    const ID_KIND={set:'set',exercise:'exercise',workout:'workout',template:'template',program:'program',programWorkout:'program-workout',superset:'superset',custom:'custom'};
    /* crypto.randomUUID() is the random core; the Math.random fallback only
       runs on file:// or ancient browsers that lack it. */
    function randomCore(){
      if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&0x3|0x8)).toString(16);});
    }
    /* Kind info stays in the prefix (e.g. "template-<uuid>"); per-model
       wrappers name the intent at each minting site. */
    function uid(kind){return `${kind}-${randomCore()}`;}
    /* New unique id for a set. */
    function newSetId(){return uid(ID_KIND.set);}
    /* New unique id for an exercise item. */
    function newExerciseUid(){return uid(ID_KIND.exercise);}
    /* New unique id for a workout. */
    function newWorkoutId(){return uid(ID_KIND.workout);}
    /* New unique id for a saved-workout template. */
    function newTemplateId(){return uid(ID_KIND.template);}
    /* New unique id for a program. */
    function newProgramId(){return uid(ID_KIND.program);}
    /* New unique id for a program workout. */
    function newProgramWorkoutUid(){return uid(ID_KIND.programWorkout);}
    /* New unique id for a superset group. */
    function newSupersetGroupId(){return uid(ID_KIND.superset);}
    /* Custom exercises keep the human-readable name slug (it shows in
       exports/debugging), with a random suffix so two same-named customs
       can never share an id. */
    function newCustomExerciseId(name){return `${ID_KIND.custom}-${normalize(name)||'exercise'}-${randomCore().slice(0,8)}`;}
    /* #290: stable content-derived ids for imports. Accepting the same share
       (or importing the same file) on two devices must mint the SAME id, so
       the sync id-union dedups instead of surfacing two copies. cyrb53:
       deterministic, compact, no async crypto needed. The caller decides the
       content key — it must be stable across devices for the same payload
       (so: payload/file content, never a per-device resolved id). */
    function contentHash53(str){
      let h1=0xdeadbeef,h2=0x41c6ce57;
      for(let i=0;i<str.length;i++){
        const ch=str.charCodeAt(i);
        h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);
      }
      h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
      h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
      return (h2>>>0).toString(16).padStart(8,'0')+(h1>>>0).toString(16).padStart(8,'0');
    }
    /* Stable content-derived id for an imported record. */
    function stableImportUid(kind,key){return `${kind}-import-${contentHash53(String(key))}`;}
    /* Stable content-derived id for an imported template. */
    function stableTemplateId(key){return stableImportUid(ID_KIND.template,key);}
    /* Stable content-derived id for an imported program. */
    function stableProgramId(key){return stableImportUid(ID_KIND.program,key);}
    /* #263: re-accepting a share must not stack identical "(shared)" names —
       keep suffixing until the name is unique. */
    function uniqueSuffixedName(base,existingNames,numbered){
      if(!existingNames.includes(base))return base;
      /* #315 (user 2026-09-13): shared workouts render a SHARED chip instead
         of a "(shared)" name suffix, so re-accept collisions dedupe with a
         neutral (2)/(3). Programs keep the legacy " (shared)" suffix. */
      let n=1,candidate;
      if(numbered){
        candidate=`${base} (2)`;
        while(existingNames.includes(candidate)){n++;candidate=`${base} (${n+1})`;}
      }else{
        candidate=`${base} (shared)`;
        while(existingNames.includes(candidate)){n++;candidate=`${base} (shared ${n})`;}
      }
      return candidate;
    }
    /* #99 L12: single canonical local-date formatter. Accepts an optional Date
       (defaults to now) — replaces the dashboard-stats isoForDate duplicate. */
    function localIsoDate(date) {
      const now = date || new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0,10);
    }
    /* #99 A13: finished workouts carry a completedAt ISO timestamp; legacy
       records only have date. Anything that means "latest"/recency sorts by
       completedAt with date (or a log's isoDate) as the legacy fallback.
       `date` stays the display/grouping key everywhere. */
    /* #99 C17 decision rule: sortByRecencyDesc = completedAt-first (means "latest
       saved/recently touched" — repeat-last, #99 A13); sortByWorkoutDateDesc =
       workout-date-first (means "latest performed" — the Logs list,
       suggestions, exercise history, #274/#401, and — since #544 — Home's
       recent-4 list). completedAt only breaks same-day ties in the
       workout-date sort, per #277. */
    function sortByRecencyDesc(a,b){
      const key=w=>(w&&w.completedAt)||(w&&(w.isoDate||w.date))||'';
      const x=key(a),y=key(b);
      return y<x?-1:y>x?1:0;
    }
    /* #401 (user 2026-09-13): the Logs list displays w.date, so it sorts by
       the workout date — a late-logged/backfilled entry (completedAt days
       after the workout) must sit by when the workout happened, not when it
       was saved. completedAt only breaks same-day ties, per #277's
       same-day-chronology rule. Home's recent-4 / repeat-last keep
       sortByRecencyDesc (completedAt-first per #99 A13 / #273). */
    function sortByWorkoutDateDesc(a,b){
      /* #274 (user 2026-09-13): "latest" for suggestions and exercise history
         means most-recently-DONE (workout date), not most-recently-logged.
         Log entries carry ISO `isoDate` alongside the display-formatted
         `date`, so prefer isoDate for the comparison. */
      const da=(a&&(a.isoDate||a.date))||'',db=(b&&(b.isoDate||b.date))||'';
      if(da!==db)return db<da?-1:1;
      const ca=(a&&a.completedAt)||'',cb=(b&&b.completedAt)||'';
      return cb<ca?-1:cb>ca?1:0;
    }
    /* #409 (user 2026-09-14): Intl.DateTimeFormat construction is ~200x the
       cost of a format() call — the old per-call `new` made formatLogDate
       the dominant cost inside getExerciseLogs/history renders. Hoisted. */
    const LOG_DATE_FMT=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'});
    const PRETTY_DATE_FMT=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
    /* Formats an ISO date for log lists ("Sep 21, 2026"). */
    function formatLogDate(value) {
      if (!value) return '';
      /* #chaos (2026-09-15): a garbage date string ("soon") makes
         new Date(...) Invalid Date, and format() throws RangeError —
         degrade to '' instead of crashing the caller. */
      const d=new Date(`${value}T12:00:00`);
      if (isNaN(d.getTime())) return '';
      return LOG_DATE_FMT.format(d);
    }
    /* Formats an ISO date with weekday ("Sun, Sep 21, 2026"). */
    function formatPrettyDate(value) {
      if (!value) return '';
      return PRETTY_DATE_FMT.format(new Date(`${value}T12:00:00`));
    }
    /* → assets/js/formulas/volume.js: setVolume — moved here in the v1.878 restructure (no behavior change). */
    /* #374: one fallback label for exercises with no equipment recorded —
       the library said 'none', the detail page 'no equipment', and the
       picker 'No equipment'. */
    function equipmentLabel(ex){return (ex&&ex.equipment)||'No equipment';}
    /* #382 (user 2026-09-13): banded work treats weight as optional, like
       bodyweight — band resistance is variable and often unknown.
       #452 (user 2026-09-14): exercise ball, foam roll(er), and "other"
       join the list — the load is bodyweight-ish or simply unknown. */
    const WEIGHT_OPTIONAL_EQUIPMENT=['body only','bands','exercise ball','foam roll','foam roller','other'];
    /* Hotfix 2026-09-15 (user): no equipment recorded (missing/empty/
       undefined — e.g. library rows that never got an equipment value)
       counts as weight-optional too, exactly like bodyweight. A null or
       not-found exercise still returns false (unchanged failure behavior). */
    function exerciseWeightOptional(ex){return !!ex&&(!ex.equipment||WEIGHT_OPTIONAL_EQUIPMENT.includes(ex.equipment));}
    /* → assets/js/formulas/prs.js: PR_E1RM_TOLERANCE — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/prs.js: detectExercisePRs — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/prs.js: detectTimedPRs — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/prs.js: detectBodyweightPRs — moved here in the v1.878 restructure (no behavior change). */
    /* #158: the shared "prior" definition for PR detection. Matches the live
       PR banner (which compares against all of getExerciseLogs): earlier
       sessions from the SAME date count, because they completed before this
       workout. workoutState.completed is newest-first, so a same-date row
       after this workout's index is an earlier session. The old
       row.date<workout.date gate silently dropped those. */
    /* #409 (user 2026-09-14): priorSetsForPR re-ran an O(W) filter over all
       completed workouts for every (workout, exercise) pair — recentPRRows
       was O(W^2) per Stats render (~540ms at 800 workouts). The row filter
       depends only on the workout, so it is memoized per workout; the
       per-exercise set extraction is memoized per (workout, exercise).
       Cache key is the completed array identity + length: every mutation
       site either reassigns workoutState.completed or changes its length,
       so a stale entry is impossible by construction. */
    let _priorCache={list:null,len:-1,rows:new Map(),sets:new Map()};
    /* Returns the per-workout-list prior-row cache, resetting on data change. */
    function priorCacheFor(list){
      if(_priorCache.list!==list||_priorCache.len!==(list?list.length:0)){
        _priorCache={list,len:list?list.length:0,rows:new Map(),sets:new Map()};
      }
      return _priorCache;
    }
    /* Earlier completed workouts for PR comparison (same-date sessions count). */
    function priorRowsForWorkout(workout){
      const ordered=workoutState.completed||[],cache=priorCacheFor(ordered);
      let rows=cache.rows.get(workout.id);
      if(!rows){
        const selfIdx=ordered.findIndex(row=>row.id===workout.id);
        const stamp=row=>row&&row.completedAt?Date.parse(row.completedAt):NaN;
        const selfStamp=stamp(workout);
        rows=ordered.filter((row,i)=>{
          if(row.id===workout.id)return false;
          if(row.date<workout.date)return true;
          if(row.date>workout.date)return false;
          /* #277: same-day chronology comes from completedAt, not array order —
             a sync reorder must not flip which session counts as "prior".
             Stamp-less legacy rows keep the index comparison. */
          const rowStamp=stamp(row);
          if(!isNaN(selfStamp)&&!isNaN(rowStamp))return rowStamp<selfStamp;
          return selfIdx>=0&&i>selfIdx;
        });
        cache.rows.set(workout.id,rows);
      }
      return rows;
    }
    /* Prior sets for an exercise (by canonical id) for PR detection. */
    function priorSetsForPR(workout,exerciseId){
      const ordered=workoutState.completed||[],cache=priorCacheFor(ordered);
      /* #539: match by canonical id — sets logged under a variant id count
         toward the canonical's PRs. */
      const cid=(typeof canonicalExerciseId==='function')?canonicalExerciseId(exerciseId):exerciseId;
      const key=workout.id+'::'+cid;
      let sets=cache.sets.get(key);
      if(!sets){
        sets=priorRowsForWorkout(workout)
          .flatMap(row=>row.exercises.filter(entry=>((typeof canonicalExerciseId==='function')?canonicalExerciseId(entry.exerciseId):entry.exerciseId)===cid).flatMap(entry=>entry.sets));
        cache.sets.set(key,sets);
      }
      return sets;
    }
    /* → assets/js/formulas/volume.js: displayVolume — moved here in the v1.878 restructure (no behavior change). */
    /* #410 (user 2026-09-13): dumbbell weight entry mode. The canonical
       stored weight is ALWAYS the total combined weight of both dumbbells;
       only presentation and input change. Effective mode for an exercise:
       its live profile override (set from the workout's Exercise options,
       also persisted below) → progressionSetup.dbEntryPrefs[exerciseId] →
       the Settings default ('per'). Non-dumbbell exercises always behave
       as 'total' — callers gate on the equipment check. */
    function dbEntryMode(exerciseId,item){
      const prof=item&&item.progression;
      if(prof&&(prof.dbEntry==='per'||prof.dbEntry==='total'))return prof.dbEntry;
      const prefs=(typeof progressionSetup!=='undefined'&&progressionSetup.dbEntryPrefs)||{};
      if(exerciseId&&(prefs[exerciseId]==='per'||prefs[exerciseId]==='total'))return prefs[exerciseId];
      return (typeof progressionSetup!=='undefined'&&progressionSetup.dbEntry==='total')?'total':'per';
    }
    /* #538 (user 2026-09-17): single-dumbbell flag — true when this exercise
       is performed with one dumbbell (Bulgarian split squat), so per-mode
       entry must NOT double into canonical storage. Resolution mirrors
       dbEntryMode: item.progression.singleDb override →
       progressionSetup.singleDbPrefs[exerciseId] → false (pair, today's
       behavior). Only meaningful in per-dumbbell entry mode; total mode
       never doubles, so the flag is inert there. */
    function dbSingleDumbbell(exerciseId,item){
      const prof=item&&item.progression;
      if(prof&&typeof prof.singleDb==='boolean')return prof.singleDb;
      const prefs=(typeof progressionSetup!=='undefined'&&progressionSetup.singleDbPrefs)||{};
      if(exerciseId&&typeof prefs[exerciseId]==='boolean')return prefs[exerciseId];
      return false;
    }
    /* Display a canonical total-combined dumbbell weight in the user's entry
       mode: 'per' shows half (the per-dumbbell weight), 'total' shows it
       as-is. Like the lb/kg conversion — display-only, storage canonical.
       #538: single-dumbbell exercises skip the halving — the canonical total
       IS the one dumbbell's weight. */
    function dbDisplayWeight(canonicalW,exerciseId,item,isDb){
      if(!isDb)return displayWeight(canonicalW);
      const n=Number(canonicalW);
      if(!isFinite(n)||n<=0)return displayWeight(canonicalW);
      const single=dbSingleDumbbell(exerciseId,item);
      return displayWeight(dbEntryMode(exerciseId,item)==='per'&&!single?n/2:canonicalW);
    }
    /* Convert a weight-field entry back to canonical total-combined storage:
       'per' doubles the entered per-dumbbell weight, 'total' is unchanged.
       #538: single-dumbbell exercises skip the doubling — the entered
       weight already is the total, so volume (canonical × reps) counts once. */
    function dbStorageWeight(displayVal,exerciseId,item,isDb){
      const canonical=storageWeight(displayVal);
      if(!isDb)return canonical;
      const n=Number(canonical);
      if(!isFinite(n)||n<=0)return canonical;
      const single=dbSingleDumbbell(exerciseId,item);
      return dbEntryMode(exerciseId,item)==='per'&&!single?String(n*2):canonical;
    }
    /* A7 (issue #99): prescribed target RPE is a different datum from the
       actual RPE logged on a set. Templates/programs/imports store targets;
       live sessions store actuals in `rpe`. This normalizes a candidate
       target (legacy template `rpe`, MacroFactor RIR-derived RPE, share
       payloads) to a clean string or ''. */
    function cleanTargetRpe(v){
      if(v==null||String(v).trim()==='')return '';
      const n=Number(v); if(!Number.isFinite(n)||n<1||n>10)return '';
      return String(v).trim();
    }
    /* #548 (security audit 2026-09-19): the old DOM-based implementation
       (div.textContent -> innerHTML) does NOT escape quotes — the HTML
       fragment serialization algorithm only escapes & < > in text nodes.
       A custom exercise name like `" autofocus onfocus="alert(1)` broke out
       of quoted attributes (aria-label, data-*) in the finish-workout
       review, workout history, and set-tag dialogs: stored XSS. Escape
       quotes explicitly; safe in both text and attribute contexts. */
    function escapeHtml(text) {
      return String(text)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
    }
    /* → assets/js/components/empty-states.js: emptyStateHtml — moved here in the v1.878 restructure (no behavior change). */
    /* #504: the standard empty-state actions — a primary button and a quiet
       secondary link. Ids are caller-chosen constants; labels are escaped. */
    function emptyStatePrimary(id, label) {
      return `<button class="primary-button" id="${escapeHtml(id)}" type="button">${escapeHtml(label)}</button>`;
    }
    /* The quiet secondary-link variant. */
    function emptyStateSecondary(id, label) {
      return `<button class="text-link" id="${escapeHtml(id)}" type="button">${escapeHtml(label)}</button>`;
    }
    /* Muscle pill: the shared primary-tag muscle chip used by Stats, the
       exercise library, program pages, and workout detail. The optional
       suffix is code-generated (e.g. ` · 12`), never user text. */
    function musclePill(name,suffix=''){
      return `<span class="tag primary">${escapeHtml(name)}${suffix}</span>`;
    }
    /* Time-step preset pills (2026-09-10, user picked presets over a stepper;
       Custom removed app-wide 2026-09-10, #45).
       Shared by Settings, program setup, and per-exercise rule rows. */
    const TIME_STEP_PRESETS=[5,10,15,30];
    /* Renders the time-step pill group markup. */
    function timeStepPillsHTML(){
      return TIME_STEP_PRESETS.map(n=>`<button type="button" data-step="${n}" aria-pressed="false">${n}s</button>`).join('');
    }
    /* Marks the active time-step pill in an already-rendered group. */
    function syncTimeStepPills(root,value){
      if(!root)return;
      const n=Number(value);
      root.querySelectorAll('[data-step]').forEach(btn=>{
        btn.setAttribute('aria-pressed',String(Number(btn.dataset.step)===n));
      });
    }
    /* Renders the time-step pills and wires selection to the get/set pair. */
    function wireTimeStepPills(root,get,set){
      if(!root)return;
      root.innerHTML=timeStepPillsHTML();
      syncTimeStepPills(root,get());
      root.addEventListener('click',e=>{
        const btn=e.target.closest('[data-step]');
        if(!btn||!root.contains(btn))return;
        set(Number(btn.dataset.step));
        syncTimeStepPills(root,get());
      });
    }
    /* #99 B12: one shared toast service. showToast (the app-wide toast) and
       syncToast (the sync UI's toast) used to race on #appToast with
       independent timers — a sync toast could clobber an app toast
       mid-display, and a stale fade timer could hide a fresh toast early.
       Every toast now shares one timer pair, so a new toast always cancels
       the old one cleanly. kind appends a CSS class (e.g. 'error',
       'pr-toast'); durationMs defaults to 3600. opts.onAbsent runs when the
       toast host is missing (callers fall back to their own status
       line); otherwise a missing host is a silent no-op, as before. */
    let toastTimer=null,toastFadeTimer=null;
    /* #226: a native <dialog> shown with showModal() paints in the top layer,
       above the fixed-position #appToast — "Share link copied." was invisible
       under the share modal. While any dialog is open the toast is reparented
       into the topmost one so it joins the top layer too (position:fixed keeps
       its viewport placement); with no dialog open it lives in <body>. */
    function toastTopLayerHost(){
      const open=document.querySelectorAll('dialog[open]');
      return open.length?open[open.length-1]:document.body;
    }
    /* Shows a toast with the shared timer pair; re-parents into open dialogs. */
    function toastService(message,opts={}){
      const el=document.getElementById('appToast');
      if(!el){if(typeof opts.onAbsent==='function')opts.onAbsent();return;}
      try{
        const host=toastTopLayerHost();
        if(el.parentNode!==host)host.appendChild(el);
        el.textContent=message;
        el.className=`app-toast ${opts.kind||''}`.trim();
        el.hidden=false;
        clearTimeout(toastTimer);clearTimeout(toastFadeTimer);
        requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('show')));
        toastTimer=setTimeout(()=>{
          el.classList.remove('show');
          toastFadeTimer=setTimeout(()=>{
            if(!el.classList.contains('show')){
              el.hidden=true;
              if(!document.querySelector('dialog[open]')&&el.parentNode!==document.body)document.body.appendChild(el);
            }
          },300);
        },opts.durationMs||3600);
      }catch(_){}
    }
    /* The app-wide toast every module already calls — same signature as the
       old workout-editor.js showToast it replaces. */
    function showToast(message,kind='',durationMs=3600){
      toastService(message,{kind,durationMs});
    }
    /* #350: tapping a populated number field (saved-workout builder set
       inputs, live-editor set inputs, configure dialogs, settings) drops the
       caret at position 0 on iOS Safari. Move it to the end on focus so the
       user can append/edit immediately. Applied synchronously AND once more
       on the next task — iOS finishes its own caret placement after focusin,
       so the deferred pass wins over the system's placement. try/catch:
       Chrome throws on setSelectionRange for type=number; the Safari path
       (the one with the bug) accepts it. Delegated once — covers builder
       and live inputs. Guarded: the unit-test VM loads this module with a
       partial document stub that lacks addEventListener. */
    function caretToEnd(input){
      if(!input||!input.value)return;
      try{input.setSelectionRange(input.value.length,input.value.length);}catch(_){}
    }
    if(typeof document!=='undefined'&&typeof document.addEventListener==='function'){
    document.addEventListener('focusin',e=>{
      const t=e.target;
      if(t&&t.matches&&t.matches('input[type="number"]')){
        caretToEnd(t);
        setTimeout(()=>caretToEnd(t),0);
      }
    });
    }
    /* Per-screen scroll memory (#66, 2026-09-11): the Workout tab hosts four
       distinct screens — the start screen, the live editor, the completed
       review, and the history list — which must not share one scroll slot. A
       position saved mid-workout would otherwise restore partway down the
       start screen (and vice versa). Each tab remembers its own scroll across
       tab switches; genuinely new screens begin at the top. Scrolls apply
       synchronously in the same task as the render, so the browser never
       paints at the wrong position first (no visible jump). */
    function workoutScrollKey() {
      if (workoutState.draft) return 'workout:editor';
      const complete = document.querySelector('#workoutComplete');
      if (complete && !complete.hidden) return 'workout:complete';
      /* The 'workout:history' slot existed in the scroll map but this key was
         never returned (efficiency pass 2026-09-12) — the history list kept
         inheriting the start screen's position. */
      if (state.workoutHistoryOpen) return 'workout:history';
      return 'workout:start';
    }
    /* Scroll slot for a view; the workout tab splits into four sub-screens. */
    function scrollKeyFor(view) { return view === 'workout' ? workoutScrollKey() : view; }
    /* Saves the current scroll position for the active view. */
    function rememberScroll() { state.scroll[scrollKeyFor(state.activeView)] = window.scrollY; }
    /* Restores the saved scroll position for a view. */
    function restoreScroll(view) {
      /* #543 (user 2026-09-17): clamp to the live document range. A stale slot
         (saved against a taller layout — e.g. the exercise detail's) or a
         native restoration racing this call used to park the viewport past
         the content, which iOS Safari renders as a blank screen with only the
         edge of the real content peeking through. */
      const doc=document.scrollingElement||document.documentElement;
      const max=Math.max(0,(doc?doc.scrollHeight:0)-window.innerHeight);
      const want=state.scroll[scrollKeyFor(view)]||0;
      window.scrollTo({top:Math.min(Math.max(0,want),max),behavior:'auto'});
    }
    /* Logs are their own page (user 2026-09-12): pass highlight=null to light
       no tab while the top bar still follows `view`. */
    function setActiveNav(view, highlight) {
      if (highlight === undefined) highlight = view;
      [['dashboard',$('#dashboardNav')],['library',$('#libraryNav')],['workout',$('#workoutsNav')],['program',$('#programNav')],['stats',$('#statsNav')]].forEach(([key,button]) => {
        const active = key === highlight;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
      });
      /* #98 desktop header (2026-09-16): the header tabs mirror the bottom
         nav's active state. querySelectorAll no-ops when the header markup
         is absent (older cached index.html). */
      document.querySelectorAll('#desktopHeader .desktop-tab').forEach(tab => {
        const active = tab.dataset.view === highlight;
        tab.classList.toggle('active', active);
        if (active) tab.setAttribute('aria-current','page'); else tab.removeAttribute('aria-current');
      });
      updateTopBar(view);
    }
    /** Slim persistent top bar: title per view, back chevron only on non-root screens,
     *  settings gear everywhere except on Settings itself. */
    const TOP_BAR_TITLES = { dashboard: 'Home', library: 'Exercises', workout: 'Workout', program: 'Program', stats: 'Stats', settings: 'Settings' };
    /* #313: the live-session dot lives inside the title-text span
       (absolutely positioned, so it never shifts the centered title) —
       every title update re-appends it instead of wiping it. */
    function setTopBarTitle(el, html){
      const dot=$('#liveTitleDot');
      el.innerHTML=html;
      if(dot)el.appendChild(dot);
    }
    /* Renders the slim top bar: title, back chevron, settings gear. */
    function updateTopBar(view, customTitle) {
      const titleEl = $('#topBarTitle'); if (!titleEl) return;
      /* The title text lives in its own span so the live-session dot next to
         it survives title updates (user 2026-09-12). */
      const titleText = $('#topBarTitleText') || titleEl;
      const back = $('#topBarBack'); const gear = $('#topBarSettings');
      /* Title-bar back is the repeatable pattern (user 2026-09-11): it shows
         on Settings, exercise detail, every workout sub-screen, the program
         setup form while editing, and a program-workout page. In-page back
         buttons are gone. */
      const workoutSub = view === 'workout' && state.workoutSubScreen && state.workoutSubScreen !== 'start';
      const programSub = view === 'program' && ($('#createProgram')?.dataset.editing === 'true' || !!state.programWorkoutUid || !!state.savedProgramPreviewId);
      if (back) {
        back.hidden = !(view === 'settings' || view === 'detail' || workoutSub || programSub);
        if (workoutSub || programSub) back.setAttribute('aria-label', 'Back');
      }
      /* C3 (pixel-peeper PP2): the gear stays visible on Settings but no
         longer shows the active pill — you're already there, the pill is
         redundant. */
      if (gear) gear.classList.remove('active');
      /* #98 desktop header: its gear mirrors the top-bar gear (never active). */
      const desktopGear = $('#desktopSettings');
      if (desktopGear) desktopGear.classList.remove('active');
      if (view === 'detail') {
        /* #10 (user 2026-09-11): no breadcrumb in the header — the exercise
           name lives in the detail body; the top-bar back chevron is the one
           and only back affordance.
           #407 (user 2026-09-13): the title names the page you're on, not
           the tab you came from. Exercise detail is canonically part of the
           Exercises section, so the top bar always reads "Exercises" — even
           when reached from Stats, a workout, or a program. Back still
           returns via state.exerciseDetailReturn (unchanged). */
        setTopBarTitle(titleText, escapeHtml(TOP_BAR_TITLES.library));
      } else if (view === 'settings') {
        // Settings is its own page, not a breadcrumb (user 2026-09-10).
        setTopBarTitle(titleText, 'Settings');
      } else if (view === 'workout' && (state.workoutSubScreen === 'history' || state.workoutSubScreen === 'complete')) {
        /* User 2026-09-12: the log list and a completed workout are "Logs",
           not "Workout" — these are completed sessions. The title is a hidden
           button (looks identical to other pages) that jumps to the full
           log list. The chevron was removed per user feedback: it doesn't
           fit the design and the title tap is a shortcut, not navigation. */
        const logLabel = customTitle || 'Logs';
        setTopBarTitle(titleText, `<button type="button" class="title-tap" id="topBarTitleTap" aria-label="View all workout logs">${escapeHtml(logLabel)}</button>`);
        const titleTap = $('#topBarTitleTap');
        if (titleTap) titleTap.addEventListener('click', () => {
          /* Already on the list: don't push a duplicate history entry. */
          if (state.workoutSubScreen === 'history') { window.scrollTo({top:0,behavior:'auto'}); return; }
          showWorkoutHistory();
        });
      } else {
        setTopBarTitle(titleText, escapeHtml(customTitle || TOP_BAR_TITLES[view] || ''));
      }
    }

        /* ===== Shared exercise/tracking helpers (efficiency pass 2026-09-12) =====
       Used across workout-editor.js, programs.js, app-bootstrap.js,
       progression.js, and workout-history.js. They live here (utilities.js
       loads first) so no feature module reaches into another for them. */
    /* ===== Shared domain constants (moved here 2026-09-12, #99 B23) =====
       REP_PRESETS and defaultExerciseProgression were owned by feature modules
       (programs.js, workout-editor.js) but consumed cross-module; the dead
       OB_RANGE_PRESETS duplicate died with the onboarding gate (#99 B1). */
    /* AMRAP is open-ended: no max (user 2026-09-10). An empty max
       field elsewhere also means open. The 15+ preset was removed
       2026-09-21 (user) — stored openTop data still renders, but no UI
       offers it as a preset. */
    const REP_PRESETS={strength:{label:'Strength',min:1,max:5},hypertrophy:{label:'Hypertrophy',min:6,max:12},endurance:{label:'Endurance',min:12,max:20},amrap:{label:'AMRAP',min:1,max:null,amrap:true},
      /* QA batch (user 2026-09-21, #14): legacy "15+" data is preserved
         internally, but no UI exposes it — pickers use VISIBLE_REP_PRESETS. */
      open:{label:'15+',min:15,max:null,openTop:true,legacy:true}};
    /* QA batch (user 2026-09-21, #14): the keys user-facing preset pickers
       may offer. 'open' stays resolvable for legacy data but is never shown. */
    const VISIBLE_REP_PRESETS=['strength','hypertrophy','endurance','amrap'];
    /* #99: ONE factory owns the exercise-level progression profile shape.
       `overrides` fills in the mode/range; increment/timeStep fall back to the
       global progressionSetup defaults. */
    function defaultExerciseProgression(overrides={}) {
      return {
        mode: overrides.mode || 'reps',
        min: overrides.min ?? null,
        max: overrides.max ?? null,
        openTop: !!overrides.openTop,
        amrap: !!overrides.amrap,
        timeMin: overrides.timeMin ?? 30,
        timeMax: overrides.timeMax ?? 60,
        timeStep: overrides.timeStep ?? progressionSetup.timeStep ?? 5,
        incrementType: overrides.incrementType || progressionSetup.incrementType || 'lb',
        incrementValue: overrides.incrementValue ?? progressionSetup.incrementValue ?? 5,
        repsOnly: !!overrides.repsOnly,
        custom: !!overrides.custom,
        /* #360: scheme rides the profile so share import (rebuilt through
           this factory) doesn't drop a per-exercise 'off'. */
        ...(overrides.scheme?{scheme:overrides.scheme}:{}),
        /* #410 (user 2026-09-13): per-exercise dumbbell entry-mode override
           ('per'|'total'); null = fall back to dbEntryPrefs → Settings.
           #538 (user 2026-09-17): single-dumbbell flag; null = fall back to
           singleDbPrefs → pair. */
        dbEntry: (overrides.dbEntry==='per'||overrides.dbEntry==='total')?overrides.dbEntry:null,
        singleDb: typeof overrides.singleDb==='boolean'?overrides.singleDb:null
      };
    }
    /* ===== #99 B8: canonical clone utilities =====
       Eight hand-written exercise/set clone paths used to encode the same
       schema as inline literals (repeat, template-from-completed,
       template-start, program-start, builder copy, history edit, share
       import) — and they already disagreed on RPE (A7). Every rebuild of an
       exercise item from another record goes through ONE of these explicit
       conversion modes, so schema fields can't silently disappear on one
       path. Semantics preserved EXACTLY:
       - A7: 'forNewSession' clears actual RPE and carries only a STORED
         prescribed target; 'forTemplate' converts a completed set's ACTUAL
         rpe into a suggested targetRpe.
       - #175: 'forNewSession' carries the previous weight as a real value.
       - #267: 'forNewSession' blanks r/seconds so the ghost suggestion shows.
       - Legacy templates stored prescribed targets in `rpe`; 'fromTemplate'
         and 'fromProgram' prefer `targetRpe` over `rpe`.
       - 'forEdit' is the full-fidelity round trip (actual RPE kept,
         complete preserved) — it is editing, not a new session.
       - Tracking resolution is per-mode: only 'fromTemplate' consults
         progression.mode (opts.trackingFallback preserves the builder
         copy's `||null`); the other modes keep their old `||'reps'`.
       - 'fromShare' decodes the v2 slim arrays; the codec passes its own
         progression decoder (it lives in the share codec module).
       - #498: `distance` mirrors `r`/`seconds` in every mode — blank for a
         fresh session, carried as a target from templates. */
    function cloneSetFields(set,mode){
      const s=set||{};
      switch(mode){
        /* #267 (user 2026-09-12): repeat-as-new blanks performance (r/seconds)
           so the Rep+ ghost suggestion shows — carrying last session's reps
           as real values hid the ghost. Weight still carries (#175), RPE
           still clears (A7). */
        case 'forNewSession':return {w:s.w==null?'':String(s.w),r:'',seconds:'',distance:'',rpe:'',targetRpe:cleanTargetRpe(s.targetRpe),tags:[...(s.tags||[])]};
        case 'forTemplate':return {w:s.w==null?'':String(s.w),r:s.r==null?'':String(s.r),seconds:s.seconds==null?'':String(s.seconds),distance:s.distance==null?'':String(s.distance),rpe:'',targetRpe:cleanTargetRpe(s.rpe),tags:[...(s.tags||[])]};
        case 'fromTemplate':return {w:'',r:s.r??'',seconds:s.seconds??'',distance:s.distance??'',rpe:'',targetRpe:cleanTargetRpe(s.targetRpe??s.rpe),tags:[...(s.tags||[])]};
        case 'fromProgram':return {w:'',r:'',seconds:'',distance:'',rpe:'',targetRpe:cleanTargetRpe(s.targetRpe??s.rpe),tags:[...(s.tags||[])]};
        /* #501: preserve the log's explicit complete flags — opening a log
           for edit must not silently complete sets the finish left
           unchecked. Legacy/imported logs all carry complete:true. */
        case 'forEdit':return {w:s.w==null?'':String(s.w),r:s.r==null?'':String(s.r),seconds:s.seconds==null?'':String(s.seconds),distance:s.distance==null?'':String(s.distance),rpe:s.rpe==null?'':String(s.rpe),targetRpe:'',tags:[...(s.tags||[])],complete:!!s.complete};
        /* Builder → saved-template persist: prescriptions only; every logged
           actual (weight, RPE, stored target) is dropped. Orphaned superset
           ids are dropped by the caller via opts.supersetId. */
        case 'forSaveTemplate':return {w:'',r:s.r??'',seconds:s.seconds??'',distance:s.distance??'',rpe:'',targetRpe:'',tags:[...(s.tags||[])]};
        default:return {w:'',r:'',seconds:'',distance:'',rpe:'',targetRpe:'',tags:[]};
      }
    }
    /* opts.emptyDefault: some paths (builder copy, program start) mint one
       blank set when the source has none; the others keep an empty list. */
    function cloneExerciseSets(sets,mode,opts={}){
      const rows=(sets&&sets.length)?sets:(opts.emptyDefault?[{w:'',r:'',seconds:'',rpe:'',tags:[]}]:[]);
      return rows.map(set=>Object.assign(newSet(),cloneSetFields(set,mode)));
    }
    /* Rebuilds an exercise item from another record in a conversion mode. */
    function cloneExerciseItem(item,mode,opts={}){
      const src=item||{};
      const tracking=opts.tracking||(mode==='fromTemplate'
        ? src.tracking||src.progression?.mode||('trackingFallback' in opts?opts.trackingFallback:'reps')
        : src.tracking||'reps');
      return newExerciseItem({
        exerciseId:'exerciseId' in opts?opts.exerciseId:src.exerciseId,
        tracking,
        metrics:'metrics' in opts?opts.metrics:(Array.isArray(src.metrics)?[...src.metrics]:null),
        note:'note' in opts?opts.note:(src.note||''),
        noteOpen:!!opts.noteOpen,
        exerciseTags:'exerciseTags' in opts?opts.exerciseTags:src.exerciseTags,
        supersetId:'supersetId' in opts?opts.supersetId:src.supersetId,
        progression:'progression' in opts?opts.progression:src.progression,
        sets:'sets' in opts?opts.sets:cloneExerciseSets(src.sets,mode,opts)
      });
    }
    /* Share import: slim v2 arrays → full items. Uids are regenerated and
       sets rebuilt through newSet so defaults always match the recipient's
       app version. decodeProgression is the share codec's own decoder. */
    function cloneExerciseItemFromShare(sitem,decodeProgression){
      const cols=a=>Array.isArray(a)?a:[];
      /* #498: a share import is a NEW item for the recipient — absent
         metrics fall through to the catalog defaults via newExerciseItem
         (undefined, not null). Legacy links stay decodable; the wire format
         never carried that field. */
      return cloneExerciseItem(null,'fromShare',{
        exerciseId:sitem.i,
        tracking:sitem.k||'reps',
        metrics:Array.isArray(sitem.m)?sitem.m:undefined,
        note:sitem.o||'',
        exerciseTags:Array.isArray(sitem.g)?[...sitem.g]:[],
        supersetId:sitem.u||null,
        progression:decodeProgression(sitem.p),
        sets:(sitem.e||[]).map(a=>{const c=cols(a);return Object.assign(newSet(),{w:c[0]??'',r:c[1]??'',seconds:c[2]??'',rpe:c[3]??'',tags:[...cols(c[4])],targetRpe:cleanTargetRpe(c[5]),distance:c[6]??''});})
      });
    }
    /* #99 B13: one shared exercise-target summary for saved-workout rows
       (programs.js) and share-preview rows (share.js). The caller injects the
       resolved exercise name — share payloads resolve names against their own
       custom exercises first, since those aren't in the recipient's library. */
    function exerciseTargetSummary(item,name){
      const n=(item.sets||[]).length,p=item.progression||{};
      let target='';
      if((item.tracking||p.mode)==='time')target=`${p.timeMin??30}–${p.timeMax??60} sec`;
      else if(p.min!=null||p.max!=null)target=`${p.min??''}–${p.max??''} reps`;
      else{const rs=[...new Set((item.sets||[]).map(s=>s.r).filter(v=>v!==''&&v!=null))];if(rs.length)target=`${rs.join('/')} reps`;}
      return {name,meta:`${n} set${n===1?'':'s'}${target?` · ${target}`:''}`};
    }
    /* #81: number superset groups (Superset 1, Superset 2, …) so multiple
       groups are visually distinct. Numbering follows order of first appearance. */
    function supersetGroupNumber(exercises,supersetId){
      const seen=[];
      for(const row of exercises){
        if(row.supersetId&&!seen.includes(row.supersetId))seen.push(row.supersetId);
      }
      return seen.indexOf(supersetId)+1;
    }
    /* Canonical tracking read (efficiency pass 2026-09-12): the toggle says
       "seconds" but the canonical value is 'time' — a pre-fix builder bug
       persisted raw 'seconds' strings, so normalize here, the single read
       point, instead of scattering ==='seconds' checks. */
    function exerciseTracking(item, ex) {
      const t=item?.tracking || item?.progression?.mode || ex?.tracking || (ex?.force === 'static' ? 'time' : 'reps');
      return t==='seconds'?'time':t;
    }
    /* Rep/time-range placeholder for set inputs (2026-09-10): the placeholder
       shows the target range ("6–12", "6+", "AMRAP", "30–60 sec") while the
       value auto-saved when completing an untouched set is the range minimum —
       the conservative, honest default. AMRAP has no auto value: reps must be
       entered. A progression suggestion (target) takes precedence over both. */
    function rangePlaceholder(profile,time){
      profile=profile||{};
      if(time){
        const min=profile.timeMin,max=profile.timeMax;
        if(min&&max&&min!==max)return {text:`${min}–${max} sec`,value:String(min)};
        if(min)return {text:`${min} sec`,value:String(min)};
        return {text:'',value:''};
      }
      if(profile.amrap)return {text:profile.min>1?`AMRAP from ${profile.min}`:'AMRAP',value:''};
      const min=profile.min,max=profile.max;
      if(profile.openTop&&min)return {text:`${min}+`,value:String(min)};
      if(min&&max)return min===max?{text:String(min),value:String(min)}:{text:`${min}–${max}`,value:String(min)};
      if(min)return {text:String(min),value:String(min)};
      return {text:'',value:''};
    }
    /* Effective progression scheme for an exercise item (#54, v1.001): the
       item's own stamped scheme first, then the program context (program
       drafts stamp scheme at start; the builder's program-workout editor
       reads the active program), then the global default. */
    function resolvedExerciseScheme(item){
      const prof = item?.progression || {};
      if(prof.scheme) return prof.scheme;
      const d = workoutState.draft;
      if(d?.programId && workoutState.activeProgram?.id === d.programId){
        const s = workoutState.activeProgram.progression?.scheme;
        if(s) return s;
      }
      const b = state.savedBuilder;
      if(b?.editTarget?.kind === 'program'){
        const s = workoutState.activeProgram?.progression?.scheme;
        if(s) return s;
      }
      return progressionSetup.scheme || 'linear';
    }
    /* #205 (user 2026-09-12): one-paragraph description per progression mode
       for the Settings → Progression defaults picker. Tapping a pill shows
       only that mode's copy — the old combined block described all three at
       once. Wording is the existing copy, split per mode. */
    const SCHEME_DESCRIPTIONS={
      rpe:'RPE-based adds reps first, then weight, gated by the RPE trigger.',
      linear:'Linear adds the increment every session, no RPE needed.',
      onerm:'%1RM prescribes each exercise\'s load as a percentage of its training max (or estimated 1RM when no training max is set).'
    };
    /* One-paragraph description for a progression mode. */
    function schemeDescription(scheme){return SCHEME_DESCRIPTIONS[scheme]||SCHEME_DESCRIPTIONS.linear;}
    /* Summarizes an exercise's progression setup as short labels. */
    /* P1 QA 2026-09-22: the %1RM percent shown in Exercise options when no
       live suggestion exists. Mirrors the engine's own precedence
       (onermRx in progression.js): per-exercise override → the program's
       weekly % wave value for the current week → the program default → 75.
       Without the wave step, a program on week 1 of an 85/90/95 wave showed
       "75% of TM" — the program default — even though the engine prescribes
       85%. Program context is sniffed the same way the threshold fallback
       below does (live draft's program, or the program template being
       edited in the saved-workout builder). */
    function onermProgramContext(){
      const d=workoutState.draft;
      if(d&&!d.editingId&&d.programId&&typeof findProgramById==='function'){
        const p=findProgramById(d.programId);
        if(p)return {config:p.progression||{},week:(typeof programWeek==='function')?programWeek(p):1};
      }
      const b=(typeof state!=='undefined')?state.savedBuilder:null;
      if(b?.editTarget?.kind==='program'&&typeof findProgramById==='function'){
        const p=findProgramById(b.editTarget.uid);
        if(p)return {config:p.progression||{},week:(typeof programWeek==='function')?programWeek(p):1};
      }
      return null;
    }
    function onermDisplayPct(prof){
      const rawPct=Number(prof.percentOf1RM);
      if(Number.isFinite(rawPct)&&rawPct>0)return clampPct1RM(rawPct);
      const prog=onermProgramContext();
      if(prog&&typeof programPctForWeek==='function'){
        return programPctForWeek(prog.config,prog.week)||Number(prog.config?.percentOf1RM)||75;
      }
      return 75;
    }
    function progressionSummaryForOptions(item) {
      // user 2026-09-11: show the exercise's progression setup under Exercise
      // options so the suggestion basis is visible during the workout.
      const prof = item.progression || {};
      const scheme = resolvedExerciseScheme(item);
      const schemeLabel = scheme === 'onerm' ? '%1RM' : scheme === 'linear' ? 'Linear' : 'RPE-based';
      const time = prof.mode === 'time' || exerciseTracking(item, resolveExercise(item.exerciseId)) === 'time';
      let target;
      if (time) {
        target = `${prof.timeMin || 30}–${prof.timeMax || 60} sec`;
      } else if (prof.amrap) {
        target = `AMRAP from ${prof.min || 1} reps`;
      } else if (prof.openTop) {
        target = `${prof.min || 5}+ reps`;
      } else {
        target = `${prof.min || 5}–${prof.max || 8} reps`;
      }
      // Include the live suggestion reason if one exists for this exercise
      const sugg = (workoutState.draft?.progressionSuggestions || []).find(x => x.exerciseId === item.exerciseId);
      let detail = '';
      let onermInputs = '';
      if(scheme === 'onerm'){
        // Provenance display line (#54, v1.001): "75% of TM 225 lb (you set)"
        // or "75% of auto TM ~ 240 lb from e1RM". P1 QA 2026-09-22: without a
        // live suggestion, the percent must be what the engine will actually
        // prescribe — in a program context that's the weekly % wave's value
        // for the current week, not the 75 program-default fallback.
        const pctEff = sugg?.pct ?? onermDisplayPct(prof);
        const tm = Number(prof.trainingMax ?? prof.manual1RM) || 0;
        if(sugg && sugg.kind === 'onerm'){
          detail = sugg.tmSource === 'manual'
            ? `${sugg.pct}% of TM ${displayWeight(sugg.estimated1RM)} ${weightUnit()} (you set)`
            : `${sugg.pct}% of auto TM ~ ${displayWeight(Math.round(sugg.estimated1RM))} ${weightUnit()} from e1RM`;
        }else if(tm > 0){
          detail = `${pctEff}% of TM ${displayWeight(tm)} ${weightUnit()} (you set)`;
        }else{
          detail = `${pctEff}% of estimated 1RM`;
        }
        onermInputs = `<div class="prog-onerm-fields"><label class="prog-onerm-field"><span>% of 1RM</span><span class="prog-onerm-input"><input type="number" inputmode="numeric" min="1" max="100" step="1" value="${prof.percentOf1RM ?? ''}" placeholder="${pctEff}" data-onerm-pct="${escapeHtml(item.uid)}" aria-label="Percent of 1RM override, blank for program default"><em class="unit">%</em></span></label><label class="prog-onerm-field"><span>Training max</span><span class="prog-onerm-input"><input type="number" inputmode="decimal" min="1" step="0.5" value="${tm > 0 ? displayWeight(tm) : ''}" placeholder="Auto" data-onerm-tm="${escapeHtml(item.uid)}" aria-label="Training max, blank for automatic"><em class="unit">${weightUnit()}</em></span></label></div>`;
      }else{
        const incType = prof.incrementType || 'lb';
        const incVal = prof.incrementValue ?? 5;
        detail = prof.repsOnly ? 'reps only, no load progression' : `+${incVal} ${incType === 'percent' ? '%' : weightUnit()} per jump`;
      }
      let basis = sugg?.reason ? `<span class="prog-basis">${escapeHtml(sugg.reason)}</span>` : '';
      if(!basis && !workoutState.draft?.editingId){
        /* #166: the engine returned no suggestion for this exercise — say why,
           grounded in the engine's own null cases (progressionForExercise
           returns null only when there is no history, or history with no
           valid latest top set / a suppressed no-change). Holds already
           arrive as suggestions with their own reason above. #148: skip the
           why-copy while editing a log — suggestions don't
           apply to history. */
        const logs=getExerciseLogs(item.exerciseId);
        const hasHistory=logs.length>0;
        let why;
        if(!hasHistory){
          why='No completed history for this exercise yet.';
        }else{
          /* Silent holds: the engine suppresses the no-change card (#79),
             discarding its own reason — so name it here, or "no suggestion"
             reads as broken (user 2026-09-13). Mirrors the engine's top-set
             pick (heaviest non-warmup set) and the raw top-set RPE gate
             (user 2026-09-16: accumulated fatigue no longer blocks
             progression). */
          const prof0=item.progression||{};
          const latest=logs.slice().sort(sortByWorkoutDateDesc)[0]; /* #274: most-recently-done */
          const basisSets=latest?.sets?.filter(s=>!isWarmupSet(s))||[];
          const top=basisSets.reduce((best,s)=>Number(s.w||0)>Number(best?.w||0)?s:best,null);
          const rangeLabel=prof0.openTop?`${prof0.min||15}+ reps`:prof0.amrap?'AMRAP':`${prof0.min||1}–${prof0.max||5} reps`;
          const topRpe=top?.rpe==null||String(top.rpe).trim()==='' ? null : Number(top.rpe);
          const threshold=(()=>{const prof0=item.progression||{};
            if(prof0.threshold==='completion')return 8;
            if(Number.isFinite(Number(prof0.threshold)))return Number(prof0.threshold);
            const d=workoutState.draft;
            if(d?.programId&&workoutState.activeProgram?.id===d.programId)return Number(workoutState.activeProgram.progression?.threshold??8);
            const b=(typeof state!=='undefined')?state.savedBuilder:null;
            if(b?.editTarget?.kind==='program')return Number(workoutState.activeProgram?.progression?.threshold??8);
            return Number(progressionSetup.threshold??8);})();
          const fmt=(typeof fmtRpe==='function')?fmtRpe:(r=>String(Math.round(Number(r)*10)/10));
          const rpeHold=scheme==='rpe'&&topRpe!=null&&topRpe>threshold;
          if(rpeHold)
            why=`Latest top set was RPE ${fmt(topRpe)} — above your RPE ${threshold} trigger, so the app holds.`;
          else if(scheme==='rpe'&&topRpe==null&&top)
            why='No RPE on the latest top set, so the app holds — log an RPE to get a suggestion.';
          else if(prof0.repsOnly&&top&&!prof0.openTop&&!prof0.amrap&&Number(top.r)>(Number(prof0.max)||Infinity))
            why=`Increase reps only is on — past the top of ${rangeLabel}, the app holds your ${displayWeight(Number(top.w))} ${weightUnit()} top set.`;
          else
            why='History exists, but there is not enough valid data for a suggestion.';
        }
        basis=`<span class="prog-basis">${why}</span>`;
      }
      /* #410 (user 2026-09-13): per-exercise dumbbell entry-mode override,
         next to "Increase reps only". Stored weight stays total combined;
         this only changes entry/display for this exercise, and persists via
         progressionSetup.dbEntryPrefs. */
      const dbIsDb=(typeof exercises!=='undefined')&&(resolveExercise(item.exerciseId)?.equipment==='dumbbell');
      const dbMode=dbEntryMode(item.exerciseId,item);
      /* #495: a Settings default can hide the per-exercise "Total" dumbbell
         option — when hidden the toggle doesn't render and entry stays
         per-dumbbell (the convention). */
      const dbTotalHidden=typeof progressionSetup!=='undefined'&&!!progressionSetup.hideDbTotal;
      const dbToggle=dbIsDb&&!dbTotalHidden?`<div class="prog-db-entry-row"><span class="prog-db-entry-label">Dumbbell weight</span><div class="tracking-segment" role="group" aria-label="Dumbbell weight entry"><button type="button" data-db-entry-mode="per" data-db-entry-uid="${escapeHtml(item.uid||'')}" aria-pressed="${dbMode==='per'}">Per dumbbell</button><button type="button" data-db-entry-mode="total" data-db-entry-uid="${escapeHtml(item.uid||'')}" aria-pressed="${dbMode==='total'}">Total</button></div></div>`:'';
      /* #538 (user 2026-09-17): single-dumbbell toggle — One vs Pair. Only
         meaningful in per-dumbbell entry mode (total mode never doubles, so
         the flag would be inert); hidden there to avoid a dead control. */
      const dbSingle=dbSingleDumbbell(item.exerciseId,item);
      const dbSingleToggle=dbIsDb&&dbMode==='per'?`<div class="prog-db-single-row"><span class="prog-db-entry-label">Dumbbells used</span><div class="tracking-segment" role="group" aria-label="Dumbbells used"><button type="button" data-db-single="one" data-db-single-uid="${escapeHtml(item.uid||'')}" aria-pressed="${dbSingle}">One</button><button type="button" data-db-single="pair" data-db-single-uid="${escapeHtml(item.uid||'')}" aria-pressed="${!dbSingle}">Pair</button></div></div>`:'';
      /* QA batch (user 2026-09-21, #7): the progression info reads as a flat
         wall inside Exercise options — it gets its own collapsible card
         (summary line shows scheme + target), like the v0.1 trainer
         prototype's collapsible cards. */
      /* Per-exercise RPE trigger threshold (user 2026-09-22): moved from
         Settings back under Exercise options where it used to be. 7/8/9 or
         Off (stored as 'completion'). Falls back to program/global default.
         v1.883: timed exercises show the pills too — the engine gates timed
         progression on the threshold ("add N seconds when the top set is at
         or below RPE <threshold>"), so hiding the control hid a live input. */
      const exThreshold = prof.threshold !== undefined ? prof.threshold : null;
      /* v1.883: with no per-exercise override the pills reflect the
         EFFECTIVE default (program threshold, else the global Settings
         default) — otherwise none of 7/8/9/Off shows pressed even though
         the engine gates on that default. Tapping a pill still writes an
         explicit per-exercise override. */
      const effThreshold = exThreshold !== null ? exThreshold : (()=>{
        try{
          const d=(typeof workoutState!=='undefined')?workoutState.draft:null;
          if(d&&d.programId&&workoutState.activeProgram&&workoutState.activeProgram.id===d.programId){
            const t=workoutState.activeProgram.progression&&workoutState.activeProgram.progression.threshold;
            if(t!==undefined)return t;
          }
          const b=(typeof state!=='undefined')?state.savedBuilder:null;
          if(b&&b.editTarget&&b.editTarget.kind==='program'){
            const t=workoutState.activeProgram&&workoutState.activeProgram.progression&&workoutState.activeProgram.progression.threshold;
            if(t!==undefined)return t;
          }
          const g=(typeof progressionSetup!=='undefined')?progressionSetup.threshold:undefined;
          return g===undefined?8:g;
        }catch(_){return 8;}
      })();
      const thresholdPills = (scheme === 'rpe') ? `<div class="prog-threshold-row"><span class="prog-threshold-label">RPE trigger</span><div class="tracking-segment" role="group" aria-label="RPE trigger threshold"><button type="button" data-ex-threshold="7" data-ex-threshold-uid="${escapeHtml(item.uid||'')}" aria-pressed="${String(effThreshold)==='7'}">7</button><button type="button" data-ex-threshold="8" data-ex-threshold-uid="${escapeHtml(item.uid||'')}" aria-pressed="${String(effThreshold)==='8'}">8</button><button type="button" data-ex-threshold="9" data-ex-threshold-uid="${escapeHtml(item.uid||'')}" aria-pressed="${String(effThreshold)==='9'}">9</button><button type="button" data-ex-threshold="completion" data-ex-threshold-uid="${escapeHtml(item.uid||'')}" aria-pressed="${String(effThreshold)==='completion'}">Off</button></div></div>` : '';
      return `<details class="progression-card"><summary><span class="prog-card-title">Progression</span><span class="prog-scheme">${escapeHtml(schemeLabel)}</span><span class="prog-target">${escapeHtml(target)}</span></summary><div class="progression-card-body"><div class="prog-summary"><span class="prog-detail">${escapeHtml(detail)}</span>${onermInputs}${basis}</div>${thresholdPills}${(!time&&scheme!=='onerm')?`<div class="prog-reps-only-row"><button class="reps-only-toggle" type="button" data-reps-only-toggle="${escapeHtml(item.uid||'')}" aria-pressed="${!!prof.repsOnly}">Increase reps only</button></div>`:''}${dbToggle}${dbSingleToggle}</div></details>`;
    }
    /* %1RM per-exercise inputs (#54, v1.001): % override + training max,
       rendered by progressionSummaryForOptions in both the live editor and
       the saved-workout builder. 'change' (not 'input') so typing isn't
       interrupted; afterChange lets each host recompute its suggestions. */
    function wireOnermOptionInputs(scope, findItem, afterChange){
      if(!scope || typeof findItem !== 'function') return;
      scope.querySelectorAll('[data-onerm-pct]').forEach(input => input.addEventListener('change', () => {
        const item = findItem(input.dataset.onermPct); if(!item) return;
        const p = item.progression || (item.progression = {});
        const v = Number(input.value);
        if(input.value.trim() === '' || !Number.isFinite(v) || v <= 0) delete p.percentOf1RM;
        else p.percentOf1RM = clampPct1RM(v);
        if(afterChange) afterChange(item);
        schedulePersist();
      }));
      scope.querySelectorAll('[data-onerm-tm]').forEach(input => input.addEventListener('change', () => {
        const item = findItem(input.dataset.onermTm); if(!item) return;
        const p = item.progression || (item.progression = {});
        const v = Number(input.value);
        if(input.value.trim() === '' || !Number.isFinite(v) || v <= 0){ delete p.trainingMax; delete p.tmSource; }
        else{ p.trainingMax = Math.max(1, Math.round(Number(storageWeight(input.value)) * 10) / 10); p.tmSource = 'manual'; }
        if(afterChange) afterChange(item);
        schedulePersist();
      }));
    }
    /* #538 (user 2026-09-17): single-dumbbell toggle. Tapping sets the item
       profile AND persists it in progressionSetup.singleDbPrefs[exerciseId],
       so the choice sticks for this exercise in future workouts (same shape
       as the #410 dbEntry override). afterChange re-renders the host — the
       weight fields re-display without the per-mode doubling. */
    function wireDbSingleToggle(scope, findItem, afterChange){
      if(!scope || typeof findItem !== 'function') return;
      scope.querySelectorAll('[data-db-single]').forEach(btn => btn.addEventListener('click', () => {
        const val=btn.dataset.dbSingle; if(val!=='one'&&val!=='pair')return;
        const item = findItem(btn.dataset.dbSingleUid); if(!item) return;
        const next=val==='one';
        if(dbSingleDumbbell(item.exerciseId,item)===next)return;
        const p = item.progression || (item.progression = {});
        p.singleDb = next;
        if(typeof progressionSetup!=='undefined'){
          progressionSetup.singleDbPrefs=progressionSetup.singleDbPrefs||{};
          if(item.exerciseId)progressionSetup.singleDbPrefs[item.exerciseId]=next;
        }
        if(afterChange) afterChange(item);
        schedulePersist();
      }));
    }
    /* Reps-only toggle in Exercise options (#395, user 2026-09-13): the
       setting was previously reachable only in the exercise picker's rule
       accordion. Flipping it recomputes suggestions; the host re-renders. */
    function wireRepsOnlyToggle(scope, findItem, afterChange){
      if(!scope || typeof findItem !== 'function') return;
      scope.querySelectorAll('[data-reps-only-toggle]').forEach(btn => btn.addEventListener('click', () => {
        const item = findItem(btn.dataset.repsOnlyToggle); if(!item) return;
        const p = item.progression || (item.progression = {});
        p.repsOnly = !p.repsOnly;
        if(afterChange) afterChange(item);
        schedulePersist();
      }));
    }
    /* Per-exercise RPE trigger threshold (user 2026-09-22): moved from
       Settings back under Exercise options where it used to be. Tapping a
       pill stores the override in item.progression.threshold (7/8/9 or
       'completion' for Off); the host re-renders so aria-pressed syncs. */
    function wireExerciseThresholdPills(scope, findItem, afterChange){
      if(!scope || typeof findItem !== 'function') return;
      scope.querySelectorAll('[data-ex-threshold]').forEach(btn => btn.addEventListener('click', () => {
        const item = findItem(btn.dataset.exThresholdUid); if(!item) return;
        const v = btn.dataset.exThreshold;
        const p = item.progression || (item.progression = {});
        p.threshold = v === 'completion' ? 'completion' : Number(v);
        if(afterChange) afterChange(item);
        schedulePersist();
      }));
    }
    /* #410 (user 2026-09-13): per-exercise dumbbell entry-mode override.
       Tapping a mode sets the item profile AND persists it in
       progressionSetup.dbEntryPrefs[exerciseId], so the choice sticks for
       this exercise in future workouts. afterChange re-renders the host
       (weight fields re-display in the new mode). */
    function wireDbEntryToggle(scope, findItem, afterChange){
      if(!scope || typeof findItem !== 'function') return;
      scope.querySelectorAll('[data-db-entry-mode]').forEach(btn => btn.addEventListener('click', () => {
        const mode=btn.dataset.dbEntryMode; if(mode!=='per'&&mode!=='total')return;
        const item = findItem(btn.dataset.dbEntryUid); if(!item) return;
        if(dbEntryMode(item.exerciseId,item)===mode)return;
        const p = item.progression || (item.progression = {});
        p.dbEntry = mode;
        if(typeof progressionSetup!=='undefined'){
          progressionSetup.dbEntryPrefs=progressionSetup.dbEntryPrefs||{};
          if(item.exerciseId)progressionSetup.dbEntryPrefs[item.exerciseId]=mode;
        }
        if(afterChange) afterChange(item);
        schedulePersist();
      }));
    }
    /* One canonical tracking-mode switch (efficiency pass 2026-09-12): maps
       the toggle's "seconds" to canonical 'time', no-ops when already set (no
       scroll jump), keeps the progression mode in sync, never mutates entered
       rep/seconds values. Returns true when the mode actually changed. */
    function setExerciseTracking(item, next, {resetCompletion=false}={}){
      const mode=next==='seconds'?'time':'reps';
      const ex=resolveExercise(item.exerciseId);
      if(exerciseTracking(item,ex)===mode)return false;
      item.tracking=mode;
      item.progression={...progressionProfileForDraftItem(item),mode};
      if(resetCompletion)item.sets.forEach(set=>{set.complete=false;});
      return true;
    }
    /* #564: canonical numeric sanitization for set fields. Set inputs stored
       raw strings with no clamp — fractional reps and absurd weights persisted
       into stats. Every write path (set-complete toggle, finish serialization,
       CSV import) funnels through this so imported data can't bypass it.
       Returns null for empty/invalid; reps are whole numbers. PURE. */
    function sanitizeSetValue(field, raw){
      if(raw==null||raw==='')return null;
      const n=Number(raw);
      if(!Number.isFinite(n))return null;
      const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
      switch(field){
        case 'w': return clamp(n,0,5000);
        case 'r': return clamp(Math.round(n),0,100000);
        case 'seconds': return clamp(n,0,86400);
        case 'distance': return clamp(n,0,1000000);
        case 'rpe': return clamp(n,0,10);
        default: return n;
      }
    }

    /* #562: malformed-hash guard shared by the cold-boot, hashchange, and
       popstate routing paths in app-bootstrap.js. A lone % (or other bad
       escape) must not throw and abort routing — fall back to the raw slice. PURE. */
    function safeDecodeHash(){
      try{return decodeURIComponent((location.hash||'').slice(1));}
      catch(_){return (location.hash||'').slice(1);}
    }
