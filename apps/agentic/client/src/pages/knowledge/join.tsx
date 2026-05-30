/**
 * Knowledge Domains — Invite acceptance at /knowledge/join
 *
 * Stage-gated, conversational workspace where invited users interface with
 * the HKI Sentinel to verify credentials and bind access securely.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  Key,
  Loader2,
  Lock,
  Shield,
  UserCheck,
} from "lucide-react";
import { Button, useNotifications } from "@hki/ui";

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  KnowledgeSelfServiceShell,
  useKnowledgePageMeta,
} from "./components/SelfServiceChrome";
import { StageGator, GateStatus } from "./components/StageGator";
import { OnboardingSentinel } from "./components/OnboardingSentinel";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function KnowledgeJoin() {
  useKnowledgePageMeta("Join Domain — Hermetic");

  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { notify } = useNotifications();

  // State-gates tracing
  const [gateStates, setGateStates] = useState<Record<number, GateStatus>>({
    1: "locked",
    2: "locked",
    3: "locked",
    4: "locked",
  });
  const [digests, setDigests] = useState<Record<number, string>>({});

  const [inviteCodeError, setInviteCodeError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    role: string;
    valueStreamId?: string;
  } | null>(null);

  const handleGateChange = (
    gateId: number,
    status: GateStatus,
    digest?: string
  ) => {
    setGateStates(prev => ({ ...prev, [gateId]: status }));
    if (digest) {
      setDigests(prev => ({ ...prev, [gateId]: digest }));
    }
  };

  const acceptMut = trpc.admin.acceptInvite.useMutation({
    onSuccess: (data: any) => {
      setSuccessData({ role: data.role, valueStreamId: data.valueStreamId });
      setInviteCodeError(null);
      notify({
        title: "Domain access granted",
        severity: "success",
        group: "team",
      });
      // Trigger sentinel dialog success
      if (window.__sentinel_trigger_success) {
        window.__sentinel_trigger_success(data);
      }
    },
    onError: (error: any) => {
      const msg = error.message || "Invite failed";
      setInviteCodeError(msg);
      notify({
        title: "Invite failed",
        description: msg,
        severity: "error",
        group: "team",
      });
    },
  });

  const handleFinalSuccess = () => {
    if (successData) {
      setLocation(
        successData.valueStreamId
          ? `/knowledge?stream=${encodeURIComponent(successData.valueStreamId)}`
          : "/knowledge"
      );
    } else {
      setLocation("/knowledge");
    }
  };

  return (
    <KnowledgeSelfServiceShell
      back={{ href: "/welcome", label: "Knowledge Domains" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mx-auto grid w-full max-w-6xl flex-1 items-stretch gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
      >
        {/* Left Column: Visual Stage Gator & Telemetry */}
        <section className="kb-self-service-panel rounded-[28px] p-7 lg:p-9 flex flex-col justify-between h-full relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-primary/3 blur-2xl pointer-events-none" />

          <div>
            <div className="kb-self-service-chip">
              <Shield className="h-3.5 w-3.5" />
              Onboarding Checklist
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Cryptographic Gateways
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
              To guarantee fail-closed security, the HKI platform requires a
              strict sequence of trust handshakes. Connect your credentials and
              enter your invite code to begin.
            </p>
          </div>

          <div className="mt-8 flex-1">
            <StageGator gateStates={gateStates} digests={digests} />
          </div>

          <div className="mt-8 pt-6 border-t border-border/40 text-xs text-muted-foreground flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-primary" />
            <span>Encrypted using AES-256 GCM edge tunnels.</span>
          </div>
        </section>

        {/* Right Column: Conversational Sentinel Interface */}
        <section className="flex flex-col justify-center">
          <OnboardingSentinel
            onGateChange={handleGateChange}
            onSuccess={handleFinalSuccess}
            acceptInviteMut={acceptMut}
            inviteCodeError={inviteCodeError}
            setInviteCodeError={setInviteCodeError}
          />
        </section>
      </motion.div>
    </KnowledgeSelfServiceShell>
  );
}
