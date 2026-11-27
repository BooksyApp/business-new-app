// Sends an uploaded build to TestFlight EXTERNAL testers: waits until App Store Connect has processed it, answers export
// compliance, attaches it to every external beta group and submits it for Beta App Review (Apple reviews the first build of
// each version; a new version number means a new review). Prints what is missing (never any secret or contact value).
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (base64 of the .p8), BUNDLE_ID, BUILD_NUMBER (optional: newest build), WHATS_NEW (optional).
const crypto = require('crypto');
const { ASC_KEY_ID: kid, ASC_ISSUER_ID: iss, ASC_KEY_P8: p8b64, BUNDLE_ID: bundle = 'az.booqi.business', BUILD_NUMBER: want = '', WHATS_NEW: whatsNew = '' } = process.env;
const log = (...a) => console.log('testflight:', ...a);
if (!kid || !iss || !p8b64) { log('ASC secrets missing, skipped'); process.exit(0); }
const b = (x) => Buffer.from(x).toString('base64url');
const key = crypto.createPrivateKey(Buffer.from(p8b64, 'base64').toString('utf8'));
const jwt = () => {
  const now = Math.floor(Date.now() / 1000);
  const u = b(JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' })) + '.' + b(JSON.stringify({ iss, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' }));
  return u + '.' + crypto.sign('sha256', Buffer.from(u), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
};
async function api(method, path, body) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + path, { method, headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let j = null; try { j = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { ok: r.ok, status: r.status, j, err: j && j.errors ? j.errors.map((e) => `${e.code}: ${e.detail || e.title}`).join(' | ') : '' };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const apps = await api('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(bundle)}`);
  const app = apps.j && apps.j.data && apps.j.data[0];
  if (!app) { log('app not found for bundle', bundle, apps.status, apps.err); process.exit(1); }

  // 1. the build, processed
  let build = null;
  for (let i = 0; i < 40; i++) {
    const q = `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=10&include=preReleaseVersion${want ? `&filter[version]=${encodeURIComponent(want)}` : ''}`;
    const r = await api('GET', q);
    const list = (r.j && r.j.data) || [];
    build = list.find((x) => !x.attributes.expired) || null;
    if (build) {
      const pv = ((r.j.included || []).find((x) => x.type === 'preReleaseVersions' && build.relationships.preReleaseVersion.data && x.id === build.relationships.preReleaseVersion.data.id) || {}).attributes;
      build.marketing = pv ? pv.version : '?';
      if (build.attributes.processingState === 'VALID') break;
      if (['FAILED', 'INVALID'].includes(build.attributes.processingState)) { log('build', build.attributes.version, 'processing', build.attributes.processingState); process.exit(1); }
    }
    log(build ? `build ${build.attributes.version} is ${build.attributes.processingState}, waiting` : `build ${want || '(newest)'} not visible yet, waiting`);
    await sleep(30000);
  }
  if (!build || build.attributes.processingState !== 'VALID') { log('gave up waiting for processing'); process.exit(1); }
  log(`build ${build.attributes.version} (version ${build.marketing}) is processed`);

  // 2. export compliance
  if (build.attributes.usesNonExemptEncryption == null) {
    const r = await api('PATCH', `/v1/builds/${build.id}`, { data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } } });
    log('export compliance set:', r.ok ? 'ok' : `${r.status} ${r.err}`);
  }

  // 3. what the review needs (presence only)
  const det = await api('GET', `/v1/apps/${app.id}/betaAppReviewDetail`);
  const d = (det.j && det.j.data && det.j.data.attributes) || {};
  const miss = ['contactFirstName', 'contactLastName', 'contactPhone', 'contactEmail'].filter((k) => !d[k]);
  log('beta review contact:', miss.length ? `MISSING ${miss.join(', ')}` : 'complete', '| sign-in required:', !!d.demoAccountRequired, d.demoAccountRequired && !(d.demoAccountName && d.demoAccountPassword) ? '(demo account MISSING)' : '');
  const loc = await api('GET', `/v1/apps/${app.id}/betaAppLocalizations`);
  const locs = (loc.j && loc.j.data) || [];
  log('beta app info locales:', locs.map((x) => `${x.attributes.locale}${x.attributes.description ? '' : ' (no description)'}${x.attributes.feedbackEmail ? '' : ' (no feedback e-mail)'}`).join(', ') || 'NONE');

  // 4. "what to test"
  const bl = await api('GET', `/v1/builds/${build.id}/betaBuildLocalizations`);
  const bls = (bl.j && bl.j.data) || [];
  const note = (whatsNew || 'Salon sahibləri üçün booqi Business: təqvim, rezervlər, kassa, müştərilər və hesabatlar. Zəhmət olmasa əsas axınları yoxlayın.').slice(0, 3900);
  if (!bls.length) {
    const r = await api('POST', '/v1/betaBuildLocalizations', { data: { type: 'betaBuildLocalizations', attributes: { locale: (locs[0] && locs[0].attributes.locale) || 'en-US', whatsNew: note }, relationships: { build: { data: { type: 'builds', id: build.id } } } } });
    log('what-to-test note:', r.ok ? 'created' : `${r.status} ${r.err}`);
  } else {
    for (const x of bls.filter((y) => !y.attributes.whatsNew)) {
      const r = await api('PATCH', `/v1/betaBuildLocalizations/${x.id}`, { data: { type: 'betaBuildLocalizations', id: x.id, attributes: { whatsNew: note } } });
      log(`what-to-test note (${x.attributes.locale}):`, r.ok ? 'set' : `${r.status} ${r.err}`);
    }
  }

  // 5. external groups
  const gr = await api('GET', `/v1/betaGroups?filter[app]=${app.id}&limit=50`);
  const groups = (gr.j && gr.j.data) || [];
  const ext = groups.filter((g) => !g.attributes.isInternalGroup);
  log('groups:', groups.map((g) => `${g.attributes.name} [${g.attributes.isInternalGroup ? 'internal' : 'external'}]`).join(', ') || 'NONE');
  if (!ext.length) { log('NO EXTERNAL GROUP: create one in App Store Connect > TestFlight > External Testing and add testers; nothing to send the build to'); process.exit(2); }
  for (const g of ext) {
    const t = await api('GET', `/v1/betaGroups/${g.id}/betaTesters?limit=1`);
    const total = t.j && t.j.meta && t.j.meta.paging ? t.j.meta.paging.total : '?';
    const r = await api('POST', `/v1/betaGroups/${g.id}/relationships/builds`, { data: [{ type: 'builds', id: build.id }] });
    log(`group "${g.attributes.name}" (${total} testers): build`, r.ok || r.status === 204 ? 'attached' : `${r.status} ${r.err}`);
  }

  // 6. Beta App Review
  const cur = await api('GET', `/v1/builds/${build.id}/betaAppReviewSubmission`);
  const state = cur.j && cur.j.data ? cur.j.data.attributes.betaReviewState : null;
  if (state) { log('beta review state:', state); return; }
  const sub = await api('POST', '/v1/betaAppReviewSubmissions', { data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: build.id } } } } });
  if (sub.ok) log('submitted for Beta App Review:', sub.j.data.attributes.betaReviewState);
  else if (/ANOTHER_BUILD_IN_REVIEW|already/i.test(sub.err)) log('another build of this version is already in review:', sub.err);
  else { log('Beta App Review submit FAILED:', sub.status, sub.err); process.exit(3); }
})().catch((e) => { log('error', e.message); process.exit(1); });
