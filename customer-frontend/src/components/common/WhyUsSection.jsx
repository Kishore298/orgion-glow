import React from 'react';
import { Leaf, FlaskConical, Factory, HeartHandshake, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { LUXURY_EASE, RevealSection, RevealStaggerGrid, RevealStaggerItem } from './MotionPrimitives';

const PILLARS = [
  {
    num: '01',
    tag: 'Pure Botanicals',
    icon: Leaf,
    title: '100% Herbal',
    desc: 'Time-honoured botanicals, cold-pressed oils, and whole plant extracts.',
  },
  {
    num: '02',
    tag: 'Zero Toxins',
    icon: FlaskConical,
    title: 'Chemical Free',
    desc: 'Zero parabens, sulphates, mineral oils, or synthetic dyes.',
  },
  {
    num: '03',
    tag: 'Small-Batch Studio',
    icon: Factory,
    title: 'Own Manufacturing',
    desc: 'Handcrafted in small fresh batches for uncompromised purity.',
  },
  {
    num: '04',
    tag: 'Pan-India Love',
    icon: HeartHandshake,
    title: 'Trusted by Thousands',
    desc: 'Loved across India for visible radiance and honest care.',
  },
];

export default function WhyUsSection() {
  return (
    <section
      id="why-us"
      className="scroll-mt-24 relative overflow-hidden bg-surface-muted py-12 sm:py-18 lg:py-20 border-y border-border"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <RevealSection className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.12em] text-primary-dark">
            <Sparkles size={12} /> Pure Botanical Craft
          </span>
          <h2 className="mt-2.5 font-serif text-2xl sm:text-4xl font-semibold text-primary-dark">
            Why ORGION
          </h2>
          <p className="mt-2 text-xs sm:text-base text-text-muted leading-relaxed">
            Every soap, night cream, and lip balm is thoughtfully formulated under our own roof with nature at its heart.
          </p>
        </RevealSection>

        <RevealStaggerGrid className="mt-8 sm:mt-12 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {PILLARS.map(({ num, tag, icon: Icon, title, desc }) => (
            <RevealStaggerItem key={title}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.25, ease: LUXURY_EASE }}
                className="group relative flex h-full flex-col rounded-2xl border border-border bg-surface p-3.5 sm:p-6 shadow-card transition-all duration-300 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-primary-soft text-primary ring-1 ring-primary/15 transition-colors group-hover:bg-primary group-hover:text-white">
                    <Icon size={18} className="sm:w-[21px] sm:h-[21px]" strokeWidth={1.7} />
                  </div>
                  <span className="font-serif text-sm sm:text-lg font-semibold text-sage/80">
                    {num}
                  </span>
                </div>

                <span className="mt-3 sm:mt-5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                  {tag}
                </span>
                <h3 className="mt-0.5 sm:mt-1 font-serif text-base sm:text-xl font-semibold text-text leading-snug">
                  {title}
                </h3>
                <p className="mt-1 sm:mt-2 text-[11px] sm:text-sm leading-snug sm:leading-relaxed text-text-muted">
                  {desc}
                </p>

                <div className="mt-auto pt-3 sm:pt-4">
                  <div className="h-[2px] w-7 sm:w-8 rounded-full bg-gold/60 transition-all duration-300 group-hover:w-14 group-hover:bg-primary" />
                </div>
              </motion.div>
            </RevealStaggerItem>
          ))}
        </RevealStaggerGrid>

        <RevealSection
          delay={0.15}
          className="mt-7 sm:mt-10 flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-8 gap-y-1.5 text-[11px] sm:text-xs font-medium text-text-muted"
        >
          <span>• Crafted in Nagercoil, India</span>
          <span>• Fresh Small Batches</span>
          <span>• Skin-Friendly Botanicals</span>
        </RevealSection>
      </div>
    </section>
  );
}
