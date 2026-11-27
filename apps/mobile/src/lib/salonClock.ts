/**
 * The salon's clock. "Now", "today" and the calendar's now-line follow the salon's city, not the
 * phone: an owner whose phone is set to Warsaw still sees Baku time for a Baku salon. The server
 * already decides past / lead time on the salon's clock; this keeps the screens in step with it.
 */
let zone = 'Asia/Baku'; // booqi's market; replaced by the salon's own zone when the API sends one

/** Use the salon's IANA zone (businesses.timezone) when known. */
export function setSalonZone(z?: string | null) {
  if (z && typeof z === 'string') zone = z;
}

export const salonZone = () => zone;

/**
 * A Date whose local fields (getHours, getDate, ...) read the salon's wall clock. Only for display
 * and day maths; never send it as an instant.
 */
export function salonNow(): Date {
  const real = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(real);
    const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const d = new Date(n('year'), n('month') - 1, n('day'), n('hour') % 24, n('minute'), n('second'));
    if (!Number.isNaN(d.getTime())) return d;
  } catch {
    // no Intl time zones on this engine: fall through
  }
  // Baku is UTC+4 all year (no DST).
  return new Date(real.getTime() + (240 + real.getTimezoneOffset()) * 60000);
}

export const salonNowMin = () => { const n = salonNow(); return n.getHours() * 60 + n.getMinutes(); };

/** The salon's city for labels ("Bakı" for Asia/Baku, else the zone's last part). */
export const salonCity = () => (zone === 'Asia/Baku' ? 'Bakı' : (zone.split('/').pop() ?? zone).replace(/_/g, ' '));

/** True when the phone's clock is in another zone than the salon (an owner abroad): then label the time. */
export function phoneZoneDiffers(): boolean {
  return Math.abs(salonNow().getTime() - Date.now()) >= 60000;
}
