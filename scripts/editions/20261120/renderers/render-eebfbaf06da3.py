"""Render only camera/light changes over a verified, packed native import."""
from pathlib import Path
import bpy,json,hashlib,datetime,argparse,sys,time,os,math
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
p=argparse.ArgumentParser();p.add_argument('import_proof',type=Path);p.add_argument('plan',type=Path);p.add_argument('output',type=Path);p.add_argument('--identities');p.add_argument('--samples',type=int,default=96);p.add_argument('--max-preview-edge',type=int);p.add_argument('--allow-trial',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);assert 1<=a.samples<=4096
P=a.output.resolve();assert not P.exists() or not any(P.iterdir());P.mkdir(parents=True,exist_ok=True);(P/'renderer-source.py').write_bytes(Path(__file__).read_bytes())
def pin(p):
 p=Path(p);h=hashlib.sha256()
 with p.open('rb')as f:
  while b:=f.read(8*1024*1024):h.update(b)
 return {'path':str(p.resolve()),'bytes':p.stat().st_size,'sha256':h.hexdigest()}
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
imp=json.loads(a.import_proof.read_text());nativeInventory=Path(imp['inventory']['path']);assert pin(nativeInventory)['sha256']==imp['inventory']['sha256'];nativeWarnings=json.loads(nativeInventory.read_text()).get('warnings',[]);plan=json.loads(a.plan.read_text());assert imp['state']=='IMPORT_INSPECTION_PASS';assert bpy.context.scene.get('nativeSceneSHA256')==imp['input']['sha256'];assert pin(bpy.data.filepath)['sha256']==imp['packedBlend']['sha256']
if not a.allow_trial:assert imp['sourceRevision']['state']=='FINAL_FROZEN','Final district source freeze required'
selected=set(a.identities.split(',')) if a.identities else None
jobs=[j for j in plan['jobs'] if j['district']==imp['district'] and j['scenario']==imp['scenario'] and (selected is None or j['identity'] in selected)];assert jobs,'No matching render jobs'
s=bpy.context.scene;before={'objects':len(s.objects),'meshObjects':sum(o.type=='MESH' for o in s.objects),'triangles':sum(len(p.vertices)-2 for o in s.objects if o.type=='MESH' for p in o.data.polygons),'materialNames':sorted(m.name for m in bpy.data.materials)}
for o in list(s.objects):
 if o.type in ['LIGHT','CAMERA']:bpy.data.objects.remove(o,do_unlink=True)
l=plan['lighting'];world=bpy.data.worlds.new('Architectural native scene studio');world.use_nodes=True;bg=world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=l['worldColour'];bg.inputs['Strength'].default_value=l['worldStrength'];s.world=world
ld=bpy.data.lights.new('Matched studio sun','SUN');sun=bpy.data.objects.new(ld.name,ld);s.collection.objects.link(sun);sun.rotation_euler=l['sunRotationEuler'];ld.energy=l['sunEnergy'];ld.angle=l['sunAngle'];ld.color=l['sunColour']
s.render.engine='CYCLES';s.cycles.samples=a.samples;s.cycles.use_denoising=True;s.cycles.use_adaptive_sampling=True;s.cycles.adaptive_threshold=.022;s.cycles.denoiser='OPENIMAGEDENOISE';s.cycles.denoising_input_passes='RGB_ALBEDO_NORMAL';s.cycles.denoising_prefilter='ACCURATE'

# On a full volume a tiled render can exhaust scratch space before Cycles writes
# the native image. In that case keep this edition's render passes in memory.
import shutil
free_at_start = shutil.disk_usage(P).free
if free_at_start < 4 * 1024**3:
    s.cycles.tile_size = 8192
os.environ['CYCLES_METAL_DISABLE_BINARY_ARCHIVES']='1';prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.refresh_devices();prefs.metalrt='ON';prefs.kernel_optimization_level='OFF'
for dev in prefs.devices:dev.use=dev.type=='METAL' and os.environ.get('FM_CYCLES_DEVICE','AUTO').upper()!='CPU'
s.cycles.device='GPU' if any(dev.use for dev in prefs.devices) else 'CPU'
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.image_settings.color_depth='8';s.render.image_settings.compression=15;s.render.film_transparent=True;s.render.resolution_percentage=100;s.render.use_border=False;s.render.use_crop_to_border=False;s.render.use_persistent_data=True;s.render.pixel_aspect_x=1;s.render.pixel_aspect_y=1
s.view_settings.view_transform=l['viewTransform'];s.view_settings.look=l['look'];s.view_settings.exposure=l['exposure'];s.view_settings.gamma=l['gamma']
r={'state':'RENDERING','cyclesDevice':s.cycles.device,'cyclesTileSize':s.cycles.tile_size,'freeScratchAtStart':free_at_start,'sourceState':imp['sourceRevision']['state'],'sourceImport':pin(a.import_proof),'sourceGLB':imp['input'],'sourceBlend':imp['packedBlend'],'plan':pin(a.plan),'renderer':pin(P/'renderer-source.py'),'district':imp['district'],'scenario':imp['scenario'],'startedUTC':stamp(),'blenderVersion':bpy.app.version_string,'samples':a.samples,'lighting':l,'background':plan['background'],'sourceGeometryEdited':False,'sourceMaterialsEdited':False,'sourceBefore':before,'sourcePresentationWarnings':nativeWarnings,'preview':bool(a.max_preview_edge),'images':[],'published':False}
for job in jobs:
 c=job['camera'];cd=bpy.data.cameras.new(job['identity']);cam=bpy.data.objects.new(cd.name,cd);s.collection.objects.link(cam);cam.location=c['location'];cam.rotation_euler=c['rotationEuler'];cd.type=c['type'];cd.lens=c['lens'];cd.ortho_scale=c['orthoScale'];cd.sensor_fit=c['sensorFit'];cd.sensor_width=c['sensorWidth'];cd.sensor_height=c['sensorHeight'];cd.shift_x,cd.shift_y=c['shift'];cd.clip_start,cd.clip_end=c['clip'];s.camera=cam
 w,h=job['resolution'];scale=min(1,a.max_preview_edge/max(w,h)) if a.max_preview_edge else 1;s.render.resolution_x=round(w*scale);s.render.resolution_y=round(h*scale);out=P/job['identity'].replace('.png','');out.mkdir(parents=True,exist_ok=True);s.render.filepath=str(out/'scene-rgba.png');bpy.context.view_layer.update()
 # Project a true north perturbation at the shifted image centre. Pixel aspect
 # and sensor-fit projection are both handled by the actual Blender camera.
 frame=cd.view_frame(scene=s);centre=sum(frame,Vector())/4;centre=cam.matrix_world@(centre*1000);origin=world_to_camera_view(s,cam,centre);north=world_to_camera_view(s,cam,centre+Vector((0,1,0)));direction=[(north.x-origin.x)*s.render.resolution_x,-(north.y-origin.y)*s.render.resolution_y];length=math.hypot(*direction);assert length>0;direction=[x/length for x in direction]
 t=time.time();started=stamp();bpy.ops.render.render(write_still=True);row={'identity':job['identity'],'image':pin(s.render.filepath),'dimensions':[s.render.resolution_x,s.render.resolution_y],'plannedNativeDimensions':job['resolution'],'preview':bool(a.max_preview_edge),'renderStartedUTC':started,'renderCompletedUTC':stamp(),'seconds':time.time()-t,'camera':c,'cameraQualifications':job['cameraQualifications'],'north':{'screenUnitRightDown':direction,'bearingClockwiseFromScreenUpDegrees':(math.degrees(math.atan2(direction[0],-direction[1]))+360)%360,'method':'Actual projection of world north at image-centre ray; lens shift, sensor fit, pixel frame accounted for','worldNorthBlender':[0,1,0]},'sourceInputSHA256':imp['input']['sha256'],'district':imp['district'],'scenario':imp['scenario'],'geographicScope':job.get('geographicScope', 'whole_municipality' if imp['district']=='citywide' else 'named_district_scene'),'sourcePresentationWarnings':nativeWarnings,'nativePixelsNoUpscaling':True,'crop':False,'title':job['title'],'area':job['area'],'sourceAttributionPolicy':'Final credits are read from this exact frozen native export, separately pinned in credits.json; historical inventory attribution is not reused.'};r['images'].append(row);(out/'scene-proof.json').write_text(json.dumps(row,indent=2)+'\n');(P/'render-proof.json').write_text(json.dumps(r,indent=2)+'\n');print('NATIVE_VIEW_RENDERED',job['identity'],flush=True)
after={'meshObjects':sum(o.type=='MESH' for o in s.objects),'triangles':sum(len(p.vertices)-2 for o in s.objects if o.type=='MESH' for p in o.data.polygons),'materialNames':sorted(m.name for m in bpy.data.materials)};assert all(after[k]==before[k] for k in after);r['sourceAfter']=after;r['state']='RENDERED_VISUAL_REVIEW_REQUIRED';r['completedUTC']=stamp();(P/'render-proof.json').write_text(json.dumps(r,indent=2)+'\n')
