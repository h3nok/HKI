/**
 * Smoke tests for all @hki/ui primitive components.
 * Each test verifies the component renders without crashing and produces DOM output.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Badge } from "../../components/badge";
import { Input } from "../../components/input";
import { Label } from "../../components/label";
import { Skeleton } from "../../components/skeleton";
import { Separator } from "../../components/separator";
import { Progress } from "../../components/progress";
import { Switch } from "../../components/switch";
import { Checkbox } from "../../components/checkbox";
import { Slider } from "../../components/slider";
import { Spinner } from "../../components/spinner";
import { Textarea } from "../../components/textarea";
import { Avatar, AvatarFallback } from "../../components/avatar";
import { Kbd, KbdGroup } from "../../components/kbd";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/card";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "../../components/alert";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../../components/accordion";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "../../components/tooltip";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../../components/collapsible";
import {
  RadioGroup,
  RadioGroupItem,
} from "../../components/radio-group";
import { ScrollArea } from "../../components/scroll-area";
import { AspectRatio } from "../../components/aspect-ratio";
import { Toggle } from "../../components/toggle";

describe("Primitive Components — Smoke Tests", () => {
  it("Badge renders", () => {
    render(<Badge>Test</Badge>);
    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("Badge renders variants", () => {
    const { rerender } = render(<Badge variant="default">A</Badge>);
    expect(screen.getByText("A")).toBeInTheDocument();
    rerender(<Badge variant="secondary">B</Badge>);
    expect(screen.getByText("B")).toBeInTheDocument();
    rerender(<Badge variant="destructive">C</Badge>);
    expect(screen.getByText("C")).toBeInTheDocument();
    rerender(<Badge variant="outline">D</Badge>);
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("Input renders and accepts value", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("Label renders", () => {
    render(<Label htmlFor="test">My Label</Label>);
    expect(screen.getByText("My Label")).toBeInTheDocument();
  });

  it("Skeleton renders", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("Separator renders", () => {
    const { container } = render(<Separator />);
    expect(container.querySelector("[data-orientation]")).toBeInTheDocument();
  });

  it("Progress renders with value", () => {
    render(<Progress value={60} />);
    const el = document.querySelector("[role='progressbar']");
    expect(el).toBeInTheDocument();
  });

  it("Switch renders and is toggleable", () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("Checkbox renders", () => {
    render(<Checkbox aria-label="Check" />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("Slider renders", () => {
    render(<Slider defaultValue={[50]} max={100} step={1} aria-label="Volume" />);
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("Spinner renders", () => {
    const { container } = render(<Spinner />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("Textarea renders", () => {
    render(<Textarea placeholder="Write something" />);
    expect(screen.getByPlaceholderText("Write something")).toBeInTheDocument();
  });

  it("Avatar renders with fallback", () => {
    render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    );
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("Kbd renders", () => {
    render(<Kbd>⌘K</Kbd>);
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("KbdGroup renders", () => {
    render(
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    );
    expect(screen.getByText("⌘")).toBeInTheDocument();
    expect(screen.getByText("K")).toBeInTheDocument();
  });

  it("Card renders with all subcomponents", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("Alert renders with title and description", () => {
    render(
      <Alert>
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>Something happened</AlertDescription>
      </Alert>
    );
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Something happened")).toBeInTheDocument();
  });

  it("Tabs renders with content", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );
    expect(screen.getByText("Tab 1")).toBeInTheDocument();
    expect(screen.getByText("Content 1")).toBeInTheDocument();
  });

  it("Accordion renders", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(screen.getByText("Section 1")).toBeInTheDocument();
  });

  it("Tooltip renders trigger", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Tooltip text</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(screen.getByText("Hover me")).toBeInTheDocument();
  });

  it("Collapsible renders", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Hidden content</CollapsibleContent>
      </Collapsible>
    );
    expect(screen.getByText("Toggle")).toBeInTheDocument();
  });

  it("RadioGroup renders", () => {
    render(
      <RadioGroup defaultValue="a">
        <RadioGroupItem value="a" aria-label="Option A" />
        <RadioGroupItem value="b" aria-label="Option B" />
      </RadioGroup>
    );
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("ScrollArea renders", () => {
    const { container } = render(
      <ScrollArea className="h-40">
        <div style={{ height: 200 }}>Long content</div>
      </ScrollArea>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("AspectRatio renders", () => {
    const { container } = render(
      <AspectRatio ratio={16 / 9}>
        <div>Aspect content</div>
      </AspectRatio>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("Toggle renders", () => {
    render(<Toggle aria-label="Bold">B</Toggle>);
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
  });
});
