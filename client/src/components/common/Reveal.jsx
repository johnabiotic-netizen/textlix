import { useEffect, useRef, useState, createElement } from 'react';

/**
 * Scroll-triggered reveal wrapper.
 * Fades in + slides up the first time it enters the viewport.
 *
 *   <Reveal delay={0.1}><Card /></Reveal>
 *
 * Implemented with IntersectionObserver + CSS transitions instead of
 * framer-motion's `whileInView` — framer's runtime cost on mobile was
 * showing up in TBT on the landing page. Honors prefers-reduced-motion
 * (shows children in their final state immediately).
 */
export default function Reveal({
  children,
  delay = 0,
  y = 24,
  duration = 0.55,
  className = '',
  as = 'div',
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true);
      setVisible(true);
      return undefined;
    }

    const node = ref.current;
    if (!node) return undefined;

    // If the element is already in the initial viewport at mount, skip the
    // fade-in entirely and render visible. The scroll-reveal effect is meant
    // for things the user scrolls *to* — for above-the-fold content (especially
    // the LCP hero), the animation just delays paint and tanks the LCP metric.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '-80px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const style = reduced
    ? undefined
    : {
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : `translate3d(0, ${y}px, 0)`,
        transition: `opacity ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s, transform ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s`,
        willChange: visible ? 'auto' : 'opacity, transform',
      };

  return createElement(as, { ref, className, style }, children);
}
