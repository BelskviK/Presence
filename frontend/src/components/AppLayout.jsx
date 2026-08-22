import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import useAuthStore from "../store/authStore";
import useClock from "../hooks/useClock";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationBell from "./NotificationBell";
import Icon from "./Icon";

const NAV_MINE = [
  { to: "/", key: "common.dashboard", icon: "layout-dashboard", end: true },
  { to: "/attendance", key: "attendance.attendance", icon: "calendar-days" },
  { to: "/leave", key: "leave.leave", icon: "plane" },
  { to: "/salary", key: "salary.salary", icon: "wallet" },
];

const NAV_ADMIN = [
  {
    to: "/reports",
    key: "reports.reports",
    icon: "bar-chart-3",
    roles: ["MANAGER", "ADMIN"],
  },
  {
    to: "/employees",
    key: "employees.employees",
    icon: "users",
    roles: ["ADMIN"],
  },
  {
    to: "/geofences",
    key: "geofence.locations",
    icon: "map-pin",
    roles: ["ADMIN"],
  },
];

const ROUTE_META = {
  "/": ["common.dashboard", "common.dashboard"],
  "/attendance": ["attendance.attendance", "attendance.attendance"],
  "/leave": ["leave.leave", "leave.leave"],
  "/salary": ["salary.salary", "salary.salary"],
  "/profile": ["profile.profile", "profile.myProfile"],
  "/reports": ["reports.reports", "reports.reports"],
  "/employees": ["employees.employees", "employees.employees"],
  "/geofences": ["geofence.locations", "geofence.locations"],
};

export default function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";
  const clock = useClock(!isAdmin);

  const mineItems = NAV_MINE.filter(
    (item) => !isAdmin || item.to !== "/salary",
  );
  const adminItems = NAV_ADMIN.filter(
    (item) => !item.roles || item.roles.includes(user?.role),
  );

  const [crumbKey, titleKey] = ROUTE_META[location.pathname] || ROUTE_META["/"];

  const handleLogout = async () => {
    await logout();
    toast.success(t("auth.logoutSuccess"));
    navigate("/login");
  };

  const handleToggleClock = async () => {
    await clock.toggleClock();
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--color-bg)", color: "var(--color-text)" }}
    >
      <header
        className="sticky top-0 z-30 w-full"
        style={{
          background: "var(--color-bg)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 pb-2 flex items-center gap-2 sm:gap-4 flex-wrap">
          <div className="min-w-0" style={{ lineHeight: 1.2 }}>
            <div
              className="flex items-center gap-1.5 truncate"
              style={{
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--color-neutral-600)",
              }}
            >
              <Icon name="clock" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {t("common.moduleName")} ·{" "}
              </span>
              {t(crumbKey)}
            </div>
            <h3 className="mt-0.5 truncate text-lg sm:text-2xl">
              {t(titleKey)}
            </h3>
          </div>

          <div
            className="relative hidden lg:block"
            style={{ width: 220, marginInlineStart: 24 }}
          >
            <Icon
              name="search"
              className="w-4 h-4 absolute"
              style={{
                insetInlineStart: 9,
                top: 10,
                color: "var(--color-neutral-600)",
              }}
            />
            <input
              className="input"
              style={{ paddingInlineStart: 30 }}
              placeholder={t("common.search")}
            />
          </div>

          <div
            className="flex items-center gap-1 sm:gap-2.5"
            style={{ marginInlineStart: "auto" }}
          >
            {!isAdmin && (
              <div
                className="flex items-center gap-1 sm:gap-2"
                style={{
                  border: "1px solid var(--color-divider)",
                  borderRadius: 999,
                  background: "var(--color-neutral-100)",
                  padding: "4px 6px 4px 10px",
                }}
              >
                <span
                  className="livedot shrink-0"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: clock.isClockedIn
                      ? "var(--color-accent)"
                      : "var(--color-neutral-400)",
                  }}
                />
                <span
                  className="hidden sm:inline"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: 13,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {clock.isClockedIn
                    ? t("attendance.onShift")
                    : t("attendance.offShift")}
                </span>
                <button
                  className="btn btn-ghost whitespace-nowrap"
                  style={{ fontSize: 12, padding: "0 4px" }}
                  disabled={clock.busy}
                  onClick={handleToggleClock}
                >
                  {clock.busy
                    ? "…"
                    : clock.isClockedIn
                      ? t("attendance.clockOut")
                      : t("attendance.clockIn")}
                </button>
              </div>
            )}
            <NotificationBell />
            <LanguageSwitcher />
            <div
              className="flex items-center gap-1 sm:gap-2"
              style={{
                paddingInlineStart: 6,
                borderInlineStart: "1px solid var(--color-divider)",
              }}
            >
              <NavLink
                to="/profile"
                className="flex items-center gap-2"
                title={t("profile.myProfile")}
              >
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "var(--color-accent-100)",
                    color: "var(--color-accent-800)",
                    fontFamily: "var(--font-heading)",
                    fontSize: 11,
                  }}
                >
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </span>
                <span className="hidden lg:block" style={{ lineHeight: 1.2 }}>
                  <span
                    className="block"
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {user?.firstName} {user?.lastName}
                  </span>
                  <span
                    className="block"
                    style={{
                      fontSize: 10,
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                      color: "var(--color-neutral-600)",
                    }}
                  >
                    {user?.role}
                  </span>
                </span>
              </NavLink>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                style={{ width: 30, height: 30 }}
                title={t("common.logout")}
                onClick={handleLogout}
              >
                <Icon name="log-out" className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <nav className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 pb-3 flex items-center justify-center flex-wrap gap-1">
          {mineItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={t(item.key)}
              className={({ isActive }) => navClass(isActive)}
            >
              <Icon name={item.icon} className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t(item.key)}</span>
            </NavLink>
          ))}
          {adminItems.length > 0 && (
            <span
              style={{
                width: 1,
                height: 18,
                background: "var(--color-divider)",
                margin: "0 8px",
              }}
            />
          )}
          {adminItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={t(item.key)}
              className={({ isActive }) => navClass(isActive)}
            >
              <Icon name={item.icon} className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t(item.key)}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}

const navClass = (isActive) =>
  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
    isActive
      ? "font-medium bg-[var(--color-accent)] text-white shadow-[var(--shadow-sm)]"
      : "font-normal text-[var(--color-neutral-800)] hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)]"
  }`;
