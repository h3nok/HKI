import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  FadeIn,
  StaggerList,
  StaggerItem,
  SpringScale,
  AnimateHeight,
  FadeInScale,
} from '../components/motion';
import { Button } from '../components/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/card';
import { Badge } from '../components/badge';

const meta = {
  title: 'Motion/FadeIn',
  component: FadeIn,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Brand-aware motion system consuming design-system animation tokens. Provides consistent, performant animations across the platform.',
      },
    },
  },
} satisfies Meta<typeof FadeIn>;

export default meta;
type Story = StoryObj<typeof meta>;

// =============================================================================
// FadeIn Stories
// =============================================================================

export const FadeInUp: Story = {
  args: { children: null },
  render: () => (
    <FadeIn direction="up" key={Date.now()}>
      <Card style={{ width: 300 }}>
        <CardHeader>
          <CardTitle>Fade In Up</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Default animation — fades in from below with smooth easing.
          </p>
        </CardContent>
      </Card>
    </FadeIn>
  ),
  name: 'FadeIn — Up (Default)',
};

export const FadeInDirections: Story = {
  args: { children: null },
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {(['up', 'down', 'left', 'right'] as const).map((dir, i) => (
        <FadeIn key={dir} direction={dir} delay={i * 0.15}>
          <Card style={{ width: 200 }}>
            <CardHeader>
              <CardTitle className="text-base">from {dir}</CardTitle>
            </CardHeader>
          </Card>
        </FadeIn>
      ))}
    </div>
  ),
  name: 'FadeIn — All Directions',
};

// =============================================================================
// StaggerList Stories
// =============================================================================

export const Stagger: Story = {
  args: { children: null },
  render: () => (
    <StaggerList style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 320 }}>
      {['Warehouse Analytics', 'Member Insights', 'Supply Chain', 'Revenue Forecast'].map(
        (item) => (
          <StaggerItem key={item}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{item}</CardTitle>
              </CardHeader>
            </Card>
          </StaggerItem>
        )
      )}
    </StaggerList>
  ),
  name: 'StaggerList',
};

// =============================================================================
// SpringScale Stories
// =============================================================================

export const Spring: Story = {
  args: { children: null },
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      <SpringScale>
        <Button variant="brand">Hover Me</Button>
      </SpringScale>
      <SpringScale hoverScale={1.05} tapScale={0.95}>
        <Card style={{ width: 200, cursor: 'pointer' }}>
          <CardHeader>
            <CardTitle className="text-sm">Spring Card</CardTitle>
          </CardHeader>
        </Card>
      </SpringScale>
      <SpringScale disabled>
        <Button variant="outline" disabled>Disabled</Button>
      </SpringScale>
    </div>
  ),
  name: 'SpringScale',
};

// =============================================================================
// AnimateHeight Stories
// =============================================================================

function AnimateHeightDemo() {
  const [show, setShow] = useState(false);
  return (
    <div style={{ width: 320 }}>
      <Button onClick={() => setShow(!show)} variant="outline" style={{ marginBottom: 8 }}>
        {show ? 'Collapse' : 'Expand'}
      </Button>
      <AnimateHeight show={show}>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              This content smoothly expands and collapses with design system easing.
            </p>
            <div className="flex gap-2 mt-3">
              <Badge variant="hki-blue">Analytics</Badge>
              <Badge variant="hki-red">Priority</Badge>
              <Badge variant="success">Active</Badge>
            </div>
          </CardContent>
        </Card>
      </AnimateHeight>
    </div>
  );
}

export const Height: Story = {
  args: { children: null },
  render: () => <AnimateHeightDemo />,
  name: 'AnimateHeight',
};

// =============================================================================
// FadeInScale Stories
// =============================================================================

export const ScaleIn: Story = {
  args: { children: null },
  render: () => (
    <FadeInScale key={Date.now()}>
      <Card style={{ width: 280 }}>
        <CardHeader>
          <CardTitle className="text-base">Pop-in Entrance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Scale + fade entrance for modals, tooltips, and notifications.
          </p>
        </CardContent>
      </Card>
    </FadeInScale>
  ),
  name: 'FadeInScale',
};

// =============================================================================
// Combined Showcase
// =============================================================================

export const FullShowcase: Story = {
  args: { children: null },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 500 }}>
      <div>
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
          Staggered List
        </h3>
        <StaggerList style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['Item A', 'Item B', 'Item C'].map((item) => (
            <StaggerItem key={item}>
              <SpringScale>
                <Card style={{ cursor: 'pointer' }}>
                  <CardHeader>
                    <CardTitle className="text-sm">{item}</CardTitle>
                  </CardHeader>
                </Card>
              </SpringScale>
            </StaggerItem>
          ))}
        </StaggerList>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
          Brand Buttons with Spring
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <FadeIn delay={0}>
            <SpringScale>
              <Button variant="brand">Primary CTA</Button>
            </SpringScale>
          </FadeIn>
          <FadeIn delay={0.1}>
            <SpringScale>
              <Button variant="outline">Secondary</Button>
            </SpringScale>
          </FadeIn>
        </div>
      </div>
    </div>
  ),
  name: 'Full Showcase',
};
