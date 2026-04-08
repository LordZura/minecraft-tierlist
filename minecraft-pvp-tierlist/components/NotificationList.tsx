"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Notification = {
  id: string;
  type: string;
  related_id: string | null;
  message: string;
  read: boolean;
  created_at: string;
};

export function NotificationList() {
  const router = useRouter();
  const [myId, setMyId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      setMyId(data.user.id);
      loadNotifications(data.user.id);
    });
  }, []);

  async function loadNotifications(userId: string) {
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications(data ?? []);
    setLoading(false);
  }

  async function markAllRead() {
    if (!myId) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", myId)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleFightLogAction(
    notifId: string,
    fightLogId: string,
    action: "confirm" | "reject",
  ) {
    setActing(notifId);
    try {
      const res = await fetch(`/api/fight-log/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fight_log_id: fightLogId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Mark notification read and update local state
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)),
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActing(null);
    }
  }

  async function handleChallengeAction(
    notifId: string,
    challengeId: string,
    action: "accept" | "reject",
  ) {
    setActing(notifId);
    try {
      const res = await fetch("/api/challenge/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)),
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActing(null);
    }
  }

  const typeIcon: Record<string, string> = {
    fight_log_request: "⚔",
    challenge_request: "🏆",
    challenge_result: "📊",
    fight_log_confirmed: "✅",
    fight_log_rejected: "❌",
  };

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div>
      {/* Header actions */}
      {unread > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 12,
          }}
        >
          <button
            onClick={markAllRead}
            className="btn btn-ghost"
            style={{ fontSize: "0.8rem", padding: "6px 14px" }}
          >
            Mark all read
          </button>
        </div>
      )}

      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "var(--color-muted)",
          }}
        >
          <span className="font-pixel" style={{ fontSize: "1.5rem" }}>
            Loading…
          </span>
        </div>
      ) : notifications.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: "center" }}>
          <p
            className="font-pixel"
            style={{
              fontSize: "1.5rem",
              color: "var(--color-muted)",
              marginBottom: 8,
            }}
          >
            All clear
          </p>
          <p style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>
            No notifications yet.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifications.map((n) => {
            const isActing = acting === n.id;
            const needsAction =
              !n.read &&
              (n.type === "fight_log_request" ||
                n.type === "challenge_request");

            return (
              <div
                key={n.id}
                className="card"
                style={{
                  padding: "16px 20px",
                  borderColor: !n.read
                    ? "var(--color-border2)"
                    : "var(--color-border)",
                  background: !n.read
                    ? "var(--color-surface)"
                    : "rgba(8,12,8,0.6)",
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                  transition: "all 0.2s",
                }}
              >
                {/* Icon */}
                <div
                  style={{ fontSize: "1.4rem", flexShrink: 0, marginTop: 2 }}
                >
                  {typeIcon[n.type] ?? "🔔"}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontWeight: 600,
                          marginBottom: 4,
                          fontSize: "0.95rem",
                          color: n.read
                            ? "var(--color-text-dim)"
                            : "var(--color-text)",
                        }}
                      >
                        {n.message}
                      </p>
                      <p
                        className="font-mono"
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--color-muted)",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!n.read && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--color-green)",
                          flexShrink: 0,
                          marginTop: 6,
                          boxShadow: "0 0 6px rgba(74,222,128,0.5)",
                        }}
                      />
                    )}
                  </div>

                  {/* Actions */}
                  {needsAction && n.related_id && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      {n.type === "fight_log_request" && (
                        <>
                          <button
                            className="btn btn-primary"
                            disabled={isActing}
                            onClick={() =>
                              handleFightLogAction(
                                n.id,
                                n.related_id!,
                                "confirm",
                              )
                            }
                            style={{ padding: "6px 16px", fontSize: "0.8rem" }}
                          >
                            {isActing ? "…" : "✓ Confirm"}
                          </button>
                          <button
                            className="btn btn-danger"
                            disabled={isActing}
                            onClick={() =>
                              handleFightLogAction(
                                n.id,
                                n.related_id!,
                                "reject",
                              )
                            }
                            style={{ padding: "6px 16px", fontSize: "0.8rem" }}
                          >
                            {isActing ? "…" : "✗ Reject"}
                          </button>
                        </>
                      )}
                      {n.type === "challenge_request" && (
                        <>
                          <button
                            className="btn btn-primary"
                            disabled={isActing}
                            onClick={() =>
                              handleChallengeAction(
                                n.id,
                                n.related_id!,
                                "accept",
                              )
                            }
                            style={{
                              padding: "6px 16px",
                              fontSize: "0.8rem",
                              background: "var(--color-gold)",
                              borderColor: "var(--color-gold)",
                            }}
                          >
                            {isActing ? "…" : "🏆 Accept"}
                          </button>
                          <button
                            className="btn btn-danger"
                            disabled={isActing}
                            onClick={() =>
                              handleChallengeAction(
                                n.id,
                                n.related_id!,
                                "reject",
                              )
                            }
                            style={{ padding: "6px 16px", fontSize: "0.8rem" }}
                          >
                            {isActing ? "…" : "✗ Decline"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
