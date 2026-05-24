import React, { useState, useEffect, useRef } from 'react';
import { X, Zap, ZapOff, Image as ImageIcon, Check, Camera, RefreshCw, AlertTriangle, Loader2, Plus, Trash2, FileText, Download } from 'lucide-react';
import { useCamera } from '../hooks/useCamera';
import { jsPDF } from 'jspdf';
import { saveScan } from '../services/db';
import './DocScanView.css';

interface DocScanViewProps {
  onClose: () => void;
  onSaveSuccess: () => void;
}

type ScanFilterType = 'bw' | 'color' | 'original';

interface ScannedPage {
  id: string;
  dataUrl: string;
  filter: ScanFilterType;
}

type ViewModeType = 'camera' | 'preview' | 'tray_review';

export const DocScanView: React.FC<DocScanViewProps> = ({ onClose, onSaveSuccess }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const {
    stream,
    loading,
    error,
    facingMode,
    startCamera,
    stopCamera,
    switchCamera,
    captureFrame
  } = useCamera();

  const [flashOn, setFlashOn] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ScanFilterType>('bw');
  const [shutterActive, setShutterActive] = useState(false);
  
  // Multi-page temporary session tray states
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [viewMode, setViewMode] = useState<ViewModeType>('camera');
  const [exporting, setExporting] = useState(false);

  // Mount/Unmount effect - manage live feed safely
  useEffect(() => {
    if (viewMode === 'camera') {
      startCamera('environment'); // Always default to environment/rear camera for documents
    }
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera, viewMode]);

  // Safe flashlight/torch constraint binding
  useEffect(() => {
    if (!stream || viewMode !== 'camera') return;
    
    const track = stream.getVideoTracks()[0];
    if (track) {
      const capabilities = track.getCapabilities() as any;
      if (capabilities?.torch) {
        track.applyConstraints({
          advanced: [{ torch: flashOn }]
        } as any).catch((err) => {
          console.warn('[ScanNest Flash] Device torch rejected constraint: ', err);
        });
      }
    }
  }, [flashOn, stream, viewMode]);

  // Capture current video frame and switch to single-page review/preview
  const handleCapture = () => {
    if (!videoRef.current) return;
    
    const dataUrl = captureFrame(videoRef.current);
    if (dataUrl) {
      setShutterActive(true);
      setTimeout(() => {
        setShutterActive(false);
        setCapturedImage(dataUrl);
        setViewMode('preview');
        stopCamera(); // Pause stream to conserve battery
      }, 400);
    }
  };

  // Add the currently snapped page + selected scan filter into the tray
  const handleKeepPage = () => {
    if (capturedImage) {
      setPages([
        ...pages,
        {
          id: Date.now().toString(),
          dataUrl: capturedImage,
          filter: activeFilter
        }
      ]);
      setCapturedImage(null);
      setViewMode('camera'); // Return to viewfinder for next page
    }
  };

  // Wire Retake to discard captured image and restart stream
  const handleRetake = () => {
    setCapturedImage(null);
    setViewMode('camera');
  };

  // Delete a specific page from the session tray
  const handleDeletePage = (id: string) => {
    setPages(pages.filter(p => p.id !== id));
  };

  // Bake the B&W/Color visual scan filters into the canvas JPEG output
  const bakeFilterToImage = (dataUrl: string, filter: ScanFilterType): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl); // Fallback to raw image if canvas 2D fails
          return;
        }

        // Apply HTML5 canvas filter variables
        if (filter === 'bw') {
          ctx.filter = 'contrast(1.45) grayscale(1) brightness(1.08)';
        } else if (filter === 'color') {
          ctx.filter = 'saturate(1.35) contrast(1.06) brightness(1.03)';
        } else {
          ctx.filter = 'none';
        }

        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85)); // Compressed JPEG structure
      };
      img.onerror = () => resolve(dataUrl);
    });
  };

  // Assemble all processed documents into a single local A4 PDF
  const handleExportPDF = async () => {
    if (pages.length === 0) return;
    setExporting(true);
    stopCamera();

    try {
      // Standard A4 portrait: 210mm x 297mm
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const A4_WIDTH = 210;
      const A4_HEIGHT = 297;
      const a4Ratio = A4_WIDTH / A4_HEIGHT;

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        
        // 1. Bake CSS filter choices permanently into the image pixels
        const bakedDataUrl = await bakeFilterToImage(page.dataUrl, page.filter);

        if (i > 0) {
          pdf.addPage();
        }

        // 2. Resolve image dimensions asynchronously to prevent stretching
        const dims = await new Promise<{ width: number; height: number }>((resolve) => {
          const tempImg = new Image();
          tempImg.src = bakedDataUrl;
          tempImg.onload = () => resolve({ width: tempImg.width, height: tempImg.height });
          tempImg.onerror = () => resolve({ width: A4_WIDTH, height: A4_HEIGHT });
        });

        const imgRatio = dims.width / dims.height;

        let drawWidth = A4_WIDTH;
        let drawHeight = A4_HEIGHT;
        let xOffset = 0;
        let yOffset = 0;

        // Preserve aspect ratios cleanly
        if (imgRatio > a4Ratio) {
          drawWidth = A4_WIDTH;
          drawHeight = A4_WIDTH / imgRatio;
          yOffset = (A4_HEIGHT - drawHeight) / 2; // Centered vertically
        } else {
          drawHeight = A4_HEIGHT;
          drawWidth = A4_HEIGHT * imgRatio;
          xOffset = (A4_WIDTH - drawWidth) / 2; // Centered horizontally
        }

        // Add baked JPEG data to PDF with balanced compression
        pdf.addImage(bakedDataUrl, 'JPEG', xOffset, yOffset, drawWidth, drawHeight, undefined, 'FAST');
      }

      // Generate study-scan filename
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `scannest-study-scan-${dateStr}.pdf`;

      // Generate dynamic local scan title for student record index
      const dateOptions: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      };
      const dateStrTitle = new Date().toLocaleDateString('en-US', dateOptions);
      const defaultTitle = `Study Scan — ${dateStrTitle}`;

      // Extract compiled PDF content as a raw binary Blob object
      const pdfBlob = pdf.output('blob');

      // Write record to local browser IndexedDB transaction safely
      await saveScan({
        id: Date.now().toString(),
        title: defaultTitle,
        createdAt: Date.now(),
        pageCount: pages.length,
        sizeBytes: pdfBlob.size,
        fileName: filename,
        pdfBlob: pdfBlob,
        type: 'document'
      });

      // Trigger instant local browser sandbox download
      pdf.save(filename);

      // Reset tray items and return to dashboard
      setPages([]);
      onSaveSuccess();
    } catch (err) {
      console.error('[ScanNest jsPDF compiler failed] ', err);
      alert('Compilation error occurred. Please verify your camera snapshots.');
    } finally {
      setExporting(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setShutterActive(true);
          setTimeout(() => {
            setShutterActive(false);
            setCapturedImage(event.target!.result as string);
            setViewMode('preview');
            stopCamera();
          }, 400);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Compile CSS visual display style classes
  const getFilterStyle = (filterType: ScanFilterType) => {
    switch (filterType) {
      case 'bw':
        return { filter: 'contrast(1.45) grayscale(1) brightness(1.08)' };
      case 'color':
        return { filter: 'saturate(1.35) contrast(1.06) brightness(1.03)' };
      case 'original':
      default:
        return {};
    }
  };

  return (
    <div className="doc-scan-view">
      {/* Dynamic Camera Shutter Flash Effect */}
      {shutterActive && <div className="camera-shutter-flash"></div>}

      {/* Assembly & Compilation loading screen */}
      {exporting && (
        <div className="pdf-compiling-loader-overlay flex-center animate-fade-in">
          <div className="loader-box flex-center">
            <Loader2 size={44} className="loader-spin" />
            <h3 className="compile-title">Compiling Document</h3>
            <p className="compile-desc">Baking monochromatic filters and compiling {pages.length} pages into a single A4 PDF...</p>
            <div className="pdf-progress-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'preview' && capturedImage && (
        /* Preview & Single Page Filters adjustment view */
        <div className="preview-container animate-fade-in">
          <header className="preview-header">
            <h3 className="preview-title">Adjust Page Filters</h3>
            <button 
              id="doc-preview-btn-discard"
              onClick={handleRetake} 
              className="preview-close-btn tap-target"
              aria-label="Discard snapshot"
            >
              <X size={20} />
            </button>
          </header>

          <div className="preview-canvas-area flex-center">
            <div className="simulated-document-page">
              <div className="document-corner tl"></div>
              <div className="document-corner tr"></div>
              <div className="document-corner bl"></div>
              <div className="document-corner br"></div>
              
              <div className="simulated-doc-content flex-center">
                <img 
                  src={capturedImage} 
                  className="captured-preview-img" 
                  style={getFilterStyle(activeFilter)} 
                  alt="Scanned document page"
                />
              </div>
            </div>
          </div>

          <footer className="preview-footer-controls">
            {/* Monochromatic visual filter selectors */}
            <div className="filter-chip-row flex-center">
              <button 
                id="doc-filter-bw"
                onClick={() => setActiveFilter('bw')} 
                className={`filter-chip ${activeFilter === 'bw' ? 'active' : ''}`}
              >
                B&W Scan
              </button>
              <button 
                id="doc-filter-color"
                onClick={() => setActiveFilter('color')} 
                className={`filter-chip ${activeFilter === 'color' ? 'active' : ''}`}
              >
                Enhanced Color
              </button>
              <button 
                id="doc-filter-original"
                onClick={() => setActiveFilter('original')} 
                className={`filter-chip ${activeFilter === 'original' ? 'active' : ''}`}
              >
                Original Photo
              </button>
            </div>
            
            <div className="preview-action-row">
              <button 
                id="doc-preview-btn-retake"
                onClick={handleRetake} 
                className="btn-preview-secondary tap-target flex-center"
              >
                <RefreshCw size={16} />
                <span>Discard</span>
              </button>
              
              <button 
                id="doc-preview-btn-keep"
                onClick={handleKeepPage} 
                className="btn-preview-primary tap-target flex-center"
              >
                <Check size={18} />
                <span>Keep Page</span>
              </button>
            </div>
          </footer>
        </div>
      )}

      {viewMode === 'tray_review' && (
        /* Immersive Document Tray Pages overview screen */
        <div className="tray-review-container animate-fade-in">
          <header className="preview-header">
            <h3 className="preview-title">Document Tray ({pages.length} pages)</h3>
            <button 
              id="tray-review-close"
              onClick={() => { setViewMode('camera'); }} 
              className="preview-close-btn tap-target"
              aria-label="Back to viewfinder"
            >
              <X size={20} />
            </button>
          </header>

          <div className="tray-scroll-area">
            {pages.length > 0 ? (
              <div className="tray-pages-grid">
                {pages.map((page, index) => (
                  <div key={page.id} className="tray-page-card">
                    <div className="tray-page-thumbnail-wrapper flex-center">
                      <img 
                        src={page.dataUrl} 
                        style={getFilterStyle(page.filter)} 
                        className="tray-page-thumbnail" 
                        alt={`Scanned page ${index + 1}`}
                      />
                      <button 
                        id={`tray-btn-delete-${page.id}`}
                        onClick={() => handleDeletePage(page.id)}
                        className="tray-page-delete-btn flex-center tap-target"
                        title="Delete page"
                      >
                        <Trash2 size={14} />
                      </button>
                      <span className="tray-page-badge">{index + 1}</span>
                    </div>
                    <span className="tray-page-label">Page {index + 1} ({page.filter.toUpperCase()})</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="tray-empty-state flex-center">
                <div className="empty-state-icon flex-center">
                  <FileText size={32} />
                </div>
                <h4 className="empty-state-title">Empty Document Tray</h4>
                <p className="empty-state-desc">You have removed all pages. Tap "Add Pages" below to take another snapshot.</p>
              </div>
            )}
          </div>

          <footer className="preview-footer-controls">
            <div className="preview-action-row">
              <button 
                id="tray-btn-add-more"
                onClick={() => { setViewMode('camera'); }} 
                className="btn-preview-secondary tap-target flex-center"
              >
                <Plus size={18} />
                <span>Add Page</span>
              </button>
              
              <button 
                id="tray-btn-export"
                onClick={handleExportPDF} 
                disabled={pages.length === 0}
                className="btn-preview-primary tap-target flex-center"
              >
                <Download size={18} />
                <span>Compile PDF ({pages.length})</span>
              </button>
            </div>
          </footer>
        </div>
      )}

      {viewMode === 'camera' && (
        /* Camera Active Viewfinder State */
        <div className="viewfinder-container">
          {/* Top Control Overlay */}
          <header className="viewfinder-header">
            <button 
              id="doc-scan-btn-close"
              onClick={handleClose} 
              className="viewfinder-circle-btn tap-target flex-center"
              aria-label="Close scanner"
            >
              <X size={20} />
            </button>
            
            <div className="scanner-overlay-status">
              Document Scan
            </div>
            
            <button 
              id="doc-scan-btn-flash"
              onClick={() => setFlashOn(!flashOn)} 
              disabled={loading || !!error}
              className={`viewfinder-circle-btn tap-target flex-center ${flashOn ? 'flash-active' : ''}`}
              aria-label="Toggle flashlight"
            >
              {flashOn ? <Zap size={20} /> : <ZapOff size={20} />}
            </button>
          </header>

          {/* Central frame/loading area */}
          <div className="viewfinder-frame-area flex-center">
            {loading && (
              <div className="camera-loader-overlay flex-center">
                <Loader2 size={36} className="loader-spin" />
                <span>Calibrating lens...</span>
              </div>
            )}

            {error && (
              <div className="camera-error-overlay flex-center">
                <div className="error-icon-box flex-center">
                  <AlertTriangle size={28} />
                </div>
                <h4 className="error-title">Access Blocked</h4>
                <p className="error-message">{error}</p>
                <button 
                  id="camera-error-retry"
                  onClick={() => startCamera(facingMode)} 
                  className="btn-error-retry tap-target flex-center"
                >
                  <RefreshCw size={16} />
                  <span>Grant Permission</span>
                </button>
              </div>
            )}

            {/* Video Preview feed and crop visual lines */}
            {!loading && !error && (
              <div className="camera-video-wrapper">
                <video 
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="camera-video-feed"
                />
                
                <div className="document-framing-box flex-center">
                  <div className="corner-bracket top-left"></div>
                  <div className="corner-bracket top-right"></div>
                  <div className="corner-bracket bottom-left"></div>
                  <div className="corner-bracket bottom-right"></div>
                  
                  <div className="framing-helper-text">
                    Align document edges
                  </div>
                  
                  <div className="dynamic-border-pulse"></div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Controls */}
          <footer className="viewfinder-footer">
            <div className="capture-mode-bar flex-center">
              <button 
                id="doc-scan-mode-auto"
                onClick={() => setIsAutoMode(true)} 
                className={`mode-btn ${isAutoMode ? 'active' : ''}`}
              >
                Auto-Capture
              </button>
              <button 
                id="doc-scan-mode-manual"
                onClick={() => setIsAutoMode(false)} 
                className={`mode-btn ${!isAutoMode ? 'active' : ''}`}
              >
                Manual
              </button>
            </div>

            <div className="capture-action-row flex-center">
              {/* Context Slot Left: Thumbnail Page Tray or Gallery Load */}
              {pages.length > 0 ? (
                <button 
                  id="doc-scan-btn-tray-review"
                  onClick={() => { setViewMode('tray_review'); stopCamera(); }}
                  className="viewfinder-tray-thumbnail-btn tap-target flex-center"
                  aria-label="Open document tray"
                >
                  <img 
                    src={pages[pages.length - 1].dataUrl} 
                    style={getFilterStyle(pages[pages.length - 1].filter)} 
                    className="tray-btn-thumb" 
                    alt="Latest scan"
                  />
                  <span className="tray-btn-badge">{pages.length}</span>
                </button>
              ) : (
                <label 
                  id="doc-scan-label-gallery"
                  htmlFor="gallery-input" 
                  className="viewfinder-circle-btn tap-target flex-center gallery-btn"
                  aria-label="Import document from gallery"
                >
                  <ImageIcon size={22} />
                  <input 
                    type="file" 
                    id="gallery-input" 
                    accept="image/*" 
                    onChange={handleGalleryUpload} 
                    style={{ display: 'none' }}
                  />
                </label>
              )}

              {/* Shutter capture button trigger */}
              <button 
                id="doc-scan-btn-shutter"
                onClick={handleCapture} 
                disabled={loading || !!error}
                className="camera-shutter-outer flex-center tap-target"
                aria-label="Capture page"
              >
                <div className="camera-shutter-inner flex-center">
                  <Camera size={26} className="camera-shutter-icon" />
                </div>
              </button>

              {/* Lens toggle: Front/Rear Swapping */}
              <button 
                id="doc-scan-btn-swap"
                onClick={switchCamera} 
                disabled={loading || !!error}
                className="viewfinder-circle-btn tap-target flex-center"
                aria-label="Swap lens front/rear"
              >
                <RefreshCw size={22} />
              </button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
};
