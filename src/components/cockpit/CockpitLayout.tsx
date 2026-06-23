import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { signOut } from '@/lib/supabase';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/cockpit', icon: '📊', end: true },
  { label: 'Creators', to: '/cockpit/creators', icon: '🎬' },
  { label: 'Assessment Templates', to: '/cockpit/settings/assessment-templates', icon: '⚙' },
];

export function CockpitLayout() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/cockpit');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-surface border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-gray-200">
          <h1 className="font-display font-bold text-lg text-accent">Creators Cockpit</h1>
          <p className="text-xs text-gray-500 mt-1">Agency Control Plane</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-surface-3 text-accent font-medium'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-surface-2'
                }`
              }
            >
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-surface-2 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

