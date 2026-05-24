import React, { useState, useEffect } from 'react';
import { FileText, QrCode, ArrowRight, ShieldCheck, Zap, HardDrive, Calendar } from 'lucide-react';
import { getAllScans } from '../services/db';
import type { ScannedDocRecord } from '../services/db';
import './HomeView.css';

interface HomeViewProps {
  onScanDoc: () => void;
  onScanQR: () => void;
  onNavigateToHistory: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onScanDoc, onScanQR, onNavigateToHistory }) => {
  const [recentScans, setRecentScans] = useState<ScannedDocRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load the latest 2 records dynamically from IndexedDB
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const records = await getAllScans();
        setRecentScans(records.slice(0, 2));
      } catch (err) {
        console.error('[ScanNest Home] Failed to fetch recent items:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecent();
  }, []);

  const handleDownload = (item: ScannedDocRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'qr' && item.value) {
      try {
        navigator.clipboard.writeText(item.value);
        alert(`Copied: ${item.value}`);
      } catch (err) {
        console.error('[ScanNest Home] Quick-copy failed:', err);
      }
      return;
    }
    if (item.pdfBlob && item.fileName) {
      try {
        const fileUrl = URL.createObjectURL(item.pdfBlob);
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = item.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(fileUrl);
      } catch (err) {
        console.error('[ScanNest Home] Quick-download failed:', err);
      }
    }
  };

  const formatDate = (timestamp: number) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return new Date(timestamp).toLocaleDateString('en-US', options);
  };

  const formatBytes = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(0)} KB`;
    }
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="home-view">
      {/* Calm Greeting */}
      <section className="welcome-section animate-fade-in">
        <span className="welcome-subtitle">Your Calm Digital Repository</span>
        <h2 className="welcome-title">Capture Cleanly.</h2>
        <p className="welcome-description">
          All document scanning, image edge detection, and QR code parsing occur directly on your device. Zero cloud sync.
        </p>
      </section>

      {/* Core Action Cards */}
      <section className="actions-section">
        <button 
          id="home-card-scan-doc"
          onClick={onScanDoc} 
          className="action-card primary tap-target"
        >
          <div className="card-accent-gradient"></div>
          <div className="card-content">
            <div className="card-icon-wrapper flex-center">
              <FileText size={26} className="card-icon" />
            </div>
            <div className="card-text-group">
              <h3 className="card-title">Scan Document</h3>
              <p className="card-desc">Capture worksheets, handouts, or book pages directly to local PDFs.</p>
            </div>
            <div className="card-arrow flex-center">
              <ArrowRight size={18} />
            </div>
          </div>
        </button>

        <button 
          id="home-card-scan-qr"
          onClick={onScanQR} 
          className="action-card secondary tap-target"
        >
          <div className="card-content">
            <div className="card-icon-wrapper flex-center">
              <QrCode size={26} className="card-icon" />
            </div>
            <div className="card-text-group">
              <h3 className="card-title">Scan QR / Barcode</h3>
              <p className="card-desc">Instantly parse URLs, Wi-Fi networks, or barcode contents.</p>
            </div>
            <div className="card-arrow flex-center">
              <ArrowRight size={18} />
            </div>
          </div>
        </button>
      </section>

      {/* Dynamic Recent Scans Section */}
      <section className="recent-scans-section">
        <div className="section-header">
          <h3 className="section-title">Recent Activity</h3>
          {recentScans.length > 0 && (
            <button 
              id="home-btn-view-all"
              onClick={onNavigateToHistory} 
              className="section-action-link"
            >
              View All
            </button>
          )}
        </div>

        {loading ? (
          <div className="home-recent-loader flex-center shimmer-placeholder" style={{ height: '80px', borderRadius: '16px' }}></div>
        ) : recentScans.length > 0 ? (
          <div className="home-recent-list">
            {recentScans.map((item) => (
              <div 
                key={item.id} 
                onClick={(e) => handleDownload(item, e)}
                className={`home-recent-card tap-target flex-center ${item.type === 'qr' ? 'qr-card-item' : ''}`}
                title={item.type === 'qr' ? 'Click to copy content' : 'Click to download again'}
              >
                <div className="home-recent-icon flex-center">
                  {item.type === 'qr' ? (
                    <QrCode size={18} className="recent-qr-icon" />
                  ) : (
                    <FileText size={18} className="recent-pdf-icon" />
                  )}
                </div>
                <div className="home-recent-details">
                  <span className="recent-title">{item.title}</span>
                  <div className="recent-meta flex-center">
                    <Calendar size={10} />
                    <span>{formatDate(item.createdAt)}</span>
                    {item.type === 'document' && (
                      <>
                        <span className="recent-meta-divider">•</span>
                        <span>{item.pageCount || 0} {item.pageCount === 1 ? 'page' : 'pages'} ({formatBytes(item.sizeBytes || 0)})</span>
                      </>
                    )}
                    {item.type === 'qr' && item.value && (
                      <>
                        <span className="recent-meta-divider">•</span>
                        <span className="recent-qr-value">{item.value.length > 25 ? `${item.value.slice(0, 25)}...` : item.value}</span>
                      </>
                    )}
                  </div>
                </div>
                <ArrowRight size={14} className="home-recent-arrow" />
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-placeholder-card flex-center">
            <div className="placeholder-illustration flex-center">
              <div className="pulse-ripple"></div>
              <div className="nest-icon-inner flex-center">
                <HardDrive size={32} className="nest-icon" />
              </div>
            </div>
            <h4 className="placeholder-title">Your Nest is Ready</h4>
            <p className="placeholder-desc">
              No documents are scanned yet. Tap "Scan Document" above to capture your first PDF.
            </p>
          </div>
        )}
      </section>

      {/* Security Checkpoints Footer */}
      <section className="guarantee-section">
        <div className="guarantee-grid">
          <div className="guarantee-item flex-center">
            <ShieldCheck size={18} className="g-icon green" />
            <span>100% Privacy</span>
          </div>
          <div className="guarantee-item flex-center">
            <Zap size={18} className="g-icon blue" />
            <span>Instant Offline</span>
          </div>
          <div className="guarantee-item flex-center">
            <HardDrive size={18} className="g-icon purple" />
            <span>Zero Cloud</span>
          </div>
        </div>
      </section>
    </div>
  );
};
