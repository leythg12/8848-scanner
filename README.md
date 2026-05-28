# 8848 Club — Member Scanner

QR code scanner for 8848 Club Casablanca staff.  
Scans a member's QR code (containing their Wix Contact ID) and displays their name, email, phone number, and plan status in real time.

---

## Stack

- **Next.js 14** (App Router)
- **Wix SDK** (`@wix/sdk`, `@wix/contacts`, `@wix/pricing-plans`)
- Deployed on **Vercel** (free tier)
- Installable as a **PWA** on iPhone/iPad

---

## Project Structure

```
8848-scanner/
├── app/
│   ├── api/
│   │   └── member/
│   │       └── route.js        ← Server-side Wix API calls
│   ├── globals.css
│   ├── layout.js
│   ├── page.js                 ← Scanner UI
│   └── page.module.css
├── public/
│   └── manifest.json           ← PWA manifest
├── .env.local.example
├── .gitignore
├── next.config.js
└── package.json
```

---

## Setup & Deployment

### 1. Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- A [GitHub](https://github.com) account (free)
- A [Vercel](https://vercel.com) account (free, sign in with GitHub)

---

### 2. Configure Wix OAuth App

1. Go to your Wix dashboard → **Paramètres** → **OAuth Apps** (Headless)
2. Create a new OAuth app (or use the existing one with clientId `9478b40a-81d7-4f50-b129-f5a94343c23b`)
3. Make sure the app has these **permissions**:
   - `Contacts` → Read
   - `Pricing Plans` → Read Orders
4. Copy the **Client ID**

---

### 3. Set up the project locally

```bash
# Clone or download this folder, then:
cd 8848-scanner
npm install
```

Create your local env file:
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_WIX_CLIENT_ID=9478b40a-81d7-4f50-b129-f5a94343c23b
```

Test locally:
```bash
npm run dev
# Open http://localhost:3000
```

---

### 4. Deploy to Vercel

#### Option A — Via GitHub (recommended)

1. Create a new GitHub repository (private is fine)
2. Push this folder:
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/8848-scanner.git
git push -u origin main
```
3. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
4. In **Environment Variables**, add:
   - Key: `NEXT_PUBLIC_WIX_CLIENT_ID`
   - Value: `9478b40a-81d7-4f50-b129-f5a94343c23b`
5. Click **Deploy**

Vercel gives you a URL like `https://8848-scanner.vercel.app` — you can also add a custom domain.

#### Option B — Via Vercel CLI

```bash
npm i -g vercel
vercel
# Follow prompts, add env var when asked
```

---

### 5. Install as PWA on iPhone/iPad (staff devices)

1. Open the Vercel URL in **Safari** on the iPhone/iPad
2. Tap the **Share** button (box with arrow)
3. Tap **"Sur l'écran d'accueil"** (Add to Home Screen)
4. Tap **Ajouter**

The app now appears as a full-screen app icon on the home screen — no App Store needed.

---

## QR Code format

The QR codes must encode the **Wix Contact ID** of the member — a UUID in the format:
```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

The scanner also supports URLs containing the UUID (e.g. `https://yoursite.com/member/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) — it extracts the UUID automatically.

To generate QR codes for your members, you can use the Wix Contacts export to get Contact IDs, then generate QR codes with any tool (e.g. [qr-code-generator.com](https://www.qr-code-generator.com)).

---

## Security note

The Wix Client ID (`NEXT_PUBLIC_WIX_CLIENT_ID`) is safe to expose publicly — it only allows read access via OAuth and cannot be used to modify data. The actual API calls happen server-side in `/app/api/member/route.js`.

If you want to restrict access to staff only, add a simple passcode screen — ask Claude to add one.
