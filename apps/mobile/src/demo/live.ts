/**
 * Dev harness (web preview `?mock=live`): REAL-SHAPED answers copied from the backend (LooksService.map, StoriesService, TimeOff DTO,
 * ReviewController.toMap, BookingController): UUID string ids, relative upload urls, nulls, string/number mixes, plain `null` bodies.
 * Anything not listed falls through to the demo fixtures. Never reached in release (needs setDemoVariant('live')).
 */
const json = (d: unknown, status = 200) => new Response(d === undefined ? '' : JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
const U = (n: number) => `0000000${n}-0000-4000-8000-00000000000${n}`;
export function liveHit(method: string, path: string): Response | null {
  if (method !== 'GET') return null;
  if (/^\/businesses\/[^/]+\/looks\/settings/.test(path)) return json({ autoPublish: false });
  if (/^\/businesses\/[^/]+\/looks$/.test(path)) return json([
    { id: U(1), salonId: U(9), salonName: 'S', photoUrl: null, title: null, serviceId: null, serviceName: null, staffId: null, staffName: null, priceFrom: null, currency: null, durationMinutes: null, tags: [], category: null, weeklyBookings: 0, saveCount: 0, likeCount: 0, createdAt: '2026-11-20T10:00:00', status: 'PENDING', rejectNote: null },
    { id: U(2), photoUrl: '/api/public/uploads/abc', title: 'Bob', serviceName: 'Kəsim', status: 'APPROVED', rejectNote: null },
  ]);
  if (/^\/businesses\/[^/]+\/stories$/.test(path)) return json([{ id: U(3), kind: 'PHOTO', url: '/api/public/uploads/s1', caption: null, createdAt: '2026-11-26T10:00:00', expiresAt: '2026-11-27T10:00:00' }]);
  if (/^\/reviews\/business\/[^/]+\/summary/.test(path)) return json({ count: 0, average: null });
  if (/^\/time-off\/business\//.test(path)) return json([{ id: U(4), staffId: U(5), staffName: null, startDate: '2026-11-27', endDate: '2026-11-27', startTime: null, endTime: null, isFullDay: true, reason: null }]);
  if (/^\/staff\/business\//.test(path)) return json(null);
  return null;
}
