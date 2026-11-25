import { useEffect, useState } from 'react';

import { getPlatformSettings } from '@/services/platformService';

/**
 * What the platform is announcing, above the panel.
 *
 * One line, no dismiss: it is there until an administrator clears it, because the reason
 * to set one is always something a salon needs to still know tomorrow.
 */
export function PlatformBanner() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    getPlatformSettings().then((settings) => setMessage(settings.announcement));
  }, []);

  if (!message) return null;

  return (
    <div className="bg-slate-900 px-4 py-2 text-center text-sm text-white">{message}</div>
  );
}
