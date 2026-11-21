import {readFile,writeFile} from 'node:fs/promises';

const data = new URL('../public/data/',import.meta.url);
const transit = JSON.parse(await readFile(new URL('transit.json',data),'utf8'));
// The map draws routes from versioned GLBs. The picker needs only station records.
const fields = ['id','name','system','status','position','coordinateCaveat','positionCaveat','caveat','note','source'];
const stations = transit.stations.map(row=>Object.fromEntries(fields.filter(key=>key in row).map(key=>[key,row[key]])));
await writeFile(new URL('map-stations.json',data),JSON.stringify({asOf:transit.asOf,stations})+'\n');
