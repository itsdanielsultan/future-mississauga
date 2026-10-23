const counts = document.querySelector('#sourceCounts');
if (counts) {
  try {
    const response = await fetch('data/stats.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Source counts unavailable');
    const stats = await response.json();
    const records = Number(stats.researchedRecords), groups = Number(stats.municipalGroups);
    if (Number.isSafeInteger(records) && records >= 0 && Number.isSafeInteger(groups) && groups >= 0) {
      counts.textContent = `${records.toLocaleString()} research records · ${groups.toLocaleString()} municipal source groups`;
    }
  } catch {
    // The source notes and links remain available if the live count cannot load.
    counts.hidden = true;
  }
}
