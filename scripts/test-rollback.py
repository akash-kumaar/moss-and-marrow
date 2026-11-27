#!/usr/bin/env python3
"""Offline command adapters: no AWS calls, daemon, or production filesystem."""
import json,os,pathlib,subprocess,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
OLD='sha256:'+'1'*64
NEW='sha256:'+'2'*64
ID='a'*40+'-20260101T000000Z-12345678'
class RollbackTests(unittest.TestCase):
 def run_case(self,case='success',release=ID):
  with tempfile.TemporaryDirectory() as tmp:
   p=pathlib.Path(tmp); (p/'bin').mkdir()
   (p/'state').write_text(OLD); (p/'calls').write_text('')
   (p/'moss-releases.json').write_text(json.dumps([{'id':ID,'commit':'a'*40,'frontend':NEW,'backend':NEW,'timestamp':'2026-01-01T00:00:00Z'}]))
   (p/'docker-compose.deploy.yml').write_text('services:\n  database:\n    image: mongo:7.0\n    volumes:\n      - mongo_data:/data/db\n  backend:\n    image: old\n    env_file:\n      - /tmp/moss-env.AAAAAAAA\n  frontend:\n    image: old\n')
   original=(p/'docker-compose.deploy.yml').read_bytes()
   if case=='missing': (p/'moss-releases.json').unlink()
   if case=='invalid_metadata': (p/'moss-releases.json').write_text('not json')
   (p/'rollback').write_text((ROOT/'scripts/rollback.sh').read_text().replace('readonly DEPLOY_DIR=/opt',f'readonly DEPLOY_DIR={p}'))
   adapter='''#!/usr/bin/env python3
import sys,os,pathlib,json
p=pathlib.Path(os.environ['QA']); a=sys.argv[1:]; case=os.environ['CASE']; old=os.environ['OLD']; new=os.environ['NEW']
with (p/'calls').open('a') as f:f.write(pathlib.Path(sys.argv[0]).name+' '+ ' '.join(a)+'\\n')
if pathlib.Path(sys.argv[0]).name=='aws':
 if 'batch-get-image' in a: print('None' if case=='ecr' else new)
 else: print('token')
elif a[0]=='login': sys.stdin.read()
elif a[0]=='pull': sys.exit(1 if case=='pull' else 0)
elif a[0]=='exec': assert a==['exec','moss_marrow_frontend','nginx','-t']
elif a[0]=='image': print('image-id')
elif a[0]=='inspect':
 fmt=a[2]
 if fmt=='{{.Config.Image}}':print('874940900689.dkr.ecr.ap-south-1.amazonaws.com/moss-marrow/'+a[3].removeprefix('moss_marrow_')+'@'+(p/'state').read_text())
 elif fmt=='{{.Image}}':print('image-id')
 elif fmt=='{{json .Config.Env}}':print(json.dumps(['MONGODB_URI=mongodb://database/moss_marrow','PRIVATE_VALUE=dollar$and spaces']))
 elif 'Labels' in fmt:print('existingproject')
 else:print('healthy')
elif a[0]=='compose':
 assert '--no-deps' in a and '--pull' in a and a[-2:]==['backend','frontend']
 assert a[2]=='existingproject'
 text=pathlib.Path(a[a.index('-f')+1]).read_text(); assert 'mongo_data:/data/db' in text
 override=json.loads(pathlib.Path(a[a.index('-f',a.index('-f')+1)+1]).read_text())
 assert override['services']['backend']['environment']['PRIVATE_VALUE']=='dollar$$and spaces'
 image=text.split('  frontend:\\n    image: ')[1].split('\\n')[0].split('@')[1]
 (p/'state').write_text(image)
 if case=='recovery_failure' or (case=='launch' and image==new):sys.exit(19)
else:sys.exit(8)
'''
   for name in ['docker','aws']:
    (p/'bin'/name).write_text(adapter); (p/'bin'/name).chmod(0o700)
   (p/'bin'/'curl').write_text('''#!/usr/bin/env python3
import os,pathlib,sys
p=pathlib.Path(os.environ['QA'])
if os.environ['CASE']=='health' and (p/'state').read_text()==os.environ['NEW']:sys.exit(1)
print('{"status":"ok"}' if 'health' in ' '.join(sys.argv) else '<div id="root"></div>')
'''); (p/'bin'/'curl').chmod(0o700)
   env={**os.environ,'QA':tmp,'CASE':case,'OLD':OLD,'NEW':NEW,'PATH':str(p/'bin')+':'+os.environ['PATH']}
   lock=None
   if case=='locked':
    import fcntl
    lock=(p/'.moss-deploy.lock').open('w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
   result=subprocess.run(['bash',str(p/'rollback'),release],env=env,capture_output=True,text=True)
   calls=(p/'calls').read_text(); state=(p/'state').read_text()
   if case=='success':
    persisted=(p/'docker-compose.deploy.yml').read_text()
    expected=original.decode().replace('    image: old','    image: 874940900689.dkr.ecr.ap-south-1.amazonaws.com/moss-marrow/backend@'+NEW,1)
    expected=expected.replace('    image: old','    image: 874940900689.dkr.ecr.ap-south-1.amazonaws.com/moss-marrow/frontend@'+NEW,1)
    self.assertEqual(persisted,expected)
   else:self.assertEqual((p/'docker-compose.deploy.yml').read_bytes(),original)
   self.assertNotIn('down',calls);self.assertNotIn('prune',calls)
   if case=='success':
    self.assertEqual(result.returncode,0,result.stderr); self.assertEqual(state,NEW)
    self.assertIn('Rollback verified',result.stdout)
   else:
    self.assertNotEqual(result.returncode,0)
    if case in ['health','launch']:self.assertEqual(state,OLD);self.assertIn('Recovery verified',result.stderr)
    if case=='recovery_failure':self.assertIn('CRITICAL',result.stderr)
   if lock:lock.close()
 def test_cases(self):
  for case in ['success','missing','invalid_metadata','ecr','pull','health','launch','recovery_failure','locked']:
   with self.subTest(case=case):self.run_case(case)
 def test_invalid_identifier(self):self.run_case('invalid','../escape')
 def test_unknown_release(self):self.run_case('unknown','b'*40+'-20260101T000000Z-12345678')


class HistoryTests(unittest.TestCase):
 def test_atomic_history_and_retention(self):
  source=(ROOT/'scripts/deploy.sh').read_text()
  writer=source.split('<<\'PY\'\n',1)[1].split('\nPY',1)[0]
  with tempfile.TemporaryDirectory() as tmp:
   path=pathlib.Path(tmp)/'history.json'
   command=['python3','-',str(path),'a'*40,NEW,NEW]
   for _ in range(12):
    r=subprocess.run(command,input=writer,text=True,capture_output=True)
    self.assertEqual(r.returncode,0,r.stderr)
   rows=json.loads(path.read_text())
   self.assertEqual(len(rows),10)
   self.assertEqual(len({row['id'] for row in rows}),10)
   self.assertEqual(path.stat().st_mode & 0o777,0o600)
   path.write_text('corrupted history');before=path.read_bytes()
   r=subprocess.run(command,input=writer,text=True,capture_output=True)
   self.assertNotEqual(r.returncode,0);self.assertEqual(path.read_bytes(),before)

if __name__=='__main__':unittest.main()
