"""Isolated multi-student and persistence regression; never modifies normal project data."""
import os, pathlib, runpy, subprocess, tempfile, time, urllib.request
ROOT = pathlib.Path(__file__).resolve().parent.parent
os.environ['LF_TEST_URL'] = 'http://localhost:8091'
with tempfile.TemporaryDirectory(prefix='lost-found-test-') as directory:
    env = dict(os.environ, LF_DATA_FILE=str(pathlib.Path(directory) / 'reports.bin'))
    def start():
        p = subprocess.Popen(['java', 'WebServer', '8091'], cwd=ROOT, env=env, stdout=subprocess.DEVNULL)
        for _ in range(100):
            if p.poll() is not None:
                raise AssertionError('Server failed to start or load saved data')
            try:
                urllib.request.urlopen(os.environ['LF_TEST_URL'] + '/api/config', timeout=.2)
                return p
            except OSError:
                time.sleep(.05)
        p.terminate()
        raise AssertionError('Server startup timed out')
    server = start()
    try:
        test = runpy.run_path(str(ROOT/'tests/test_web.py'))
        call, finder, owner = test['call'], test['finder'], test['owner']
        item = dict(test['item'], location='AB1')
        found = call(finder, 'found', dict(item, photo=test['photo'], phone='9810022341'))
        lost = call(owner, 'lost', item)
        call(owner, 'requests', dict(lostId=lost['id'], foundId=found['id'], proof='An engraved star on the inside'))
        server.terminate(); server.wait(); server = start()
        call(finder, 'found', expected=401)
        call(finder, 'login', test['credentials'][0])
        row = next(f for f in call(finder, 'found') if f['id']==found['id'])
        assert row['photo'] == test['photo'] and row['timeFrom'] == '09:00'
        assert row['requests'][0]['status'] == 'pending'
        call(finder, 'review', dict(requestId=row['requests'][0]['id'], decision='approved'))
        server.terminate(); server.wait(); server = start()
        call(owner, 'login', test['credentials'][1])
        match = next(f for f in call(owner, 'matches?lostId='+str(lost['id'])) if f['id']==found['id'])
        assert match['status']=='approved' and match['phone']=='9810022341'
        print('PASS: two students, finder signs back in, pending request survives restart, approval and photo survive second restart.')
    finally:
        server.terminate(); server.wait()
