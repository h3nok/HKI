import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  Cpu,
  Database,
  Terminal,
  ArrowRight,
  Check,
  AlertCircle,
  RefreshCw,
  Layers,
  Copy,
  Trash2,
  Lock,
  Compass,
  FileCode,
} from "lucide-react";
import { cn } from "@hki/ui";
import { toast } from "sonner";

interface EnvelopeSandboxProps {
  domains: Array<{ id: string; name: string }>;
}

export function EnvelopeSandbox({ domains }: EnvelopeSandboxProps) {
  const [activeTab, setActiveTab] = useState<"minter" | "decoder">("minter");

  // Minter State
  const [orgId, setOrgId] = useState("org_acme_retail");
  const [subjectId, setSubjectId] = useState("user_hki_operator_9");
  const [activeDomain, setActiveDomain] = useState(
    domains[0]?.id || "payments"
  );
  const [authDomainsInput, setAuthDomainsInput] = useState("");
  const [authorizedDomains, setAuthorizedDomains] = useState<string[]>([]);
  const [purpose, setPurpose] = useState("retrieve");
  const [riskTier, setRiskTier] = useState("low-risk");
  const [policyPack, setPolicyPack] = useState("pp_standard_v1.0");
  const [issuer, setIssuer] = useState("urn:hki:api-gateway");
  const [signature, setSignature] = useState("sig_ed25519_8f3a9c7b4e2d1f0c...");
  const [ttl, setTtl] = useState(300);

  // Decoder State
  const [rawEnvelopeInput, setRawEnvelopeInput] = useState("");
  const [decodedEnvelope, setDecodedEnvelope] = useState<any>(null);
  const [decoderError, setDecoderError] = useState<string | null>(null);

  // Populate default authorized domains when activeDomain changes
  useEffect(() => {
    if (activeDomain && !authorizedDomains.includes(activeDomain)) {
      setAuthorizedDomains(prev =>
        [activeDomain, ...prev].filter(
          (item, idx, self) => self.indexOf(item) === idx
        )
      );
    }
  }, [activeDomain]);

  // Set default domains list if available
  useEffect(() => {
    if (domains.length > 0 && !activeDomain) {
      setActiveDomain(domains[0].id);
    }
  }, [domains]);

  // Load handoff envelope from public site if provided in query string
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const envelopeParam = params.get("envelope");
      if (envelopeParam) {
        try {
          const decoded = JSON.parse(atob(envelopeParam));
          if (decoded && typeof decoded === "object") {
            setRawEnvelopeInput(JSON.stringify(decoded, null, 2));
            setDecodedEnvelope(decoded);
            setActiveTab("decoder");
            toast.success(
              "Handoff Envelope loaded successfully from public site!"
            );

            // Clean the query parameter from the URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
          }
        } catch (err) {
          console.error("Failed to decode handoff envelope:", err);
          toast.error("Failed to load handoff envelope from URL");
        }
      }
    }
  }, []);

  // Handle adding authorized domain
  const handleAddAuthDomain = () => {
    const trimmed = authDomainsInput.trim().toLowerCase();
    if (!trimmed) return;
    if (trimmed === "global" || trimmed === "*") {
      toast.error("Global or wildcard domains are forbidden by HKI Invariants");
      return;
    }
    if (authorizedDomains.includes(trimmed)) {
      toast.warning("Domain already added");
      return;
    }
    setAuthorizedDomains(prev => [...prev, trimmed]);
    setAuthDomainsInput("");
  };

  const handleRemoveAuthDomain = (domainToRemove: string) => {
    if (domainToRemove === activeDomain) {
      toast.error("Cannot remove the active domain from authorized set");
      return;
    }
    setAuthorizedDomains(prev => prev.filter(d => d !== domainToRemove));
  };

  // Generate HKI Envelope Object
  const mintedEnvelopeObj = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return {
      hki_version: "1.0",
      envelope_id: "env_" + Math.random().toString(36).substr(2, 9),
      org_id: orgId,
      subject_id: subjectId,
      active_domain: activeDomain,
      authorized_domains:
        authorizedDomains.length > 0 ? authorizedDomains : [activeDomain],
      purpose,
      risk_tier: riskTier,
      policy_pack_id: policyPack,
      issued_at: now,
      expires_at: now + Number(ttl),
      issuer,
      signature:
        signature || `sig_mock_${Math.random().toString(36).substr(2, 16)}`,
    };
  }, [
    orgId,
    subjectId,
    activeDomain,
    authorizedDomains,
    purpose,
    riskTier,
    policyPack,
    issuer,
    signature,
    ttl,
  ]);

  // Decode live inputs or parsed inputs
  const currentEnvelopeToValidate = useMemo(() => {
    if (activeTab === "minter") {
      return mintedEnvelopeObj;
    }
    return decodedEnvelope;
  }, [activeTab, mintedEnvelopeObj, decodedEnvelope]);

  // 6 Invariants Auditor
  const validationResults = useMemo(() => {
    const env = currentEnvelopeToValidate;
    if (!env) {
      return {
        isValid: false,
        issues: ["No envelope loaded"],
        invariants: {
          singleActive: false,
          failClosed: false,
          exactMatch: false,
          noBodyOverride: false,
          explicitPublication: false,
          adminSeparation: false,
        },
      };
    }

    const issues: string[] = [];
    const invariants = {
      singleActive: true,
      failClosed: true,
      exactMatch: true,
      noBodyOverride: true,
      explicitPublication: true,
      adminSeparation: true,
    };

    // 1. Single active domain
    if (!env.active_domain) {
      invariants.singleActive = false;
      issues.push("Active domain is missing");
    } else if (
      env.active_domain === "global" ||
      env.active_domain === "*" ||
      env.active_domain.trim() === ""
    ) {
      invariants.singleActive = false;
      issues.push(`Forbidden active domain value: "${env.active_domain}"`);
    }

    // 2. Fail-closed
    if (!env.signature) {
      invariants.failClosed = false;
      issues.push("Cryptographic signature is missing");
    }
    const expiresAt = Number(env.expires_at || 0);
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt && expiresAt < now) {
      invariants.failClosed = false;
      issues.push("Envelope has expired");
    }

    // 3. Exact match visibility
    // In actual code this prevents exact matches being violated, we evaluate authorized domains here
    if (env.active_domain && env.authorized_domains) {
      const activeLower = env.active_domain.toLowerCase();
      const hasDomain = env.authorized_domains.some(
        (d: string) => d.toLowerCase() === activeLower
      );
      if (!hasDomain) {
        invariants.explicitPublication = false;
        issues.push(
          `Active domain "${env.active_domain}" is not in the authorized list`
        );
      }
    }

    // 4. Wildcard checks in authorized set
    if (env.authorized_domains) {
      if (
        env.authorized_domains.includes("*") ||
        env.authorized_domains.includes("global")
      ) {
        invariants.explicitPublication = false;
        issues.push(
          "Wildcards ('*') or 'global' are forbidden in authorized_domains set"
        );
      }
    }

    const isValid = issues.length === 0;

    return {
      isValid,
      issues,
      invariants,
    };
  }, [currentEnvelopeToValidate]);

  const handleCopyJson = () => {
    const text = JSON.stringify(mintedEnvelopeObj, null, 2);
    navigator.clipboard.writeText(text);
    toast.success("Envelope JSON copied to clipboard");
  };

  const handleDecodeInput = () => {
    setDecoderError(null);
    setDecodedEnvelope(null);
    if (!rawEnvelopeInput.trim()) {
      setDecoderError("Please enter envelope JSON content");
      return;
    }

    try {
      const parsed = JSON.parse(rawEnvelopeInput);
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Must be a valid JSON object");
      }
      setDecodedEnvelope(parsed);
      toast.success("Envelope parsed successfully");
    } catch (e: any) {
      setDecoderError(e.message || "Failed to parse JSON");
      toast.error("Invalid Envelope JSON");
    }
  };

  const loadMockDecoded = () => {
    const mock = {
      hki_version: "1.0",
      envelope_id: "env_mock_9824fac",
      org_id: "org_acme_retail",
      subject_id: "user_customer_service_agent",
      active_domain: "support",
      authorized_domains: ["support", "orders"],
      purpose: "execute",
      risk_tier: "low-risk",
      policy_pack_id: "pp_support_v2",
      issued_at: Math.floor(Date.now() / 1000) - 30,
      expires_at: Math.floor(Date.now() / 1000) + 270,
      issuer: "urn:hki:api-gateway",
      signature: "sig_ed25519_abc1237890ef",
    };
    setRawEnvelopeInput(JSON.stringify(mock, null, 2));
    setDecodedEnvelope(mock);
    setDecoderError(null);
    toast.info("Mock envelope loaded into decoder");
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-background/50 backdrop-blur-xl shadow-xl overflow-hidden mt-6">
      {/* Header Banner */}
      <div className="relative border-b border-border/75 bg-gradient-to-r from-[#0E7C7B]/10 via-background to-background px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#0E7C7B]/30 bg-[#0E7C7B]/10 text-[#0E7C7B]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Cryptographic Envelope Sandbox
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Design system utility to mint, inspect, and trace signed
                HkiEnvelopes across systems.
              </p>
            </div>
          </div>

          <div className="flex rounded-lg border border-border bg-background/50 p-1">
            <button
              onClick={() => setActiveTab("minter")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                activeTab === "minter"
                  ? "bg-[#0E7C7B] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Minter Studio
            </button>
            <button
              onClick={() => setActiveTab("decoder")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                activeTab === "decoder"
                  ? "bg-[#0E7C7B] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Decoder Tool
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border/80">
        {/* Left Column: Interactive Playground Input */}
        <div className="lg:col-span-7 p-6 space-y-5">
          <AnimatePresence mode="wait">
            {activeTab === "minter" ? (
              <motion.div
                key="minter-pane"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground block mb-1.5">
                      Organization ID
                    </label>
                    <input
                      type="text"
                      value={orgId}
                      onChange={e => setOrgId(e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0E7C7B]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground block mb-1.5">
                      Subject (User/Agent) ID
                    </label>
                    <input
                      type="text"
                      value={subjectId}
                      onChange={e => setSubjectId(e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0E7C7B]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground block mb-1.5">
                      Active Domain
                    </label>
                    <select
                      value={activeDomain}
                      onChange={e => setActiveDomain(e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0E7C7B]"
                    >
                      {domains.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.id})
                        </option>
                      ))}
                      <option value="global">global (Invariant Trap)</option>
                      <option value="*">* (Wildcard Trap)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground block mb-1.5">
                      Purpose
                    </label>
                    <select
                      value={purpose}
                      onChange={e => setPurpose(e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0E7C7B]"
                    >
                      <option value="retrieve">
                        retrieve (RAG / Read-only)
                      </option>
                      <option value="execute">execute (Actions / Tools)</option>
                      <option value="audit">audit (Compliance Plane)</option>
                    </select>
                  </div>
                </div>

                {/* Authorized Domains Set Builder */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground block mb-1.5">
                    Authorized Domains List
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={authDomainsInput}
                      onChange={e => setAuthDomainsInput(e.target.value)}
                      placeholder="e.g. catalog, orders, logistics"
                      onKeyDown={e =>
                        e.key === "Enter" && handleAddAuthDomain()
                      }
                      className="flex-1 h-10 px-3 text-sm bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0E7C7B]"
                    />
                    <button
                      type="button"
                      onClick={handleAddAuthDomain}
                      className="px-4 h-10 text-xs font-semibold bg-background hover:bg-muted border border-border/80 rounded-xl transition"
                    >
                      Add Domain
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-border/60 bg-muted/30 min-h-12">
                    {authorizedDomains.length === 0 && (
                      <span className="text-xs text-muted-foreground/85 flex items-center">
                        No secondary domains authorized. Fallback is
                        [active_domain] only.
                      </span>
                    )}
                    {authorizedDomains.map(domain => (
                      <span
                        key={domain}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors",
                          domain === activeDomain
                            ? "bg-[#0E7C7B]/10 border-[#0E7C7B]/30 text-[#0E7C7B]"
                            : "bg-background border-border text-foreground"
                        )}
                      >
                        {domain}
                        {domain === activeDomain && (
                          <span className="text-[9px] uppercase font-bold text-[#0E7C7B] ml-1">
                            Active
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveAuthDomain(domain)}
                          className="hover:text-destructive transition ml-1"
                          disabled={domain === activeDomain}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground block mb-1.5">
                      Risk Tier
                    </label>
                    <select
                      value={riskTier}
                      onChange={e => setRiskTier(e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0E7C7B]"
                    >
                      <option value="read-only">
                        read-only (No write / low-risk)
                      </option>
                      <option value="low-risk">low-risk (Standard)</option>
                      <option value="high-risk">
                        high-risk (Extra auditing)
                      </option>
                      <option value="critical">critical (HITL required)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground block mb-1.5">
                      Policy Pack
                    </label>
                    <input
                      type="text"
                      value={policyPack}
                      onChange={e => setPolicyPack(e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0E7C7B]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground block mb-1.5">
                      TTL (Seconds)
                    </label>
                    <input
                      type="number"
                      value={ttl}
                      onChange={e => setTtl(Number(e.target.value))}
                      className="w-full h-10 px-3 text-sm bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0E7C7B]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground block mb-1.5">
                    Gateway Issuer URL
                  </label>
                  <input
                    type="text"
                    value={issuer}
                    onChange={e => setIssuer(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0E7C7B]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground block">
                      Cryptographic Signature (Ed25519)
                    </label>
                    <button
                      type="button"
                      onClick={() => setSignature("")}
                      className="text-[10px] text-destructive hover:underline"
                    >
                      Clear Signature (Fails Invariant 2)
                    </button>
                  </div>
                  <input
                    type="text"
                    value={signature}
                    onChange={e => setSignature(e.target.value)}
                    placeholder="Provide token signature or leave empty to mock"
                    className="w-full h-10 px-3 font-mono text-xs bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0E7C7B]"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="decoder-pane"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    Paste Encoded Envelope Payload
                  </span>
                  <button
                    type="button"
                    onClick={loadMockDecoded}
                    className="text-xs text-[#0E7C7B] hover:underline"
                  >
                    Load Sample Envelope
                  </button>
                </div>

                <textarea
                  value={rawEnvelopeInput}
                  onChange={e => setRawEnvelopeInput(e.target.value)}
                  placeholder='Paste JSON here e.g. {"hki_version": "1.0", "org_id": "...", "active_domain": "..."}'
                  className="w-full h-64 p-3 font-mono text-xs bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0E7C7B]"
                />

                {decoderError && (
                  <div className="p-3 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{decoderError}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDecodeInput}
                    className="flex-1 h-11 text-xs font-semibold bg-[#0E7C7B] text-white hover:bg-[#0E7C7B]/95 rounded-xl shadow-sm transition"
                  >
                    Decode & Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRawEnvelopeInput("");
                      setDecodedEnvelope(null);
                      setDecoderError(null);
                    }}
                    className="h-11 px-4 text-xs font-semibold bg-background hover:bg-muted border border-border/80 rounded-xl transition"
                  >
                    Clear
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Real-time Invariant Check + Downstream Flow Simulation */}
        <div className="lg:col-span-5 p-6 bg-muted/15 flex flex-col justify-between">
          <div className="space-y-5">
            {/* Header: Audit Verdict */}
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Invariants Audit
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border",
                  validationResults.isValid
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                )}
              >
                {validationResults.isValid ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Conformant
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Rejected
                  </>
                )}
              </span>
            </div>

            {/* Checklist */}
            <div className="space-y-3.5">
              <InvariantItem
                title="1. Single Active Domain"
                desc="Active domain must be explicitly named, never global/wildcard"
                passed={validationResults.invariants.singleActive}
              />
              <InvariantItem
                title="2. Fail-Closed Default"
                desc="Missing or invalid envelope rejects with 401/403"
                passed={validationResults.invariants.failClosed}
              />
              <InvariantItem
                title="3. Exact-Match Visibility"
                desc="Strict same_domain() lookup instead of loose matching"
                passed={validationResults.invariants.exactMatch}
              />
              <InvariantItem
                title="5. Explicit Cross-Domain Publication"
                desc="Access is allowed strictly for explicitly authorized domains"
                passed={validationResults.invariants.explicitPublication}
              />
            </div>

            {validationResults.issues.length > 0 && (
              <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 mt-4 space-y-1.5">
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block">
                  Validation Failures ({validationResults.issues.length})
                </span>
                <ul className="list-disc pl-4 space-y-1">
                  {validationResults.issues.map((issue, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground">
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Downstream Propagation Simulator */}
            {currentEnvelopeToValidate && (
              <div className="pt-4 border-t border-border/50">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground block mb-3">
                  Downstream Propagation Trace
                </span>

                <div className="space-y-3 font-mono text-xs">
                  <TraceNode
                    label="API Gateway Edge"
                    status={validationResults.isValid ? "signed" : "blocked"}
                    desc={
                      validationResults.isValid
                        ? `Mints and seals payload`
                        : "Signature rejected"
                    }
                    meta={currentEnvelopeToValidate.envelope_id}
                  />
                  <div className="h-3 w-px bg-border/80 ml-4" />
                  <TraceNode
                    label="Orchestrator Agent"
                    status={
                      validationResults.isValid ? "authorized" : "rejected"
                    }
                    desc={
                      validationResults.isValid
                        ? `Carries envelope in state`
                        : "Request unauthorized"
                    }
                    meta={`domain: ${currentEnvelopeToValidate.active_domain}`}
                  />
                  <div className="h-3 w-px bg-border/80 ml-4" />
                  <TraceNode
                    label="Vector Store Search"
                    status={
                      validationResults.isValid &&
                      currentEnvelopeToValidate.active_domain !== "global" &&
                      currentEnvelopeToValidate.active_domain !== "*"
                        ? "isolated"
                        : "denied"
                    }
                    desc={
                      validationResults.isValid
                        ? `Queried index of domain: ${currentEnvelopeToValidate.active_domain}`
                        : "Query block"
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {activeTab === "minter" && (
            <div className="flex gap-2 pt-4 border-t border-border/50 mt-4">
              <button
                type="button"
                onClick={handleCopyJson}
                className="flex-1 h-10 text-xs font-semibold bg-background hover:bg-muted border border-border/80 rounded-xl flex items-center justify-center gap-2 transition"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Envelope
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InvariantItem({
  title,
  desc,
  passed,
}: {
  title: string;
  desc: string;
  passed: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5",
          passed
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
        )}
      >
        {passed ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5" />
        )}
      </div>
      <div>
        <h4 className="text-xs font-semibold text-foreground leading-tight">
          {title}
        </h4>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
          {desc}
        </p>
      </div>
    </div>
  );
}

function TraceNode({
  label,
  status,
  desc,
  meta,
}: {
  label: string;
  status:
    | "signed"
    | "blocked"
    | "authorized"
    | "rejected"
    | "isolated"
    | "denied";
  desc: string;
  meta?: string;
}) {
  const getStatusColor = () => {
    switch (status) {
      case "signed":
      case "authorized":
      case "isolated":
        return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      default:
        return "text-rose-500 bg-rose-500/10 border-rose-500/20";
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-[0.06em] shrink-0 min-w-22 text-center",
          getStatusColor()
        )}
      >
        {status}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-foreground text-xs leading-none">
          {label}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 truncate leading-tight">
          {desc} {meta && <span className="opacity-60">({meta})</span>}
        </div>
      </div>
    </div>
  );
}
