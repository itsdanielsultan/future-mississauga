// Controls are part of the initial document so their order is stable before loading.
export function arrangeViewerControls(root=document){
 const key=root.querySelector('.scene-status-key');
 if(key)key.hidden=root.querySelector('#appearanceSelect')?.value!=='status';
}
