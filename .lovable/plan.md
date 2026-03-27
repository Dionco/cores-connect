

## Plan: Replace logo with uploaded SVG

The app currently imports `cores-logo.png` from `src/assets/` in both `LoginPage.tsx` and `AppLayout.tsx`. The user has uploaded the official Cores logo as an SVG file (`Cores_Logo_Tagline_RGB.svg`).

### Steps

1. **Copy the uploaded SVG** to `src/assets/cores-logo.svg`
2. **Update `LoginPage.tsx`** — change the import from `cores-logo.png` to `cores-logo.svg`
3. **Update `AppLayout.tsx`** — change the import from `cores-logo.png` to `cores-logo.svg`; the sidebar version already applies `brightness-0 invert` to make it white, which will work with the SVG

### Technical notes
- The SVG uses `fill: #284150` (dark navy), so it will display correctly on the login page's white background
- The sidebar's `brightness-0 invert` CSS filter will correctly invert it to white on the gradient background

