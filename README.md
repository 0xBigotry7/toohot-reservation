# TooHot Admin Dashboard (Netlify)

This is the admin dashboard for TooHot Restaurant reservations. Deploy as a separate Netlify site for security and custom subdomain support.

## 🚀 Setup & Deployment

### 1. **Install dependencies**
```bash
cd reservation-system/admin-simple
npm install
```

### 2. **Configure environment**
Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_API_URL` — Your main site's Netlify Functions endpoint (e.g. `https://toohot.kitchen/.netlify/functions`)
- `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` — For simple admin login

### 3. **Build and deploy**
```bash
npm run build
# Deploy to Netlify (drag & drop .next folder or use Netlify CLI)
netlify deploy --prod --dir=.next
```

### 4. **Custom domain (optional)**
- In Netlify dashboard, add a custom domain (e.g. `admin.toohot.kitchen`)

## 🛠️ Usage
- Log in with your admin password
- View, search, and manage reservations
- See live stats and system status

---

For full deployment instructions, see `../NETLIFY_DEPLOYMENT_GUIDE.md`. 