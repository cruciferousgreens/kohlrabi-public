/* ===== module: components/empty-states.js ===== */
    /** Shared empty-state card: the single "nothing here yet" presentation
        used across views (workout editor, dashboard/stats, exercise library,
        programs). Pure HTML builder — callers supply the copy and action
        buttons; the component owns the markup and classes.
        Depends on: escapeHtml (lib/utilities.js) — read at CALL time.
        Worked example: emptyStateHtml({title:'No workouts yet',
        description:'Log your first session.', primaryHtml:'<button>…</button>'})
        → a centered .empty-state card. */

    /* #504 (v1.8): shared empty-state builder — Nielsen Norman / Cloudscape:
       the heading states the state, one short description only when it adds
       info, and every state offers an action. Filtered-void states get a
       reset action, distinct from first-use states. Sentence case, no
       exclamation points, no "please". Callers pass their own button/link
       markup so each screen's wiring stays next to its renderer. */
    function emptyStateHtml({title, description, primaryHtml, secondaryHtml}) {
      return `<div class="empty-state"><h2 class="empty-state-title">${escapeHtml(title)}</h2>`
        +(description?`<p class="empty-state-sub">${escapeHtml(description)}</p>`:'')
        +((primaryHtml||secondaryHtml)?`<div class="empty-state-actions">${primaryHtml||''}${secondaryHtml||''}</div>`:'')
        +`</div>`;
    }
