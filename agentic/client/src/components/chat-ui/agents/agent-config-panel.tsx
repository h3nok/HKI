/**
 * AgentConfigPanel - Agent Selection & Configuration UI
 *
 * Allows users to:
 * - Select different agents
 * - Configure agent parameters (temperature, max tokens, etc.)
 * - Enable/disable specific tools
 * - Set guardrail policies
 * - View agent capabilities
 *
 * Features:
 * - Real-time configuration preview
 * - Preset configurations
 * - Tool selection interface
 * - Advanced settings panel
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Brain,
  Activity,
  Wrench,
  MessageSquare,
  Search,
  Shield,
  Zap,
  Info,
  Check,
  ChevronDown,
  ChevronRight,
  Save,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@hki/ui";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@hki/ui";

// ============================================================================
// TYPES
// ============================================================================

export type AgentType =
  | "supervisor"
  | "router"
  | "tool-use"
  | "generation"
  | "retail"
  | "feedback";

export interface AgentConfig {
  type: AgentType;
  temperature: number; // 0-1
  maxTokens: number;
  topP: number; // 0-1
  enabledTools: string[];
  guardrails: {
    inputValidation: boolean;
    outputValidation: boolean;
    piiDetection: boolean;
    toxicityFilter: boolean;
  };
}

export interface AgentOption {
  type: AgentType;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  capabilities: string[];
  recommendedFor: string[];
}

export interface AgentConfigPanelProps {
  agents: AgentOption[];
  currentConfig: AgentConfig;
  availableTools: Array<{ id: string; name: string }>;
  onConfigChange: (config: AgentConfig) => void;
  onSave?: () => void;
}

// ============================================================================
// DESIGN CONFIG
// ============================================================================

const agentIcons = {
  supervisor: Brain,
  router: Activity,
  "tool-use": Wrench,
  generation: MessageSquare,
  retail: Search,
  feedback: Shield,
};

const agentColors = {
  supervisor: "var(--primary)",
  router: "#8b5cf6",
  "tool-use": "#16a34a",
  generation: "#d97706",
  retail: "var(--secondary)",
  feedback: "#ec4899",
};

const presets = {
  balanced: {
    name: "Balanced",
    description: "Good balance between creativity and accuracy",
    temperature: 0.7,
    topP: 0.9,
  },
  creative: {
    name: "Creative",
    description: "More creative and varied responses",
    temperature: 0.9,
    topP: 0.95,
  },
  precise: {
    name: "Precise",
    description: "Focused and deterministic responses",
    temperature: 0.3,
    topP: 0.8,
  },
};

// ============================================================================
// COMPONENTS
// ============================================================================

function AgentCard({
  agent,
  isSelected,
  onSelect,
}: {
  agent: AgentOption;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = agent.icon;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={cn(
        "relative w-full text-left p-4 rounded-xl border-2 transition-all",
        isSelected && "shadow-lg"
      )}
      style={{
        background: isSelected
          ? `color-mix(in srgb, ${agent.color} 8%, var(--card))`
          : "var(--card)",
        borderColor: isSelected ? agent.color : "var(--border)",
      }}
    >
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 p-1 rounded-full"
          style={{ background: agent.color }}
        >
          <Check className="h-3 w-3 text-white" />
        </motion.div>
      )}

      <div className="flex items-start gap-3">
        <div
          className="p-2 rounded-lg shrink-0"
          style={{
            background: `color-mix(in srgb, ${agent.color} 15%, transparent)`,
          }}
        >
          <Icon className="h-5 w-5" style={{ color: agent.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <h4
            className="font-semibold text-sm mb-1"
            style={{ color: "var(--foreground)" }}
          >
            {agent.name}
          </h4>
          <p
            className="text-xs mb-2"
            style={{ color: "var(--muted-foreground)" }}
          >
            {agent.description}
          </p>
          <div className="flex flex-wrap gap-1">
            {agent.capabilities.slice(0, 3).map(cap => (
              <Badge
                key={cap}
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                {cap}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function ConfigSection({
  title,
  icon: Icon,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <div
        className={cn(
          "flex items-center justify-between mb-3",
          collapsible && "cursor-pointer"
        )}
        onClick={() => collapsible && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <h4
            className="text-sm font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {title}
          </h4>
        </div>
        {collapsible &&
          (isOpen ? (
            <ChevronDown
              className="h-4 w-4"
              style={{ color: "var(--muted-foreground)" }}
            />
          ) : (
            <ChevronRight
              className="h-4 w-4"
              style={{ color: "var(--muted-foreground)" }}
            />
          ))}
      </div>

      <AnimatePresence>
        {(!collapsible || isOpen) && (
          <motion.div
            initial={collapsible ? { height: 0, opacity: 0 } : {}}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AgentConfigPanel({
  agents,
  currentConfig,
  availableTools,
  onConfigChange,
  onSave,
}: AgentConfigPanelProps) {
  const [hasChanges, setHasChanges] = useState(false);

  const selectedAgent = agents.find(a => a.type === currentConfig.type);

  const handleConfigUpdate = (updates: Partial<AgentConfig>) => {
    onConfigChange({ ...currentConfig, ...updates });
    setHasChanges(true);
  };

  const handlePresetSelect = (presetKey: keyof typeof presets) => {
    const preset = presets[presetKey];
    handleConfigUpdate({
      temperature: preset.temperature,
      topP: preset.topP,
    });
  };

  const handleSave = () => {
    onSave?.();
    setHasChanges(false);
  };

  const handleReset = () => {
    // Reset to default config
    const defaultConfig: AgentConfig = {
      type: currentConfig.type,
      temperature: 0.7,
      maxTokens: 2000,
      topP: 0.9,
      enabledTools: availableTools.map(t => t.id),
      guardrails: {
        inputValidation: true,
        outputValidation: true,
        piiDetection: true,
        toxicityFilter: true,
      },
    };
    onConfigChange(defaultConfig);
    setHasChanges(false);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded-lg"
            style={{
              background: "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            <Settings className="h-4 w-4" style={{ color: "var(--primary)" }} />
          </div>
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Agent Configuration
          </h3>
        </div>
        {hasChanges && (
          <Badge variant="secondary">
            <Zap className="h-3 w-3 mr-1" />
            Unsaved Changes
          </Badge>
        )}
      </div>

      {/* Agent Selection */}
      <ConfigSection title="Select Agent" icon={Brain}>
        <div className="grid grid-cols-1 gap-2">
          {agents.map(agent => (
            <AgentCard
              key={agent.type}
              agent={agent}
              isSelected={currentConfig.type === agent.type}
              onSelect={() => handleConfigUpdate({ type: agent.type })}
            />
          ))}
        </div>
      </ConfigSection>

      <Separator />

      {/* Model Parameters */}
      <ConfigSection
        title="Model Parameters"
        icon={Zap}
        collapsible
        defaultOpen
      >
        <div className="space-y-4">
          {/* Preset Selector */}
          <div>
            <Label className="text-xs mb-2 block">Quick Presets</Label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(presets).map(([key, preset]) => (
                <TooltipProvider key={key}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          handlePresetSelect(key as keyof typeof presets)
                        }
                      >
                        {preset.name}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{preset.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Temperature</Label>
              <span
                className="text-xs font-mono"
                style={{ color: "var(--muted-foreground)" }}
              >
                {currentConfig.temperature.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[currentConfig.temperature]}
              onValueChange={([v]) => handleConfigUpdate({ temperature: v })}
              min={0}
              max={1}
              step={0.1}
            />
            <p
              className="text-xs mt-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              Higher = more creative, Lower = more focused
            </p>
          </div>

          {/* Max Tokens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Max Tokens</Label>
              <span
                className="text-xs font-mono"
                style={{ color: "var(--muted-foreground)" }}
              >
                {currentConfig.maxTokens}
              </span>
            </div>
            <Slider
              value={[currentConfig.maxTokens]}
              onValueChange={([v]) => handleConfigUpdate({ maxTokens: v })}
              min={100}
              max={4000}
              step={100}
            />
          </div>

          {/* Top P */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Top P</Label>
              <span
                className="text-xs font-mono"
                style={{ color: "var(--muted-foreground)" }}
              >
                {currentConfig.topP.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[currentConfig.topP]}
              onValueChange={([v]) => handleConfigUpdate({ topP: v })}
              min={0}
              max={1}
              step={0.05}
            />
            <p
              className="text-xs mt-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              Nucleus sampling threshold
            </p>
          </div>
        </div>
      </ConfigSection>

      <Separator />

      {/* Guardrails */}
      <ConfigSection
        title="Safety & Guardrails"
        icon={Shield}
        collapsible
        defaultOpen
      >
        <div className="space-y-3">
          {Object.entries(currentConfig.guardrails).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="text-xs capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </Label>
              <Switch
                checked={value}
                onCheckedChange={checked =>
                  handleConfigUpdate({
                    guardrails: { ...currentConfig.guardrails, [key]: checked },
                  })
                }
              />
            </div>
          ))}
        </div>
      </ConfigSection>

      <Separator />

      {/* Tools */}
      <ConfigSection
        title="Enabled Tools"
        icon={Wrench}
        collapsible
        defaultOpen={false}
      >
        <div className="space-y-2">
          {availableTools.map(tool => (
            <div key={tool.id} className="flex items-center justify-between">
              <Label className="text-xs">{tool.name}</Label>
              <Switch
                checked={currentConfig.enabledTools.includes(tool.id)}
                onCheckedChange={checked => {
                  const newTools = checked
                    ? [...currentConfig.enabledTools, tool.id]
                    : currentConfig.enabledTools.filter(t => t !== tool.id);
                  handleConfigUpdate({ enabledTools: newTools });
                }}
              />
            </div>
          ))}
        </div>
      </ConfigSection>

      {/* Actions */}
      <div
        className="flex items-center gap-2 pt-4 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <Button
          variant="default"
          size="sm"
          className="flex-1"
          onClick={handleSave}
          disabled={!hasChanges}
        >
          <Save className="h-3.5 w-3.5 mr-2" />
          Save Changes
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={!hasChanges}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-2" />
          Reset
        </Button>
      </div>
    </div>
  );
}
