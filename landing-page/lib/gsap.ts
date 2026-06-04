import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Observer } from 'gsap/Observer';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, Observer);
  gsap.defaults({ ease: 'power3.out' });
}

export { gsap, ScrollTrigger };
