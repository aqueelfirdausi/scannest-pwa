import React, { useState, useEffect } from 'react';
import { Search, FileText, QrCode, Trash2, Calendar, FileDown, Edit2, Loader2, HardDrive } from 'lucide-react';
import { getAllScans, deleteScan, renameScan } from '../services/db';
import type { ScannedDocRecord } from '../services/db';
import './ScansHistoryView.css';

export const ScansHistoryView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pdf' | 'qr'>('all');
  
  const [scans, setScans] = useState<ScannedDocRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load persistent scans from IndexedDB on view mount
  const loadScans = async () => {
    setLoading(true);
    try {
      const records = await getAllScans();
      setScans(records);
    } catch (err) {
      console.error('[ScanNest History] Loaded database failure: ', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScans();
  }, []);

  // Erase a specific document record from IndexedDB safely
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Safety verification check to avoid accidental student scan erasures
    if (window.confirm('Permanently delete this document from your local storage? This is irreversible.')) {
      try {
        await deleteScan(id);
        setScans(scans.filter(item => item.id !== id));
      } catch (err) {
        console.error('[ScanNest DB] Erasure failure: ', err);
        alert('Failed to erase document.');
      }
    }
  };

  // Modify document indexing title safely
  const handleRename = async (item: ScannedDocRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTitle = window.prompt('Rename Study Document Title:', item.title);
    if (newTitle && newTitle.trim() !== '' && newTitle.trim() !== item.title) {
      try {
        await renameScan(item.id, newTitle.trim());
        // Dynamic UI refresh
        setScans(scans.map(s => s.id === item.id ? { ...s, title: newTitle.trim() } : s));
      } catch (err) {
        console.error('[ScanNest DB] Rename failure: ', err);
        alert('Failed to rename document index.');
      }
    }
  };

  // Extract PDF Blob from IndexedDB and download again locally
  const handleDownload = (item: ScannedDocRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (item.type === 'qr') {
      if (item.value) {
        try {
          navigator.clipboard.writeText(item.value);
          alert('Copied QR code value to clipboard!');
        } catch (err) {
          console.error('[ScanNest History] Clipboard copy failed: ', err);
        }
      }
      return;
    }
    
    if (item.pdfBlob && item.fileName) {
      try {
        // 1. Create client-side temporary Object URL
        const fileUrl = URL.createObjectURL(item.pdfBlob);
        
        // 2. Spawn temporary dynamic link anchor to trigger browser download
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = item.fileName;
        document.body.appendChild(link);
        link.click();
        
        // 3. Clean up node and revoke URL
        document.body.removeChild(link);
        URL.revokeObjectURL(fileUrl);
      } catch (err) {
        console.error('[ScanNest History] Binary download extraction failed: ', err);
        alert('Could not compile PDF download.');
      }
    }
  };

  const formatDate = (timestamp: number) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(timestamp).toLocaleDateString('en-US', options);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Run metadata matches search filtering
  const filteredScans = scans.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.fileName && item.fileName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (item.value && item.value.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = activeFilter === 'all' || 
                          (activeFilter === 'pdf' && item.type === 'document') || 
                          (activeFilter === 'qr' && item.type === 'qr');
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="scans-history-view">
      {/* Search & Filter Bar */}
      <section className="search-filter-section">
        <div className="search-bar-wrapper flex-center">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search local documents..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            id="history-search-input"
          />
          {searchQuery && (
            <button 
              id="history-search-clear"
              onClick={() => setSearchQuery('')} 
              className="search-clear-btn"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="filter-chips-row flex-center">
          <button 
            id="history-filter-all"
            onClick={() => setActiveFilter('all')} 
            className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
          >
            All Scans
          </button>
          <button 
            id="history-filter-pdf"
            onClick={() => setActiveFilter('pdf')} 
            className={`filter-tab ${activeFilter === 'pdf' ? 'active' : ''}`}
          >
            PDF Documents
          </button>
          <button 
            id="history-filter-qr"
            onClick={() => setActiveFilter('qr')} 
            className={`filter-tab ${activeFilter === 'qr' ? 'active' : ''}`}
          >
            QR Codes
          </button>
        </div>
      </section>

      {/* Scans List index */}
      <section className="scans-list-container">
        {loading ? (
          <div className="history-loader flex-center">
            <Loader2 size={36} className="loader-spin" />
            <span>Scanning local sandbox...</span>
          </div>
        ) : filteredScans.length > 0 ? (
          <div className="scans-list">
            {filteredScans.map((item) => (
              <div 
                key={item.id} 
                onClick={(e) => handleDownload(item, e)}
                className="scan-item-card tap-target clickable-card"
                title="Click to download again"
              >
                <div className="item-icon-wrapper flex-center">
                  {item.type === 'document' ? (
                    <FileText size={20} className="type-icon pdf" />
                  ) : (
                    <QrCode size={20} className="type-icon qr" />
                  )}
                </div>

                <div className="item-details">
                  <h4 className="item-title">{item.title}</h4>
                  <div className="item-meta flex-center">
                    <span className="meta-detail flex-center">
                      <Calendar size={12} />
                      {formatDate(item.createdAt)}
                    </span>
                    <span className="meta-divider">•</span>
                    {item.type === 'document' ? (
                      <span className="meta-detail content-detail">
                        {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'} ({formatBytes(item.sizeBytes || 0)})
                      </span>
                    ) : (
                      <span className="meta-detail content-detail qr-value-text" title={item.value}>
                        {item.value}
                      </span>
                    )}
                  </div>
                </div>

                <div className="item-actions flex-center">
                  <button 
                    id={`history-btn-rename-${item.id}`}
                    onClick={(e) => handleRename(item, e)}
                    className="item-action-btn flex-center" 
                    title="Rename scan"
                  >
                    <Edit2 size={15} />
                  </button>
                  
                  {item.type === 'document' && (
                    <button 
                      id={`history-btn-download-${item.id}`}
                      onClick={(e) => handleDownload(item, e)}
                      className="item-action-btn download-btn flex-center" 
                      title="Re-download PDF file"
                    >
                      <FileDown size={16} />
                    </button>
                  )}
                  
                  <button 
                    id={`history-btn-delete-${item.id}`}
                    onClick={(e) => handleDelete(item.id, e)} 
                    className="item-action-btn delete-btn flex-center" 
                    title="Delete permanently"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="history-empty-state flex-center">
            <div className="empty-state-icon flex-center">
              <HardDrive size={28} />
            </div>
            <h4 className="empty-state-title">No local scans found</h4>
            <p className="empty-state-desc">
              Your device sandbox is currently empty. Navigate to Home to snap your first document or scan QR codes privately!
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
