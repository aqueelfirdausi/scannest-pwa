import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, HardDrive, Trash2, Info, Download, Upload, AlertTriangle,
  Camera, CheckCircle2, XCircle, RefreshCw, Wrench, RotateCcw, ChevronRight
} from 'lucide-react';
import { clearAllScans } from '../services/db';
import './SettingsView.css';

// ─── Camera preference stored in localStorage ─────────────────────────────────
const PREF_KEY = 'scannest_camera_pref';
type CameraPref = 'auto' | 'environment' | 'user';

function loadCameraPref(): CameraPref {
  try {
    const stored = localStorage.getItem(PREF_KEY);
    if (stored === 'environment' || stored === 'user' || stored === 'auto') return stored;
  } catch (_) { /* ignore */ }
  return 'auto';
}

function saveCameraPref(pref: CameraPref) {
  try { localStorage.setItem(PREF_KEY, pref); } catch (_) { /* ignore */ }
}

// ─── Camera environment diagnostics ───────────────────────────────────────────
interface CameraEnv {
  secureContext: boolean;
  mediaDevicesAvailable: boolean;
  getUserMediaAvailable: boolean;
}

function getCameraEnv(): CameraEnv {
  return {
    secureContext: typeof window !== 'undefined' && (window.isSecureContext ?? false),
    mediaDevicesAvailable: typeof navigator !== 'undefined' && !!navigator.mediaDevices,
    getUserMediaAvailable: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  };
}

function resolveTestError(err: any): string {
  const name: string = err?.name ?? '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
    return 'Permission denied or blocked. Go to browser site settings and allow camera for this site, then retry.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
    return 'No camera found on this device. Check that a camera is connected and not blocked.';
  if (name === 'NotReadableError' || name === 'TrackStartError')
    return 'Camera is already in use by another app or tab. Close them and retry.';
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError')
    return 'Camera constraint issue. The device camera could not satisfy the request.';
  if (name === 'SecurityError')
    return 'Blocked by a browser security policy. Ensure this app is accessed over HTTPS.';
  return `Camera test failed (${name || 'unknown error'}). Close other camera apps and retry.`;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export const SettingsView: React.FC = () => {
  // ── Existing settings state ──
  const [autoCapture, setAutoCapture] = useState(true);
  const [saveToGallery, setSaveToGallery] = useState(false);

  // ── Camera preference ──
  const [cameraPref, setCameraPref] = useState<CameraPref>(loadCameraPref);
  const handleCameraPref = (pref: CameraPref) => {
    setCameraPref(pref);
    saveCameraPref(pref);
  };

  // ── Camera diagnostics ──
  const [cameraEnv] = useState<CameraEnv>(getCameraEnv);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');

  const handleCameraTest = async () => {
    if (!cameraEnv.secureContext) {
      setTestStatus('fail');
      setTestMessage('Insecure context — camera requires HTTPS. Access this app via its HTTPS URL.');
      return;
    }
    if (!cameraEnv.getUserMediaAvailable) {
      setTestStatus('fail');
      setTestMessage('Your browser does not support camera access (getUserMedia unavailable).');
      return;
    }

    setTestStatus('testing');
    setTestMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop immediately — we only verify access, never keep the stream
      stream.getTracks().forEach(t => t.stop());
      setTestStatus('ok');
      setTestMessage('Camera access is working on this device.');
    } catch (err: any) {
      setTestStatus('fail');
      setTestMessage(resolveTestError(err));
    }
  };

  // ── Local data reset ──
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<'idle' | 'success' | 'fail'>('idle');

  const handleClearData = async () => {
    setClearing(true);
    setClearResult('idle');
    try {
      // 1. Clear all IndexedDB scan records
      await clearAllScans();

      // 2. Clear localStorage (camera preference will reset too — that's fine)
      try { localStorage.clear(); } catch (_) { /* ignore */ }

      // 3. Clear sessionStorage
      try { sessionStorage.clear(); } catch (_) { /* ignore */ }

      // 4. Clear Cache Storage entries created by ScanNest service worker
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(k => caches.delete(k)));
      }

      // 5. Unregister service worker so fresh registration happens on reload
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }

      setClearing(false);
      setClearResult('success');
      setShowClearConfirm(false);
    } catch (err) {
      console.error('[ScanNest Settings] Data clear failed:', err);
      setClearing(false);
      setClearResult('fail');
      setShowClearConfirm(false);
    }
  };

  const handleReload = () => {
    // Small delay after SW unregister so new SW can be fetched cleanly
    setTimeout(() => window.location.reload(), 300);
  };

  // Auto-dismiss test result after 8 s so UI doesn't get stale
  useEffect(() => {
    if (testStatus === 'ok' || testStatus === 'fail') {
      const t = setTimeout(() => setTestStatus('idle'), 8000);
      return () => clearTimeout(t);
    }
  }, [testStatus]);

  const env = cameraEnv;

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

          <div className="setting-divider"></div>

          {/* Camera Preference */}
          <div className="setting-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '10px' }}>
            <div className="setting-info" style={{ maxWidth: '100%' }}>
              <span className="setting-label">Preferred Camera</span>
              <span className="setting-desc">Which camera to open first when scanning</span>
            </div>
            <div className="cam-pref-pill-row">
              {(['auto', 'environment', 'user'] as CameraPref[]).map((opt) => (
                <button
                  key={opt}
                  id={`settings-cam-pref-${opt}`}
                  onClick={() => handleCameraPref(opt)}
                  className={`cam-pref-pill ${cameraPref === opt ? 'active' : ''}`}
                >
                  {opt === 'auto' ? 'Auto' : opt === 'environment' ? 'Rear' : 'Front'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TROUBLESHOOTING & DEVICE ACCESS ─────────────────────────────────── */}
      <section className="settings-group">
        <h4 className="group-title">Troubleshooting &amp; Device Access</h4>

        {/* 1. Camera Access Check */}
        <div className="settings-card">
          <div className="trouble-section-header flex-center">
            <div className="trouble-icon-wrap flex-center">
              <Camera size={16} />
            </div>
            <div>
              <span className="trouble-section-title">Camera Access Check</span>
              <span className="trouble-section-desc">Verify your browser can reach the camera</span>
            </div>
          </div>

          <div className="cam-env-list">
            <div className="cam-env-row">
              {env.secureContext
                ? <CheckCircle2 size={14} className="env-ok" />
                : <XCircle size={14} className="env-fail" />}
              <span className="env-label">Secure context (HTTPS)</span>
              <span className={`env-badge ${env.secureContext ? 'ok' : 'fail'}`}>
                {env.secureContext ? 'Active' : 'Missing'}
              </span>
            </div>
            <div className="cam-env-row">
              {env.mediaDevicesAvailable
                ? <CheckCircle2 size={14} className="env-ok" />
                : <XCircle size={14} className="env-fail" />}
              <span className="env-label">navigator.mediaDevices</span>
              <span className={`env-badge ${env.mediaDevicesAvailable ? 'ok' : 'fail'}`}>
                {env.mediaDevicesAvailable ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <div className="cam-env-row">
              {env.getUserMediaAvailable
                ? <CheckCircle2 size={14} className="env-ok" />
                : <XCircle size={14} className="env-fail" />}
              <span className="env-label">getUserMedia API</span>
              <span className={`env-badge ${env.getUserMediaAvailable ? 'ok' : 'fail'}`}>
                {env.getUserMediaAvailable ? 'Supported' : 'Unsupported'}
              </span>
            </div>
          </div>

          <div className="trouble-btn-row">
            <button
              id="settings-btn-camera-test"
              onClick={handleCameraTest}
              disabled={testStatus === 'testing'}
              className="trouble-action-btn flex-center"
            >
              {testStatus === 'testing'
                ? <><RefreshCw size={14} className="spin-icon" /><span>Testing…</span></>
                : <><Camera size={14} /><span>Test camera access</span></>}
            </button>
          </div>

          {testStatus === 'ok' && (
            <div className="trouble-result ok flex-center animate-fade-in">
              <CheckCircle2 size={15} />
              <span>{testMessage}</span>
            </div>
          )}
          {testStatus === 'fail' && (
            <div className="trouble-result fail flex-center animate-fade-in">
              <XCircle size={15} />
              <span>{testMessage}</span>
            </div>
          )}
        </div>

        {/* 2. Camera Reset Guidance */}
        <div className="settings-card guidance-card">
          <div className="trouble-section-header flex-center">
            <div className="trouble-icon-wrap flex-center" style={{ background: 'rgba(245,158,11,0.12)', color: '#d97706' }}>
              <Wrench size={16} />
            </div>
            <div>
              <span className="trouble-section-title">Camera Permission Guidance</span>
              <span className="trouble-section-desc">How to fix blocked camera access</span>
            </div>
          </div>

          <p className="guidance-note">
            Camera permissions are managed by your browser — ScanNest cannot override them directly.
            Uninstalling a PWA does <strong>not</strong> always reset browser site permissions.
          </p>

          <div className="guidance-step-list">
            <div className="guidance-step">
              <ChevronRight size={13} className="step-chevron" />
              <div>
                <span className="step-platform">Android Chrome (quick way)</span>
                <span className="step-body">Open this site in Chrome → tap the lock / info icon in the address bar → Permissions → Camera → Allow.</span>
              </div>
            </div>
            <div className="guidance-step">
              <ChevronRight size={13} className="step-chevron" />
              <div>
                <span className="step-platform">Android Chrome (full reset)</span>
                <span className="step-body">Chrome menu → Settings → Site settings → Camera → find this site → set to Allow or Reset.</span>
              </div>
            </div>
            <div className="guidance-step">
              <ChevronRight size={13} className="step-chevron" />
              <div>
                <span className="step-platform">Safari on iOS</span>
                <span className="step-body">iOS Settings → Safari → Camera → Allow. Or Settings → Privacy &amp; Security → Camera → ensure Safari is on.</span>
              </div>
            </div>
            <div className="guidance-step">
              <ChevronRight size={13} className="step-chevron" />
              <div>
                <span className="step-platform">After reinstalling PWA</span>
                <span className="step-body">First uninstall the PWA, then go to Chrome site settings and reset camera permission, then reinstall the PWA.</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Local Data Reset */}
        <div className="settings-card">
          <div className="trouble-section-header flex-center">
            <div className="trouble-icon-wrap flex-center" style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
              <Trash2 size={16} />
            </div>
            <div>
              <span className="trouble-section-title">Clear Local ScanNest Data</span>
              <span className="trouble-section-desc">Wipe cached data, saved scans, and service worker</span>
            </div>
          </div>

          <p className="guidance-note">
            This clears: all saved scan records from IndexedDB, Cache Storage entries from the service worker, and localStorage/sessionStorage. The service worker will also be unregistered so it re-installs cleanly on next load. <strong>This cannot be undone.</strong>
          </p>

          {!showClearConfirm && clearResult === 'idle' && (
            <div className="trouble-btn-row">
              <button
                id="settings-btn-clear-trigger"
                onClick={() => setShowClearConfirm(true)}
                className="trouble-action-btn danger flex-center"
              >
                <Trash2 size={14} />
                <span>Clear local ScanNest data</span>
              </button>
            </div>
          )}

          {showClearConfirm && (
            <div className="danger-confirm-box animate-fade-in">
              <div className="danger-warning-message flex-center">
                <AlertTriangle size={18} className="warning-icon" />
                <span>Clear local scans and app cache from this device? This cannot be undone.</span>
              </div>
              <div className="danger-confirm-actions">
                <button
                  id="settings-btn-clear-cancel"
                  onClick={() => setShowClearConfirm(false)}
                  className="btn-clear-cancel tap-target"
                  disabled={clearing}
                >
                  Cancel
                </button>
                <button
                  id="settings-btn-clear-confirm"
                  onClick={handleClearData}
                  className="btn-clear-confirm tap-target flex-center"
                  disabled={clearing}
                >
                  {clearing
                    ? <><RefreshCw size={13} className="spin-icon" /><span>Clearing…</span></>
                    : <span>Yes, clear everything</span>}
                </button>
              </div>
            </div>
          )}

          {clearResult === 'success' && (
            <div className="trouble-result ok flex-center animate-fade-in" style={{ margin: '12px 16px' }}>
              <CheckCircle2 size={15} />
              <span>All local ScanNest data cleared. Close and reopen the app for a fresh start.</span>
            </div>
          )}
          {clearResult === 'fail' && (
            <div className="trouble-result fail flex-center animate-fade-in" style={{ margin: '12px 16px' }}>
              <XCircle size={15} />
              <span>Some data could not be cleared. Try manually clearing site data from your browser settings.</span>
            </div>
          )}

          {/* 4. App Reload */}
          {clearResult === 'success' && (
            <div className="trouble-btn-row animate-fade-in">
              <button
                id="settings-btn-reload"
                onClick={handleReload}
                className="trouble-action-btn flex-center"
              >
                <RotateCcw size={14} />
                <span>Reload app</span>
              </button>
            </div>
          )}
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
          <button id="settings-btn-export" className="setting-action-row tap-target flex-center">
            <Download size={18} className="row-icon blue" />
            <div className="row-text">
              <span className="row-label">Backup Data</span>
              <span className="row-desc">Export index and scans locally to an archive file</span>
            </div>
          </button>

          <div className="setting-divider"></div>

          <button id="settings-btn-import" className="setting-action-row tap-target flex-center">
            <Upload size={18} className="row-icon purple" />
            <div className="row-text">
              <span className="row-label">Restore Data</span>
              <span className="row-desc">Import standard backup archive into ScanNest</span>
            </div>
          </button>
        </div>
      </section>

      {/* About & Security Enclave */}
      <section className="settings-group">
        <h4 className="group-title">About &amp; Privacy</h4>
        <div className="settings-card info-card">
          <div className="info-section">
            <div className="info-section-header flex-center">
              <ShieldCheck size={18} className="info-icon green" />
              <h5 className="info-section-title">Privacy &amp; Safety Charter</h5>
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
