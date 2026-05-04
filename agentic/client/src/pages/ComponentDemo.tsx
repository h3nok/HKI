/**
 * Component Demo Page
 * Preview thinking animations and other UI components
 */

import { useState } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { ThinkingAnimation, ThinkingInline, ThinkingCard } from '@/components/chat-ui';

export default function ComponentDemo() {
  usePageMeta("Component Demo — HKI Agentic");
  const [activeVariant, setActiveVariant] = useState<'minimal' | 'standard' | 'expanded'>('standard');
  const [isDark, setIsDark] = useState(false);

  return (
    <div
      className={`min-h-screen p-8 transition-colors duration-300 ${isDark ? 'dark' : ''}`}
      style={{ 
        background: isDark ? '#0F1419' : '#F8FAFC', 
        color: isDark ? '#E6EDF3' : '#1E293B',
      }}
      data-theme={isDark ? 'dark' : 'light'}
    >
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header with Theme Toggle */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Thinking Animation</h1>
            <p style={{ color: isDark ? '#8B949E' : '#64748B' }}>
              HKI branded: <strong style={{ color: 'var(--secondary)' }}>Red C</strong> with <strong style={{ color: 'var(--primary)' }}>Blue rings</strong> — inverted in dark mode
            </p>
          </div>
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-3 rounded-xl transition-colors"
            style={{
              background: isDark ? '#192734' : '#E2E8F0',
              color: isDark ? '#E6EDF3' : '#1E293B',
            }}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {/* Variant Selector */}
        <div
          className="p-6 rounded-2xl"
          style={{
            background: isDark ? '#192734' : 'white',
            border: `1px solid ${isDark ? '#2D3F52' : '#E2E8F0'}`,
          }}
        >
          <h2 className="text-lg font-semibold mb-4">Animation Variants</h2>
          <div className="flex gap-2 mb-8">
            {(['minimal', 'standard', 'expanded'] as const).map((variant) => (
              <button
                key={variant}
                onClick={() => setActiveVariant(variant)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize"
                style={{
                  background: activeVariant === variant
                    ? 'var(--secondary)'
                    : isDark ? '#2D3F52' : '#E2E8F0',
                  color: activeVariant === variant
                    ? 'white'
                    : isDark ? '#E6EDF3' : '#1E293B',
                }}
              >
                {variant}
              </button>
            ))}
          </div>

          {/* Preview */}
          <div
            className="flex items-center justify-center p-12 rounded-xl"
            style={{
              background: isDark ? '#0F1419' : '#F1F5F9',
              minHeight: 200,
            }}
          >
            <ThinkingAnimation variant={activeVariant} />
          </div>
        </div>

        {/* All Variants Side by Side */}
        <div
          className="p-6 rounded-2xl"
          style={{
            background: isDark ? '#192734' : 'white',
            border: `1px solid ${isDark ? '#2D3F52' : '#E2E8F0'}`,
          }}
        >
          <h2 className="text-lg font-semibold mb-4">Size Comparison</h2>
          <div className="flex items-end justify-around gap-8 py-8">
            <div className="text-center">
              <ThinkingAnimation variant="minimal" showLabel={false} />
              <p className="text-xs mt-4" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
                Minimal (28px)
              </p>
            </div>
            <div className="text-center">
              <ThinkingAnimation variant="standard" showLabel={false} />
              <p className="text-xs mt-4" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
                Standard (56px)
              </p>
            </div>
            <div className="text-center">
              <ThinkingAnimation variant="expanded" showLabel={false} />
              <p className="text-xs mt-4" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
                Expanded (96px)
              </p>
            </div>
          </div>
        </div>

        {/* ThinkingInline */}
        <div
          className="p-6 rounded-2xl"
          style={{
            background: isDark ? '#192734' : 'white',
            border: `1px solid ${isDark ? '#2D3F52' : '#E2E8F0'}`,
          }}
        >
          <h2 className="text-lg font-semibold mb-4">Inline Indicator</h2>
          <p className="text-sm mb-4" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
            Use in chat messages or compact spaces
          </p>
          <div className="flex items-center gap-4">
            <ThinkingInline />
          </div>
        </div>

        {/* ThinkingCard */}
        <div
          className="p-6 rounded-2xl"
          style={{
            background: isDark ? '#192734' : 'white',
            border: `1px solid ${isDark ? '#2D3F52' : '#E2E8F0'}`,
          }}
        >
          <h2 className="text-lg font-semibold mb-4">Thinking Card</h2>
          <p className="text-sm mb-4" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
            Prominent display with title and description
          </p>
          <div className="space-y-4 max-w-md">
            <ThinkingCard
              title="Analyzing your request"
              description="Understanding context and planning approach..."
            />
            <ThinkingCard
              title="Searching knowledge base"
              description="Finding relevant information to assist you"
            />
          </div>
        </div>

        {/* Usage Examples */}
        <div
          className="p-6 rounded-2xl"
          style={{
            background: isDark ? '#192734' : 'white',
            border: `1px solid ${isDark ? '#2D3F52' : '#E2E8F0'}`,
          }}
        >
          <h2 className="text-lg font-semibold mb-4">Usage</h2>
          <pre
            className="p-4 rounded-xl text-sm overflow-x-auto"
            style={{
              background: isDark ? '#0F1419' : '#F8FAFC',
              border: `1px solid ${isDark ? '#2D3F52' : '#E2E8F0'}`,
              color: isDark ? '#E6EDF3' : '#1E293B',
            }}
          >
{`import { ThinkingAnimation, ThinkingInline, ThinkingCard } from '@/components/chat-ui';

// Basic animation with variants
<ThinkingAnimation variant="minimal" />
<ThinkingAnimation variant="standard" />
<ThinkingAnimation variant="expanded" />

// Custom label
<ThinkingAnimation label="Processing" />

// Inline for chat messages
<ThinkingInline />

// Card for prominent display
<ThinkingCard 
  title="Analyzing your request"
  description="Optional description..."
/>`}
          </pre>
        </div>
      </div>
    </div>
  );
}
