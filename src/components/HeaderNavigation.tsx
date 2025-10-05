'use client';

import { useState } from 'react';

interface User {
  id: string
  userType: string
  firstName: string
  lastName: string
  email: string
}

interface HeaderNavigationProps {
  user: User;
  logout: () => void;
}

const HeaderNavigation: React.FC<HeaderNavigationProps> = ({ user, logout }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const getNavigationLinks = () => {
    switch (user.userType) {
      // case 'ENFORCER':
      //   return [
      //     { href: '/dashboard', label: 'Dashboard', icon: '📊' },
      //     { href: '/incidents', label: 'Incidents', icon: '🚨' },
      //     { href: '/report', label: 'Report Incident', icon: '📝' },
      //   ];
      case 'PUBLIC':
        return [
          { href: '/dashboard', label: 'Dashboard', icon: '📊' },
          { href: '/calculator', label: 'Fare Calculator', icon: '🧮' },
          { href: '/report', label: 'Report Incident', icon: '📝' },
        ];
      default:
        return [];
    }
  };

  const navigationLinks = getNavigationLinks();

  if (navigationLinks.length === 0) {
    // For ADMIN and DATA_ENCODER, just show user menu
    return (
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-2 text-gray-700 hover:text-emerald-600 transition-colors focus:outline-none"
        >
          <span className="text-lg">👤</span>
          <span className="hidden sm:inline font-medium">{user.firstName || user.email}</span>
          <svg
            className="w-4 h-4 transition-transform duration-200"
            style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
              <div className="font-medium">{user.firstName} {user.lastName}</div>
              <div className="text-xs text-gray-400">{user.email}</div>
              <div className="text-xs text-emerald-600 font-medium">{user.userType}</div>
            </div>
            <button
              onClick={logout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              🚪 Logout
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-6">
      {/* Navigation Links for desktop screens */}
      <div className="hidden lg:flex items-center space-x-4">
        {navigationLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="flex items-center space-x-1 text-gray-600 hover:text-emerald-600 transition-colors px-3 py-2 rounded-md hover:bg-emerald-50"
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </a>
        ))}
      </div>

      {/* Mobile Navigation Dropdown */}
      <div className="lg:hidden relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-2 text-gray-700 hover:text-emerald-600 transition-colors focus:outline-none"
        >
          <span className="text-lg">☰</span>
          <span className="hidden sm:inline">Menu</span>
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
              <div className="font-medium">{user.firstName} {user.lastName}</div>
              <div className="text-xs text-gray-400">{user.email}</div>
              <div className="text-xs text-emerald-600 font-medium">{user.userType}</div>
            </div>
            {navigationLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                onClick={() => setIsDropdownOpen(false)}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </a>
            ))}
            <div className="border-t border-gray-100 mt-2 pt-2">
              <button
                onClick={logout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center space-x-3"
              >
                <span>🚪</span>
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Menu for Desktop */}
      <div className="hidden lg:block relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-2 text-gray-700 hover:text-emerald-600 transition-colors focus:outline-none"
        >
          <span className="text-lg">👤</span>
          <span className="hidden sm:inline font-medium">{user.firstName || user.email}</span>
          <svg
            className="w-4 h-4 transition-transform duration-200"
            style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
              <div className="font-medium">{user.firstName} {user.lastName}</div>
              <div className="text-xs text-gray-400">{user.email}</div>
              <div className="text-xs text-emerald-600 font-medium">{user.userType}</div>
            </div>
            <a
              href="/dashboard/profile"
              className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
            >
              <span>👤</span>
              <span>Profile</span>
            </a>
            <button
              onClick={logout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center space-x-3"
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeaderNavigation;