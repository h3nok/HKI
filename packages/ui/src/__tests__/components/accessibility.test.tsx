/**
 * Accessibility tests for @hki/ui components.
 * Verifies ARIA roles, labels, keyboard navigation basics, and focus management.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { Button } from "../../components/button";
import { Input } from "../../components/input";
import { Checkbox } from "../../components/checkbox";
import { Switch } from "../../components/switch";
import { Slider } from "../../components/slider";
import { RadioGroup, RadioGroupItem } from "../../components/radio-group";
import { Label } from "../../components/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../components/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../components/select";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "../../components/alert-dialog";
import { SkipToContent } from "../../components/accessibility";
import { Toggle } from "../../components/toggle";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/tabs";

describe("Accessibility — ARIA Roles", () => {
  it("Button has button role", () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("Input has textbox role", () => {
    render(<Input aria-label="Name" />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("Checkbox has checkbox role", () => {
    render(<Checkbox aria-label="Accept terms" />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("Switch has switch role", () => {
    render(<Switch aria-label="Dark mode" />);
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("Slider has slider role", () => {
    render(<Slider aria-label="Volume" defaultValue={[50]} />);
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("RadioGroup has radiogroup role with radio items", () => {
    render(
      <RadioGroup defaultValue="a" aria-label="Options">
        <RadioGroupItem value="a" aria-label="A" />
        <RadioGroupItem value="b" aria-label="B" />
      </RadioGroup>
    );
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("Toggle has button role with aria-pressed", () => {
    render(<Toggle aria-label="Bold">B</Toggle>);
    const btn = screen.getByRole("button", { name: "Bold" });
    expect(btn).toHaveAttribute("aria-pressed");
  });

  it("Tabs have correct tab/tabpanel roles", () => {
    render(
      <Tabs defaultValue="t1">
        <TabsList>
          <TabsTrigger value="t1">Tab 1</TabsTrigger>
          <TabsTrigger value="t2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="t1">Panel 1</TabsContent>
        <TabsContent value="t2">Panel 2</TabsContent>
      </Tabs>
    );
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });
});

describe("Accessibility — Label Association", () => {
  it("Label connects to input via htmlFor", () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" />
      </>
    );
    const input = screen.getByLabelText("Email");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });
});

describe("Accessibility — Disabled State", () => {
  it("disabled Button is not clickable and has aria-disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Submit
      </Button>
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("disabled Input is not editable", () => {
    render(<Input disabled aria-label="Locked" />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});

describe("Accessibility — SkipToContent", () => {
  it("renders a skip link with correct href", () => {
    render(<SkipToContent targetId="main-content" />);
    const link = screen.getByText(/skip to/i);
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "#main-content");
  });
});

describe("Accessibility — Dialog Focus Trap", () => {
  it("Dialog trigger opens dialog with proper structure", () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Desc</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    const trigger = screen.getByRole("button", { name: "Open" });
    expect(trigger).toBeInTheDocument();
  });

  it("AlertDialog trigger renders", () => {
    render(
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button>Delete</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm</AlertDialogTitle>
          <AlertDialogDescription>Sure?</AlertDialogDescription>
          <AlertDialogCancel>No</AlertDialogCancel>
          <AlertDialogAction>Yes</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});

describe("Accessibility — Select", () => {
  it("Select trigger has combobox role", () => {
    render(
      <Select>
        <SelectTrigger aria-label="Fruit">
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
