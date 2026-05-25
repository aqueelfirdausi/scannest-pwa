import React, { useState, useEffect, useRef } from 'react';
import { X, Zap, ZapOff, Image, Copy, ExternalLink, Check, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { useCamera } from '../hooks/useCamera';
import { saveScan } from '../services/db';
import jsQR from 'jsqr';
import './QRScanView.css';

interface QRScanViewProps {
  onClose: () => void;
  onNavigateToSettings?: () => void;
}

export const QRScanView: React.FC<QRScanViewProps> = ({ onClose, onNavigateToSettings }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const activeRef = useRef<boolean>(true);

  const {
    stream,
    loading,
    error,
    facingMode,
    startCamera,
    stopCamera,
    switchCamera
  } = useCamera();

  const [flashOn, setFlashOn] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Capture camera errors and save to localStorage
  useEffect(() => {
    if (error) {
      const isPermissionDenied = error.toLowerCase().includes('permission') || error.toLowerCase().includes('allow') || error.toLowerCase().includes('notallowed');
      const timestamp = new Date().toLocaleString();
      const errDetail = `${isPermissionDenied ? 'PermissionDeniedError' : 'CameraError'}: ${error} (Captured on ${timestamp})`;
      try {
        localStorage.setItem('scannest_last_camera_error', errDetail);
      } catch (_) {}
    }
  }, [error]);

  // Wire camera stream to video element srcObject whenever stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.warn('[ScanNest QRScan] Video autoplay was blocked:', err);
      });
    }
  }, [stream]);

  // Mount/Unmount effect - manage live feed safely
  useEffect(() => {
    startCamera('environment'); // Always default to environment/rear camera for QR codes
    return () => {
      activeRef.current = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safe flashlight/torch constraint binding
  useEffect(() => {
    if (!stream) return;
    
    const track = stream.getVideoTracks()[0];
    if (track) {
      const capabilities = track.getCapabilities() as any;
      if (capabilities?.torch) {
        track.applyConstraints({
          advanced: [{ torch: flashOn }]
        } as any).catch((err) => {
          console.warn('[ScanNest QR Flash] Device torch constraint rejected: ', err);
        });
      }
    }
  }, [flashOn, stream]);

  // Core frame loop for QR detection
  const scanLoop = async () => {
    if (!videoRef.current || !activeRef.current) {
      if (activeRef.current) {
        requestRef.current = requestAnimationFrame(scanLoop);
      }
      return;
    }

    const video = videoRef.current;
    const now = Date.now();

    // Poll safely every 250ms to conserve mobile CPU/battery
    if (now - lastScannedTimeRef.current >= 250) {
      lastScannedTimeRef.current = now;

      try {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          let decodedValue: string | null = null;

          // 1. Try Native Browser BarcodeDetector (highly optimized on Android Chrome)
          if ((window as any).BarcodeDetector) {
            try {
              const BarcodeDetectorClass = (window as any).BarcodeDetector;
              const formats = await BarcodeDetectorClass.getSupportedFormats();
              if (formats.includes('qr_code')) {
                const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
                const barcodes = await detector.detect(video);
                if (barcodes && barcodes.length > 0) {
                  decodedValue = barcodes[0].rawValue;
                  console.log('[ScanNest QR] Native detector read:', decodedValue);
                }
              }
            } catch (nativeErr) {
              console.warn('[ScanNest QR] Native detector failed, falling back to jsQR:', nativeErr);
            }
          }

          // 2. Fall back to lightweight client-side jsQR canvas image pixel parsing
          if (!decodedValue) {
            const canvas = document.createElement('canvas');
            // Check video natural widths/heights
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code) {
                decodedValue = code.data;
                console.log('[ScanNest QR] jsQR fallback read:', decodedValue);
              }
            }
          }

          // 3. Successful detection
          if (decodedValue) {
            // Pause scanning instantly to avoid spamming or multiple sheets trigger
            activeRef.current = false;
            
            // Format nice title representation
            let formattedTitle = 'QR Scan';
            try {
              if (decodedValue.startsWith('http')) {
                formattedTitle = `Link: ${new URL(decodedValue).hostname}`;
              } else {
                formattedTitle = `Text: ${decodedValue.slice(0, 16)}${decodedValue.length > 16 ? '...' : ''}`;
              }
            } catch (e) {
              formattedTitle = 'Decoded Barcode';
            }

            // Save record asynchronously to local IndexedDB
            await saveScan({
              id: Date.now().toString(),
              title: formattedTitle,
              createdAt: Date.now(),
              value: decodedValue,
              type: 'qr'
            });

            setScannedResult(decodedValue);
            return; // Terminate current loop branch
          }
        }
      } catch (err) {
        console.error('[ScanNest QR Frame Loop Failure] ', err);
      }
    }

    if (activeRef.current) {
      requestRef.current = requestAnimationFrame(scanLoop);
    }
  };

  // Launch scan loop once video/stream resources are calibrated
  useEffect(() => {
    if (stream && !loading && !error) {
      activeRef.current = true;
      requestRef.current = requestAnimationFrame(scanLoop);
    }

    return () => {
      activeRef.current = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [stream, loading, error]);

  const handleCopyLink = () => {
    if (scannedResult) {
      navigator.clipboard.writeText(scannedResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const img = new window.Image();
          img.src = event.target.result as string;
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code) {
                activeRef.current = false;
                
                let formattedTitle = 'Imported Link';
                if (code.data.startsWith('http')) {
                  try {
                    formattedTitle = `Link: ${new URL(code.data).hostname}`;
                  } catch {}
                } else {
                  formattedTitle = `Code: ${code.data.slice(0, 16)}...`;
                }

                await saveScan({
                  id: Date.now().toString(),
                  title: formattedTitle,
                  createdAt: Date.now(),
                  value: code.data,
                  type: 'qr'
                });

                setScannedResult(code.data);
              } else {
                alert('No valid QR code detected in the uploaded image.');
              }
            }
          };
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSwitchCamera = async () => {
    await switchCamera();
  };

  // Close the sheet, resume standard loop
  const handleDismissSheet = () => {
    setScannedResult(null);
    activeRef.current = true;
    requestRef.current = requestAnimationFrame(scanLoop);
  };

  const handleClose = () => {
    activeRef.current = false;
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    stopCamera();
    onClose();
  };

  return (
    <div className="qr-scan-view">
      <div className="viewfinder-container">
        {/* Top Header Controls */}
        <header className="viewfinder-header">
          <button 
            id="qr-scan-btn-close"
            onClick={handleClose} 
            className="viewfinder-circle-btn tap-target flex-center"
            aria-label="Close scanner"
          >
            <X size={20} />
          </button>
          
          <div className="scanner-overlay-status">
            {scannedResult ? 'Scan Paused' : 'Scan QR Code'}
          </div>
          
          <div className="header-actions flex-center" style={{ gap: '8px' }}>
            {/* Lens Switch lens swap trigger */}
            <button 
              id="qr-scan-btn-swap"
              onClick={handleSwitchCamera} 
              disabled={loading || !!error}
              className="viewfinder-circle-btn tap-target flex-center"
              aria-label="Swap camera lens"
            >
              <RefreshCw size={20} />
            </button>

            {/* Flash Switch */}
            <button 
              id="qr-scan-btn-flash"
              onClick={() => setFlashOn(!flashOn)} 
              disabled={loading || !!error}
              className={`viewfinder-circle-btn tap-target flex-center ${flashOn ? 'flash-active' : ''}`}
              aria-label="Toggle flashlight"
            >
              {flashOn ? <Zap size={20} /> : <ZapOff size={20} />}
            </button>
          </div>
        </header>

        {/* Camera Preview and centring square overlays */}
        <div className="viewfinder-frame-area flex-center">
          {loading && (
            <div className="camera-loader-overlay flex-center">
              <Loader2 size={36} className="loader-spin" />
              <span>Calibrating lens...</span>
            </div>
          )}

          {error && (
            <div className="camera-error-overlay flex-center" style={{ zIndex: 10, padding: '24px', textAlign: 'center' }}>
              <div className="error-icon-box flex-center">
                <AlertTriangle size={28} />
              </div>
              <h4 className="error-title">Access Blocked</h4>
              
              {/* Check if permission denied */}
              {(error.toLowerCase().includes('permission') || error.toLowerCase().includes('allow') || error.toLowerCase().includes('notallowed')) ? (
                <>
                  <p className="error-message" style={{ margin: '8px 0 16px 0', fontSize: '0.8rem', lineHeight: '1.4', color: 'rgba(255,255,255,0.7)' }}>
                    Camera is blocked by browser permission. ScanNest cannot override this automatically.
                  </p>
                  {onNavigateToSettings && (
                    <button
                      onClick={onNavigateToSettings}
                      className="btn-error-retry tap-target flex-center"
                      style={{ background: 'var(--color-primary)', color: '#ffffff', marginBottom: '10px' }}
                    >
                      <span>Fix camera permission in Settings</span>
                    </button>
                  )}
                </>
              ) : (
                <p className="error-message">{error}</p>
              )}

              <button 
                id="qr-camera-error-retry"
                onClick={() => startCamera(facingMode)} 
                className="btn-error-retry tap-target flex-center"
                style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff' }}
              >
                <RefreshCw size={16} />
                <span>Retry Camera</span>
              </button>
            </div>
          )}

          {/* Video element - always kept in DOM so videoRef is never null when stream arrives */}
          <div className="camera-video-wrapper" style={{ display: loading || error ? 'none' : 'block' }}>
            <video 
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video-feed"
            />
            
            <div className="qr-scanning-bracket flex-center">
              {/* Corner Brackets */}
              <div className="qr-bracket tl"></div>
              <div className="qr-bracket tr"></div>
              <div className="qr-bracket bl"></div>
              <div className="qr-bracket br"></div>
              
              {/* Sweeping Laser Line */}
              {!scannedResult && <div className="sweeping-laser-line"></div>}
              
              {/* Visual scan status label when code is detected */}
              {scannedResult && (
                <div className="scan-paused-label flex-center animate-fade-in">
                  <Check size={18} />
                  <span>Detected</span>
                </div>
              )}
            </div>

            <p className="qr-helper-text">
              {scannedResult ? 'Scan paused. View result below.' : 'Align QR code inside the bracket'}
            </p>
          </div>
        </div>

        {/* Footer controls */}
        <footer className="viewfinder-footer">
          <div className="capture-action-row flex-center">
            {/* Gallery Upload fallback */}
            <label 
              id="qr-scan-label-gallery"
              htmlFor="qr-gallery-input" 
              className="viewfinder-circle-btn tap-target flex-center gallery-btn"
              aria-label="Upload QR from gallery"
            >
              <Image size={22} />
              <input 
                type="file" 
                id="qr-gallery-input" 
                accept="image/*" 
                onChange={handleGalleryUpload} 
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </footer>
      </div>

      {/* Simulated Bottom Sheet for Scanned Result */}
      {scannedResult && (
        <div className="result-bottom-sheet-wrapper">
          <div className="bottom-sheet-overlay" onClick={handleDismissSheet}></div>
          <div className="result-bottom-sheet animate-slide-up-sheet">
            <div className="sheet-drag-handle"></div>
            
            <header className="sheet-header">
              <div className="sheet-header-icon-wrapper flex-center">
                <Check size={20} className="success-icon" />
              </div>
              <div className="sheet-header-titles">
                <h3 className="sheet-title">QR Code Detected</h3>
                <p className="sheet-subtitle">Secure offline persistent parse</p>
              </div>
            </header>

            <div className="sheet-content">
              <div className="result-url-card flex-center">
                <span className="result-url-text">{scannedResult}</span>
              </div>

              <div className="sheet-actions-row">
                <button 
                  id="qr-result-btn-copy"
                  onClick={handleCopyLink} 
                  className={`btn-sheet-secondary tap-target flex-center ${copied ? 'copied' : ''}`}
                >
                  <Copy size={16} />
                  <span>{copied ? 'Copied' : 'Copy Value'}</span>
                </button>
                
                {scannedResult.startsWith('http') ? (
                  <a 
                    id="qr-result-link-open"
                    href={scannedResult} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn-sheet-primary tap-target flex-center"
                  >
                    <ExternalLink size={16} />
                    <span>Open Link</span>
                  </a>
                ) : (
                  <div className="btn-sheet-primary disabled tap-target flex-center opacity-50 pointer-events-none">
                    <ExternalLink size={16} />
                    <span>Text Code</span>
                  </div>
                )}
              </div>
            </div>

            <button 
              id="qr-result-btn-done"
              onClick={handleClose} 
              className="btn-sheet-done tap-target flex-center"
            >
              Done & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
