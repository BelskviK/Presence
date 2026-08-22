import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format, differenceInCalendarDays, addDays } from "date-fns";
import { dateLocale } from "../utils/dateLocale";
import toast from "react-hot-toast";
import useAuthStore from "../store/authStore";
import { leaveService } from "../services/leaveService";
import StatusBadge from "../components/StatusBadge";
import { useHighlight } from "../hooks/useHighlight";

const LEAVE_TYPES = [
  "VACATION",
  "SICK",
  "PERSONAL",
  "UNPAID",
  "MATERNITY",
  "OTHER",
];

function BalanceCard({ balance }) {
  const { t } = useTranslation();
  const total = Number(balance.totalAllowance) + Number(balance.carryover);
  const pips = Array.from({ length: total }, (_, i) => i < balance.used);
  return (
    <div className="card">
      <div
        style={{
          fontSize: 10,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--color-neutral-600)",
        }}
      >
        {t(`leave.leaveTypes.${balance.leaveType.toLowerCase()}`)}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 32,
            lineHeight: 1,
          }}
        >
          {Number(balance.remaining).toFixed(0)}
        </span>
        <span
          style={{
            fontSize: 12,
            whiteSpace: "nowrap",
            color: "var(--color-neutral-600)",
          }}
        >
          {t("leave.remaining").toLowerCase()} / {total}{" "}
          {t("time.days").toLowerCase()}
        </span>
      </div>
      <div className="flex gap-0.5 mt-1">
        {pips.map((used, i) => (
          <span
            key={i}
            style={{
              display: "block",
              flex: 1,
              height: 12,
              borderRadius: 999,
              background: used
                ? "var(--color-neutral-300)"
                : "var(--color-accent)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TeamAway() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);

  useEffect(() => {
    leaveService
      .getAllRequests("APPROVED")
      .then((all) => {
        const now = new Date();
        const horizon = addDays(now, 14);
        setItems(
          all
            .filter(
              (r) =>
                new Date(r.endDate) >= now && new Date(r.startDate) <= horizon,
            )
            .slice(0, 6),
        );
      })
      .catch(() => {});
  }, []);

  return (
    <div className="card blueprint">
      <h6 style={{ margin: 0, color: "var(--color-accent)" }}>
        {t("leave.teamAway")}
      </h6>
      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
          {t("reports.noData")}
        </p>
      ) : (
        items.map((o) => (
          <div
            key={o.id}
            className="flex items-center gap-2 py-1.5"
            style={{
              borderTop:
                "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
              fontSize: 12,
            }}
          >
            <span
              className="flex items-center justify-center shrink-0"
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "var(--color-neutral-200)",
                fontFamily: "var(--font-heading)",
                fontSize: 9,
              }}
            >
              {o.userId?.firstName?.[0]}
              {o.userId?.lastName?.[0]}
            </span>
            <span className="flex-1">
              {o.userId?.firstName} {o.userId?.lastName}
            </span>
            <span
              style={{
                whiteSpace: "nowrap",
                color: "var(--color-neutral-700)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {format(new Date(o.startDate), "MMM d", { locale: dateLocale() })}{" "}
              – {format(new Date(o.endDate), "MMM d", { locale: dateLocale() })}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function RequestForm({ onSubmitted }) {
  const { t } = useTranslation();
  const [leaveType, setLeaveType] = useState("VACATION");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const days =
    startDate && endDate
      ? Math.max(
          0,
          differenceInCalendarDays(new Date(endDate), new Date(startDate)) + 1,
        )
      : 0;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await leaveService.submitRequest({
        leaveType,
        startDate,
        endDate,
        reason,
      });
      toast.success(t("leave.requestSuccess"));
      setStartDate("");
      setEndDate("");
      setReason("");
      onSubmitted();
    } catch (err) {
      toast.error(err?.response?.data?.message || t("leave.requestFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card blueprint">
      <h4>{t("leave.leaveRequest")}</h4>
      <div className="field">
        <label>{t("leave.leaveType")}</label>
        <select
          className="input"
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value)}
        >
          {LEAVE_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`leave.leaveTypes.${type.toLowerCase()}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="field">
          <label>{t("leave.startDate")}</label>
          <input
            type="date"
            required
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label>{t("leave.endDate")}</label>
          <input
            type="date"
            required
            className="input"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      <div
        className="flex items-center justify-between"
        style={{
          border: "1px solid var(--color-divider)",
          borderRadius: 10,
          background: "var(--color-neutral-100)",
          padding: "8px 12px",
          fontSize: 12,
        }}
      >
        <span style={{ color: "var(--color-neutral-700)" }}>
          {t("leave.daysRequested")}
        </span>
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 17 }}>
          {days}
        </span>
      </div>
      <div className="field">
        <label>{t("leave.reason")}</label>
        <textarea
          required
          className="input"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="btn btn-primary btn-block blueprint"
        style={{ height: 40 }}
      >
        {busy ? t("common.loading") : t("leave.submitRequest")}
      </button>
    </form>
  );
}

export default function LeavePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canApprove = user?.role === "MANAGER" || user?.role === "ADMIN";
  const canRequestLeave = user?.role !== "ADMIN";

  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchParams] = useSearchParams();
  const highlightId = useHighlight();
  // Arriving from a notification, the request being pointed at may be in any
  // state, so start on "all" instead of the usual PENDING filter — otherwise the
  // row we want to show wouldn't be in the list at all.
  const [statusFilter, setStatusFilter] = useState(() =>
    searchParams.get("highlight") ? "" : "PENDING",
  );
  const [notesById, setNotesById] = useState({});
  const highlightRef = useRef(null);

  const load = useCallback(async () => {
    if (canRequestLeave) setBalances(await leaveService.getMyBalance());
    const list = canApprove
      ? await leaveService.getAllRequests(statusFilter || undefined)
      : await leaveService.getMyRequests();
    setRequests(list);
  }, [canRequestLeave, canApprove, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Bring the highlighted row into view once it has actually rendered.
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, requests]);

  const act = async (action, id) => {
    try {
      if (action === "approve") await leaveService.approve(id, notesById[id]);
      if (action === "reject") await leaveService.reject(id, notesById[id]);
      if (action === "cancel") await leaveService.cancel(id);
      toast.success(t("common.success"));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || t("errors.unexpectedError"));
    }
  };

  return (
    <div className="space-y-6">
      <section
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}
      >
        {canRequestLeave &&
          balances.map((b) => <BalanceCard key={b.id} balance={b} />)}
        {canApprove && <TeamAway />}
      </section>

      <div
        className={`grid gap-6 items-start grid-cols-1 ${canRequestLeave ? "lg:grid-cols-[320px_minmax(0,1fr)]" : ""}`}
      >
        {canRequestLeave && <RequestForm onSubmitted={load} />}

        <section className="card p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4>{t("leave.leave")}</h4>
            <span className="seg">
              <label className="seg-opt">
                <input
                  type="radio"
                  name="lv"
                  checked={statusFilter === "PENDING"}
                  onChange={() => setStatusFilter("PENDING")}
                />
                {t("leave.pending")}
              </label>
              <label className="seg-opt">
                <input
                  type="radio"
                  name="lv"
                  checked={statusFilter === "APPROVED"}
                  onChange={() => setStatusFilter("APPROVED")}
                />
                {t("leave.approved")}
              </label>
              <label className="seg-opt">
                <input
                  type="radio"
                  name="lv"
                  checked={statusFilter === ""}
                  onChange={() => setStatusFilter("")}
                />
                {t("common.all")}
              </label>
            </span>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="table mt-2">
              <thead>
                <tr>
                  {canApprove && <th>{t("employees.employees")}</th>}
                  <th>{t("leave.leaveType")}</th>
                  <th>{t("leave.startDate")}</th>
                  <th>{t("leave.daysRequested")}</th>
                  <th>{t("leave.status")}</th>
                  <th style={{ textAlign: "end" }}>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{ color: "var(--color-neutral-600)" }}
                    >
                      {t("reports.noData")}
                    </td>
                  </tr>
                )}
                {requests.map((r) => {
                  const requester =
                    typeof r.userId === "object" ? r.userId : null;
                  const isHighlighted = r.id === highlightId;
                  return (
                    <tr
                      key={r.id}
                      ref={isHighlighted ? highlightRef : null}
                      className={isHighlighted ? "highlight-flash" : undefined}
                    >
                      {canApprove && (
                        <td>
                          <span className="block" style={{ fontWeight: 500 }}>
                            {requester?.firstName} {requester?.lastName}
                          </span>
                          <span
                            className="block"
                            style={{
                              fontSize: 11,
                              color: "var(--color-neutral-600)",
                            }}
                          >
                            {r.reason}
                          </span>
                        </td>
                      )}
                      <td>
                        {t(`leave.leaveTypes.${r.leaveType.toLowerCase()}`)}
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>
                        {format(new Date(r.startDate), "MMM d", {
                          locale: dateLocale(),
                        })}{" "}
                        –{" "}
                        {format(new Date(r.endDate), "MMM d", {
                          locale: dateLocale(),
                        })}
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>
                        {r.daysRequested}
                      </td>
                      <td>
                        <StatusBadge
                          status={r.status}
                          label={t(`leave.${r.status.toLowerCase()}`)}
                        />
                      </td>
                      <td>
                        <span className="flex gap-1.5 justify-end flex-wrap">
                          {canApprove && r.status === "PENDING" && (
                            <>
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: 12, padding: "2px 9px" }}
                                onClick={() => act("approve", r.id)}
                              >
                                {t("leave.approveLeave")}
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: 12, padding: "2px 9px" }}
                                onClick={() => act("reject", r.id)}
                              >
                                {t("leave.rejectLeave")}
                              </button>
                            </>
                          )}
                          {!canApprove && r.status === "PENDING" && (
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: 12, padding: "2px 9px" }}
                              onClick={() => act("cancel", r.id)}
                            >
                              {t("common.cancel")}
                            </button>
                          )}
                          {r.status !== "PENDING" && r.approvalNotes && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--color-neutral-600)",
                              }}
                            >
                              {r.approvalNotes}
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
