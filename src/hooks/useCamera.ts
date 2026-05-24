import { useState, useCallback, useRef } from 'react';

export type CameraFacingMode = 'user' | 'environment';

export interface UseCameraResult {
  stream: MediaStream | null;
  loading: boolean;
  error: string | null;
  facingMode: CameraFacingMode;
  startCamera: (mode?: CameraFacingMode) => Promise<MediaStream | null>;
  stopCamera: () => void;
  switchCamera: () => Promise<MediaStream | null>;
  captureFrame: (videoElement: HTMLVideoElement | null) => string | null;
}

export const useCamera = (): UseCameraResult => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('environment');
  
  // Keep track of the active stream via ref to handle cleanups reliably
  const activeStreamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`[ScanNest Camera] Stopped track: ${track.label}`);
      });
      activeStreamRef.current = null;
      setStream(null);
    }
  }, []);

  const startCamera = useCallback(async (mode: CameraFacingMode = facingMode): Promise<MediaStream | null> => {
    // Stop any existing stream first to avoid hardware locking
    stopCamera();
    
    setLoading(true);
    setError(null);
    
    // Check browser compatibility
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errMsg = 'Camera APIs are not supported by this browser. Please use Chrome, Safari, or a modern mobile browser.';
      setError(errMsg);
      setLoading(false);
      return null;
    }

    // Set constraints optimized for document scanning clarity
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: mode,
        width: { ideal: 1920, max: 3840 },
        height: { ideal: 1080, max: 2160 },
      },
      audio: false
    };

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      activeStreamRef.current = mediaStream;
      setStream(mediaStream);
      setFacingMode(mode);
      setLoading(false);
      return mediaStream;
    } catch (err: any) {
      console.error('[ScanNest Camera Error] ', err);
      let userFriendlyError = 'Failed to open camera. Please make sure no other apps are using it.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userFriendlyError = 'Camera permission was denied. Please enable camera access in your browser settings to scan.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        userFriendlyError = 'No camera hardware detected on this device.';
      } else if (err.name === 'OverconstrainedError') {
        // Fallback constraint attempt in case high resolution constraints are rejected
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          activeStreamRef.current = fallbackStream;
          setStream(fallbackStream);
          setFacingMode(mode);
          setLoading(false);
          return fallbackStream;
        } catch (fallbackErr) {
          userFriendlyError = 'Your hardware does not match the scanning resolution requirements.';
        }
      }

      setError(userFriendlyError);
      setLoading(false);
      return null;
    }
  }, [facingMode, stopCamera]);

  const switchCamera = useCallback(async (): Promise<MediaStream | null> => {
    const nextMode: CameraFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    return startCamera(nextMode);
  }, [facingMode, startCamera]);

  const captureFrame = useCallback((videoElement: HTMLVideoElement | null): string | null => {
    if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
      console.warn('[ScanNest Camera] Cannot capture: Video element is not fully initialized');
      return null;
    }

    try {
      // Create offscreen canvas for snapshot draw
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Draw the active video frame pixels onto canvas
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // Export frame as compressed JPEG
      return canvas.toDataURL('image/jpeg', 0.9);
    } catch (captureErr) {
      console.error('[ScanNest Camera] Frame extraction failed: ', captureErr);
      return null;
    }
  }, []);

  return {
    stream,
    loading,
    error,
    facingMode,
    startCamera,
    stopCamera,
    switchCamera,
    captureFrame
  };
};
