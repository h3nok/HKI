// Section Header (Atelier)
export { SectionHeader } from "./section-header";
export type { SectionHeaderProps } from "./section-header";

// Atelier Icon wrapper — HKI custom registry + lazy Lucide
export { Icon as AtelierIcon, HKI_ICON_REGISTRY } from "./icon";
export type {
  IconProps as AtelierIconProps,
  IconSize,
  IconTone,
  HkiIconName,
} from "./icon";

// Core UI Components
export { Button, buttonVariants } from "./button";
export type { ButtonProps } from "./button";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./card";

export { Input } from "./input";
export type { InputProps } from "./input";

export { Label } from "./label";

export { Badge, badgeVariants } from "./badge";
export type { BadgeProps } from "./badge";

export { Skeleton } from "./skeleton";

export { Separator } from "./separator";

// Motion System
export {
  FadeIn,
  StaggerList,
  StaggerItem,
  SpringScale,
  AnimateHeight,
  FadeInScale,
} from "./motion";
export type {
  FadeInProps,
  StaggerListProps,
  StaggerItemProps,
  SpringScaleProps,
  AnimateHeightProps,
  FadeInScaleProps,
} from "./motion";

// Dialog
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog";

// Select
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./select";

// Tooltip
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./tooltip";

// Icon Action
export { IconAction } from "./icon-action";
export type { IconActionProps } from "./icon-action";

// Textarea
export { Textarea } from "./textarea";
export type { TextareaProps } from "./textarea";

// Dropdown Menu
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./dropdown-menu";

// Progress
export { Progress } from "./progress";

// Switch
export { Switch } from "./switch";

// Tabs
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

// Sheet
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./sheet";

// Avatar
export { Avatar, AvatarImage, AvatarFallback } from "./avatar";

// Breadcrumb
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "./breadcrumb";

// Sidebar (Full-featured with mobile support)
export {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarTrigger,
  SidebarRail,
  SidebarInput,
  SidebarInset,
  SidebarSeparator,
  useSidebar,
} from "./sidebar-full";

// DataTable
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  DataTable,
  DataTablePagination,
  DataTableColumnHeader,
} from "./data-table";
export type { ColumnDef } from "./data-table";

// StatsCard
export {
  StatsCard,
  StatsCardGrid,
  MiniStatsCard,
  Trend,
  statsCardVariants,
  iconContainerVariants,
} from "./stats-card";

// Topbar
export { Topbar, TopbarSearch, TopbarAction, topbarVariants } from "./topbar";
export type { TopbarProps } from "./topbar";

// Context Panel
export {
  ContextPanelProvider,
  ContextPanel,
  ContextPanelHeader,
  ContextPanelContent,
  ContextPanelFooter,
  ContextPanelSection,
  ContextPanelTrigger,
  useContextPanel,
  contextPanelVariants,
} from "./context-panel";

// App Layout
export {
  AppLayoutProvider,
  AppLayoutShell,
  AppLayoutSidebar,
  AppLayoutMain,
  ContentContainer,
  Grid,
  GridItem,
  PageHeader,
  Section,
  useAppLayout,
  LAYOUT_CONSTANTS,
} from "./app-layout";

// Scroll Area
export { ScrollArea, ScrollBar } from "./scroll-area";

// Popover
export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from "./popover";

// Command
export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "./command";

// Checkbox
export { Checkbox } from "./checkbox";
export type { CheckboxProps } from "./checkbox";

// Radio Group
export { RadioGroup, RadioGroupItem } from "./radio-group";

// Alert
export { Alert, AlertTitle, AlertDescription, alertVariants } from "./alert";

// Notifications — "The Stream"
export {
  NotificationProvider,
  useNotifications,
  NotificationCenter,
  NotificationStream,
  SEVERITY_DURATION,
} from "./notifications";
export type {
  Notification,
  NotificationSeverity,
  NotificationAction,
  NotifyOptions,
  NotificationState,
  NotificationContextValue,
  NotificationProviderProps,
  NotificationCenterProps,
  NotificationStreamProps,
} from "./notifications";

// Sonner (Toast)
export { Toaster } from "./sonner";

// Spinner
export { Spinner } from "./spinner";
export type { SpinnerProps } from "./spinner";

// Form
export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
} from "./form";

// Collapsible
export {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./collapsible";

// ═══════════════════════════════════════════════════════════════════════════════
// INNOVATION PLATFORM PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

// Stage Badge
export {
  StageBadge,
  stageBadgeVariants,
  STAGE_LABELS,
  STAGE_ICONS,
} from "./stage-badge";
export type { StageBadgeProps } from "./stage-badge";

// Priority Badge
export {
  PriorityBadge,
  priorityBadgeVariants,
  PRIORITY_LABELS,
  PRIORITY_DOT_COLORS,
} from "./priority-badge";
export type { PriorityBadgeProps } from "./priority-badge";

// KPI Card
export { KPICard, KPICardGrid } from "./kpi-card";
export type { KPICardProps } from "./kpi-card";

// Innovation Funnel
export { InnovationFunnel, DEFAULT_FUNNEL_STAGES } from "./innovation-funnel";
export type { InnovationFunnelProps, FunnelStage } from "./innovation-funnel";

// Empty State
export { EmptyState } from "./empty-state";
export type { EmptyStateProps, EmptyStateVariant } from "./empty-state";

// Initiative Card
export { InitiativeCard, InitiativeCardGrid } from "./initiative-card";
export type { InitiativeCardProps } from "./initiative-card";

// ═══════════════════════════════════════════════════════════════════════════════
// HERMETIC PRIMITIVES (Card, Badge, Stat, EmptyState)
// ═══════════════════════════════════════════════════════════════════════════════

export {
  HermeticCard,
  HermeticBadge,
  HermeticStat,
  HermeticEmptyState,
  // Legacy aliases — deprecated, kept for in-flight migrations
  HkiCard,
  HkiBadge,
  HkiStat,
  HkiEmptyState,
} from "./glass";
export type {
  HermeticCardProps,
  HermeticBadgeProps,
  HermeticBadgeTone,
  HermeticStatProps,
  HermeticEmptyStateProps,
  HkiCardProps,
  HkiBadgeProps,
  HkiBadgeTone,
  HkiStatProps,
  HkiEmptyStateProps,
} from "./glass";

// ═══════════════════════════════════════════════════════════════════════════════
// HKI BRAND SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export {
  HkiMark,
  HkiWordmark,
  HkiLogo,
  // backward-compat aliases
  HkiIcon,
  HkiInnovationLogo,
  HkiInnovationIcon,
  Logo,
  Icon,
  Branding,
} from "./branding";
export type {
  HkiMarkProps,
  HkiWordmarkProps,
  HkiLogoProps,
  HkiIconProps,
  BrandVariant,
  MarkSize,
  LogoLayout,
} from "./branding";

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════════

export {
  LoginPage,
  PLATFORM_PRESETS,
  AUTH_PROVIDER_PRESETS,
} from "./login-page";
export type {
  LoginPageProps,
  AuthProvider,
  AuthProviderType,
  PlatformBranding,
} from "./login-page";

// ═══════════════════════════════════════════════════════════════════════════════
// AGENTIC UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Guardrails
export {
  GuardrailAlert,
  type GuardrailAlertProps,
  type GuardrailCheckStatus,
  GuardrailsIndicator,
  type GuardrailsIndicatorProps,
  type GuardrailCheck,
  type GuardrailOverallStatus,
} from "./agentic/guardrails";

// Tool Use
export {
  ToolExecutionCard,
  type ToolExecutionCardProps,
} from "./agentic/tool-use";

// Thought Trace
export {
  ThoughtTraceTimeline,
  ThoughtTraceStream,
  type ThoughtTraceTimelineProps,
  type ThoughtTraceStep,
  type ThoughtTraceStepType,
  type ThoughtTraceStepStatus,
  type ThoughtTraceStreamProps,
  type ThoughtChunk,
  type StreamStatus,
  ThoughtTraceStepCard,
  type ThoughtTraceStepCardProps,
  StreamingIndicator,
  StreamingIndicatorCompact,
  type StreamingIndicatorProps,
  type StreamingStatus,
  ReasoningCard,
  InlineReasoning,
  type ReasoningCardProps,
  type ReasoningStep,
  ThinkingAnimation,
  ThinkingInline,
  ThinkingCard,
  type ThinkingAnimationProps,
  type ThinkingVariant,
} from "./agentic/thought-trace";

// Core Agentic
export {
  ConfidenceIndicator,
  ConfidenceBar,
  type ConfidenceIndicatorProps,
  type ConfidenceBarProps,
} from "./agentic/core";

// HITL (Human-in-the-Loop)
export {
  ApprovalQueue,
  type ApprovalQueueProps,
  type ApprovalItem,
  type ApprovalStatus,
  type ApprovalPriority,
  type ApprovalType,
} from "./agentic/hitl";

// Execution Engine
export {
  ExecutionPlanCard,
  type ExecutionPlanData,
  type PlanStatus,
  ExecutionStepRow,
  type ExecutionStepData,
  type StepStatus,
  InterventionCard,
  type InterventionData,
  type InterventionAction,
} from "./agentic/execution";

// Alert Dialog
export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./alert-dialog";

// Accordion
export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./accordion";

// Aspect Ratio
export { AspectRatio } from "./aspect-ratio";

// Calendar
export { Calendar, CalendarDayButton } from "./calendar";

// Carousel
export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "./carousel";

// Context Menu
export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
} from "./context-menu";

// Drawer
export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from "./drawer";

// Hover Card
export { HoverCard, HoverCardTrigger, HoverCardContent } from "./hover-card";

// Input OTP
export {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "./input-otp";

// Menubar
export {
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from "./menubar";

// Pagination
export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "./pagination";

// Resizable
export {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./resizable";

// Kbd
export { Kbd, KbdGroup } from "./kbd";

// Navigation Menu
export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
} from "./navigation-menu";

// Chart
export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  useChart,
} from "./chart";
export type { ChartConfig } from "./chart";

// Slider
export { Slider } from "./slider";

// Toggle
export { Toggle, toggleVariants } from "./toggle";

// Toggle Group
export { ToggleGroup, ToggleGroupItem } from "./toggle-group";

// Dashboard primitives
export {
  GridBackground,
  type GridBackgroundProps,
  StatPill,
  type StatPillProps,
  type StatPillColor,
  DashboardCard,
  type DashboardCardProps,
  InteractiveBentoGrid,
  type InteractiveBentoGridProps,
  BentoCard,
  type BentoCardProps,
  DashboardBanner,
  type DashboardBannerProps,
  type Stat as DashboardStat,
  type GamificationBadge as DashboardGamificationBadge,
  PageShell,
  type PageShellProps,
  type BreadcrumbItem as DashboardBreadcrumbItem,
  ThemeToggle as DashboardThemeToggle,
  type ThemeToggleProps as DashboardThemeToggleProps,
  StatusBadge as DashboardStatusBadge,
  type StatusBadgeProps as DashboardStatusBadgeProps,
  type StatusBadgeVariant,
  FilterBar,
  type FilterBarProps,
  type FilterOption,
  DUOTONE,
  EASE,
  fadeUp,
  stagger,
  cardPop,
  PRIORITY_STYLES,
  STAGE_COLORS,
  formatCurrency,
} from "./dashboard";

// Dashboard
export * from "./dashboard/stat-pill";
export * from "./dashboard/dashboard-card";
export * from "./dashboard/dashboard-banner";
export * from "./dashboard/page-shell";
export * from "./dashboard/page-header";

// Wizard
export { Wizard, useWizard } from "./wizard";
export type { WizardProps, WizardStep } from "./wizard";

// ComboboxPicker
export { ComboboxPicker } from "./combobox-picker";
export type {
  ComboboxPickerProps,
  ComboboxPickerOption,
} from "./combobox-picker";

// ═══════════════════════════════════════════════════════════════════════════════
// GAMIFICATION PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Achievement Badge
  AchievementBadge,
  achievementBadgeVariants,
  TIER_STYLES,
  TIER_LABEL,
  // Badge Grid
  BadgeGrid,
  // Streak Indicator
  StreakIndicator,
  // Score Ring
  ScoreRing,
  // Leaderboard
  Leaderboard,
  // Impact Stat
  ImpactStat,
  // Celebration
  fireConfetti,
  fireMilestone,
  AchievementToast,
  // Contribution Heatmap
  ContributionHeatmap,
} from "./gamification";

// Product Switcher — Cross-product navigation
export { ProductSwitcher, PLATFORM_PRODUCTS } from "./product-switcher";
export type { ProductSwitcherProps, Product } from "./product-switcher";

// Not Found Page
export { NotFoundPage } from "./not-found-page";
export type { NotFoundPageProps } from "./not-found-page";

// Accessibility
export { SkipToContent, RouteAnnouncer } from "./accessibility";
export type { SkipToContentProps, RouteAnnouncerProps } from "./accessibility";

export type {
  // Types
  BadgeTier,
  AchievementBadgeData,
  StreakData,
  LeaderboardEntry,
  ImpactData,
  ContributionEvent,
  StreamScore,
  // Props
  AchievementBadgeProps,
  BadgeGridProps,
  StreakIndicatorProps,
  ScoreRingProps,
  ScoreRingThresholds,
  LeaderboardProps,
  ImpactStatProps,
  ConfettiOptions,
  AchievementToastProps,
  ContributionHeatmapProps,
} from "./gamification";

// Value Stream Icons
export {
  StreamIcon,
  STREAM_ICON_OPTIONS,
  GlobalIcon,
  PharmaIcon,
  FreshIcon,
  OpticalIcon,
  EcomIcon,
  WarehouseIcon,
  PackageIcon,
  ToolsIcon,
  FinanceIcon,
  StoreIcon,
  TruckIcon,
  ChartIcon,
  BuildingIcon,
} from "./icons/value-stream-icons";
export type {
  ValueStreamIconId,
  StreamIconOption,
} from "./icons/value-stream-icons";
