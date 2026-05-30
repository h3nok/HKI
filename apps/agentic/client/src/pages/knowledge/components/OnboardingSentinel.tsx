import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Bot,
  UserCheck,
  Send,
  Loader2,
  CheckCircle,
  HelpCircle,
  KeyRound,
} from "lucide-react";
import { Button, cn } from "@hki/ui";
import { useAuth } from "@/_core/hooks/useAuth";

interface Message {
  id: string;
  sender: "sentinel" | "user";
  text: string;
  timestamp: Date;
  component?: React.ReactNode;
}

interface OnboardingSentinelProps {
  onGateChange: (
    gateId: number,
    status: "locked" | "processing" | "sealed",
    digest?: string
  ) => void;
  onSuccess: (data: { role: string; valueStreamId?: string }) => void;
  acceptInviteMut: {
    mutate: (args: { inviteCode: string }) => void;
    isPending: boolean;
  };
  inviteCodeError: string | null;
  setInviteCodeError: (err: string | null) => void;
}

export function OnboardingSentinel({
  onGateChange,
  onSuccess,
  acceptInviteMut,
  inviteCodeError,
  setInviteCodeError,
}: OnboardingSentinelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Initial message: Principal Handshake
  useEffect(() => {
    setIsTyping(true);
    const timer = setTimeout(() => {
      setIsTyping(false);
      const userLabel = user?.email || user?.name || "Guest Principal";
      setMessages([
        {
          id: "welcome",
          sender: "sentinel",
          text: `Greeting authorized personnel. I am the HKI Security Sentinel. I will guide you through the cryptographic isolation boundaries required to connect your workspace.`,
          timestamp: new Date(),
        },
        {
          id: "handshake-init",
          sender: "sentinel",
          text: `Let's initialize Gate 1: Principal Handshake. Checking identity signatures...`,
          timestamp: new Date(),
        },
      ]);

      onGateChange(1, "processing");

      // Slide to step 1 verification
      setTimeout(() => {
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [
            ...prev,
            {
              id: "handshake-success",
              sender: "sentinel",
              text: `✓ Identity handshake successful. Principal verified: [${userLabel}]. Credentials sealed.`,
              timestamp: new Date(),
            },
          ]);
          onGateChange(
            1,
            "sealed",
            `SHA-256: ${hashString(userLabel || "session-signature")}`
          );

          // Move to Step 2
          setStep(2);
        }, 1500);
      }, 1000);
    }, 800);

    return () => clearTimeout(timer);
  }, [user]);

  // Trigger Step 2: Code Negotiation
  useEffect(() => {
    if (step === 2) {
      onGateChange(2, "processing");
      setIsTyping(true);
      const timer = setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [
          ...prev,
          {
            id: "code-prompt",
            sender: "sentinel",
            text: `Gate 2: Domain Negotiation active. Please enter your admin-issued 8-digit invite code to attach access to the correct isolation boundary.`,
            timestamp: new Date(),
          },
        ]);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [step]);

  function hashString(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash)
      .toString(16)
      .padEnd(8, "0")
      .toUpperCase()
      .slice(0, 12);
  }

  const handleSendCode = (code: string) => {
    if (!code.trim()) return;
    const sanitized = code.trim().toUpperCase();
    setMessages(prev => [
      ...prev,
      {
        id: `user-code-${Date.now()}`,
        sender: "user",
        text: sanitized,
        timestamp: new Date(),
      },
    ]);
    setInputValue("");
    setInviteCodeError(null);

    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: `sentinel-checking-${Date.now()}`,
          sender: "sentinel",
          text: `Negotiating domain parameters for token [${sanitized}] with the HKI Admin plane...`,
          timestamp: new Date(),
        },
      ]);

      // Call mutation
      acceptInviteMut.mutate({ inviteCode: sanitized });
    }, 800);
  };

  // Handle tRPC response integration
  const handleInviteValidationResult = (
    successData: any,
    errorMsg: string | null
  ) => {
    if (successData) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        onGateChange(
          2,
          "sealed",
          `TOKEN: ${successData.valueStreamId || "SHARED-DOMAIN"}`
        );
        setMessages(prev => [
          ...prev,
          {
            id: "code-success",
            sender: "sentinel",
            text: `✓ Domain negotiation validated! Assigned Domain: [${successData.valueStreamId || "Workspace Global"}]. Assigned Role: [${successData.role}].`,
            timestamp: new Date(),
          },
        ]);

        // Proceed to Step 3
        setStep(3);
      }, 1000);
    } else if (errorMsg) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [
          ...prev,
          {
            id: `code-error-${Date.now()}`,
            sender: "sentinel",
            text: `⚠ Domain Negotiation Failed: ${errorMsg}. Please re-verify the invite code and submit again.`,
            timestamp: new Date(),
          },
        ]);
      }, 1000);
    }
  };

  // Hook into the inviteCodeError from tRPC
  useEffect(() => {
    if (inviteCodeError) {
      handleInviteValidationResult(null, inviteCodeError);
    }
  }, [inviteCodeError]);

  // Listen to outer success triggers from the parent
  window.__sentinel_trigger_success = (data: any) => {
    handleInviteValidationResult(data, null);
  };

  // Step 3: Policy Pact Accord
  useEffect(() => {
    if (step === 3) {
      onGateChange(3, "processing");
      setIsTyping(true);
      const timer = setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [
          ...prev,
          {
            id: "pact-prompt",
            sender: "sentinel",
            text: `Gate 3: Policy Pact Accord. To guarantee fail-closed security, you must explicitly bind your account to our isolation standards.`,
            timestamp: new Date(),
          },
          {
            id: "pact-card",
            sender: "sentinel",
            text: "Please agree to the HKI Security covenants below.",
            timestamp: new Date(),
            component: (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-2.5 rounded-2xl bg-card border border-border/80 p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      HKI Security Isolation Covenant
                    </p>
                    <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground list-disc pl-4 leading-relaxed">
                      <li>Exact-match single domain visibility is enforced.</li>
                      <li>Global or wildcard fallbacks are strictly denied.</li>
                      <li>
                        Unauthorised body-scope override attempts will
                        fail-closed.
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    className="rounded-xl text-xs gap-1 font-semibold"
                    onClick={() => handleAcceptPact()}
                  >
                    I Agree & Bind Account
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </motion.div>
            ),
          },
        ]);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleAcceptPact = () => {
    setMessages(prev => [
      ...prev,
      {
        id: `user-pact-accept-${Date.now()}`,
        sender: "user",
        text: "I agree to and sign the HKI Security Isolation Covenant.",
        timestamp: new Date(),
      },
    ]);

    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      onGateChange(
        3,
        "sealed",
        `SIG-PACT: ${Date.now().toString(16).toUpperCase()}`
      );
      setMessages(prev => [
        ...prev,
        {
          id: "pact-accepted",
          sender: "sentinel",
          text: `✓ Covenant signature appended to principal credentials. Pact validated.`,
          timestamp: new Date(),
        },
      ]);

      // Go to Step 4
      setStep(4);
    }, 1000);
  };

  // Step 4: Envelope Seal & Mint
  useEffect(() => {
    if (step === 4) {
      onGateChange(4, "processing");
      setIsTyping(true);
      const timer = setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [
          ...prev,
          {
            id: "mint-intro",
            sender: "sentinel",
            text: `Gate 4: Envelope Seal & Mint. Sealing your session credentials inside a restricted cryptographic envelope...`,
            timestamp: new Date(),
          },
        ]);

        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          const sig = `SEAL: ${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
          onGateChange(4, "sealed", sig);
          setMessages(prev => [
            ...prev,
            {
              id: "mint-success",
              sender: "sentinel",
              text: `✓ HkiEnvelope minted and signed successfully. Your connection parameters are locked. Workspace access granted.`,
              timestamp: new Date(),
              component: (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-3 text-center"
                >
                  <Button
                    size="lg"
                    className="rounded-xl text-xs gap-2 font-semibold shadow-md px-6 bg-emerald-500 hover:bg-emerald-600 text-white"
                    onClick={() => {
                      // Trigger callback to finalize
                      onSuccess({
                        role: "Member", // Will be bound based on success response
                        valueStreamId: undefined, // Let the parent routing handle it
                      });
                    }}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Open Sequested Domain
                  </Button>
                </motion.div>
              ),
            },
          ]);
        }, 1800);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <div className="flex h-[480px] flex-col rounded-[24px] bg-card/40 border border-border/40 shadow-inner backdrop-blur overflow-hidden">
      {/* Sentinel Title Header */}
      <div className="flex items-center gap-3 border-b border-border/40 bg-card/60 px-5 py-3 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
          <Bot className="h-4.5 w-4.5 animate-pulse" />
        </div>
        <div>
          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
            HKI Sentinel
            <span
              className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              title="Online"
            />
          </p>
          <p className="text-[10px] text-muted-foreground font-mono">
            Secured Admin Interface
          </p>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "flex max-w-[85%] flex-col gap-1 rounded-2xl p-3 text-xs leading-relaxed",
                msg.sender === "sentinel"
                  ? "bg-card border border-border/50 text-foreground mr-auto rounded-tl-none shadow-sm"
                  : "bg-primary text-primary-foreground ml-auto rounded-tr-none shadow-md"
              )}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>
              {msg.component}
              <span className="text-[9px] text-muted-foreground/60 mt-1 block self-end font-mono">
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </motion.div>
          ))}

          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 bg-card/80 border border-border/30 rounded-2xl rounded-tl-none px-3.5 py-3 mr-auto text-muted-foreground max-w-[80px]"
            >
              <div className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-bounce" />
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input Tray */}
      <div className="border-t border-border/30 p-3 bg-card/45 shrink-0 flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => {
            if (
              e.key === "Enter" &&
              step === 2 &&
              inputValue.trim().length >= 4
            ) {
              handleSendCode(inputValue);
            }
          }}
          disabled={step !== 2 || acceptInviteMut.isPending}
          placeholder={
            step === 2
              ? "Enter 8-digit invite code..."
              : step === 1
                ? "Checking identity signatures..."
                : step === 3
                  ? "Agree to the Policy Pact above..."
                  : "Session is fully sealed"
          }
          maxLength={8}
          className="flex-1 rounded-xl bg-card border border-border/80 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 text-center font-mono uppercase tracking-[0.12em]"
        />
        <Button
          size="icon"
          onClick={() => handleSendCode(inputValue)}
          disabled={
            step !== 2 ||
            inputValue.trim().length < 4 ||
            acceptInviteMut.isPending
          }
          className="rounded-xl h-8 w-8 text-white bg-primary hover:bg-primary/95 shrink-0"
        >
          {acceptInviteMut.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

// Global declaration for cross-component triggers
declare global {
  interface Window {
    __sentinel_trigger_success?: (data: any) => void;
  }
}
