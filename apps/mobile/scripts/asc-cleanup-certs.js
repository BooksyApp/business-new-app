// Deletes the throw-away "Apple Development: Created via API" certificates that Xcode automatic signing
// creates on every CI run (Apple caps the number of certificates per account). Never touches
// Distribution certificates. Needs ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_P8 (base64 of the .p8).
const crypto = require('crypto');
const { ASC_KEY_ID: kid, ASC_ISSUER_ID: iss, ASC_KEY_P8: p8b64 } = process.env;
if (!kid || !iss || !p8b64) { console.log('asc-cleanup: ASC secrets missing, skipped'); process.exit(0); }
const b = (x) => Buffer.from(x).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = b(JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' })) + '.' + b(JSON.stringify({ iss, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }));
const key = crypto.createPrivateKey(Buffer.from(p8b64, 'base64').toString('utf8'));
const sig = crypto.sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' });
const token = unsigned + '.' + sig.toString('base64url');
const api = (method, path) => fetch('https://api.appstoreconnect.apple.com' + path, { method, headers: { Authorization: 'Bearer ' + token } });
(async () => {
  try {
    const r = await api('GET', '/v1/certificates?limit=200');
    if (!r.ok) { console.log('asc-cleanup: list failed', r.status); return; }
    const list = (await r.json()).data || [];
    const junk = list.filter((c) => c.attributes.certificateType === 'DEVELOPMENT' && /Created via API/.test(c.attributes.name || ''));
    let n = 0;
    for (const c of junk) { const d = await api('DELETE', '/v1/certificates/' + c.id); if (d.status === 204) n++; }
    console.log(`asc-cleanup: ${n}/${junk.length} development certificates removed (of ${list.length} total)`);
  } catch (e) { console.log('asc-cleanup: error', e.message); }
})();
