import React from 'react';
import { Home, Files, Settings } from 'lucide-react';
import './BottomNav.css';

export type TabType = 'home' | 'history' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  const navItems = [
    { id: 'home' as TabType, label: 'Home', icon: Home },
    { id: 'history' as TabType, label: 'My Scans', icon: Files },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const IconComponent = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            id={`nav-btn-${item.id}`}
            onClick={() => onChangeTab(item.id)}
            className={`nav-item tap-target ${isActive ? 'active' : ''}`}
            aria-label={`Navigate to ${item.label}`}
          >
            <div className="nav-icon-container">
              <IconComponent 
                size={22} 
                strokeWidth={isActive ? 2.2 : 1.8} 
                className="nav-icon" 
              />
            </div>
            <span className="nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
