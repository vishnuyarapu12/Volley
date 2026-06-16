import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Sparkles, User, LogOut, Moon, Sun, Users, Trophy } from 'lucide-react';

export default function Navigation({ darkMode, onToggleDarkMode, onLogout }) {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/', icon: Sparkles, label: 'Moments' },
    { path: '/dashboard', icon: Activity, label: 'Dashboard' },
    { path: '/players', icon: Users, label: 'Players' },
    { path: '/team', icon: Trophy, label: 'Score Board' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-volleyball-dark border-t border-white/20 z-40 mobile-menu"
      style={{ '--app-nav-height': '4.5rem' }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex gap-2 flex-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-all ${
                isActive(path)
                  ? 'text-volleyball-accent bg-white/10'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title={label}
            >
              <Icon size={20} />
              <span className="text-xs">{label}</span>
            </Link>
          ))}
        </div>

        <div className="flex gap-2 ml-2 border-l border-white/20 pl-2">
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-lg text-gray-400 hover:text-volleyball-accent hover:bg-white/10 transition-all"
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <button
            onClick={onLogout}
            className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
}
