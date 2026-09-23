
/* ===== module: supersets.js ===== */
    /** Groups and reorders workout exercises without changing their logging data.
     *  The superset + reorder dialogs work on whichever exercise list is open —
     *  the live draft or the saved-workout builder (user 2026-09-12) — through
     *  the small context helpers below instead of duplicated per-screen logic. */
     /* Module map (v1.006) — Key: normalizeSupersets(), exerciseListContext(), contextRerender(). Depends on: draft/exercise items (workout-editor), state (draft or builder). */
    function exerciseListContext() {
      /* The builder is an overlay on the workout tab; while it's open, its
         exercise list is the one the user is editing. */
      if (state.builderOpen && state.savedBuilder) return 'builder';
      return 'draft';
    }
    /* The exercise list under edit: the saved builder's, or the live draft's. */
    function contextExercises() {
      if (exerciseListContext() === 'builder') return state.savedBuilder.exercises;
      return workoutState.draft ? workoutState.draft.exercises : null;
    }
    /* Re-renders whichever exercise list is under edit. */
    function contextRerender() {
      if (exerciseListContext() === 'builder') { renderSavedBuilder(); return; }
      renderWorkoutExercises(); renderWorkoutProgression();
    }
    /* Persists whichever exercise list is under edit (builder persist / draft save). */
    function contextSaved() {
      if (exerciseListContext() === 'builder') schedulePersist();
      else markDraftSaved();
    }
    /* Dissolves superset groups that fell below 2 members. */
    function normalizeSupersets() {
      const list = contextExercises();
      if (!list) return;
      const counts = list.reduce((all, item) => {
        if (item.supersetId) all[item.supersetId] = (all[item.supersetId] || 0) + 1;
        return all;
      }, {});
      list.forEach(item => { if (item.supersetId && counts[item.supersetId] < 2) item.supersetId = null; });
    }
    /* #438 (user 2026-09-14): partition an exercise list into visual superset
       blocks. Consecutive exercises sharing a supersetId form one group block
       when the id has 2+ members list-wide; everything else is a single block.
       Non-adjacent members of one group get one outline each (same group
       number) since a single outline can't span a gap. */
    function supersetVisualBlocks(list){
      const counts={};
      list.forEach(item=>{if(item.supersetId)counts[item.supersetId]=(counts[item.supersetId]||0)+1;});
      const blocks=[];let i=0;
      while(i<list.length){
        const item=list[i];
        if(item.supersetId&&counts[item.supersetId]>1){
          const run=[item];let j=i+1;
          while(j<list.length&&list[j].supersetId===item.supersetId){run.push(list[j]);j++;}
          blocks.push({group:true,supersetId:item.supersetId,items:run});
          i=j;
        }else{
          blocks.push({group:false,items:[item]});
          i++;
        }
      }
      return blocks;
    }
    /* User 2026-09-14: reordering lumps a superset together — the reorder
       dialog moves the whole visual block, not a single row. Pure: returns
       the new item order with the block containing index moved one block
       up/down, or null when it can't move. */
    function moveBlockAt(list,index,dir){
      const blocks=supersetVisualBlocks(list);
      let bi=-1,acc=0;
      for(let k=0;k<blocks.length;k++){if(index<acc+blocks[k].items.length){bi=k;break;}acc+=blocks[k].items.length;}
      if(bi<0)return null;
      const j=dir==='up'?bi-1:bi+1;
      if(j<0||j>=blocks.length)return null;
      const moved=blocks.splice(bi,1)[0];
      blocks.splice(j,0,moved);
      return blocks.flatMap(b=>b.items);
    }
    /* #438: the group outline header — one "Superset N" label plus the single
       Edit affordance for the whole group, which opens the reorder dialog
       (user 2026-09-22: the reorder dialog's checkboxes are the only superset
       surface; the per-exercise member picker is gone). editAttr is the call
       site's data attribute (wired by the existing per-screen superset button
       wiring). */
    function supersetGroupHeadHtml(list,supersetId,editAttr){
      const n=supersetGroupNumber(list,supersetId);
      return `<div class="superset-group-head"><span class="superset-group-label">Superset ${n}</span><button class="superset-group-edit" type="button" ${editAttr} aria-label="Edit superset ${n}">Edit superset</button></div>`;
    }
