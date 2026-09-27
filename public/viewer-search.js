// Search the local, cited project catalogue; no external geocoder or tracking.
const knownAliases={
 'absolute-world':['Marilyn Monroe','Marilyn Monroe towers','Absolute towers'],
 'alba':['Alba condos'],
 'perla-towers':['Perla','35 Watergarden','65 Watergarden'],
 'watergarden':['Gemma','15 Watergarden'],
 'exchange-district':['Exchange District','EX1','EX2','EX3','EXS'],
 'mcity-1-2':['M City 1','M City 2','M1','M2'],
 'mcity-3':['M City 3','M3'], 'mcity-4':['M City 4','M4']
};
const abbreviations={rd:'road',st:'street',ave:'avenue',av:'avenue',blvd:'boulevard',dr:'drive',crt:'court',ct:'court',cres:'crescent',pkwy:'parkway',hwy:'highway',e:'east',w:'west',n:'north',s:'south'};
export function normalizeSearch(value){return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/(\d)([a-z])|([a-z])(\d)/g,(_,a,b,c,d)=>a?`${a} ${b}`:`${c} ${d}`).replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).map(t=>abbreviations[t]||t).join(' ');}
export function createSearchIndex(projects){return projects.map(project=>{
 const aliases=[...(knownAliases[project.id]||[]),...(Array.isArray(project.aliases)?project.aliases:[])];
 const fields=[project.name,project.address,...aliases,project.id].map(normalizeSearch).filter(Boolean);
 return {project,fields,words:[...new Set(fields.join(' ').split(' '))]};
});}
export function searchProjects(index,query,limit=6){
 const text=normalizeSearch(query);if(!text)return [];
 const tokens=text.split(' ');
 return index.flatMap(entry=>{
  if(!tokens.every(t=>entry.words.some(w=>/^\d+$/.test(t)?w===t:w.startsWith(t))))return [];
  let score=40+tokens.reduce((n,t)=>n+(entry.words.includes(t)?8:0),0);
  entry.fields.forEach((field,i)=>{const weight=i===0?120:i===1?105:110;if(field===text)score=Math.max(score,weight+30);else if(field.startsWith(text))score=Math.max(score,weight+15);else if((' '+field+' ').includes(' '+text+' '))score=Math.max(score,weight);});
  return [{project:entry.project,score}];
 }).sort((a,b)=>b.score-a.score||a.project.name.localeCompare(b.project.name)).slice(0,limit).map(x=>x.project);
}
