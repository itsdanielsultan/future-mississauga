"""Presentation-only status tint on qualified massing; exact source scene stays on disk."""
import numpy as np
def geometry_fingerprint():
    h=hashlib.sha256()
    for obj in sorted((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:o.name):
        h.update(obj.name.encode());h.update(np.asarray(obj.matrix_world,dtype='<f8').tobytes())
        for collection,field,size,dtype in [(obj.data.vertices,'co',3,'<f4'),(obj.data.loops,'vertex_index',1,'<i4'),(obj.data.polygons,'loop_total',1,'<i4')]:
            values=np.empty(len(collection)*size,dtype=dtype);collection.foreach_get(field,values);h.update(values.tobytes())
    return h.hexdigest()
geometry_before=geometry_fingerprint()
semantic_assets=json.loads((Path(__file__).parent/'semantic-slots.json').read_text())
source_materials={m.name:{'diffuse':list(m.diffuse_color),'nodes':[(n.name,n.type,[(v.name,list(v.default_value) if hasattr(v.default_value,'__len__') else v.default_value) for v in n.inputs if hasattr(v,'default_value') and (isinstance(v.default_value,(int,float)) or hasattr(v.default_value,'__len__'))]) for n in m.node_tree.nodes] if m.use_nodes else []} for m in bpy.data.materials}
material_before=hashlib.sha256(json.dumps(source_materials,sort_keys=True).encode()).hexdigest()
palette={'existing':'#b8b9b6','under_construction':'#85b4bf','approved':'#d8b7ac','proposed':'#d8b7ac','unknown':'#b89bc3','mixed':'#b89bc3'}
legacy={'Existing':'existing','Under Construction':'under_construction','Approved':'approved','Proposed':'proposed','Uncertain':'unknown'}
changed=[];preserved=0;created={}
def status_material(lifecycle):
    if lifecycle in created:return created[lifecycle]
    rgb=[int(palette[lifecycle][i:i+2],16)/255 for i in (1,3,5)]
    linear=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in rgb]
    mat=bpy.data.materials.new('Nov09 display status / '+lifecycle);mat.use_nodes=True
    node=mat.node_tree.nodes.get('Principled BSDF');node.inputs['Base Color'].default_value=(*linear,1);node.inputs['Roughness'].default_value=.82
    mat.diffuse_color=(*linear,1);created[lifecycle]=mat;return mat
for obj in bpy.context.scene.objects:
    if obj.type!='MESH':continue
    # Imported glTF extras are retained directly on each object.
    data={key:obj.get(key) for key in ['assetId','projectId','lifecycle','Status','displayStatus','sourceAssetSHA256','id','preserveFinish']}
    lifecycle=data['lifecycle'] or legacy.get(data['displayStatus'] or data['Status'])
    # A source-model podium contains authored concrete slabs and planted roofs.
    source_podium = data['assetId']=='voya-towers-plan-derived' and obj.name.startswith('voya-podium-')
    if source_podium or lifecycle not in palette or not data['projectId'] or data['preserveFinish']:
        preserved+=1;continue
    asset=semantic_assets.get(data['assetId'],{})
    if data['assetId']:
        if asset.get('projectId')!=data['projectId'] or asset.get('sha256')!=data['sourceAssetSHA256']:
            preserved+=1;continue
        slots=[i for name,ident,i in asset['slots'] if obj.name==name or (ident is not None and data['id']==ident)]
    else:
        # Municipal primitives are identified by their record ID and reviewed project lifecycle.
        # Existing source vertex colours remain intact; future/constructing massing gets the key.
        slots=list(range(len(obj.material_slots))) if data['id'] and lifecycle!='existing' else []
    for index in slots:
        if index>=len(obj.material_slots):continue
        material=obj.material_slots[index].material
        if not material or any(n.type=='TEX_IMAGE' for n in material.node_tree.nodes):continue
        original_name=material.name
        obj.material_slots[index].link='OBJECT';obj.material_slots[index].material=status_material(lifecycle)
        changed.append({'object':obj.name,'sourceId':data['id'],'projectId':data['projectId'],'assetId':data['assetId'],'slot':index,'lifecycle':lifecycle,'colour':palette[lifecycle],'sourceMaterial':original_name,'displayMaterial':obj.material_slots[index].material.name})
display_material_proof={'policy':'Presentation override only on identified municipal non-existing massing and exact pinned semantic slots. Existing vertex colours, textures and authored facades preserved. Unknown is never labelled approved.','sourceMaterialSHA256':material_before,'geometrySHA256Before':geometry_before,'geometrySHA256After':geometry_fingerprint(),'palette':palette,'changedSlots':changed,'preservedMeshCount':preserved,'sourceFilesEdited':False}
assert display_material_proof['geometrySHA256Before']==display_material_proof['geometrySHA256After']
(P/'display-material-proof.json').write_text(json.dumps(display_material_proof,indent=2)+'\n')
print('DISPLAY_MATERIAL_SLOTS',len(changed),flush=True)
