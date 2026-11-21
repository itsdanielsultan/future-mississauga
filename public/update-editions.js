(() => {
  // Links into older articles keep their original addresses and open the full edition notes.
  function showEdition() {
    const page = window.fmLocal?.historyURL() || new URL(location.href);
    const hash = page.hash.slice(1);
    const older = /^(?:november-|october-|earlier-studies|m-city-studies|latestNotes|local-accuracy-review)/.test(hash);
    const notes = older || page.searchParams.get('view') === 'notes';
    document.documentElement.dataset.updateEdition = notes ? 'notes' : 'timeline';
  }
  showEdition();
  window.addEventListener('hashchange', showEdition);
  window.addEventListener('pageshow', showEdition);
})();
