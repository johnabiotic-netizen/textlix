import { motion } from 'framer-motion';

/**
 * Scroll-triggered reveal wrapper.
 * Fades in + slides up the first time it enters the viewport.
 *
 *   <Reveal delay={0.1}><Card /></Reveal>
 *
 * Honors prefers-reduced-motion (framer-motion handles it automatically when
 * the user has reduced-motion set system-wide).
 */
export default function Reveal({
  children,
  delay = 0,
  y = 24,
  duration = 0.55,
  className = '',
  as = 'div',
}) {
  const MotionComp = motion[as] || motion.div;
  return (
    <MotionComp
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </MotionComp>
  );
}
