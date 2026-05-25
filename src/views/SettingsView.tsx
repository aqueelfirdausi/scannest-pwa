import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, HardDrive, Trash2, Info, Download, Upload, AlertTriangle,
  Camera, CheckCircle2, XCircle, RefreshCw, RotateCcw, ChevronRight, ExternalLink
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
  const [permissionState, setPermissionState] = useState<'granted' | 'prompt' | 'denied' | 'unknown'>('unknown');
  const [lastCameraError, setLastCameraError] = useState<string | null>(null);

  // Monitor device permission query availability
  useEffect(() => {
    try {
      const lastError = localStorage.getItem('scannest_last_camera_error');
      if (lastError) setLastCameraError(lastError);
    } catch (_) {}

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' as PermissionName })
        .then((status) => {
          setPermissionState(status.state as any);
          status.onchange = () => {
            setPermissionState(status.state as any);
          };
        })
        .catch(() => {
          setPermissionState('unknown');
        });
    } else {
      setPermissionState('unknown');
    }
  }, []);

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
      // Immediately stop all tracks to release device hardware
      stream.getTracks().forEach(t => t.stop());
      setTestStatus('ok');
      setTestMessage('Camera access is working on this device.');
      
      // Update permission state
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setPermissionState(status.state as any);
      } else {
        setPermissionState('granted');
      }

      // Clear last error in localStorage
      localStorage.removeItem('scannest_last_camera_error');
      setLastCameraError(null);
    } catch (err: any) {
      setTestStatus('fail');
      const friendlyErr = resolveTestError(err);
      setTestMessage(friendlyErr);

      // Save error details in localStorage
      const timestamp = new Date().toLocaleString();
      const errorMsg = `${err.name || 'UnknownError'}: ${friendlyErr} (Logged on ${timestamp})`;
      localStorage.setItem('scannest_last_camera_error', errorMsg);
      setLastCameraError(errorMsg);

      // Update permission state on block
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
      }
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
        <h4 className="group-title">Camera Permission Recovery &amp; Safety</h4>

        {/* 1. Camera Permission Recovery Assistant */}
        <div className="settings-card">
          <div className="trouble-section-header flex-center">
            <div className="trouble-icon-wrap flex-center" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-primary)' }}>
              <Camera size={16} />
            </div>
            <div>
              <span className="trouble-section-title">Camera Permission Recovery Assistant</span>
              <span className="trouble-section-desc">Resolve blocked or denied camera access</span>
            </div>
          </div>

          <div className="cam-env-list" style={{ marginTop: '14px' }}>
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
              <span className="env-label">Browser Camera API</span>
              <span className={`env-badge ${env.mediaDevicesAvailable ? 'ok' : 'fail'}`}>
                {env.mediaDevicesAvailable ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <div className="cam-env-row">
              {env.getUserMediaAvailable
                ? <CheckCircle2 size={14} className="env-ok" />
                : <XCircle size={14} className="env-fail" />}
              <span className="env-label">getUserMedia API Support</span>
              <span className={`env-badge ${env.getUserMediaAvailable ? 'ok' : 'fail'}`}>
                {env.getUserMediaAvailable ? 'Supported' : 'Unsupported'}
              </span>
            </div>
            <div className="cam-env-row" style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
              <span className="env-label" style={{ fontWeight: 600 }}>Active Permission State:</span>
              <span className={`env-badge ${permissionState === 'granted' ? 'ok' : permissionState === 'denied' ? 'fail' : 'warning'}`} style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
                {permissionState}
              </span>
            </div>
          </div>

          {lastCameraError && (
            <div className="last-error-box" style={{ margin: '14px 0', padding: '10px 12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', fontSize: '0.78rem', color: '#fca5a5' }}>
              <strong>Last recorded camera issue:</strong>
              <div style={{ marginTop: '4px', fontFamily: 'monospace', fontSize: '0.72rem', wordBreak: 'break-word', lineHeight: '1.4' }}>{lastCameraError}</div>
            </div>
          )}

          <div className="trouble-btn-row" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
            <button
              id="settings-btn-camera-test"
              onClick={handleCameraTest}
              disabled={testStatus === 'testing'}
              className="trouble-action-btn flex-center"
              style={{ flex: 1, minWidth: '150px' }}
            >
              {testStatus === 'testing'
                ? <><RefreshCw size={14} className="spin-icon" /><span>Requesting…</span></>
                : <><Camera size={14} /><span>Request Camera Access</span></>}
            </button>

            <button
              id="settings-btn-open-browser"
              onClick={() => window.open(window.location.origin, "_blank")}
              className="trouble-action-btn flex-center"
              style={{ flex: 1, minWidth: '150px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.05)', color: '#ffffff' }}
            >
              <ExternalLink size={14} style={{ marginRight: '6px' }} />
              <span>Open in browser tab</span>
            </button>
          </div>

          <p className="guidance-note" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '8px', lineHeight: '1.4', fontStyle: 'italic' }}>
            “Some devices recover permissions more reliably from a standard browser tab first. Allow camera there, then reopen the installed PWA.”
          </p>

          {testStatus === 'ok' && (
            <div className="trouble-result ok flex-center animate-fade-in" style={{ marginTop: '12px' }}>
              <CheckCircle2 size={15} />
              <span>{testMessage}</span>
            </div>
          )}
          {testStatus === 'fail' && (
            <div className="trouble-result fail flex-center animate-fade-in" style={{ marginTop: '12px' }}>
              <XCircle size={15} />
              <span>{testMessage}</span>
            </div>
          )}

          {/* If denied, render the explicit Manual Reset Guidance Panel */}
          {permissionState === 'denied' && (
            <div className="manual-reset-panel animate-fade-in" style={{ marginTop: '16px', padding: '16px', background: 'rgba(245,158,11,0.06)', border: '1.5px dashed rgba(245,158,11,0.3)', borderRadius: '12px' }}>
              <div className="flex-center" style={{ gap: '8px', color: '#f59e0b', fontWeight: 'bold', fontSize: '0.88rem', marginBottom: '12px' }}>
                <AlertTriangle size={18} />
                <span>Camera is Blocked (Manual Reset Required)</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.45', margin: '0 0 12px 0' }}>
                Browser permissions are strictly managed by your OS/Browser. ScanNest cannot forcibly override this block. Please follow these steps to restore access:
              </p>
              
              <div className="guidance-step-list" style={{ gap: '10px', display: 'flex', flexDirection: 'column' }}>
                <div className="guidance-step" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <ChevronRight size={13} className="step-chevron" style={{ marginTop: '3px', flexShrink: 0, color: '#f59e0b' }} />
                  <div style={{ fontSize: '0.78rem' }}>
                    <span className="step-platform" style={{ color: '#f59e0b', fontWeight: 600, display: 'block', marginBottom: '2px' }}>1. Android Chrome address bar lock</span>
                    <span className="step-body" style={{ color: 'rgba(255,255,255,0.8)' }}>Open ScanNest in Chrome browser tab → tap lock/settings icon near address bar → permissions → Camera → Allow. Close and reopen the PWA app.</span>
                  </div>
                </div>
                <div className="guidance-step" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <ChevronRight size={13} className="step-chevron" style={{ marginTop: '3px', flexShrink: 0, color: '#f59e0b' }} />
                  <div style={{ fontSize: '0.78rem' }}>
                    <span className="step-platform" style={{ color: '#f59e0b', fontWeight: 600, display: 'block', marginBottom: '2px' }}>2. Full reset path in Chrome Settings</span>
                    <span className="step-body" style={{ color: 'rgba(255,255,255,0.8)' }}>Chrome Settings → Site settings → Camera → find <code>scannest-app-ten.vercel.app</code> → Allow or Reset permissions.</span>
                  </div>
                </div>
                <div className="guidance-step" style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <ChevronRight size={13} className="step-chevron" style={{ marginTop: '3px', flexShrink: 0, color: '#f59e0b' }} />
                  <div style={{ fontSize: '0.78rem' }}>
                    <span className="step-platform" style={{ color: '#f59e0b', fontWeight: 600, display: 'block', marginBottom: '2px' }}>3. Android OS Application settings</span>
                    <span className="step-body" style={{ color: 'rgba(255,255,255,0.8)' }}>Android Settings → Apps → Chrome → Permissions → Camera → Allow while using app.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Wipe ScanNest Local Data & Cached Files */}
        <div className="settings-card">
          <div className="trouble-section-header flex-center">
            <div className="trouble-icon-wrap flex-center" style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
              <Trash2 size={16} />
            </div>
            <div>
              <span className="trouble-section-title">Wipe ScanNest Local Data &amp; Cached Files</span>
              <span className="trouble-section-desc">Clear IndexedDB, LocalStorage, and Cache Storage</span>
            </div>
          </div>

          <p className="guidance-note" style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: '1.45', margin: '10px 0' }}>
            This clears: saved scan history records from IndexedDB, PWA Cache Storage files, and localStorage settings. The service worker will be unregistered to reload fresh code. <strong>This cannot be undone.</strong>
          </p>
          
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', padding: '10px 12px', fontSize: '0.78rem', color: '#fca5a5', marginBottom: '14px', lineHeight: '1.4' }}>
            <strong>Important note on permissions:</strong> Clearing ScanNest data does <strong>NOT</strong> reset Chrome's camera permission. Permissions must be reset manually in the browser or OS settings.
          </div>

          {!showClearConfirm && clearResult === 'idle' && (
            <div className="trouble-btn-row">
              <button
                id="settings-btn-clear-trigger"
                onClick={() => setShowClearConfirm(true)}
                className="trouble-action-btn danger flex-center"
              >
                <Trash2 size={14} />
                <span>Wipe ScanNest Local Data</span>
              </button>
            </div>
          )}

          {showClearConfirm && (
            <div className="danger-confirm-box animate-fade-in" style={{ padding: '12px 0' }}>
              <div className="danger-warning-message flex-center" style={{ gap: '8px', marginBottom: '12px' }}>
                <AlertTriangle size={18} className="warning-icon" style={{ color: 'var(--color-danger)' }} />
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.9)' }}>Clear local scans and app cache from this device? This cannot be undone.</span>
              </div>
              <div className="danger-confirm-actions" style={{ display: 'flex', gap: '10px' }}>
                <button
                  id="settings-btn-clear-cancel"
                  onClick={() => setShowClearConfirm(false)}
                  className="btn-clear-cancel tap-target"
                  disabled={clearing}
                  style={{ flex: 1, padding: '10px 0', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', borderRadius: '8px', color: '#ffffff', fontSize: '0.8rem' }}
                >
                  Cancel
                </button>
                <button
                  id="settings-btn-clear-confirm"
                  onClick={handleClearData}
                  className="btn-clear-confirm tap-target flex-center"
                  disabled={clearing}
                  style={{ flex: 1.5, padding: '10px 0', background: 'var(--color-danger)', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '0.8rem', justifyContent: 'center', gap: '6px' }}
                >
                  {clearing
                    ? <><RefreshCw size={13} className="spin-icon" /><span>Clearing…</span></>
                    : <span>Yes, clear everything</span>}
                </button>
              </div>
            </div>
          )}

          {clearResult === 'success' && (
            <div className="animate-fade-in" style={{ marginTop: '12px' }}>
              <div className="trouble-result ok flex-center" style={{ margin: '12px 0' }}>
                <CheckCircle2 size={15} />
                <span>All local ScanNest data successfully wiped!</span>
              </div>

              {/* Fresh Reinstall Checklist */}
              <div className="reinstall-checklist" style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', marginTop: '16px' }}>
                <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '10px' }}>
                  Fresh Reinstall Checklist:
                </div>
                <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: '1.45' }}>
                  <li>Close this ScanNest PWA app window completely.</li>
                  <li>Open standard Google Chrome browser on your device.</li>
                  <li>Visit <code>https://scannest-app-ten.vercel.app</code> in Chrome.</li>
                  <li>Tap the **Scan Document** camera shutter to trigger prompt.</li>
                  <li>Tap **Allow** camera access in Chrome.</li>
                  <li>Add/install ScanNest to your device home screen again.</li>
                </ol>
              </div>

              <div className="trouble-btn-row" style={{ marginTop: '14px' }}>
                <button
                  id="settings-btn-reload"
                  onClick={handleReload}
                  className="trouble-action-btn flex-center"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <RotateCcw size={14} style={{ marginRight: '6px' }} />
                  <span>Reload app</span>
                </button>
              </div>
            </div>
          )}
          {clearResult === 'fail' && (
            <div className="trouble-result fail flex-center animate-fade-in" style={{ margin: '12px 0' }}>
              <XCircle size={15} />
              <span>Some data could not be cleared. Try manually clearing site data from your browser settings.</span>
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
