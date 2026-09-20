# Unified Utility Billing & Meter Management System

A centralized, role-based web application designed to digitize and automate the entire lifecycle of utility (Electricity & Water) billing. It replaces fragmented legacy processes with an integrated solution spanning field meter reading, automated dynamic bill generation, and administrative oversight.

## 🚀 Features

- **Unified Platform**: Manage both Water and Electricity utilities in a single application.
- **Dynamic Tariff Engine**: Admins can instantly edit pricing slabs and fixed charges without altering code.
- **Automated Billing**: Bills are calculated and generated instantly as soon as a meter reader submits a reading from the field.
- **Role-Based Workflows (RBAC)**:
  - **Admin**: Command center for managing revenue, consumer onboarding, meters, and dynamic tariffs.
  - **Meter Reader**: Mobile-optimized field interface for fast and validated reading entry.
  - **Consumer**: Transparent dashboard for viewing usage history, current dues, and past bills.
- **Modern UI/UX**: Built with a clean Bento-grid design system and Lucide icons for an intuitive, fast, and responsive user experience.

## 🛠️ Technology Stack

- **Backend**: Node.js & Express.js
- **Database**: MongoDB (via Mongoose ORM)
- **Frontend**: EJS (Embedded JavaScript) Templates with Vanilla CSS (Bento-grid architecture)
- **Authentication**: Session-based auth via `express-session` & `connect-mongo` (No JWTs/Tokens)

## 📦 Local Installation & Setup

### Prerequisites
- Node.js (v16+ recommended)
- MongoDB (Running locally or a MongoDB Atlas URI)

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/billing-system.git
cd billing-system
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root of the project (you can use `.env.example` as a template):
```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/billing_system
SESSION_SECRET=your_super_secret_session_key
```

### 4. Database Seeding (Initial Setup)
Since there is no public registration, you must seed the initial admin account to access the system:
```bash
node scripts/seed.js
```
*(This script typically creates a default admin user. Check `scripts/seed.js` for default credentials, usually `admin / admin123`)*

### 5. Start the Application
For development (with auto-reload):
```bash
npm run dev
```
For production:
```bash
npm start
```

The application will be running at `http://localhost:3000`.

## 🚢 Deployment Guidelines

This application is ready to be deployed to platforms like **Render**, **Heroku**, **Railway**, or **DigitalOcean**. 

### Deployment Checklist
1. **Database:** Ensure you are using a cloud MongoDB instance (e.g., MongoDB Atlas) and update your `MONGO_URI` environment variable on the host.
2. **Environment Variables:** Set all variables (`PORT`, `MONGO_URI`, `SESSION_SECRET`) in your hosting provider's dashboard. Do **not** commit the `.env` file.
3. **Session Store:** The app uses `connect-mongo` for session storage, which is perfectly suited for production and load balancing.
4. **Node Environment:** Set `NODE_ENV=production` in your hosting dashboard to enable Express production optimizations.
5. **Start Command:** Ensure your platform uses `npm start` (which runs `node server.js`) to start the server.

---
*Built for the Smart India Hackathon (SIH)*
