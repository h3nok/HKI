import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/dialog';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
} from '../components/alert-dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/tabs';
import { Button } from '../components/button';
import { Input } from '../components/input';
import { Label } from '../components/label';
import { Kbd } from '../components/kbd';
import { Badge } from '../components/badge';

// Dialog story
const dialogMeta = {
  title: 'Composites/Dialog',
  component: Dialog,
  tags: ['autodocs'],
} satisfies Meta<typeof Dialog>;

export default dialogMeta;
type Story = StoryObj<typeof dialogMeta>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Edit Profile</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Make changes to your profile here.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" defaultValue="John Doe" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" defaultValue="john@example.com" />
          </div>
        </div>
        <Button type="submit">Save changes</Button>
      </DialogContent>
    </Dialog>
  ),
};

export const AlertDialogStory: Story = {
  name: 'AlertDialog',
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete Account</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

export const TabsStory: Story = {
  name: 'Tabs',
  render: () => (
    <Tabs defaultValue="overview" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="p-4">
        Overview content goes here.
      </TabsContent>
      <TabsContent value="analytics" className="p-4">
        Analytics dashboard content.
      </TabsContent>
      <TabsContent value="settings" className="p-4">
        Settings panel content.
      </TabsContent>
    </Tabs>
  ),
};

export const KbdStory: Story = {
  name: 'Kbd Shortcuts',
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Search</span>
        <Kbd>⌘K</Kbd>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Save</span>
        <Kbd>⌘S</Kbd>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Copy</span>
        <Kbd>⌘C</Kbd>
      </div>
    </div>
  ),
};

export const BadgeVariants: Story = {
  name: 'Badge Variants',
  render: () => (
    <div className="flex gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};
