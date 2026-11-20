"""Render new final-held Lakeview captures with an explicit source-bound water adapter."""
from pathlib import Path
import bpy,json,hashlib,datetime,argparse,sys,time,os,math
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
p=argparse.ArgumentParser();p.add_argument('import_proof',type=Path);p.add_argument('plan',type=Path);p.add_argument('output',type=Path);p.add_argument('--identities');p.add_argument('--water-shadow-disabled',action='store_true');p.add_argument('--samples',type=int,default=96);p.add_argument('--max-preview-edge',type=int);p.add_argument('--allow-trial',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);assert 1<=a.samples<=4096
P=a.output.resolve();assert not P.exists() or not any(P.iterdir());P.mkdir(parents=True,exist_ok=True);(P/'renderer-source.py').write_bytes(Path(__file__).read_bytes())
def pin(p):
 p=Path(p);h=hashlib.sha256()
 with p.open('rb')as f:
  while b:=f.read(8*1024*1024):h.update(b)
 return {'path':str(p.resolve()),'bytes':p.stat().st_size,'sha256':h.hexdigest()}
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
imp=json.loads(a.import_proof.read_text());nativeInventory=Path(imp['inventory']['path']);assert pin(nativeInventory)['sha256']==imp['inventory']['sha256'];nativeWarnings=json.loads(nativeInventory.read_text()).get('warnings',[]);plan=json.loads(a.plan.read_text());assert imp['state'] in ['IMPORT_INSPECTION_PASS','OFFLINE_WATER_ADAPTER_GEOMETRY_VERIFIED_VISUAL_REVIEW_REQUIRED'];assert bpy.context.scene.get('nativeSceneSHA256')==imp['input']['sha256'];assert pin(bpy.data.filepath)['sha256']==imp['packedBlend']['sha256']
adapter=imp.get('offlineRepresentationAdapter');adapterRecord=None
if imp['state']=='OFFLINE_WATER_ADAPTER_GEOMETRY_VERIFIED_VISUAL_REVIEW_REQUIRED':assert adapter is not None,'Derived water import requires an explicit pinned adapter proof'
if adapter:
 assert pin(adapter['path'])['sha256']==adapter['sha256'];adapterRecord=json.loads(Path(adapter['path']).read_text());assert adapterRecord['output']['sha256']==imp['packedBlend']['sha256'];assert adapterRecord['sourceGLB']['sha256']==imp['input']['sha256'];assert adapterRecord['district']==imp['district'] and adapterRecord['scenario']==imp['scenario']
assert imp['district']=='lakeview' and adapterRecord is not None
assert imp['sourceRevision']['sourceFilesManifest']['sha256']=='ae821b28940a256ec6732bed07db359593b8c0faffcf5b900858a10bf4fbc20e'
assert pin(a.plan)['sha256']=='4aabc1a7d91401759d58fd13decd24470d4bbe60c3b4d5f0f13335150df8e701'
assert adapterRecord['ohnSourceIdentityAndPBRExact'] is True
assert adapterRecord['ohnAsset']['sha256']=='0f27774f67dc09a29e0713d401b40dcabc6e14011874a0bb8daf7c654bcd814d'
assert a.water_shadow_disabled,'Final Lakeview uses the separately recorded native shadow-disabled restoration'
assert (a.max_preview_edge==1200 and a.samples==12) or (a.max_preview_edge is None and a.samples==96)
lightingRepresentations=json.loads(nativeInventory.read_text()).get('lightingRepresentations',[])
assert lightingRepresentations,'New shadow-compatible native lighting qualification required'
shadowRecord=None
if a.water_shadow_disabled:
 water=bpy.data.objects.get('LakeOntarioUnified');assert water is not None and water.type=='MESH';shadowRecord={'object':water.name,'visibleShadowBefore':bool(water.visible_shadow),'visibleShadowAfter':False,'basis':'Frozen city-context.js takeLake explicitly sets castShadow=false. Separate A/B factor, not assumed tonal cause.'};water.visible_shadow=False;shadowSource=(Path(os.environ['FM_MODEL_ARCHIVE'])/'scene-presentation-correction-2026-11-01/native-context-capture/final-held-v1/site/city-context.js');assert pin(shadowSource)['sha256']=='4c499d703ac420cc55f98511546b1aa619b006463f59b7c3b93970a859511637';sourceText=shadowSource.read_text();assert 'lake.renderOrder=-1;lake.castShadow=false;lake.receiveShadow=false;' in sourceText;underlayRows=[n for n in json.loads(nativeInventory.read_text())['nodes'] if n['name']=='LakeOntarioUnified' and n.get('metadata',{}).get('qaRenderOrder')==-1];assert len(underlayRows)==1 and underlayRows[0]['triangles']==10647 and underlayRows[0]['materials'][0]['depthWrite'] is False;shadowRecord['sourceCode']=pin(shadowSource);shadowRecord['sourceLines']=[39];shadowRecord['nativeUnderlayRowSHA256']=hashlib.sha256(json.dumps(underlayRows[0],sort_keys=True).encode()).hexdigest();shadowRecord['nativeUnderlaySourceTriangles']=10647
ohnRows=[n for n in json.loads(nativeInventory.read_text())['nodes'] if n.get('metadata',{}).get('assetId')=='ohn-lakeview-offshore-supplement-v1']
assert len(ohnRows)==1
ohnRow=ohnRows[0];md=ohnRow['metadata']
assert md['sourceAssetSHA256']=='0f27774f67dc09a29e0713d401b40dcabc6e14011874a0bb8daf7c654bcd814d' and md['sourceAssetRevision']=='offshore-margin-v2'
assert md['qaCastShadow'] is False and ohnRow['vertices']==93 and ohnRow['triangles']==91
knownOHN=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('assetId')=='ohn-lakeview-offshore-supplement-v1'];assert len(knownOHN)==1
offshore=knownOHN[0]
ohnShadow={'object':offshore.name,'before':bool(offshore.visible_shadow),'after':False,'basis':'Actual exported qaCastShadow=false and exact approved native OHN asset identity; no geometry or material change.'}
offshore.visible_shadow=False
shadowRecord['integratedOHN']=ohnShadow
assert imp['sourceRevision']['state']=='FINAL_FROZEN','Final district source freeze required'

selected=set(a.identities.split(',')) if a.identities else None
jobs=[j for j in plan['jobs'] if j['district']==imp['district'] and j['scenario']==imp['scenario'] and (selected is None or j['identity'] in selected)];assert jobs,'No matching render jobs'
s=bpy.context.scene;before={'objects':len(s.objects),'meshObjects':sum(o.type=='MESH' for o in s.objects),'triangles':sum(len(p.vertices)-2 for o in s.objects if o.type=='MESH' for p in o.data.polygons),'materialNames':sorted(m.name for m in bpy.data.materials)}
for o in list(s.objects):
 if o.type in ['LIGHT','CAMERA']:bpy.data.objects.remove(o,do_unlink=True)
l=plan['lighting'];world=bpy.data.worlds.new('Architectural native scene studio');world.use_nodes=True;bg=world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=l['worldColour'];bg.inputs['Strength'].default_value=l['worldStrength'];s.world=world
ld=bpy.data.lights.new('Matched studio sun','SUN');sun=bpy.data.objects.new(ld.name,ld);s.collection.objects.link(sun);sun.rotation_euler=l['sunRotationEuler'];ld.energy=l['sunEnergy'];ld.angle=l['sunAngle'];ld.color=l['sunColour']
s.render.engine='CYCLES';s.cycles.samples=a.samples;s.cycles.use_denoising=True;s.cycles.use_adaptive_sampling=True;s.cycles.adaptive_threshold=.022;s.cycles.denoiser='OPENIMAGEDENOISE';s.cycles.denoising_input_passes='RGB_ALBEDO_NORMAL';s.cycles.denoising_prefilter='ACCURATE'
os.environ['CYCLES_METAL_DISABLE_BINARY_ARCHIVES']='1';prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.refresh_devices();prefs.metalrt='ON';prefs.kernel_optimization_level='OFF'
for dev in prefs.devices:dev.use=dev.type=='METAL'
assert any(dev.use for dev in prefs.devices),'GPU unavailable';s.cycles.device='GPU';s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.image_settings.color_depth='8';s.render.image_settings.compression=15;s.render.film_transparent=True;s.render.resolution_percentage=100;s.render.use_border=False;s.render.use_crop_to_border=False;s.render.use_persistent_data=True;s.render.pixel_aspect_x=1;s.render.pixel_aspect_y=1
s.view_settings.view_transform=l['viewTransform'];s.view_settings.look=l['look'];s.view_settings.exposure=l['exposure'];s.view_settings.gamma=l['gamma']
r={'state':'RENDERING','sourceState':imp['sourceRevision']['state'],'sourceImport':pin(a.import_proof),'sourceGLB':imp['input'],'sourceBlend':imp['packedBlend'],'plan':pin(a.plan),'renderer':pin(P/'renderer-source.py'),'district':imp['district'],'scenario':imp['scenario'],'startedUTC':stamp(),'blenderVersion':bpy.app.version_string,'samples':a.samples,'lighting':l,'background':plan['background'],'sourceGeometryEdited':False,'sourceMaterialsEdited':False,'sourceBefore':before,'sourcePresentationWarnings':nativeWarnings,'preview':bool(a.max_preview_edge),'images':[],'published':False}
r['nativeLightingRepresentations']=lightingRepresentations;r['ohnIntegratedNativeAsset']=adapterRecord['ohnAsset'];r['offlineRepresentationAdapter']=adapter;r['derivedRepresentationEdited']=bool(adapter);r['originalPackedBlend']=adapterRecord['originalPackedBlend'] if adapterRecord else imp['packedBlend'];r['shadowRestorationABFactor']=shadowRecord;r['representationScope']='Source files unchanged; explicitly pinned derived underlay overlap clip when adapter is present. All other source geometry/materials unchanged. OHN is already in the new native capture; no offline asset injection. Reviewed Cycles lighting replaces runtime WebGL directional-light sampling.'
for job in jobs:
 c=job['camera'];cd=bpy.data.cameras.new(job['identity']);cam=bpy.data.objects.new(cd.name,cd);s.collection.objects.link(cam);cam.location=c['location'];cam.rotation_euler=c['rotationEuler'];cd.type=c['type'];cd.lens=c['lens'];cd.ortho_scale=c['orthoScale'];cd.sensor_fit=c['sensorFit'];cd.sensor_width=c['sensorWidth'];cd.sensor_height=c['sensorHeight'];cd.shift_x,cd.shift_y=c['shift'];cd.clip_start,cd.clip_end=c['clip'];s.camera=cam
 w,h=job['resolution'];scale=min(1,a.max_preview_edge/max(w,h)) if a.max_preview_edge else 1;s.render.resolution_x=round(w*scale);s.render.resolution_y=round(h*scale);out=P/job['identity'].replace('.png','');out.mkdir(parents=True);s.render.filepath=str(out/'scene-rgba.png');bpy.context.view_layer.update()
 # Project a true north perturbation at the shifted image centre. Pixel aspect
 # and sensor-fit projection are both handled by the actual Blender camera.
 frame=cd.view_frame(scene=s);centre=sum(frame,Vector())/4;centre=cam.matrix_world@(centre*1000);origin=world_to_camera_view(s,cam,centre);north=world_to_camera_view(s,cam,centre+Vector((0,1,0)));direction=[(north.x-origin.x)*s.render.resolution_x,-(north.y-origin.y)*s.render.resolution_y];length=math.hypot(*direction);assert length>0;direction=[x/length for x in direction]
 t=time.time();started=stamp();bpy.ops.render.render(write_still=True);row={'identity':job['identity'],'image':pin(s.render.filepath),'dimensions':[s.render.resolution_x,s.render.resolution_y],'plannedNativeDimensions':job['resolution'],'preview':bool(a.max_preview_edge),'renderStartedUTC':started,'renderCompletedUTC':stamp(),'seconds':time.time()-t,'camera':c,'cameraQualifications':job['cameraQualifications'],'north':{'screenUnitRightDown':direction,'bearingClockwiseFromScreenUpDegrees':(math.degrees(math.atan2(direction[0],-direction[1]))+360)%360,'method':'Actual projection of world north at image-centre ray; lens shift, sensor fit, pixel frame accounted for','worldNorthBlender':[0,1,0]},'sourceInputSHA256':imp['input']['sha256'],'district':imp['district'],'scenario':imp['scenario'],'geographicScope':job.get('geographicScope', 'whole_municipality' if imp['district']=='citywide' else 'named_district_scene'),'sourcePresentationWarnings':nativeWarnings,'nativePixelsNoUpscaling':True,'crop':False,'title':job['title'],'area':job['area'],'sourceAttributionPolicy':'Final credits are read from this exact frozen native export, separately pinned in credits.json; historical inventory attribution is not reused.'};row['nativeLightingRepresentations']=lightingRepresentations;row['ohnIntegratedNativeAsset']=adapterRecord['ohnAsset'];row['offlineRepresentationAdapter']=adapter;row['derivedRepresentationEdited']=bool(adapter);row['shadowRestorationABFactor']=shadowRecord;r['images'].append(row);(out/'scene-proof.json').write_text(json.dumps(row,indent=2)+'\n');(P/'render-proof.json').write_text(json.dumps(r,indent=2)+'\n');print('NATIVE_VIEW_RENDERED',job['identity'],flush=True)
after={'meshObjects':sum(o.type=='MESH' for o in s.objects),'triangles':sum(len(p.vertices)-2 for o in s.objects if o.type=='MESH' for p in o.data.polygons),'materialNames':sorted(m.name for m in bpy.data.materials)};assert all(after[k]==before[k] for k in after);r['sourceAfter']=after;r['state']='RENDERED_VISUAL_REVIEW_REQUIRED';r['completedUTC']=stamp();(P/'render-proof.json').write_text(json.dumps(r,indent=2)+'\n')
