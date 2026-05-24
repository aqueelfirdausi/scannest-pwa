# ScanNest — Calm, Local-First Student Scanner & QR Utility

ScanNest is an ad-free, local-first, privacy-respecting student document scanner and offline QR utility. It operates entirely on-device, processing pixels and persistent binary data inside the secure sandbox of the student's local browser context. 

Developed as a private local utility by **Novart Systems**, ScanNest protects students from predatory subscription loops, invasive telemetry trackers, and ad banners.

---

## Key Features

1. **True Mobile Document Scanner**:
   - Live rear camera feed integration with high-precision boundary previews.
   - Shutter button with instant captured previews, visual contrast filters (Greyscale, High-Contrast, Enhanced), and safe page-cropping layouts.
   - **Multi-page Page Tray**: Accumulate scanned pages, re-order sheets, add/delete captures, and compile directly into one unified PDF.

2. **Decentralized Local PDF Compiler**:
   - High-performance, client-side PDF rendering powered by `jsPDF`.
   - Real, baked canvas image filter output (processed grayscale/contrast matrices are baked directly into the image elements, not just rendered visually with CSS filters).

3. **Dual-Engine Offline QR & Barcode Decoder**:
   - **Native-First**: Uses native browser `BarcodeDetector` when available (highly optimized on mobile devices).
   - **Lightweight Fallback**: Integrates offline `jsQR` canvas parsing when native detectors are missing (providing maximum coverage across iOS Safari and older browsers).
   - **Battery & CPU Conservation**: Runs on a throttled **250ms** loop under `requestAnimationFrame` with automatic loop-pausing on detection.

4. **Zero-Cloud Persistent Storage**:
   - Custom vanilla Promise-based **IndexedDB** database sandbox wrapper (`db.ts`).
   - Keeps your compiled PDF files and scanned QR links intact across app reloads and network blackouts.
   - 100% private. Zero cloud servers, cookies, accounts, tracking, or telemetry scripts.

5. **Installable Progressive Web App (PWA)**:
   - Modern offline Service Worker caching (`sw.js`).
   - Compliant PWA manifest referencing our custom visual logo identities.
   - Designed to run seamlessly offline as a standalone native app on iOS and Android homescreens.

---

## 🎨 Visual Identity & Color System

ScanNest is designed with a premium, low-contrast, calm academic workspace aesthetic:
- **Warm Off-White (`#FAF9F6`)**: Primary surface layout backgrounds to prevent student eye strain.
- **Deep Ink Charcoal (`#1A1D20`)**: Deep neutral colors for typography and dark-mode structures.
- **Soft Indigo (`#4F46E5`)**: Active focal action items and main scanner guides.
- **Calm Cyan (`#06B6D4`)**: Specialized QR code elements.
- **Muted Emerald (`#10B981`)**: Success notifications and secure data checkpoints.

---

## 🛠️ Installation & Local Development

Ensure you have Node.js installed locally.

1. **Clone & Setup**:
   ```bash
   cd ScanNest
   npm install
   ```

2. **Run Dev Environment**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` on your local network to test.

3. **Compile Production Build**:
   ```bash
   npm run build
   ```
   The production output is built cleanly into the `dist/` directory.

---

## 🚀 Final Production Deployment (Vercel)

ScanNest is 100% serverless, static, and client-side, making it highly optimized for zero-cost hosting platforms like Vercel, Netlify, or GitHub Pages.

### Vercel Deployment Checklist
1. **GitHub Repository Setup**:
   - Create a private or public repository on GitHub: `github.com/novart-systems/scannest`.
   - Initialize git, commit your files, and push to remote:
     ```bash
     git init
     git add .
     git commit -m "feat: complete Phase 3 final polish & branding"
     git branch -M main
     git remote add origin <your-repo-link>
     git push -u origin main
     ```

2. **Link to Vercel**:
   - Go to your Vercel Dashboard, select **New Project**, and import your GitHub repository.
   - **Framework Preset**: Detects `Vite` automatically.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - Click **Deploy**.

3. **HTTPS Verification**:
   - Secure media capture APIs (`navigator.mediaDevices.getUserMedia`) and the `BarcodeDetector` **strictly require HTTPS** in production browsers (except `localhost` for local audits).
   - Ensure the Vercel deployment points to a valid SSL/TLS domain to allow mobile camera permissions.

4. **PWA Installability Verification**:
   - Once deployed, open ScanNest in mobile Safari (tap Share -> *Add to Home Screen*) or mobile Chrome (tap the *Install ScanNest* prompt).
   - Verify it operates stand-alone and loads instantly in offline flight modes.

---

## 🤝 Project Credits & Open Source

ScanNest is built with care as a privacy-respecting student utility under the **Novart Systems** private software portfolio. 
The codebase is structured to be 100% local, ad-free, and open for academic audits.
