import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ThinkingAnimation,
  ThinkingInline,
  ThinkingCard,
} from '../components/agentic/thought-trace/ThinkingIndicator';
import {
  StreamingIndicator,
  StreamingIndicatorCompact,
} from '../components/agentic/thought-trace/StreamingIndicator';
import { ReasoningCard, InlineReasoning } from '../components/agentic/thought-trace/ReasoningCard';
import type { ReasoningStep } from '../components/agentic/thought-trace/ReasoningCard';

// =============================================================================
// ThinkingAnimation Stories
// =============================================================================

const thinkingMeta = {
  title: 'Agentic/ThinkingAnimation',
  component: ThinkingAnimation,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'HKI brand thinking animation with a red "C" and blue orbital elements. Colors invert in dark mode. Three size variants for different contexts.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['minimal', 'standard', 'expanded'],
    },
    showLabel: { control: 'boolean' },
    label: { control: 'text' },
  },
} satisfies Meta<typeof ThinkingAnimation>;

export default thinkingMeta;
type ThinkingStory = StoryObj<typeof thinkingMeta>;

/** Default thinking animation — standard size with label */
export const Standard: ThinkingStory = {
  args: {
    variant: 'standard',
    label: 'Thinking',
    showLabel: true,
  },
};

/** Minimal variant — inline, no label. Use inside chat bubbles. */
export const Minimal: ThinkingStory = {
  args: {
    variant: 'minimal',
    showLabel: false,
  },
};

/** Expanded variant — large, prominent. Use on loading pages. */
export const Expanded: ThinkingStory = {
  args: {
    variant: 'expanded',
    label: 'Analyzing data',
    showLabel: true,
  },
};

/** All three variants side by side */
export const AllVariants: ThinkingStory = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
      <ThinkingAnimation variant="minimal" showLabel={false} />
      <ThinkingAnimation variant="standard" />
      <ThinkingAnimation variant="expanded" label="Processing" />
    </div>
  ),
};

// =============================================================================
// ThinkingInline Stories
// =============================================================================

export const Inline: ThinkingStory = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
      <ThinkingInline />
      <ThinkingInline label="Searching knowledge base..." />
      <ThinkingInline label="Analyzing 12 documents" />
    </div>
  ),
  name: 'ThinkingInline',
};

// =============================================================================
// ThinkingCard Stories
// =============================================================================

export const CardVariant: ThinkingStory = {
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <ThinkingCard
        title="Processing your request"
        description="Analyzing cost data across 3 warehouses..."
      />
    </div>
  ),
  name: 'ThinkingCard',
};

// =============================================================================
// StreamingIndicator Stories
// =============================================================================

export const StreamingThinking: ThinkingStory = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
      <StreamingIndicator status="thinking" message="Analyzing your question..." />
      <StreamingIndicator status="planning" message="Creating execution plan..." />
      <StreamingIndicator status="searching" message="Searching knowledge base..." />
      <StreamingIndicator status="executing" message="Running data analysis tool..." />
      <StreamingIndicator status="generating" message="Writing response..." />
    </div>
  ),
  name: 'StreamingIndicator — All States',
};

export const StreamingCompact: ThinkingStory = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <StreamingIndicatorCompact status="thinking" />
      <StreamingIndicatorCompact status="planning" />
      <StreamingIndicatorCompact status="searching" />
      <StreamingIndicatorCompact status="executing" />
      <StreamingIndicatorCompact status="generating" />
    </div>
  ),
  name: 'StreamingIndicator — Compact',
};

// =============================================================================
// ReasoningCard Stories
// =============================================================================

const sampleSteps: ReasoningStep[] = [
  {
    id: '1',
    type: 'observation',
    content: 'The user is asking about quarterly revenue trends for the Northwest region.',
    confidence: 0.95,
  },
  {
    id: '2',
    type: 'thought',
    content: 'I need to query the sales database for Q1-Q4 data, filtered by region code NW.',
    confidence: 0.88,
  },
  {
    id: '3',
    type: 'decision',
    content: 'Using the analytics API rather than raw SQL for pre-aggregated data.',
    confidence: 0.82,
  },
  {
    id: '4',
    type: 'conclusion',
    content: 'Revenue grew 12.3% YoY with strongest performance in Q3 driven by seasonal demand.',
    confidence: 0.91,
  },
];

export const Reasoning: ThinkingStory = {
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <ReasoningCard
        steps={sampleSteps}
        title="Agent Reasoning"
        isExpanded={true}
      />
    </div>
  ),
  name: 'ReasoningCard — Expanded',
};

export const ReasoningCollapsed: ThinkingStory = {
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <ReasoningCard
        steps={sampleSteps}
        title="Agent Reasoning"
        isExpanded={false}
      />
    </div>
  ),
  name: 'ReasoningCard — Collapsed',
};

export const InlineReasoningStory: ThinkingStory = {
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <InlineReasoning content="I'm comparing the user's query against 3 potential data sources to find the most relevant one." />
    </div>
  ),
  name: 'InlineReasoning',
};
