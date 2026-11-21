export const APPEARANCE_STORAGE_KEY='future-mississauga.building-colours';
const valid=value=>value==='natural'||value==='status';
export function savedAppearance(storage){
 try {const value=(storage??globalThis.localStorage).getItem(APPEARANCE_STORAGE_KEY);return valid(value)?value:'natural';}catch{return 'natural';}
}
export function saveAppearance(value,storage){
 if(!valid(value))return;try{(storage??globalThis.localStorage).setItem(APPEARANCE_STORAGE_KEY,value);}catch{}
}
// Bind before importing the map engine, so a choice made during loading survives.
export function prepareAppearancePreference(select,storage,entrySearch=globalThis.location?.search){
 if(!select)return 'natural';
 if(!select.dataset.appearanceReady){
  const linked=entrySearch && new URLSearchParams(entrySearch).get('appearance');
  select.value=valid(linked)?linked:savedAppearance(storage);select.dataset.appearanceReady='true';
  select.addEventListener('change',()=>{if(valid(select.value)){select.dataset.appearanceChoice=select.value;saveAppearance(select.value,storage);}});
 }
 return valid(select.dataset.appearanceChoice)?select.dataset.appearanceChoice:select.value;
}
