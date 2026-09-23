/* ===== module: formulas/program-math.js ===== */
    /** Program-schedule math: weekly %1RM waves, deload weeks, %1RM clamps.
        Plain-English rules: a program may define a weekly percentage wave
        (weeklyPcts); programPctForWeek returns the wave's percent for a given
        week (cycling when the program runs longer than the wave), or null
        when the wave is off or empty — a disabled wave leaves stale
        weeklyPcts inert so the flat percent rules. isDeloadWeek is true when
        the program marks that week a deload. clampPct1RM pins a %1RM to
        1–100 (default 75); clampDeloadPct pins a deload percent to 40–80
        (default 60).
        Depends on: progressionSetup (state.js) — read at CALL time.
        Worked example: programPctForWeek({pctWave:true,weeklyPcts:[70,80,90]},5)
        → 80 (week 5 cycles to position 2). */

    /* %1RM per-week % wave (#54, v1.001): mirrors programRangeForWeek, but for
       load percent instead of rep range. Explicit weekly entries beat the flat
       percentOf1RM default; #118 loop semantics — the wave cycles across the
       program length. Accepts a program or a bare progression/config object. */
    function programPctForWeek(programOrConfig,week){
      const progression=programOrConfig?.progression||programOrConfig||progressionSetup;
      /* The wave only applies when the toggle is on; a disabled wave leaves
         stale weeklyPcts inert so the flat percent rules. */
      if(!progression.pctWave)return null;
      const arr=progression.weeklyPcts;
      if(!Array.isArray(arr)||!arr.length)return null;
      const w=Math.max(1,Number(week)||1);
      const v=Number(arr[(w-1)%arr.length]);
      return Number.isFinite(v)&&v>0?v:null;
    }

    /* A week is a deload week only when the user flagged it in the % wave
       panel (#478). QA batch (user 2026-09-22): Auto Deload (every-N-weeks)
       is removed — deloads are never scheduled automatically, only flagged
       by hand. The flags go inert when the wave toggle is off, like the
       weeklyPcts (programPctForWeek above), so a flag set while the panel
       was visible can't keep deloading (and lighting the cover's week bar)
       with no UI to see or clear it. */
    function isDeloadWeek(programOrConfig,week){
      const progression=programOrConfig?.progression||programOrConfig||progressionSetup;
      const w=Math.max(1,Number(week)||0);
      if(!(w>0))return false;
      if(!progression.pctWave)return false;
      const flags=progression.weeklyDeloads;
      return Array.isArray(flags)&&flags.length>0&&!!flags[(w-1)%flags.length];
    }

    /* → assets/js/formulas/increments.js: roundedIncrement — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/increments.js: scaledLoadIncrement — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/increments.js: snapToIncrement — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/increments.js: snapUpToIncrement — moved here in the v1.878 restructure (no behavior change). */

    /* v1.878 restructure: snapPlateLoad deleted — plate snapping was reversed
       per #246 (suggested loads snap to the increment grid, never plates) and
       nothing in the app called it; its obsolete tests were removed from
       tests/progression.test.js. */
    /* → assets/js/formulas/increments.js: warmupLadderRows — moved here in the v1.878 restructure (no behavior change). */
    /* → assets/js/formulas/increments.js: warmupAnchorLb — moved here in the v1.878 restructure (no behavior change). */
    /* % of 1RM clamps to 1–100 (v0.99994 behavior); unset/invalid → 75. */
    function clampPct1RM(v){const n=Number(v);return Number.isFinite(n)&&n>0?Math.min(100,Math.max(1,Math.round(n))):75;}

    /* Deload load clamps to 40–80%; unset/invalid → 60. */
    function clampDeloadPct(v){const n=Number(v);return Number.isFinite(n)&&n>0?Math.min(80,Math.max(40,Math.round(n))):60;}
