import { NavLink, Outlet } from "react-router-dom"
import {
  LayoutDashboard,
  Users2,
  CheckSquare,
  FlaskConical,
  Calendar,
  GraduationCap,
  UsersRound,
  Users,
  Workflow,
  LogOut
} from "lucide-react"
import { useAuth } from "../hooks/useAuth"
import NotificationBell from "./NotificationBell"

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "דשבורד" },
  { to: "/leads", icon: Users2, label: "לידים" },
  { to: "/tasks", icon: CheckSquare, label: "משימות" },
  { to: "/trial-lessons", icon: FlaskConical, label: "שיעורי ניסיון" },
  { to: "/calendar", icon: Calendar, label: "יומן" },
  { to: "/students", icon: GraduationCap, label: "תלמידים" },
  { to: "/groups", icon: UsersRound, label: "קבוצות" },
]

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()

  return (
    <div className="flex h-screen bg-[var(--color-bg)]">
      <aside className="w-64 bg-[var(--color-nav-bg)] text-white flex flex-col fixed inset-y-0 right-0 z-30">
        <div className="p-6 border-b border-[var(--color-nav-border)]">
          <h1 className="text-xl font-[var(--font-serif)] font-semibold text-[var(--color-gold)]">INNOKIDS</h1>
          <p className="text-xs text-[var(--color-nav-text)] mt-1">מערכת ניהול</p>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-item ${isActive ? "nav-item--active" : ""}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <>
              <NavLink
                to="/team"
                className={({ isActive }) =>
                  `nav-item ${isActive ? "nav-item--active" : ""}`
                }
              >
                <Users size={18} />
                צוות
              </NavLink>
              <NavLink
                to="/automation"
                className={({ isActive }) =>
                  `nav-item ${isActive ? "nav-item--active" : ""}`
                }
              >
                <Workflow size={18} />
                אוטומציות
              </NavLink>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-[var(--color-nav-border)]">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-[var(--color-nav-text)]">
                {user?.role === "ADMIN" ? "מנהל" : "צוות"}
              </p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-[var(--color-nav-text)] hover:text-white transition-colors"
              title="התנתק"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 mr-64 flex flex-col">
        <header className="h-16 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between px-6 sticky top-0 z-20">
          <h2 className="text-lg font-[var(--font-serif)] font-semibold text-[var(--color-text-primary)]">INNOKIDS CRM</h2>
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
