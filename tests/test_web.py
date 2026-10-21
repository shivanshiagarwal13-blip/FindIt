"""Integration checks against an already running Java server. Uses only Python stdlib."""
import base64
import http.cookiejar
import json
import os
import struct
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib

BASE = os.environ.get('LF_TEST_URL', 'http://localhost:8080')

def client():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

def call(c, path, data=None, expected=200):
    req = urllib.request.Request(BASE + '/api/' + path, data=urllib.parse.urlencode(data).encode() if data is not None else None,
        headers={'X-Requested-With': 'LostFound', 'Content-Type': 'application/x-www-form-urlencoded'})
    try:
        response = c.open(req)
    except urllib.error.HTTPError as e:
        response = e
    payload = json.load(response)
    assert response.code == expected, (path, response.code, payload)
    return payload

# Generate a valid tiny PNG without third-party libraries.
def chunk(kind, data):
    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', 1, 1, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b'\0\0\0\0')) + chunk(b'IEND', b'')
photo = 'data:image/png;base64,' + base64.b64encode(png).decode()
nonce = str(time.time_ns())[-9:]
finder, owner, stranger, anonymous = [client() for _ in range(4)]
domain = call(anonymous, 'config')['domain']
credentials = []
for index, c in enumerate([finder, owner, stranger]):
    data = dict(name=['Finder','Owner','Stranger'][index], studentId=nonce+str(index), email=f'test{nonce}{index}@{domain}')
    credentials.append(data)
    call(c, 'login', data)
call(anonymous, 'lost', expected=401)
call(anonymous, 'login', dict(credentials[0], email='someone@external.edu'), 400)
for bad_id in ['123456789', '12345678901', '123456789x']:
    call(anonymous, 'login', dict(credentials[0], studentId=bad_id), 400)
call(anonymous, 'login', dict(credentials[0], email='bad..email@'+domain), 400)
call(anonymous, 'login', dict(credentials[0], email='another@'+domain), 409)
item = dict(name='Wallet', category='Accessories', location='Library', date='2026-10-07', description='Black, leather', timeFrom='09:00', timeTo='10:30')
call(finder, 'found', dict(item, phone='9810022341'), 400)
call(finder, 'found', dict(item, phone='9810022341', photo='data:image/png;base64,YmFk'), 400)
call(finder, 'found', dict(item, phone='9810022341', photo=photo, date='2999-01-01'), 400)
for bad_times in [dict(timeFrom='25:00'), dict(timeTo='08:00'), dict(timeFrom='', timeTo='10:00')]:
    call(owner, 'lost', dict(item, **bad_times), 400)
exact = call(owner, 'lost', dict(item, timeFrom='11:15', timeTo=''))
assert exact['timeFrom'] == exact['timeTo'] == '11:15'
unknown = call(owner, 'lost', dict(item, timeFrom='', timeTo=''))
assert unknown['timeFrom'] == unknown['timeTo'] == ''
found = call(finder, 'found', dict(item, phone='9810022341', photo=photo))
lost = call(owner, 'lost', item)
assert lost['timeFrom'] == '09:00' and lost['timeTo'] == '10:30'
assert found['id'] in [f['id'] for f in call(finder, 'found')]
# Regression: lost first, then found, in the same student's session.
self_lost = call(stranger, 'lost', item)
self_found = call(stranger, 'found', dict(item, phone='9810022341', photo=photo))
assert self_found['id'] in [f['id'] for f in call(stranger, 'found')]
self_match = next(f for f in call(stranger, 'matches?lostId='+str(self_lost['id'])) if f['id']==self_found['id'])
assert self_match['status'] == 'own' and self_match['timeTo'] == '10:30'
call(stranger, 'requests', dict(lostId=self_lost['id'], foundId=self_found['id'], proof='My own found report'), 403)
call(stranger, 'matches?lostId='+str(lost['id']), expected=403)
assert lost['id'] not in [l['id'] for l in call(stranger, 'lost')]
assert found['id'] not in [f['id'] for f in call(stranger, 'found')]
matches = call(owner, 'matches?lostId='+str(lost['id']))
match = next(m for m in matches if m['id'] == found['id'])
assert match['score'] == 100 and 'phone' not in match
partial = call(owner, 'lost', dict(item, location='Canteen'))
assert next(m for m in call(owner, 'matches?lostId='+str(partial['id'])) if m['id']==found['id'])['score']==80
unrelated = call(owner, 'lost', dict(item, name='Charger', category='Electronics', location='Hostel', date='2026-09-01'))
assert found['id'] not in [m['id'] for m in call(owner, 'matches?lostId='+str(unrelated['id']))]
call(owner, 'requests', dict(lostId=unrelated['id'], foundId=found['id'], proof='Some private detail'), 403)
call(stranger, 'requests', dict(lostId=lost['id'], foundId=found['id'], proof='Some private detail'), 403)
request = dict(lostId=lost['id'], foundId=found['id'], proof='My initials are engraved inside.')
call(owner, 'requests', request)
call(owner, 'requests', request, 409)
assert '9810022341' not in json.dumps(call(owner, 'matches?lostId='+str(lost['id'])))
row = next(f for f in call(finder, 'found') if f['id']==found['id'])
rid = row['requests'][0]['id']
call(finder, 'logout', {})
call(finder, 'login', credentials[0])
assert next(f for f in call(finder, 'found') if f['id']==found['id'])['requests'][0]['status'] == 'pending'
call(owner, 'review', dict(requestId=rid, decision='approved'), 403)
call(finder, 'review', dict(requestId=rid, decision='approved'))
match = next(m for m in call(owner, 'matches?lostId='+str(lost['id'])) if m['id']==found['id'])
assert match['phone']=='9810022341' and match['status']=='approved'
call(owner, 'returned', dict(foundId=found['id']), 403)
call(finder, 'returned', dict(foundId=found['id']))
assert found['id'] not in [m['id'] for m in call(owner, 'matches?lostId='+str(lost['id']))]
call(owner, 'logout', {})
call(owner, 'lost', expected=401)
call(owner, 'login', credentials[1])
assert lost['id'] in [l['id'] for l in call(owner, 'lost')]
print('PASS: registration login, exact/interval/unknown times, same-account lost-then-found visibility, validation, uploads, matching, private reports, approval, contact privacy, return and session checks.')
