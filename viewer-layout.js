// Keep the original controls and their event bindings together with the canvas.
export function arrangeViewerControls(root=document){
 const scene=root.querySelector('#sceneWrap'),picker=root.querySelector('.scenario-picker'),key=root.querySelector('.scene-status-key');
 if(!scene||!picker||!key||root.querySelector('.viewer-viewbar'))return;
 const bar=root.createElement('div');bar.className='viewer-viewbar';bar.setAttribute('aria-label','Map view and building colours');
 bar.append(picker,key);scene.before(bar);
 const edges=root.querySelector('.detail-toggle'),layers=root.querySelector('.viewer-options .layer-controls');
 if(edges&&layers)layers.prepend(edges);
 const toolbar=root.querySelector('.toolbar');if(toolbar&&!toolbar.children.length)toolbar.remove();
 root.querySelector('.map-presentation')?.setAttribute('aria-label','Map orientation and credits');
}
