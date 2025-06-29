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
- `NEXT_PUBLIC_ADMIN_PASSWORD` — Admin login password
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (for privileged operations)
- `RESEND_API_KEY` — For sending confirmation emails

### 3. **Build and deploy**
```bash
npm run build
# Deploy to Netlify (drag & drop .next folder or use Netlify CLI)
netlify deploy --prod --dir=.next
```

### 4. **Environment variables on Netlify**
Make sure to set these environment variables in your Netlify dashboard:
- `NEXT_PUBLIC_ADMIN_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- All other environment variables from your `.env.local`

### 5. **Custom domain (optional)**
- In Netlify dashboard, add a custom domain (e.g. `admin.toohot.kitchen`)

## 🛠️ Usage
- Log in with your admin password
- View, search, and manage reservations
- Create, edit, and cancel reservations
- See live stats and system status
- Track revenue and customer analytics

---

For full deployment instructions, see `../NETLIFY_DEPLOYMENT_GUIDE.md`. 