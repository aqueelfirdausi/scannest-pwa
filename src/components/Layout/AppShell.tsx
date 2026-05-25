import React, { useState } from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import type { TabType } from './BottomNav';
import { HomeView } from '../../views/HomeView';
import { ScansHistoryView } from '../../views/ScansHistoryView';
import { SettingsView } from '../../views/SettingsView';
import { DocScanView } from '../../views/DocScanView';
import { QRScanView } from '../../views/QRScanView';
import { Check } from 'lucide-react';
import './AppShell.css';

export const AppShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [activeOverlay, setActiveOverlay] = useState<'doc_scan' | 'qr_scan' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const handleOpenDocScan = () => setActiveOverlay('doc_scan');
  const handleOpenQRScan = () => setActiveOverlay('qr_scan');
  const handleCloseOverlay = () => setActiveOverlay(null);

  const showToast = (message: string) => {
    setToast(message);
    // Automatically trigger slide out fade after 3.2 seconds
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  // Determine current main view content
  const renderActiveView = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeView 
            onScanDoc={handleOpenDocScan} 
            onScanQR={handleOpenQRScan} 
            onNavigateToHistory={() => setActiveTab('history')}
          />
        );
      case 'history':
        return <ScansHistoryView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <HomeView onScanDoc={handleOpenDocScan} onScanQR={handleOpenQRScan} onNavigateToHistory={() => setActiveTab('history')} />;
    }
  };

  // Determine appropriate title for Header
  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'home':
        return 'ScanNest';
      case 'history':
        return 'My Saved Scans';
      case 'settings':
        return 'Preferences';
      default:
        return 'ScanNest';
    }
  };

  return (
    <div className="app-shell-container flex-center">
      {/* Outer ambient details for premium desktop simulator context */}
      <div className="desktop-ambient-glow"></div>
      
      <div className="app-shell">
        <div className="app-screen">
          {/* Main Layout Layer */}
          <div className="main-layout-wrapper">
            <Header title={getHeaderTitle()} />
            
            <main className="app-content-area">
              {renderActiveView()}
            </main>
            
            <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />
          </div>

          {/* Fully Immersive Scanning Overlays */}
          {activeOverlay === 'doc_scan' && (
            <div className="overlay-view-wrapper">
              <DocScanView 
                onClose={handleCloseOverlay} 
                onSaveSuccess={() => {
                  setActiveTab('history'); // Automatically flip to My Scans history tab so they see it!
                  showToast('PDF compiled & saved to local vault!');
                }}
                onNavigateToSettings={() => {
                  handleCloseOverlay();
                  setActiveTab('settings');
                }}
              />
            </div>
          )}

          {activeOverlay === 'qr_scan' && (
            <div className="overlay-view-wrapper">
              <QRScanView 
                onClose={handleCloseOverlay} 
                onNavigateToSettings={() => {
                  handleCloseOverlay();
                  setActiveTab('settings');
                }}
              />
            </div>
          )}

          {/* Floating Slide-up Toast Alerts */}
          {toast && (
            <div className="app-toast flex-center animate-toast">
              <div className="toast-icon-circle flex-center">
                <Check size={14} />
              </div>
              <span className="toast-message-text">{toast}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
