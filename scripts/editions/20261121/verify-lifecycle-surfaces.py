"""Verify the source membership and treatment of every status-bearing surface in the city plates."""
import argparse
from collections import Counter,defaultdict
import json
from pathlib import Path
import sys
import numpy as np

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'20261120'))
import geometry_mask as geometry


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workspace',type=Path)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    work=args.workspace.resolve()
    geometry.initialise(work/'toned')
    role_counts=Counter()
    municipal={}
    coverage=defaultdict(set)
    retained=set()
    reviewed={}
    source_scans=set()
    equivalent_records={}
    expected={'proposed':{2,5,9,13},'approved':{2,5,9,13},'under_construction':{4,6,8,12},'unknown':{3,10,14}}
    canonical=json.loads((geometry.PUBLIC/'data/project-lifecycle-20261121.json').read_text())
    component_states=defaultdict(set)
    for project in canonical['projects']:
        for component in project['sourceComponents']:
            if component.get('lifecycle'):
                component_states[component['id']].add(component['lifecycle'])
    for path in sorted((work/'native').glob('*/render-proof.json')):
        proof=json.loads(path.read_text())
        scoped=proof.get('municipalReplacements',[])
        changed=proof.get('assetReplacements',[])
        phase=proof.get('exchangePhaseGeometry')
        colours={'proposed':2,'approved':5,'under_construction':4,'unknown':3,'mixed':3}
        semantic={s['object']:colours[s['lifecycle']] for s in proof.get('derivedDisplayMaterials',{}).get('changedSlots',[]) if s['lifecycle'] in colours and s.get('projectId')!='voya'}
        revision_ids={c for item in scoped for c in item['componentIds']}
        inputs=[(proof['sourceGLB'],{'replace_exchange':bool(phase),'replaced_assets':sorted(a['assetId'] for a in changed),'replaced_components':sorted(revision_ids)})]
        inputs.extend((a,{}) for a in ([phase] if phase else [])+changed)
        inputs.extend((a,{'municipal_stages':{c:colours[a.get('lifecycle','under_construction')] for c in a['componentIds']}}) for a in scoped if not a.get('removeOnly'))
        for source,kwargs in inputs:
            key=(source['sha256'],json.dumps(semantic,sort_keys=True),json.dumps(kwargs,sort_keys=True))
            if key in source_scans:continue
            source_scans.add(key)
            for node,primitive,material,labels in geometry.mesh(source,semantic,inspect_materials=True,**kwargs):
                e=node.get('extras',{});cid=e.get('id');asset=e.get('assetId');state=e.get('lifecycle')
                neutral=geometry.default_neutral_material(primitive,material)
                if 'COLOR_0' in primitive['attributes']:role='authored vertex colour'
                elif 'baseColorTexture' in material.get('pbrMetallicRoughness',{}):role='source texture'
                elif material.get('name'):role='named material'
                elif neutral:role='default neutral'
                else:role='source colour or unspecified material'
                role_counts[role]+=1
                if not neutral or e.get('preserveFinish'):continue
                found=set(np.unique(labels).tolist())
                if cid and not asset:
                    stage=(geometry.planning_components.get(cid) or state)
                    if kwargs.get('municipal_stages',{}).get(cid)==4:stage='under_construction'
                    if stage not in expected:continue
                    latest=component_states.get(cid)
                    if latest and len(latest)==1 and stage not in latest:
                        # Approved and proposed have the same signed map ink.
                        assert set(latest)|{stage}=={'proposed','approved'},(cid,stage,latest)
                        current=next(iter(latest))
                        equivalent_records[cid]={'frozenPresentationStage':stage,'currentRegisteredStage':current}
                        stage=current
                    assert found<=expected[stage] and 0 not in found,(cid,stage,found)
                    if cid in municipal:assert (municipal[cid]==stage or {municipal[cid],stage}=={'proposed','approved'}),(cid,stage,municipal[cid])
                    municipal[cid]=stage;coverage[stage].add(cid)
                elif asset:
                    if found-{0}:reviewed[asset]=sorted(set(reviewed.get(asset,[]))|found-{0})
                    elif state in ('existing','under_construction'):
                        if asset=='block-nine-reference-derived':
                            assert any(t in node['name'].lower() for t in ('fin-','balcony-','roof-','podium'))
                        elif asset=='perla-towers-source-envelope':assert 'podium' in node['name'].lower()
                        elif asset=='oro-20261027-composite':assert any(t in node['name'].lower() for t in ('lower massing','cut closure'))
                        retained.add(asset)
    measured=Counter()
    categories={'existing':(1,7,15,16),'under_construction':(4,6,8,12),'proposed_or_approved':(2,5,9,13),'unknown':(3,10,14)}
    for path in sorted((work/'toned').glob('*.json')):
        frame=json.loads(path.read_text())
        if not frame.get('geometricMaskPixels'):continue
        for stage,classes in categories.items():
            measured[stage]+=sum(frame['geometricMaskPixels'].get(str(c),0) for c in classes)
    assert all(measured.values()) and len(measured)==4
    expected_unknown={cid for cid,s in municipal.items() if s=='unknown'}
    assert len(expected_unknown)==14
    result={'scannedSourceConfigurations':len(source_scans),'neutralStatusBearingMunicipalComponents':len(municipal),'uniqueMunicipalIdsByLifecycle':{k:len(v) for k,v in sorted(coverage.items())},'uncertainSourceIds':sorted(expected_unknown),'sameInkUpdatedPlanningRecords':equivalent_records,'surveyedMaterialPrimitivesAcrossInputs':dict(role_counts),'gradedNeutralRefinements':reviewed,'retainedArchitecturalElementsInNeutralMaterialSources':sorted(retained),'actualNativePixelsByLifecycle':dict(measured)}
    args.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k not in ('gradedNeutralRefinements','uncertainSourceIds')},indent=2))


if __name__=='__main__':
    main()
