import React, { useMemo, useState } from 'react';
import { Megaphone, Sparkles } from 'lucide-react';
import { useSiteConfig } from '../../hooks/useSiteConfig';

export default function AnnouncementBar() {
  const siteConfig = useSiteConfig();
  const [paused, setPaused] = useState(false);

  const items = useMemo(
    () => (siteConfig.announcements || []).filter((a) => a && a.text?.trim()),
    [siteConfig.announcements]
  );

  if (items.length === 0) return null;

  // Repeat full announcement cycle so one half always exceeds wide desktop viewports
  // while keeping exact 1 -> 2 -> ... -> N -> 1 seamless ordering
  const repeatFactor = Math.max(2, Math.ceil(4 / items.length));
  const unitItems = [];
  for (let r = 0; r < repeatFactor; r += 1) {
    for (const item of items) {
      unitItems.push(item);
    }
  }

  const totalChars = unitItems.reduce((sum, a) => sum + a.text.trim().length, 0);
  const durationSec = Math.max(24, Math.round(totalChars * 0.24));

  const renderHalf = (halfIndex) => (
    <div
      key={halfIndex}
      className="flex shrink-0 items-center"
      aria-hidden={halfIndex === 1}
    >
      {unitItems.map((item, idx) => (
        <div
          key={`${halfIndex}-${item._id || idx}-${idx}`}
          className="flex shrink-0 items-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E5C98B]/30 bg-[#FAF8F3]/[0.09] px-3.5 py-0.5 text-[11.5px] sm:text-xs font-medium tracking-[0.025em] text-[#FAF8F3] shadow-xs transition-colors hover:border-[#E5C98B]/60 hover:bg-[#FAF8F3]/[0.15]">
            <Sparkles size={11} className="shrink-0 text-[#E5C98B]" />
            <span>{item.text.trim()}</span>
          </span>
          <span
            className="mx-5 sm:mx-8 inline-flex items-center gap-2.5"
            aria-hidden="true"
          >
            <span className="h-3.5 w-px bg-[#E5C98B]/25" />
            <span className="text-[10px] text-[#E5C98B]/85">✦</span>
            <span className="h-3.5 w-px bg-[#E5C98B]/25" />
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div
      className="relative z-40 w-full border-b border-[#C6A969]/35 bg-gradient-to-r from-[#1A351C] via-[#284D2B] to-[#1A351C] text-white select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      onTouchCancel={() => setPaused(false)}
      aria-label="Store announcements"
    >
      <div className="mx-auto flex h-9 sm:h-10 max-w-7xl items-center px-2 sm:px-4">
        {/* Compact luxury badge anchor */}
        <div className="hidden sm:flex shrink-0 items-center gap-1.5 pr-3 mr-2 border-r border-[#E5C98B]/25">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E5C98B]/15 text-[#E5C98B]">
            <Megaphone size={11} />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E5C98B]">
            Highlights
          </span>
        </div>

        {/* Continuous fading marquee viewport */}
        <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]">
          <div
            className="orgion-marquee-track flex w-max items-center whitespace-nowrap py-1"
            style={{
              animationDuration: `${durationSec}s`,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          >
            {renderHalf(0)}
            {renderHalf(1)}
          </div>
        </div>
      </div>
    </div>
  );
}
