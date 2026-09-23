/* ===== module: formulas/prs.js ===== */
    /** Personal-record detection: pure comparisons of current sets vs prior sets.
        Plain-English rules: 'e1rm' = the current session's best estimated 1RM
        beats the prior best by more than PR_E1RM_TOLERANCE (0.5 lb — keeps
        rounding noise from flagging PRs); 'heaviest' = the current session's
        top set is heavier than any prior set; bodyweight rep PRs compare
        unweighted sets only (a weighted set's reps are a different movement
        class); timed PRs (#282) compare longest hold at the SAME load.
        Callers own the definition of "prior" (all history vs other workouts) —
        see priorSetsForPR in lib/utilities.js for the shared prior definition.
        Depends on: estimate1RM (e1rm.js) — read at CALL time.
        Worked example: current=[{w:225,r:5}], prior best e1RM 240 →
        detectExercisePRs returns 'e1rm' iff estimate1RM(225×5) > 240.5. */

    /* → assets/js/formulas/volume.js: SECONDARY_MUSCLE_WEIGHT — moved here in the v1.878 restructure (no behavior change). */
    /* PR detection core: compares current sets against prior sets and reports
       which PR kind (if any) the current work achieves — 'e1rm' for a new
       estimated-1RM best, 'heaviest' for a new heaviest set. The tolerance
       keeps tiny rounding noise from flagging e1RM PRs. Callers own the
       definition of "prior" (all history vs. other workouts). Shared by the
       live-workout PR label and the Stats recent-PRs list. */
    const PR_E1RM_TOLERANCE=0.5;

    function detectExercisePRs(currentSets,priorSets){
      const current=currentSets||[],prior=priorSets||[];
      if(!current.length||!prior.length)return '';
      const best=Math.max(...current.map(estimate1RM)),priorBest=Math.max(...prior.map(estimate1RM));
      if(best>priorBest+PR_E1RM_TOLERANCE)return 'e1rm';
      const weight=Math.max(...current.map(set=>Number(set.w)||0)),priorWeight=Math.max(...prior.map(set=>Number(set.w)||0));
      if(weight>priorWeight)return 'heaviest';
      return '';
    }

    /* #282: timed-PR detection — longest hold at a given load. A hold beats
       the prior best at the SAME load (unweighted = load 0); a load with no
       prior hold is new territory, so any hold there is a PR — mirroring how
       'heaviest' treats a new top weight. Callers own the "prior" definition,
       same contract as detectExercisePRs. */
    function detectTimedPRs(currentSets,priorSets){
      const current=(currentSets||[]).filter(s=>Number(s.seconds)>0),prior=(priorSets||[]).filter(s=>Number(s.seconds)>0);
      if(!current.length||!prior.length)return false;
      const load=s=>Number(s.w)||0;
      const bestAt=target=>{const pool=prior.filter(s=>load(s)===target);return pool.length?Math.max(...pool.map(s=>Number(s.seconds))):-Infinity;};
      return current.some(s=>Number(s.seconds)>bestAt(load(s)));
    }

    /* #372: bodyweight rep-PR detection — best unweighted rep set. estimate1RM
       is 0 for load-free sets, so bodyweight bests never registered as PRs
       anywhere. A rep count beats the prior best among UNWEIGHTED sets only
       (a weighted set's reps are a different movement class); no prior
       unweighted work means no PR, matching the weighted path's first-session
       rule. Callers own the "prior" definition, same contract as
       detectExercisePRs. */
    function detectBodyweightPRs(currentSets,priorSets){
      const unweighted=sets=>(sets||[]).filter(s=>!(Number(s.w)>0)&&Number(s.r)>0);
      const current=unweighted(currentSets),prior=unweighted(priorSets);
      if(!current.length||!prior.length)return false;
      return Math.max(...current.map(s=>Number(s.r)))>Math.max(...prior.map(s=>Number(s.r)));
    }
