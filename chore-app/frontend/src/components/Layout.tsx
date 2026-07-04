import { NavLink, Outlet } from "react-router-dom"
import { ClipboardList, Calendar, BarChart3, Users, LogOut } from "lucide-react"
import { useAuth } from "../hooks/useAuth"
import NotificationBell from "./NotificationBell"

const navItems = [
  { to: "/", icon: ClipboardList, label: "תורנויות" },
  { to: "/calendar", icon: Calendar, label: "יומן" },
  { to: "/reports", icon: BarChart3, label: "דוחות" },
]

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed inset-y-0 right-0 z-30">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold text-indigo-400">מנהל תורנויות</h1>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/team"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <Users size={18} />
              צוות
            </NavLink>
          )}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400">
                {user?.role === "ADMIN" ? "מנהל" : "חבר צוות"}
              </p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title="התנתק"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 mr-64 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20">
          <h2 className="text-lg font-semibold text-slate-800">ניהול תורנויות משרדיות</h2>
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
