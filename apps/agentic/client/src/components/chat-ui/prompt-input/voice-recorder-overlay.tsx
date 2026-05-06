/**
 * VoiceRecorderOverlay — Recording indicator that replaces the textarea
 *
 * Shows:
 *  • Pulsing red dot + "Recording…" label
 *  • Elapsed time (mm:ss)
 *  • Animated audio waveform bars
 *  • Cancel (X) and Stop (■) buttons
 */

import { motion } from 'framer-motion';
import { Square, X } from 'lucide-react';
import { cn } from '@hki/ui';

interface VoiceRecorderOverlayProps {
  formattedTime: string;
  onStop: () => void;
  onCancel: () => void;
}

// ── Waveform bars ───────────────────────────────────────────────────────

function WaveformBars() {
  const barCount = 24;
  return (
    <div className="flex items-center justify-center gap-0.5 h-6 flex-1 mx-3">
      {Array.from({ length: barCount }).map((_, i) => (
        <motion.div
          key={i}
          className="w-0.5 rounded-full bg-destructive/60"
          animate={{
            height: ['4px', `${8 + Math.random() * 16}px`, '4px'],
          }}
          transition={{
            duration: 0.6 + Math.random() * 0.6,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.04,
          }}
        />
      ))}
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────

export function VoiceRecorderOverlay({
  formattedTime,
  onStop,
  onCancel,
}: VoiceRecorderOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 flex-1 mx-2 py-2"
    >
      {/* Cancel button */}
      <button
        type="button"
        onClick={onCancel}
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
          'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
          'transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
        aria-label="Cancel recording"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Pulsing red dot */}
      <div className="relative flex items-center shrink-0">
        <motion.div
          className="w-2.5 h-2.5 rounded-full bg-destructive"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Ping ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-destructive"
          animate={{ scale: [1, 2], opacity: [0.5, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
        />
      </div>

      {/* Timer */}
      <span className="text-sm font-mono text-foreground tabular-nums min-w-[3ch]">
        {formattedTime}
      </span>

      {/* Waveform */}
      <WaveformBars />

      {/* Stop button */}
      <motion.button
        type="button"
        onClick={onStop}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
          'bg-destructive text-white',
          'transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
        aria-label="Stop recording"
      >
        <Square className="w-3.5 h-3.5 fill-current" />
      </motion.button>
    </motion.div>
  );
}
