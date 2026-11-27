import React from 'react';
import { motion } from 'framer-motion';

export const LUXURY_EASE = [0.22, 1, 0.36, 1];

export function MotionPage({ children, className = '' }) {
  return <div className={`animate-fade-up ${className}`}>{children}</div>;
}

export function RevealSection({ children, className = '', delay = 0 }) {
  return (
    <div
      className={`animate-fade-up ${className}`}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

export function RevealStaggerGrid({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}

export function RevealStaggerItem({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: LUXURY_EASE }}
      className={`h-full ${className}`}
    >
      {children}
    </motion.div>
  );
}
