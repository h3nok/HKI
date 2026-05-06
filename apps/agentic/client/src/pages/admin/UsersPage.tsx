/**
 * Users Page — User management
 *
 * List users, assign roles, assign domains, toggle active status.
 */

import { useState, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Users,
  Layers,
  Check,
  X,
  Loader2,
  ChevronDown,
  UserCheck,
  UserX,
  UserPlus,
  Mail,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import {
  cn,
  HkiTable,
  HkiThead,
  HkiTbody,
  HkiTr,
  HkiTh,
  HKITd,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@hki/ui";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { a } from "./theme";
import { AdminPageHeader } from "./components/AdminPageHeader";
import {
  ALL_ROLES,
  DEFAULT_STANDARD_ROLE,
  MANAGED_ROLES,
  ROLE_METADATA,
  type Role as AppRole,
} from "@shared/access-control";

const ROLE_COLORS: Record<AppRole, string> = {
  admin: `${a.pillCritical} shadow-sm`,
  manager: `${a.pillPrimary} shadow-sm`,
  operator: `${a.pillPositive} shadow-sm`,
  viewer: a.pillNeutral,
};
const ADMIN_ROLE_OPTIONS = ALL_ROLES;
const ADMIN_POPOVER_BACKDROP_Z = "z-[1190]";
const ADMIN_POPOVER_PANEL_Z = "z-[1200]";

// ═══════════════════════════════════════════════════════════════════════════════
// Domain Assignment Dropdown (per-user multi-select)
// ═══════════════════════════════════════════════════════════════════════════════

function StreamAssignDropdown({
  userId,
  current,
  allStreams,
}: {
  userId: number;
  current: string[];
  allStreams: { id: string; name: string; icon: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set(current));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const utils = trpc.useUtils();
  const mut = trpc.admin.assignValueStreams.useMutation({
    onSuccess: () => {
      toast.success("Domains updated");
      utils.admin.listUsers.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const toggle = (id: string) =>
    setSel(p => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const save = () => {
    mut.mutate({ userId, valueStreamIds: Array.from(sel) });
    setOpen(false);
  };

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.right });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePos();
  }, [open, updatePos]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className={cn(
          a.inset,
          "flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors hover:border-primary/20"
        )}
      >
        <Layers className="w-3 h-3 text-muted-foreground" />
        <span>{current.length || "None"}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>
      {open &&
        createPortal(
          <>
            <div
              className={cn("fixed inset-0", ADMIN_POPOVER_BACKDROP_Z)}
              onClick={() => setOpen(false)}
            />
            <div
              className={cn(
                a.card,
                "fixed min-w-55 rounded-lg p-2 space-y-1",
                ADMIN_POPOVER_PANEL_Z
              )}
              style={{
                top: pos.top,
                left: pos.left,
                transform: "translateX(-100%)",
              }}
            >
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1">
                Assign Domains
              </div>
              {allStreams
                .filter(s => s.id !== "global")
                .map(s => (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors text-left",
                      sel.has(s.id)
                        ? `${a.panelPrimary} text-foreground`
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span>{s.icon}</span>
                    <span className="flex-1">{s.name}</span>
                    {sel.has(s.id) && (
                      <Check className="w-3 h-3 text-primary" />
                    )}
                  </button>
                ))}
              <div className="pt-1 border-t border-border mt-1">
                <button
                  onClick={save}
                  disabled={mut.isPending}
                  className="w-full px-2 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {mut.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}{" "}
                  Save
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Role Dropdown (per-user)
// ═══════════════════════════════════════════════════════════════════════════════

function RoleDropdown({
  userId,
  currentRole,
  isSelf,
}: {
  userId: number;
  currentRole: string;
  isSelf: boolean;
}) {
  const currentRoleMeta =
    ROLE_METADATA[currentRole as AppRole] ?? ROLE_METADATA.viewer;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const utils = trpc.useUtils();
  const mut = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      utils.admin.listUsers.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePos();
  }, [open, updatePos]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => !isSelf && setOpen(!open)}
        disabled={isSelf}
        className={cn(
          "px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider border transition-colors",
          ROLE_COLORS[(currentRole as AppRole) || "viewer"] ||
            ROLE_COLORS.viewer,
          isSelf
            ? "cursor-default opacity-80"
            : "hover:opacity-90 cursor-pointer hover:shadow-sm"
        )}
        title={`${currentRoleMeta.code} — ${currentRoleMeta.description}`}
      >
        {currentRoleMeta.shortLabel}
      </button>
      {open &&
        createPortal(
          <>
            <div
              className={cn("fixed inset-0", ADMIN_POPOVER_BACKDROP_Z)}
              onClick={() => setOpen(false)}
            />
            <div
              className={cn(
                a.card,
                "fixed min-w-35 rounded-lg p-1",
                ADMIN_POPOVER_PANEL_Z
              )}
              style={{ top: pos.top, left: pos.left }}
            >
              {ADMIN_ROLE_OPTIONS.map(r => (
                <button
                  key={r}
                  onClick={() => {
                    mut.mutate({ userId, role: r });
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-start gap-2 px-2 py-2 text-left rounded-md",
                    r === currentRole
                      ? `${a.panelPrimary} font-semibold`
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      r === "admin"
                        ? "bg-destructive"
                        : r === "manager"
                          ? "bg-primary"
                          : r === "operator"
                            ? "bg-emerald-500"
                            : "bg-muted-foreground/60"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {ROLE_METADATA[r].shortLabel}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        {ROLE_METADATA[r].code}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                      {ROLE_METADATA[r].description}
                    </p>
                  </div>
                  {r === currentRole && (
                    <Check className="w-3 h-3 ml-auto text-primary" />
                  )}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Users Page
// ═══════════════════════════════════════════════════════════════════════════════

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState<AppRole>(DEFAULT_STANDARD_ROLE);
  const [invStream, setInvStream] = useState<string>("");
  const [invNote, setInvNote] = useState("");
  const [inviteResult, setInviteResult] = useState<{
    code: string;
    stream: string;
  } | null>(null);
  const { user } = useAuth();

  const utils = trpc.useUtils();
  const streamsQ = trpc.admin.listValueStreams.useQuery(undefined, {
    retry: false,
  });
  const usersQ = trpc.admin.listUsers.useQuery(
    { search: search || undefined },
    { retry: false }
  );
  const toggleActiveMut = trpc.admin.toggleUserActive.useMutation({
    onSuccess: d => {
      toast.success(d.isActive ? "Activated" : "Deactivated");
      utils.admin.listUsers.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const inviteMut = trpc.admin.createInvite.useMutation({
    onSuccess: data => {
      setInviteResult({ code: data.inviteCode, stream: data.streamName });
      setInvEmail("");
      setInvNote("");
      toast.success("Invite created");
    },
    onError: e => toast.error(e.message),
  });

  const inputCls = cn(
    a.field,
    "w-full px-3 py-2.5 text-sm rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
  );
  const userRows = (usersQ.data?.users ?? []) as Array<{
    isActive?: boolean;
    role?: AppRole;
  }>;
  const totalUsers = usersQ.data?.total ?? userRows.length;
  const activeUsers = userRows.filter(userRow => userRow.isActive).length;
  const elevatedUsers = userRows.filter(userRow => {
    return userRow.role != null && userRow.role !== DEFAULT_STANDARD_ROLE;
  }).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Users & Access"
        description="Manage control-plane access, role elevation, and domain scope. New users should stay on the standard viewer path until you intentionally expand their permissions."
        icon={Users}
        action={
          !showInvite ? (
            <button
              onClick={() => {
                setShowInvite(true);
                setInviteResult(null);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <UserPlus className="h-3.5 w-3.5" /> Invite User
            </button>
          ) : undefined
        }
        stats={[
          {
            label: "Users total",
            value: String(totalUsers),
            tone: "primary",
          },
          {
            label: "Active accounts",
            value: String(activeUsers),
            tone: activeUsers > 0 ? "positive" : "neutral",
          },
          {
            label: "Elevated roles",
            value: String(elevatedUsers),
            tone: elevatedUsers > 0 ? "warning" : "neutral",
          },
        ]}
      />

      {/* ── Invite Form ── */}
      {showInvite && (
        <div className={cn(a.card, "rounded-2xl shadow-sm")}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  a.iconPrimary,
                  "w-8 h-8 rounded-lg flex items-center justify-center"
                )}
              >
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Invite a User
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Send an invite code to onboard a team member
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowInvite(false);
                setInviteResult(null);
              }}
              className="p-1.5 rounded-full hover:bg-muted/80 dark:hover:bg-muted/50 text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {inviteResult ? (
            <div className="p-6 text-center space-y-4">
              <div
                className={cn(
                  a.iconPositive,
                  "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                )}
              >
                <Check className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Invite Created
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Share this code with the user for{" "}
                  <span className="font-medium text-foreground">
                    {inviteResult.stream}
                  </span>
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <code
                  className={cn(
                    a.inset,
                    "px-4 py-2.5 text-lg font-bold tracking-[0.3em] rounded-xl text-foreground border"
                  )}
                >
                  {inviteResult.code}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteResult.code);
                    toast.success("Copied to clipboard");
                  }}
                  className={cn(
                    a.inset,
                    "p-2.5 rounded-lg text-muted-foreground transition-colors hover:text-foreground"
                  )}
                  title="Copy code"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setInviteResult(null)}
                  className={cn(
                    a.pillPrimary,
                    "px-4 py-2 text-xs font-medium rounded-lg border transition-colors hover:opacity-90"
                  )}
                >
                  Invite Another
                </button>
                <button
                  onClick={() => {
                    setShowInvite(false);
                    setInviteResult(null);
                  }}
                  className={cn(
                    a.pillNeutral,
                    "px-4 py-2 text-xs font-medium rounded-lg border transition-colors hover:text-foreground"
                  )}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                    Email <span className="text-destructive">*</span>
                    <span className="text-muted-foreground/65 ml-1">
                      (@hki.com)
                    </span>
                  </label>
                  <input
                    value={invEmail}
                    onChange={e => setInvEmail(e.target.value)}
                    placeholder="user@hki.com"
                    type="email"
                    className={inputCls}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                    Domain <span className="text-destructive">*</span>
                  </label>
                  <Select value={invStream} onValueChange={setInvStream}>
                    <SelectTrigger className="h-10 rounded-xl text-sm">
                      <SelectValue placeholder="Select domain..." />
                    </SelectTrigger>
                    <SelectContent className={ADMIN_POPOVER_PANEL_Z}>
                      {(streamsQ.data ?? [])
                        .filter((s: any) => s.id !== "global")
                        .map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.icon} {s.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                    Role
                  </label>
                  <Select
                    value={invRole}
                    onValueChange={value => setInvRole(value as AppRole)}
                  >
                    <SelectTrigger className="h-10 rounded-xl text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={ADMIN_POPOVER_PANEL_Z}>
                      {MANAGED_ROLES.map(role => (
                        <SelectItem key={role} value={role}>
                          {ROLE_METADATA[role].shortLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    {ROLE_METADATA[invRole].code} —{" "}
                    {ROLE_METADATA[invRole].description}
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                    Note (optional)
                  </label>
                  <input
                    value={invNote}
                    onChange={e => setInvNote(e.target.value)}
                    placeholder="Welcome to the team!"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => {
                    setShowInvite(false);
                    setInviteResult(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  disabled={!invEmail || !invStream || inviteMut.isPending}
                  onClick={() =>
                    inviteMut.mutate({
                      email: invEmail.trim(),
                      valueStreamId: invStream,
                      role: invRole as any,
                      note: invNote.trim() || undefined,
                    })
                  }
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {inviteMut.isPending && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  <Mail className="w-3 h-3" /> Send Invite
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or department..."
            className={cn(
              a.field,
              "w-full pl-9 pr-3 py-2 text-sm rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            )}
          />
        </div>
        <p className="text-xs text-muted-foreground/72">
          {usersQ.data?.total ?? 0} users
        </p>
      </div>

      <div
        className={cn(
          a.inset,
          "rounded-xl border px-4 py-3 text-xs text-muted-foreground"
        )}
      >
        Platform Admins manage enterprise role tiers here. Domain membership is
        managed separately in the Domains column and determines where a user is
        allowed to operate.
      </div>

      {/* Users table */}
      <HkiTable
        loading={usersQ.isLoading}
        loadingRows={6}
        loadingCols={6}
        emptyState={
          !usersQ.isLoading && (usersQ.data?.users ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <Users className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">
                No users found
              </p>
              <p className="text-xs text-muted-foreground">
                {search
                  ? `No results for "${search}"`
                  : "Users will appear here once they sign in."}
              </p>
            </div>
          ) : undefined
        }
      >
        <HkiThead sticky>
          <HkiTr noHover>
            <HkiTh>User</HkiTh>
            <HkiTh>Role</HkiTh>
            <HkiTh>Domains</HkiTh>
            <HkiTh>Last Active</HkiTh>
            <HkiTh align="center">Status</HkiTh>
            <HkiTh align="right">Actions</HkiTh>
          </HkiTr>
        </HkiThead>
        <HkiTbody>
          {(usersQ.data?.users ?? []).map((u: any) => {
            const isSelf = u.id === user?.id;
            return (
              <HkiTr
                key={u.id}
                className={cn(
                  "transition-all duration-300 hover:bg-muted/60 dark:hover:bg-muted/30",
                  !u.isActive && "opacity-50"
                )}
              >
                <HKITd>
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-primary-foreground font-semibold shrink-0 text-[11px]"
                      style={{ background: "var(--primary)" }}
                    >
                      {(u.name || u.email || "U").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {u.name || "Unnamed"}
                        {isSelf && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (you)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {u.email || "—"}
                      </div>
                    </div>
                  </div>
                </HKITd>
                <HKITd>
                  <RoleDropdown
                    userId={u.id}
                    currentRole={u.role}
                    isSelf={isSelf}
                  />
                </HKITd>
                <HKITd>
                  <div className="flex items-center gap-2">
                    {(u.assignedStreams ?? []).length > 0 ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        {(u.assignedStreams as string[])
                          .slice(0, 3)
                          .map((sid: string) => {
                            const stream = (streamsQ.data ?? []).find(
                              (s: any) => s.id === sid
                            );
                            return stream ? (
                              <span
                                key={sid}
                                className={cn(
                                  a.inset,
                                  "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md text-muted-foreground transition-all hover:-translate-y-px"
                                )}
                                title={stream.name}
                              >
                                {stream.icon} {stream.name}
                              </span>
                            ) : null;
                          })}
                        {(u.assignedStreams as string[]).length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{(u.assignedStreams as string[]).length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/65">
                        Global (default)
                      </span>
                    )}
                    <StreamAssignDropdown
                      userId={u.id}
                      current={u.assignedStreams ?? []}
                      allStreams={streamsQ.data ?? []}
                    />
                  </div>
                </HKITd>
                <HKITd className="text-xs text-muted-foreground">
                  {u.lastSignedIn
                    ? new Date(u.lastSignedIn).toLocaleDateString()
                    : "—"}
                </HKITd>
                <HKITd className="text-center">
                  <span
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-widest border",
                      u.isActive ? a.pillPositive : a.pillNeutral
                    )}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </HKITd>
                <HKITd className="text-right">
                  {!isSelf && (
                    <button
                      onClick={() => toggleActiveMut.mutate({ userId: u.id })}
                      className={cn(
                        "p-1.5 rounded-md transition-colors",
                        u.isActive
                          ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                      )}
                      title={u.isActive ? "Deactivate" : "Activate"}
                    >
                      {u.isActive ? (
                        <UserX className="w-3.5 h-3.5" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </HKITd>
              </HkiTr>
            );
          })}
        </HkiTbody>
      </HkiTable>
    </div>
  );
}
