import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Settings,
  User,
  Monitor,
  Cpu,
  Shield,
  Key,
  Wrench,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
// import { Button } from '@/components/ui/button';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/contexts/ThemeContext";
import { tokens } from "@/design-system/tokens";
import { ui } from "@hki/ui";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useLocalStorageState } from "../hooks/use-local-storage-state";
import {
  AgentConfigPanel,
  type AgentConfig,
  type AgentOption,
} from "../agents/agent-config-panel";
import { ToolRegistryBrowser, type Tool } from "../tools/tool-registry-browser";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { useScope } from "@/_core/hooks/useScope";

type SettingsTab = "general" | "appearance" | "agent" | "tools" | "security";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ALL_TABS: {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "appearance", label: "Appearance", icon: Monitor },
  { id: "agent", label: "Agent & AI", icon: Cpu, adminOnly: true },
  { id: "tools", label: "Tools", icon: Wrench, adminOnly: true },
  { id: "security", label: "Security", icon: Shield },
];

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { role } = usePermissions();
  const { activeScopeDef, availableScopes } = useScope();
  const isAdmin = role === "admin";
  const visibleTabs = ALL_TABS.filter(t => !t.adminOnly || isAdmin);

  // Persisted preference toggles
  const [notifications, setNotifications] = useLocalStorageState(
    "agentic:notifications",
    true
  );
  const [soundEffects, setSoundEffects] = useLocalStorageState(
    "agentic:sound-effects",
    true
  );

  // P02: Agent configuration state — persisted to localStorage
  const [agentConfig, setAgentConfig] = useLocalStorage<AgentConfig>(
    "agentic:agent-config",
    {
      type: "supervisor",
      temperature: 0.7,
      maxTokens: 4096,
      topP: 0.9,
      enabledTools: ["check_inventory", "search_products", "get_member_info"],
      guardrails: {
        inputValidation: true,
        outputValidation: true,
        piiDetection: true,
        toxicityFilter: true,
      },
    }
  );

  // P02: Available agents
  const agentOptions: AgentOption[] = [
    {
      type: "supervisor",
      name: "Supervisor",
      description: "Orchestrates the full agent workflow",
      icon: Cpu,
      color: "var(--primary)",
      capabilities: ["routing", "planning", "monitoring"],
      recommendedFor: ["General queries"],
    },
    {
      type: "retail",
      name: "Retail Specialist",
      description: "Product, inventory, and pricing",
      icon: Cpu,
      color: "var(--secondary)",
      capabilities: ["inventory", "pricing", "products"],
      recommendedFor: ["Product queries"],
    },
    {
      type: "tool-use",
      name: "Tool Executor",
      description: "Executes external tools and APIs",
      icon: Wrench,
      color: "#16a34a",
      capabilities: ["tool-calling", "data-fetch"],
      recommendedFor: ["Data retrieval"],
    },
  ];

  // P02: Available tools for bounding
  const availableTools = [
    { id: "check_inventory", name: "Check Inventory" },
    { id: "search_products", name: "Search Products" },
    { id: "get_member_info", name: "Get Member Info" },
    { id: "lookup_pricing", name: "Lookup Pricing" },
    { id: "check_order_status", name: "Check Order Status" },
  ];

  // P02: Tool registry for browsing
  const registryTools: Tool[] = [
    {
      id: "check_inventory",
      name: "check_inventory",
      description: "Check real-time stock levels at warehouses",
      category: "data",
      status: "available",
      parameters: [
        {
          name: "sku",
          type: "string",
          description: "Product SKU",
          required: true,
        },
        {
          name: "warehouse_id",
          type: "string",
          description: "Warehouse ID",
          required: false,
        },
      ],
      returns: "Inventory count and location data",
      stats: { totalCalls: 1240, successRate: 0.98, avgDuration: 320 },
    },
    {
      id: "search_products",
      name: "search_products",
      description: "Search the retail catalog by name, category, or SKU",
      category: "search",
      status: "available",
      parameters: [
        {
          name: "query",
          type: "string",
          description: "Search query",
          required: true,
        },
      ],
      returns: "Array of matching products",
      stats: { totalCalls: 3450, successRate: 0.99, avgDuration: 180 },
    },
    {
      id: "get_member_info",
      name: "get_member_info",
      description: "Retrieve member profile and purchase history",
      category: "data",
      status: "available",
      parameters: [
        {
          name: "member_id",
          type: "string",
          description: "Member ID",
          required: true,
        },
      ],
      returns: "Member profile with tier and history",
      stats: { totalCalls: 890, successRate: 0.96, avgDuration: 250 },
    },
    {
      id: "lookup_pricing",
      name: "lookup_pricing",
      description: "Get current pricing and markdown status",
      category: "data",
      status: "available",
      parameters: [
        {
          name: "sku",
          type: "string",
          description: "Product SKU",
          required: true,
        },
      ],
      returns: "Pricing with margin data",
      stats: { totalCalls: 670, successRate: 0.97, avgDuration: 150 },
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your workspace preferences
          </DialogDescription>
        </DialogHeader>
        <div className="flex h-[80vh] min-h-125 max-h-175">
          {/* Sidebar */}
          <div className="w-48 bg-muted/30 border-r border-border p-3 flex flex-col gap-1">
            <div className="px-3 py-4 mb-2">
              <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
            </div>

            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                                    ${ui.navItem}
                                    ${activeTab === tab.id ? ui.navItemActive : ui.navItemInactive}
                                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col min-w-0 bg-background">
            {/* Header */}
            <div className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-semibold text-lg">
                  {ALL_TABS.find(t => t.id === activeTab)?.label}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Manage your workspace preferences
                </p>
              </div>
              <DialogClose asChild>
                <button className="h-8 w-8 rounded-full text-muted-foreground hover:bg-primary/8 hover:text-primary flex items-center justify-center transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </DialogClose>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {activeTab === "general" && (
                    <div className="space-y-6">
                      {/* Account & Org Context */}
                      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <User className="w-4 h-4 text-primary" />
                          Account & Organization
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">Name</span>
                            <p className="font-medium text-foreground mt-0.5 truncate">
                              {user?.name || "—"}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Email</span>
                            <p className="font-medium text-foreground mt-0.5 truncate">
                              {user?.email || "—"}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Role</span>
                            <p className="font-medium text-foreground mt-0.5 capitalize">
                              {role}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Active Workspace
                            </span>
                            <p className="font-medium text-foreground mt-0.5 truncate">
                              {activeScopeDef?.icon && (
                                <span className="mr-1">
                                  {activeScopeDef.icon}
                                </span>
                              )}
                              {activeScopeDef?.name || "Global"}
                            </p>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground">
                            <Layers className="w-3 h-3 inline-block mr-1 -mt-px" />
                            {availableScopes.length} workspace
                            {availableScopes.length !== 1 ? "s" : ""} available
                          </span>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Notifications</Label>
                            <p className="text-sm text-muted-foreground">
                              Receive desktop alerts for completed tasks
                            </p>
                          </div>
                          <Switch
                            checked={notifications}
                            onCheckedChange={setNotifications}
                          />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Sound Effects</Label>
                            <p className="text-sm text-muted-foreground">
                              Play subtle sounds for actions
                            </p>
                          </div>
                          <Switch
                            checked={soundEffects}
                            onCheckedChange={setSoundEffects}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "appearance" && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Dark Mode</Label>
                            <p className="text-sm text-muted-foreground">
                              Switch between light and dark themes
                            </p>
                          </div>
                          <Switch
                            checked={theme === "dark"}
                            onCheckedChange={toggleTheme}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "agent" && (
                    <div className="space-y-4">
                      <AgentConfigPanel
                        agents={agentOptions}
                        currentConfig={agentConfig}
                        availableTools={availableTools}
                        onConfigChange={setAgentConfig}
                      />
                    </div>
                  )}

                  {activeTab === "tools" && (
                    <div className="space-y-4">
                      <ToolRegistryBrowser tools={registryTools} />
                    </div>
                  )}

                  {activeTab === "security" && (
                    <div className="space-y-6">
                      <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
                        <div className="flex items-start gap-3">
                          <Key className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5" />
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium text-amber-900 dark:text-amber-400">
                              API Keys
                            </h4>
                            <p className="text-sm text-amber-800/80 dark:text-amber-500/80">
                              API keys are managed centrally in the backend
                              configuration. Contact your admin for access.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
