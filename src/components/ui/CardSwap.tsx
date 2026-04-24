'use client';
import React, { Children, cloneElement, forwardRef, isValidElement, ReactElement, ReactNode, RefObject, useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';

export interface CardSwapProps {
  width?: number | string; height?: number | string;
  cardDistance?: number; verticalDistance?: number;
  delay?: number; pauseOnHover?: boolean;
  skewAmount?: number; easing?: 'linear' | 'elastic';
  onCardClick?: (idx: number) => void; children: ReactNode;
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> { customClass?: string; }

export const Card = forwardRef<HTMLDivElement, CardProps>(({ customClass, ...rest }, ref) => (
  <div ref={ref} {...rest}
    className={`absolute top-1/2 left-1/2 rounded-2xl border border-black/5 bg-white shadow-lg [transform-style:preserve-3d] [will-change:transform] [backface-visibility:hidden] ${customClass ?? ''} ${rest.className ?? ''}`.trim()} />
));
Card.displayName = 'Card';

type CardRef = RefObject<HTMLDivElement | null>;
interface Slot { x: number; y: number; z: number; zIndex: number; }

const makeSlot = (i: number, dx: number, dy: number, total: number): Slot => ({
  x: i * dx, y: -i * dy, z: -i * dx * 1.5, zIndex: total - i
});

const placeNow = (el: HTMLElement, slot: Slot, skew: number) =>
  gsap.set(el, { x: slot.x, y: slot.y, z: slot.z, xPercent: -50, yPercent: -50, skewY: skew, transformOrigin: 'center center', zIndex: slot.zIndex, force3D: true });

export const CardSwap: React.FC<CardSwapProps> = ({
  width = 420, height = 300, cardDistance = 50, verticalDistance = 50,
  delay = 4500, pauseOnHover = true, onCardClick, skewAmount = 4, easing = 'elastic', children
}) => {
  const cfg = easing === 'elastic'
    ? { ease: 'elastic.out(0.6,0.9)', durDrop: 2, durMove: 2, durReturn: 2, promoteOverlap: 0.9, returnDelay: 0.05 }
    : { ease: 'power1.inOut', durDrop: 0.8, durMove: 0.8, durReturn: 0.8, promoteOverlap: 0.45, returnDelay: 0.2 };

  const childArr = useMemo(() => Children.toArray(children) as ReactElement<CardProps>[], [children]);
  const refs = useMemo<CardRef[]>(() => childArr.map(() => React.createRef<HTMLDivElement>()), [childArr.length]);
  const order = useRef<number[]>(Array.from({ length: childArr.length }, (_, i) => i));
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const intervalRef = useRef<number>(0);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refs.forEach((r, i) => { if (r.current) placeNow(r.current, makeSlot(i, cardDistance, verticalDistance, refs.length), skewAmount); });

    const swap = () => {
      if (order.current.length < 2) return;
      const [front, ...rest] = order.current;
      const elF = refs[front].current;
      if (!elF) return;
      const tl = gsap.timeline(); tlRef.current = tl;
      tl.to(elF, { y: '+=500', duration: cfg.durDrop, ease: cfg.ease });
      tl.addLabel('promote', `-=${cfg.durDrop * cfg.promoteOverlap}`);
      rest.forEach((idx, i) => {
        const el = refs[idx].current; if (!el) return;
        const slot = makeSlot(i, cardDistance, verticalDistance, refs.length);
        tl.set(el, { zIndex: slot.zIndex }, 'promote');
        tl.to(el, { x: slot.x, y: slot.y, z: slot.z, duration: cfg.durMove, ease: cfg.ease }, `promote+=${i * 0.15}`);
      });
      const bSlot = makeSlot(refs.length - 1, cardDistance, verticalDistance, refs.length);
      tl.addLabel('return', `promote+=${cfg.durMove * cfg.returnDelay}`);
      tl.call(() => gsap.set(elF, { zIndex: bSlot.zIndex }), undefined, 'return');
      tl.to(elF, { x: bSlot.x, y: bSlot.y, z: bSlot.z, duration: cfg.durReturn, ease: cfg.ease }, 'return');
      tl.call(() => { order.current = [...rest, front]; });
    };

    intervalRef.current = window.setInterval(swap, delay);
    if (pauseOnHover && container.current) {
      const node = container.current;
      const pause = () => { tlRef.current?.pause(); clearInterval(intervalRef.current); };
      const resume = () => { tlRef.current?.play(); intervalRef.current = window.setInterval(swap, delay); };
      node.addEventListener('mouseenter', pause);
      node.addEventListener('mouseleave', resume);
      return () => { node.removeEventListener('mouseenter', pause); node.removeEventListener('mouseleave', resume); clearInterval(intervalRef.current); };
    }
    return () => clearInterval(intervalRef.current);
  }, [cardDistance, verticalDistance, delay, pauseOnHover, skewAmount, easing, refs]);

  const rendered = childArr.map((child, i) =>
    isValidElement<CardProps>(child)
      ? cloneElement(child, { key: i, ref: refs[i], style: { width, height, ...(child.props.style ?? {}) },
          onClick: (e: React.MouseEvent<HTMLDivElement>) => { child.props.onClick?.(e); onCardClick?.(i); } } as CardProps & React.RefAttributes<HTMLDivElement>)
      : child
  );

  return (
    <div ref={container} className="relative" style={{ width, height, perspective: '1200px', transformStyle: 'preserve-3d' }}>
      <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>{rendered}</div>
    </div>
  );
};

export default CardSwap;
