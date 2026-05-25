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

  const startCamera = useCallback(async (mode: CameraFacingMode = 'environment'): Promise<MediaStream | null> => {
    // Stop any existing stream first to avoid hardware locking
    stopCamera();

    setLoading(true);
    setError(null);

    // Check for insecure context (camera requires HTTPS or localhost)
    if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      const errMsg = 'Camera requires a secure connection (HTTPS). Please access this app via its HTTPS URL.';
      setError(errMsg);
      setLoading(false);
      return null;
    }

    // Check browser compatibility
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errMsg = 'Camera is not supported by this browser or context. Please use Chrome or Safari on a modern device.';
      setError(errMsg);
      setLoading(false);
      return null;
    }

    // Strategy 1: Try with ideal facingMode + ideal resolution (most compatible)
    const primaryConstraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: mode },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    };

    // Strategy 2: Minimal fallback — just request any video (widest compatibility)
    const fallbackConstraints: MediaStreamConstraints = {
      video: true,
      audio: false,
    };

    let mediaStream: MediaStream | null = null;

    try {
      console.log('[ScanNest Camera] Attempting primary constraints:', JSON.stringify(primaryConstraints));
      mediaStream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
    } catch (primaryErr: any) {
      console.warn('[ScanNest Camera] Primary constraints failed:', primaryErr.name, primaryErr.message);

      // For overconstrained or not-found, retry with simple constraints
      if (
        primaryErr.name === 'OverconstrainedError' ||
        primaryErr.name === 'ConstraintNotSatisfiedError' ||
        primaryErr.name === 'NotFoundError' ||
        primaryErr.name === 'DevicesNotFoundError'
      ) {
        try {
          console.log('[ScanNest Camera] Retrying with simple fallback constraints...');
          mediaStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        } catch (fallbackErr: any) {
          console.error('[ScanNest Camera] Fallback also failed:', fallbackErr.name, fallbackErr.message);
          // Fall through to error handling below using fallbackErr
          const userFriendlyError = resolveErrorMessage(fallbackErr);
          setError(userFriendlyError);
          setLoading(false);
          return null;
        }
      } else {
        // Non-overconstrained errors (permission denied, in use, etc.)
        const userFriendlyError = resolveErrorMessage(primaryErr);
        setError(userFriendlyError);
        setLoading(false);
        return null;
      }
    }

    if (mediaStream) {
      activeStreamRef.current = mediaStream;
      setStream(mediaStream);
      setFacingMode(mode);
      setLoading(false);
      console.log('[ScanNest Camera] Stream acquired successfully. Tracks:', mediaStream.getTracks().map(t => t.label));
      return mediaStream;
    }

    setError('Failed to open camera. Please try again.');
    setLoading(false);
    return null;
  }, [stopCamera]);

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
    captureFrame,
  };
};

/**
 * Map MediaDevices API error names to clear, user-facing messages.
 */
function resolveErrorMessage(err: any): string {
  const name: string = err?.name ?? '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission was denied. Please open your browser settings, allow camera access for this site, then tap Retry.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device. Please ensure a camera is connected and not blocked by another app.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Camera is already in use by another app or tab. Please close other camera apps and tap Retry.';
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'Your camera does not support the required settings. Please tap Retry to try with basic settings.';
  }
  if (name === 'SecurityError') {
    return 'Camera access is blocked due to a security policy. Please ensure this app is accessed over HTTPS.';
  }
  if (name === 'AbortError') {
    return 'Camera access was interrupted. Please tap Retry.';
  }
  if (name === 'TypeError') {
    return 'Camera request failed due to invalid settings. Please tap Retry.';
  }

  return `Failed to open camera (${name || 'unknown error'}). Please close other camera apps and tap Retry.`;
}
