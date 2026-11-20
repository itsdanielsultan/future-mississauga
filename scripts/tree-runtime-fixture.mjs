import {readFileSync} from 'node:fs';
export {registerHarbornTreeContacts,applyHarbornTreeContacts} from '../public/harborn-tree-contacts.js';
export {registerBoundedCrownContacts,applyBoundedCrownContacts} from '../public/bounded-crown-contacts.js';
export {registerSouthCommonStudyOcclusion,applySouthCommonStudyOcclusion} from '../public/south-common-study-occlusion.js';
export const refinementData=JSON.parse(readFileSync(new URL('../public/data/refinement-models.json',import.meta.url)));
export const surroundingCity=null;
