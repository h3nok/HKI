import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ConfidenceIndicator,
  ConfidenceBar,
} from '../components/agentic/core/ConfidenceIndicator';

const meta = {
  title: 'Agentic/ConfidenceIndicator',
  component: ConfidenceIndicator,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Shows agent confidence in its response. Color-coded thresholds: High (80+), Medium (50-79), Low (<50). Includes tooltip with explanation and animated progress bar.',
      },
    },
  },
  argTypes: {
    score: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    showBar: { control: 'boolean' },
    showIcon: { control: 'boolean' },
    label: { control: 'text' },
    explanation: { control: 'text' },
  },
} satisfies Meta<typeof ConfidenceIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** High confidence — green indicator */
export const HighConfidence: Story = {
  args: { score: 92, size: 'md', showBar: true, showIcon: true },
};

/** Medium confidence — amber indicator */
export const MediumConfidence: Story = {
  args: { score: 65, size: 'md', showBar: true },
};

/** Low confidence — red indicator */
export const LowConfidence: Story = {
  args: { score: 28, size: 'md', showBar: true },
};

/** Small size */
export const SmallSize: Story = {
  args: { score: 85, size: 'sm' },
};

/** Large size */
export const LargeSize: Story = {
  args: { score: 72, size: 'lg', showBar: true },
};

/** Custom explanation */
export const CustomExplanation: Story = {
  args: {
    score: 45,
    size: 'md',
    label: 'Source Quality',
    explanation: 'Only 2 of 5 sources could be verified. Consider cross-referencing.',
  },
};

/** All threshold levels side by side */
export const AllLevels: Story = {
  args: { score: 95 },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ConfidenceIndicator score={95} size="md" showBar showIcon />
      <ConfidenceIndicator score={65} size="md" showBar showIcon />
      <ConfidenceIndicator score={25} size="md" showBar showIcon />
    </div>
  ),
};

/** ConfidenceBar — progress bar only */
export const BarOnly: Story = {
  args: { score: 92 },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 300 }}>
      <ConfidenceBar score={92} showLabel height="md" />
      <ConfidenceBar score={60} showLabel height="md" />
      <ConfidenceBar score={30} showLabel height="md" />
    </div>
  ),
  name: 'ConfidenceBar',
};
