/* TeamTab — two-column users & access management */
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  UserPlus,
  Copy,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  Ban,
  Users,
} from "lucide-react";
import { cn, useNotifications } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { useAuth } from "@/_core/hooks/useAuth";
import { FONT_FAMILY } from "@hki/ui";
import { cardCls, surfaceCls } from "../types";
import { k } from "../theme";
import {
  DEFAULT_STANDARD_ROLE,
  MANAGED_ROLES,
  ROLE_METADATA,
  type Role as AppRole,
} from "@shared/access-control";

type ManagedRole = (typeof MANAGED_ROLES)[number];

interface TeamTabProps {
  selectedStream: string;
  streamLabel: string;
}

const STATUS_META: Record<
  string,
  { icon: typeof CheckCircle; color: string; bg: string }
> = {
  pending: { icon: Clock, color: "text-primary", bg: "bg-primary/10" },
  accepted: {
    icon: CheckCircle,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  expired: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted/60" },
  revoked: { icon: Ban, color: "text-red-500", bg: "bg-red-500/10" },
};

export default function TeamTab({ selectedStream, streamLabel }: TeamTabProps) {
  const { isMinimumRole } = usePermissions();
  const { user } = useAuth();
  const canManage = isMinimumRole("manager");
  const isPlatformAdmin = user?.role === "admin";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ManagedRole>(DEFAULT_STANDARD_ROLE);
  const [note, setNote] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [requestRoles, setRequestRoles] = useState<Record<number, ManagedRole>>(
    {}
  );
  const [memberRoles, setMemberRoles] = useState<Record<number, ManagedRole>>(
    {}
  );

  const utils = trpc.useUtils();
  const { notify } = useNotifications();

  const invitesQ = trpc.admin.listInvites.useQuery(
    { valueStreamId: selectedStream || undefined },
    { retry: false }
  );
  const accessRequestsQ = trpc.admin.listAccessRequests.useQuery(
    { status: "pending", valueStreamId: selectedStream || undefined },
    {
      retry: false,
      enabled: canManage && !!selectedStream,
    }
  );
  const membersQ = trpc.admin.listManagedUsers.useQuery(
    selectedStream ? { valueStreamId: selectedStream } : undefined,
    {
      retry: false,
      enabled: canManage && !!selectedStream,
    }
  );

  const createMut = trpc.admin.createInvite.useMutation({
    onSuccess: (d: any) => {
      notify({
        title: `Invite sent to ${d.email}`,
        severity: "success",
        group: "team",
      });
      setLastCode(d.inviteCode);
      setEmail("");
      setNote("");
      utils.admin.listInvites.invalidate();
    },
    onError: (e: any) =>
      notify({
        title: "Invite failed",
        description: e.message,
        severity: "error",
        group: "team",
      }),
  });

  const revokeMut = trpc.admin.revokeInvite.useMutation({
    onSuccess: () => {
      notify({ title: "Invite revoked", severity: "info", group: "team" });
      utils.admin.listInvites.invalidate();
    },
    onError: (e: any) =>
      notify({
        title: "Revoke failed",
        description: e.message,
        severity: "error",
        group: "team",
      }),
  });

  const decideAccessMut = trpc.admin.decideAccessRequest.useMutation({
    onSuccess: (d: any) => {
      notify({
        title:
          d.status === "approved"
            ? `Access approved for ${d.email}`
            : "Access request denied",
        severity: "success",
        group: "team",
      });
      if (d.inviteCode) {
        setLastCode(d.inviteCode);
      }
      utils.admin.listAccessRequests.invalidate();
      utils.admin.listInvites.invalidate();
    },
    onError: (e: any) =>
      notify({
        title: "Decision failed",
        description: e.message,
        severity: "error",
        group: "team",
      }),
  });
  const updateMemberMut = trpc.admin.updateManagedUserAccess.useMutation({
    onSuccess: (result: any) => {
      notify({
        title: result.revoked
          ? "Domain access removed"
          : "Member access updated",
        severity: "success",
        group: "team",
      });
      utils.admin.listManagedUsers.invalidate();
      utils.admin.listUsers.invalidate();
    },
    onError: (e: any) =>
      notify({
        title: "Member update failed",
        description: e.message,
        severity: "error",
        group: "team",
      }),
  });

  const handleCreate = () => {
    if (!email.trim())
      return notify({ title: "Email is required", severity: "warning" });
    if (!selectedStream)
      return notify({
        title: "Select a domain first",
        severity: "warning",
      });
    createMut.mutate({
      valueStreamId: selectedStream,
      email: email.trim(),
      role,
      note: note.trim() || undefined,
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    notify({ title: "Invite code copied", severity: "success" });
  };

  const setRequestRole = (requestId: number, nextRole: ManagedRole) => {
    setRequestRoles(current => ({ ...current, [requestId]: nextRole }));
  };
  const setMemberRole = (userId: number, nextRole: ManagedRole) => {
    setMemberRoles(current => ({ ...current, [userId]: nextRole }));
  };

  const invites = (invitesQ.data ?? []) as any[];
  const pendingRequests = (accessRequestsQ.data ?? []) as any[];
  const members = (membersQ.data?.users ?? []) as any[];
  const pendingCount = invites.filter(
    (i: any) => i.status === "pending"
  ).length;
  const acceptedCount = invites.filter(
    (i: any) => i.status === "accepted"
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
            <Users className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Users &amp; Access
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {acceptedCount} member{acceptedCount !== 1 ? "s" : ""} ·{" "}
              {pendingCount} pending invite{pendingCount !== 1 ? "s" : ""}
              {selectedStream ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-primary font-medium">
                    {streamLabel}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm(!showForm)}
            aria-expanded={showForm}
            aria-controls="knowledge-invite-form"
            className={cn(
              k.btnPrimary,
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            )}
          >
            <UserPlus className="w-3.5 h-3.5" /> Invite
          </button>
        )}
      </div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* ═══ LEFT COLUMN: Invite + Accept ═══ */}
        <div className="space-y-4">
          {/* ── Invite Form (collapsible) ── */}
          {canManage && showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              id="knowledge-invite-form"
              className={cn("overflow-hidden", cardCls)}
            >
              <div className="border-b border-border/40 px-5 py-3">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" /> ✉️ Send Invitation
                </h4>
              </div>
              <div className="p-5 space-y-4">
                <div className="rounded-xl border border-border/40 bg-muted/35 px-3 py-2 text-[11px] leading-4 text-muted-foreground">
                  <span className="font-semibold text-foreground">Role</span>{" "}
                  defines capability tier.{" "}
                  <span className="font-semibold text-foreground">Domain</span>{" "}
                  membership defines scope. New users should usually start as{" "}
                  <span className="font-semibold text-foreground">
                    {ROLE_METADATA.viewer.shortLabel}
                  </span>
                  .
                </div>

                {!selectedStream && (
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-xs text-primary">
                    Select a domain from the header dropdown before sending
                    invites.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="invite-email"
                      className="block text-xs font-medium text-muted-foreground mb-1"
                    >
                      Email <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="invite-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="curator@hki.com"
                      className={cn(
                        k.input,
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      )}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="invite-role"
                      className="block text-xs font-medium text-muted-foreground mb-1"
                    >
                      Role
                    </label>
                    <select
                      id="invite-role"
                      value={role}
                      onChange={e => setRole(e.target.value as ManagedRole)}
                      className={cn(
                        k.input,
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      )}
                    >
                      {MANAGED_ROLES.map(option => (
                        <option key={option} value={option}>
                          {ROLE_METADATA[option].shortLabel} —{" "}
                          {ROLE_METADATA[option].code}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                      {ROLE_METADATA[role].description}
                    </p>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="invite-note"
                    className="block text-xs font-medium text-muted-foreground mb-1"
                  >
                    Note (optional)
                  </label>
                  <input
                    id="invite-note"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="e.g. You'll be managing the pharmacy SOPs collection"
                    className={cn(
                      k.input,
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    )}
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground/60">
                    Expires in 14 days.
                  </p>
                  <button
                    onClick={handleCreate}
                    disabled={
                      !email.trim() || !selectedStream || createMut.isPending
                    }
                    className={cn(
                      k.btnPrimary,
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    )}
                  >
                    {createMut.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Mail className="w-3.5 h-3.5" />
                    )}
                    Send Invite
                  </button>
                </div>

                {lastCode && (
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-primary font-medium uppercase tracking-wider mb-0.5">
                        Invite Code
                      </p>
                      <p
                        className="text-lg font-bold text-foreground tracking-[0.2em]"
                        style={{ fontFamily: FONT_FAMILY.mono }}
                      >
                        {lastCode}
                      </p>
                    </div>
                    <button
                      onClick={() => copyCode(lastCode)}
                      aria-label="Copy the latest invite code"
                      className={cn(
                        "flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                        k.duoToneAccentSolid,
                        k.duoToneAccentSolidHover
                      )}
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Access Requests ── */}
          {canManage && (
            <section
              className={cn("overflow-hidden", cardCls)}
              aria-labelledby="access-requests-heading"
            >
              <div className="border-b border-border/40 px-5 py-3 flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span id="access-requests-heading">
                    <Shield className="w-4 h-4 text-primary" /> 🔐 Access
                    Requests
                  </span>
                </h4>
                <span
                  className="text-xs text-muted-foreground/60"
                  aria-live="polite"
                >
                  {pendingRequests.length} pending
                </span>
              </div>

              {!selectedStream ? (
                <div className="p-5 text-xs text-primary">
                  Select a domain to review requests.
                </div>
              ) : accessRequestsQ.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/60" />
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-10 space-y-1">
                  <Shield className="w-7 h-7 text-primary/25 mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    No pending requests
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/30" role="list">
                  {pendingRequests.map((request: any) => {
                    const selectedRole = requestRoles[request.id] ?? "viewer";
                    return (
                      <div
                        key={request.id}
                        role="listitem"
                        className="px-5 py-4 space-y-3 hover:bg-muted/60/50 dark:hover:bg-card/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {request.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {request.email} · {request.department}
                            </p>
                            {request.managerEmail && (
                              <p className="text-[11px] text-muted-foreground/70 mt-1">
                                Manager contact: {request.managerEmail}
                              </p>
                            )}
                          </div>
                          <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full uppercase tracking-wider bg-primary/10 text-primary">
                            pending
                          </span>
                        </div>

                        <div className={cn("rounded-xl p-3", surfaceCls)}>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">
                            Justification
                          </p>
                          <p className="text-xs leading-relaxed text-foreground/85">
                            {request.justification}
                          </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor={`request-role-${request.id}`}
                              className="text-[11px] text-muted-foreground"
                            >
                              Grant role
                            </label>
                            <select
                              id={`request-role-${request.id}`}
                              value={selectedRole}
                              onChange={e =>
                                setRequestRole(
                                  request.id,
                                  e.target.value as ManagedRole
                                )
                              }
                              aria-label={`Role for ${request.name}`}
                              className={cn(
                                k.input,
                                "h-9 w-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                              )}
                            >
                              {MANAGED_ROLES.map(option => (
                                <option key={option} value={option}>
                                  {ROLE_METADATA[option].shortLabel}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                decideAccessMut.mutate({
                                  id: request.id,
                                  decision: "denied",
                                  valueStreamId: selectedStream,
                                })
                              }
                              disabled={decideAccessMut.isPending}
                              aria-label={`Deny access request from ${request.name}`}
                              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Deny
                            </button>
                            <button
                              onClick={() =>
                                decideAccessMut.mutate({
                                  id: request.id,
                                  decision: "approved",
                                  valueStreamId: selectedStream,
                                  role: selectedRole,
                                })
                              }
                              disabled={decideAccessMut.isPending}
                              aria-label={`Approve access request from ${request.name}`}
                              className={cn(
                                k.btnPrimary,
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                              )}
                            >
                              {decideAccessMut.isPending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                              Approve &amp; Invite
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        {/* ═══ RIGHT COLUMN: Invitations list ═══ */}
        <div className="space-y-4">
          {canManage && (
            <section
              className={cn("overflow-hidden", cardCls)}
              aria-labelledby="members-heading"
            >
              <div className="border-b border-border/40 px-5 py-3 flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span id="members-heading">Domain Members</span>
                </h4>
                <span className="text-xs text-muted-foreground/60">
                  {members.length} assigned
                </span>
              </div>
              <div className="px-5 py-3 text-[11px] leading-4 text-muted-foreground border-b border-border/30 bg-muted/25">
                This screen manages scoped access for{" "}
                <span className="font-semibold text-foreground">
                  {streamLabel || "the selected domain"}
                </span>
                . Role changes apply to the user&apos;s current enterprise tier,
                while domain assignment controls where that tier applies.
              </div>

              {!selectedStream ? (
                <div className="p-5 text-xs text-primary">
                  Select a domain to manage members.
                </div>
              ) : membersQ.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/60" />
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-10 space-y-1">
                  <Users className="w-7 h-7 text-muted-foreground/30 mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    No members are assigned to this domain yet
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/30" role="list">
                  {members.map((member: any) => {
                    const selectedMemberRole =
                      memberRoles[member.id] ?? (member.role as ManagedRole);
                    const isDirty = selectedMemberRole !== member.role;
                    const isSelf = member.id === user?.id;
                    const isProtectedAdmin =
                      member.role === "admin" && !isPlatformAdmin;
                    const actionDisabled =
                      isSelf || isProtectedAdmin || updateMemberMut.isPending;

                    return (
                      <div
                        key={member.id}
                        role="listitem"
                        className="px-5 py-4 space-y-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {member.name || member.email}
                              {isSelf && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  (you)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {member.email || "No email"}
                              {member.department
                                ? ` · ${member.department}`
                                : ""}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground/70">
                              Last active:{" "}
                              {member.lastSignedIn
                                ? new Date(
                                    member.lastSignedIn
                                  ).toLocaleDateString()
                                : "Never"}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "px-2 py-1 text-[10px] font-bold rounded-full uppercase tracking-[0.18em] border",
                              member.isActive
                                ? "bg-primary/10 text-primary border-primary/15"
                                : "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            {member.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                          <div>
                            <label
                              htmlFor={`member-role-${member.id}`}
                              className="block text-[11px] text-muted-foreground mb-1"
                            >
                              Access tier
                            </label>
                            <select
                              id={`member-role-${member.id}`}
                              value={selectedMemberRole}
                              onChange={e =>
                                setMemberRole(
                                  member.id,
                                  e.target.value as ManagedRole
                                )
                              }
                              disabled={actionDisabled}
                              className={cn(
                                k.input,
                                "h-9 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
                              )}
                            >
                              {MANAGED_ROLES.map(option => (
                                <option key={option} value={option}>
                                  {ROLE_METADATA[option].shortLabel}
                                </option>
                              ))}
                            </select>
                            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                              {ROLE_METADATA[selectedMemberRole].code} —{" "}
                              {ROLE_METADATA[selectedMemberRole].description}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              updateMemberMut.mutate({
                                userId: member.id,
                                valueStreamId: selectedStream,
                                role: selectedMemberRole,
                              })
                            }
                            disabled={!isDirty || actionDisabled}
                            className={cn(
                              k.btnPrimary,
                              "justify-center disabled:opacity-50"
                            )}
                          >
                            {updateMemberMut.isPending && isDirty ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            Update
                          </button>
                          <button
                            onClick={() =>
                              updateMemberMut.mutate({
                                userId: member.id,
                                valueStreamId: selectedStream,
                                revoke: true,
                              })
                            }
                            disabled={actionDisabled}
                            className="flex items-center justify-center gap-1 rounded-lg border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                          >
                            <Ban className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <section
            className={cn("overflow-hidden", cardCls)}
            aria-labelledby="invitations-heading"
          >
            <div className="border-b border-border/40 px-5 py-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span id="invitations-heading">📨 Invitations</span>
                {pendingCount > 0 && (
                  <span
                    className="px-1.5 py-0.5 text-xs font-semibold rounded-full kb-duotone-fill"
                    aria-live="polite"
                  >
                    {pendingCount} pending
                  </span>
                )}
              </h4>
              <span className="text-xs text-muted-foreground/60">
                {invites.length} total
              </span>
            </div>

            {invitesQ.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/60" />
              </div>
            ) : invites.length === 0 ? (
              <div className="text-center py-10 space-y-1">
                <Mail className="w-7 h-7 text-muted-foreground/30 mx-auto" />
                <p className="text-xs text-muted-foreground">
                  No invitations yet
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30" role="list">
                {invites.map((inv: any) => {
                  const meta = STATUS_META[inv.status] || STATUS_META.pending;
                  const StatusIcon = meta.icon;
                  const expired =
                    inv.status === "pending" &&
                    new Date(inv.expiresAt) < new Date();
                  return (
                    <div
                      key={inv.id}
                      role="listitem"
                      className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            meta.bg
                          )}
                        >
                          <StatusIcon className={cn("w-4 h-4", meta.color)} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {inv.email}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className={cn(
                                "px-1.5 py-0.5 text-xs font-semibold rounded-full uppercase tracking-wider",
                                meta.bg,
                                meta.color
                              )}
                            >
                              {expired ? "expired" : inv.status}
                            </span>
                            <span className="text-xs text-muted-foreground/60">
                              {ROLE_METADATA[
                                (inv.role as AppRole) || DEFAULT_STANDARD_ROLE
                              ]?.shortLabel ?? inv.role}
                            </span>
                            <span
                              className="text-xs text-muted-foreground/60"
                              style={{ fontFamily: FONT_FAMILY.mono }}
                            >
                              {inv.inviteCode}
                            </span>
                            {inv.status === "pending" &&
                              !expired &&
                              inv.expiresAt &&
                              (() => {
                                const daysLeft = Math.ceil(
                                  (new Date(inv.expiresAt).getTime() -
                                    Date.now()) /
                                    86400000
                                );
                                return (
                                  <span
                                    className={cn(
                                      "text-xs",
                                      daysLeft <= 3
                                        ? "text-primary"
                                        : "text-muted-foreground/50"
                                    )}
                                  >
                                    {daysLeft}d left
                                  </span>
                                );
                              })()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {inv.status === "pending" && !expired && canManage && (
                          <>
                            <button
                              onClick={() => copyCode(inv.inviteCode)}
                              aria-label={`Copy invite code for ${inv.email}`}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                              title="Copy code"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Revoke invite for ${inv.email}?`))
                                  revokeMut.mutate({ id: inv.id });
                              }}
                              aria-label={`Revoke invite for ${inv.email}`}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                              title="Revoke"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {inv.status === "accepted" && inv.acceptedAt && (
                          <span className="text-xs text-primary">
                            {new Date(inv.acceptedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </motion.div>
  );
}
