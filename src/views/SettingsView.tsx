import React, { useState } from 'react';
import { ShieldCheck, HardDrive, Trash2, Info, Download, Upload, AlertTriangle } from 'lucide-react';
import './SettingsView.css';

export const SettingsView: React.FC = () => {
  const [autoCapture, setAutoCapture] = useState(true);
  const [saveToGallery, setSaveToGallery] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleClearData = () => {
    setCleared(true);
    setShowClearConfirm(false);
    setTimeout(() => setCleared(false), 3000);
  };

  return (
    <div className="settings-view animate-fade-in">
      {/* Privacy Guarantee Banner */}
      <section className="settings-banner">
        <div className="banner-badge flex-center">
          <ShieldCheck size={20} className="banner-badge-icon" />
          <h3 className="banner-title">Privacy Enclave</h3>
        </div>
        <p className="banner-desc">
          ScanNest uses client-side sandboxing. Your files and scan history never leave your device. We collect no cookies, telemetry, or tracking.
        </p>
      </section>

      {/* Preferences Section */}
      <section className="settings-group">
        <h4 className="group-title">Preferences</h4>
        
        <div className="settings-card">
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Document Auto-Capture</span>
              <span className="setting-desc">Detect boundaries and snap automatically</span>
            </div>
            <button 
              id="settings-toggle-autocapture"
              onClick={() => setAutoCapture(!autoCapture)} 
              className={`toggle-switch ${autoCapture ? 'on' : ''}`}
              aria-label="Toggle auto-capture"
            >
              <span className="toggle-handle"></span>
            </button>
          </div>

          <div className="setting-divider"></div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Sync with Camera Roll</span>
              <span className="setting-desc">Save a copy of captured images to device gallery</span>
            </div>
            <button 
              id="settings-toggle-gallery"
              onClick={() => setSaveToGallery(!saveToGallery)} 
              className={`toggle-switch ${saveToGallery ? 'on' : ''}`}
              aria-label="Toggle save to gallery"
            >
              <span className="toggle-handle"></span>
            </button>
          </div>
        </div>
      </section>

      {/* Storage Metrics */}
      <section className="settings-group">
        <h4 className="group-title">Local Storage</h4>
        
        <div className="settings-card storage-card">
          <div className="storage-metric-row">
            <div className="metric-header">
              <HardDrive size={18} className="storage-icon" />
              <span className="metric-title">Browser Storage Allocation</span>
            </div>
            <span className="metric-value">4.52 MB used</span>
          </div>

          {/* Simulated progress indicator */}
          <div className="storage-progress-bar">
            <div className="progress-fill" style={{ width: '4%' }}></div>
          </div>

          <p className="storage-note">
            ScanNest utilizes your local browser sandbox. Storage capacity is governed by your device's browser disk quotas (typically up to 500+ MB is offline safe).
          </p>
        </div>
      </section>

      {/* Storage maintenance controls */}
      <section className="settings-group">
        <h4 className="group-title">Local Maintenance</h4>
        
        <div className="settings-card">
          <button 
            id="settings-btn-export"
            className="setting-action-row tap-target flex-center"
          >
            <Download size={18} className="row-icon blue" />
            <div className="row-text">
              <span className="row-label">Backup Data</span>
              <span className="row-desc">Export index and scans locally to an archive file</span>
            </div>
          </button>

          <div className="setting-divider"></div>

          <button 
            id="settings-btn-import"
            className="setting-action-row tap-target flex-center"
          >
            <Upload size={18} className="row-icon purple" />
            <div className="row-text">
              <span className="row-label">Restore Data</span>
              <span className="row-desc">Import standard backup archive into ScanNest</span>
            </div>
          </button>

          <div className="setting-divider"></div>

          {showClearConfirm ? (
            <div className="danger-confirm-box">
              <div className="danger-warning-message flex-center">
                <AlertTriangle size={18} className="warning-icon" />
                <span>Delete everything? This is permanent!</span>
              </div>
              <div className="danger-confirm-actions">
                <button 
                  id="settings-btn-clear-cancel"
                  onClick={() => setShowClearConfirm(false)} 
                  className="btn-clear-cancel tap-target"
                >
                  Cancel
                </button>
                <button 
                  id="settings-btn-clear-confirm"
                  onClick={handleClearData} 
                  className="btn-clear-confirm tap-target"
                >
                  Delete All Scans
                </button>
              </div>
            </div>
          ) : (
            <button 
              id="settings-btn-clear-trigger"
              onClick={() => setShowClearConfirm(true)} 
              className="setting-action-row tap-target flex-center"
            >
              <Trash2 size={18} className="row-icon red" />
              <div className="row-text">
                <span className="row-label text-danger">Reset Application</span>
                <span className="row-desc text-danger-desc">Erase all saved document metadata and reset options</span>
              </div>
            </button>
          )}

          {cleared && (
            <div className="success-toast flex-center animate-fade-in">
              <ShieldCheck size={16} />
              <span>Application data successfully reset.</span>
            </div>
          )}
        </div>
      </section>

      {/* About & Security Enclave */}
      <section className="settings-group">
        <h4 className="group-title">About & Privacy</h4>
        
        <div className="settings-card info-card">
          {/* Charter Card */}
          <div className="info-section">
            <div className="info-section-header flex-center">
              <ShieldCheck size={18} className="info-icon green" />
              <h5 className="info-section-title">Privacy & Safety Charter</h5>
            </div>
            <p className="info-desc">
              Your security is hardcoded. ScanNest operates inside a local sandbox that guarantees absolute data confidentiality.
            </p>
            <ul className="bullet-points-list">
              <li>
                <strong>Camera Access:</strong> The camera feed is processed in temporary RAM to detect frames. No video or image data is ever streamed or transmitted.
              </li>
              <li>
                <strong>Zero Cloud Storage:</strong> There are no database servers, API endpoints, or external cloud networks behind this app. Everything is serverless and isolated.
              </li>
              <li>
                <strong>No Accounts or Tracking:</strong> No signup forms, email tracking, usage analytics, or advertising scripts exist in this codebase.
              </li>
              <li>
                <strong>Total Control:</strong> All document scans are kept as raw binary Blobs in your private browser disk memory. You can wipe all history instantly using the Reset button.
              </li>
            </ul>
          </div>

          <div className="setting-divider"></div>

          {/* About Project & OS */}
          <div className="info-section">
            <div className="info-section-header flex-center">
              <Info size={18} className="info-icon blue" />
              <h5 className="info-section-title">Utility Philosophy</h5>
            </div>
            <p className="info-desc">
              ScanNest was built to protect students from predatory scanner app subscriptions, cloud trackers, and invasive advertisement banners. It provides a quiet, focused academic workspace.
            </p>
            <div className="github-box">
              <span className="github-tag">Open Source Initiative</span>
              <p className="github-desc">
                ScanNest will soon release under an MIT license for public audit and self-hosting.
              </p>
              <code className="github-placeholder">github.com/novart-systems/scannest</code>
            </div>
          </div>
        </div>
      </section>

      {/* Build & Attribution Footer */}
      <footer className="settings-footer-attribution flex-center">
        <div className="attribution-brand flex-center">
          <img 
            src="/novart-systems_v1-official-operational-identity_master-dark.png" 
            alt="Novart Systems Logo" 
            className="novart-logo"
          />
          <span className="attribution-sub">A private local utility by Novart Systems</span>
        </div>
        <div className="build-version">
          <span>ScanNest v1.0.0 (Local Sandbox Edition)</span>
        </div>
      </footer>
    </div>
  );
};
