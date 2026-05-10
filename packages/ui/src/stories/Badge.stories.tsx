import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../components/badge';

const meta = {
  title: 'Primitives/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default', 'secondary', 'destructive', 'outline', 'accent',
        'success', 'warning', 'hki-blue', 'hki-red', 'brand',
      ],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Badge' },
};
export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Secondary' },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Destructive' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'Outline' },
};

export const HKIBlue: Story = {
  args: { variant: 'hki-blue', children: 'Analytics' },
};

export const HKIRed: Story = {
  args: { variant: 'hki-red', children: 'Priority' },
};

export const Success: Story = {
  args: { variant: 'success', children: 'Active' },
};

export const Warning: Story = {
  args: { variant: 'warning', children: 'Pending' },
};

export const Brand: Story = {
  args: { variant: 'brand', children: 'New' },
};

/** All variants side by side */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="hki-blue">HKI Iris</Badge>
      <Badge variant="hki-red">HKI Pulse</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="brand">Brand</Badge>
    </div>
  ),
};
