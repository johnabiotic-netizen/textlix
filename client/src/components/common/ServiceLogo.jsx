import { useState, useEffect } from 'react';
import { serviceLogoUrl, serviceEmoji } from '../../utils/serviceLogo';

// Renders a service's real brand logo (favicon by domain), falling back to an
// emoji if the logo can't be loaded. Used in the browse cards/headers.
export default function ServiceLogo({ slug, size = 26, className = '' }) {
  const [failed, setFailed] = useState(false);
  // Reset when the slug changes (component is reused across list rows).
  useEffect(() => { setFailed(false); }, [slug]);

  if (failed) {
    return <span className={className} style={{ fontSize: Math.round(size * 0.85), lineHeight: 1 }}>{serviceEmoji(slug)}</span>;
  }
  return (
    <img
      src={serviceLogoUrl(slug)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
      style={{ borderRadius: 6, objectFit: 'contain' }}
    />
  );
}
