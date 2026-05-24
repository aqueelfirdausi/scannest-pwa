import React from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import './Header.css';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, onBack, showBack = false }) => {
  return (
    <header className="app-header">
      <div className="header-left">
        {showBack ? (
          <button 
            id="header-btn-back"
            onClick={onBack} 
            className="header-action-btn tap-target"
            aria-label="Go back"
          >
            <ArrowLeft size={20} className="icon" />
          </button>
        ) : (
          <div className="app-brand flex-center">
            <span className="brand-dot"></span>
            <h1 className="brand-title">{title}</h1>
          </div>
        )}
      </div>
      
      <div className="header-right flex-center">
        <div className="status-badge flex-center" title="All scans remain private on this device">
          <ShieldCheck size={14} className="badge-icon" />
          <span className="badge-text">Local-Only</span>
          <span className="pulse-dot"></span>
        </div>
      </div>
    </header>
  );
};
