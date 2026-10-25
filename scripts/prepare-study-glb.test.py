import unittest,importlib.util,pathlib,gzip
from unittest.mock import patch
p=pathlib.Path(__file__).with_name('prepare-study-glb.py');s=importlib.util.spec_from_file_location('batch',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class DatumTests(unittest.TestCase):
 def setUp(self):self.r={'preserveSemanticPartitions':True,'podiumVerticalCorrections':{'M1_P00':-.35,'M1_P03':-.05,'M2_P07':-.04},'entryPodiumComponents':{'M1':'M1_P03','M2':'M2_P07'}}
 def test_original_and_revision_parts_get_same_component(self):
  self.assertEqual(m.podium_component('M1_P00__source',{},self.r),'M1_P00');self.assertEqual(m.podium_component('M1_R02_P00__balcony',{'covered_source_component':0},self.r),'M1_P00')
 def test_entry_uses_explicit_component(self):
  self.assertEqual(m.podium_component('M1_R02_entry_signed_3900',{},self.r),'M1_P03');self.assertEqual(m.podium_component('M2_R02_entry_signed_3883',{},self.r),'M2_P07')
 def test_unmapped_or_conflicting_datum_fails_closed(self):
  for name,extra in [('M1_R02_unknown',{}),('M1_R02_P04__slab',{}),('M1_P00__source',{'covered_source_component':3})]:
   with self.assertRaises(ValueError):m.podium_component(name,extra,self.r)
 def test_semantic_boundaries_separate_unchanged_tower_and_podium(self):
  self.assertEqual(m.semantic_partition('M1_L01',None,self.r),'unchanged-tower');self.assertEqual(m.semantic_partition('M1_P00__source','M1_P00',self.r),'retained-source-podium:M1_P00');self.assertEqual(m.semantic_partition('M1_R02_P00__slab','M1_P00',self.r),'rev02-podium:M1_P00');self.assertEqual(m.semantic_partition('M1_R02_entry','M1_P03',self.r),'rev02-entry:M1_P03')
class GzipReproductionTests(unittest.TestCase):
 def test_historical_envelope_is_independent_of_host_os_byte(self):
  data=b'glTF source-preserving study\0'*100
  historical=bytearray(gzip.compress(data,compresslevel=9,mtime=0));historical[9]=3
  for os_byte in [0,3,19,255]:
   host_output=bytearray(historical);host_output[9]=os_byte
   with self.subTest(os_byte=os_byte),patch.object(m.gzip,'compress',return_value=bytes(host_output)) as compress:
    self.assertEqual(m.compress_study_glb(data),bytes(historical))
    compress.assert_called_once_with(data,compresslevel=9,mtime=0)
 def test_roundtrip_retains_all_model_bytes_and_zero_timestamp(self):
  data=bytes(range(256))*100
  result=m.compress_study_glb(data)
  self.assertEqual(gzip.decompress(result),data)
  self.assertEqual(result[4:8],b'\0'*4)
  self.assertEqual(result[9],3)
if __name__=='__main__':unittest.main(verbosity=2)
