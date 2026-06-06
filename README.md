# AppForge 🛠️📊

AppForge is a premium, full-stack, metadata-driven application builder and runtime environment. It allows users to instantly design, validate, preview, and deploy database-backed SaaS products directly from a JSON configuration file. Built using **Next.js 16**, **TypeScript**, **PostgreSQL (via Neon)**, and **Prisma ORM**, AppForge features a custom schema validation playground, automated CSV type inference engines, version rollbacks, and code exporters.

The platform is designed around a sleek, high-end **Sparkline/base44** aesthetic, featuring clean light-gray grid layouts, elegant pill-shaped navigation, custom 3D orbiting illustrations, and fluid micro-animations.

---

## 🚀 Key Features & Core Engines

### 1. ⚡ Dynamic Metadata CRUD Engine
* **Schema-Driven UI**: AppForge compiles a JSON schema definition into a fully interactive user interface with real-time validation.
* **Smart Input Rendering**: Renders custom UI controls according to column data types (e.g., custom toggle switches for booleans, inline date-pickers for dates, and styled dropdown selectors for enums).
* **Automatic Validation**: Submissions are dynamically checked against defined data types, constraints, and custom rules before saving to PostgreSQL.

### 2. 📱 Local Network PWA & "Deploy to Phone"
* **Primary IP Resolution API**: Uses a custom server-side utility (`/api/local-ip`) that reads active network interfaces and resolves the host machine's primary local network IPv4 address (e.g., `192.168.X.X`).
* **Dynamic QR-Code Generator**: Replaces `localhost` dynamically with the server's local IP on the deployment preview sheet, allowing any mobile device connected to the same Wi-Fi network to scan the QR code.
* **Instant PWA Installation**: Mobile users can view the dynamic web app prototype in real-time and install it as a progressive web application directly on their phones.

### 3. 🛡️ Config Validator & Sanitation Playground
* **Sanitation Sandbox**: A standalone playground page (`/playground`) featuring a custom schema sanitation pipeline.
* **Interactive Presets**: Includes 8 preset malformed/broken JSON examples (missing properties, invalid fields, duplicate column keys, non-JSON formats).
* **Real-time Diagnostics**: Runs validation routines and returns a side-by-side display of warnings, fatal errors, and the cleaned, normalized JSON output.

### 4. 📂 CSV Type Inference & Bulk Insert Engine
* **Drag-and-Drop Upload**: Instantly upload any tabular CSV files via the `/import` route.
* **Automatic Reverse Engineering**: The engine samples rows to automatically deduce columns, types (e.g., date, boolean, number, string), and unique enum options.
* **Grid Mapping & Preview**: Displays a beautiful data grid mapping view. Users can verify inferred schemas and adjust column names or types before creating the database schema.
* **Transactional Bulk Insert**: Inserts thousands of rows in a single batch-based Prisma transaction.

### 5. 🔄 Schema Versioning & Safe Rollbacks
* **Config History Log**: Every schema modification creates a versioned snapshot of the application config.
* **Split-Panel Comparison**: View old config definitions side-by-side with current schema states.
* **One-Click Restore**: Revert the entire database-backed UI runtime to any historical configuration without losing existing record data.

### 6. 🐙 Standalone GitHub Exporter
* **Secure Client-Side Packaging**: Creates an external standalone Next.js code repository containing seed data, database configurations, and custom CRUD views.
* **One-Click Vercel Deploy**: Instantly generates an Octokit-powered repository and provides a preconfigured deployment link for Vercel.

### 7. 🎨 Premium Landing & Login Showcase
* **Responsive Scrolling Fold**: Supports smooth page-scrolling to explore platform capabilities without interfering with the OAuth authentication card.
* **Sleek Side-Spread 3D Graphics**: Orbiting 3D isometric cards float on the outer left and right margins (`top-[22%]` and `top-[55%]`) to frame the landing fold layout elegantly.
* **Interactive Feature Walkthrough**: Centers a custom-designed timeline map, a 2x2 grid highlighting AppForge advantages, and an animated foot-to-top scroll assistant.

---

## 📐 Architecture & Database Schema

AppForge uses a highly normalized schema to run arbitrary user applications on top of a single shared database structure.

Loom tradeoff line: "I chose JSON blob storage over dynamic Prisma migrations because runtime schema generation is unsafe at this scope."

```mermaid
erDiagram
    User ||--o{ App : "creates"
    User ||--o{ Account : "authenticates"
    User ||--o{ Session : "maintains"
    App ||--o{ AppRecord : "stores data"
    App ||--o{ AppVersion : "tracks configs"
    
    User {
        string id PK
        string name
        string email
        string image
        datetime createdAt
    }
    
    App {
        string id PK
        string name
        string description
        json config "Schema Definition"
        string userId FK
        datetime createdAt
    }
    
    AppRecord {
        string id PK
        string appId FK
        string entity "Table Name"
        json data "User-submitted fields"
        datetime createdAt
    }
    
    AppVersion {
        string id PK
        string appId FK
        int version
        json config "Archived Schema Definition"
        datetime createdAt
    }
```

---

## 🛠️ Technology Stack & Dependencies

* **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **Styling**: Vanilla CSS (Tailored variables, grid-bg patterns, keyframe micro-animations, Outfit displaying sans font)
* **ORM**: [Prisma Client & Migrate](https://www.prisma.io/)
* **Database**: [Neon Serverless PostgreSQL](https://neon.tech/)
* **Authentication**: [NextAuth.js (v5 Beta)](https://next-auth.js.org/)
* **API Utilities**: `@octokit/rest` (GitHub client), `papaparse` (CSV Parser)

---

## ⚙️ Local Development Setup

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/THISHA-SAMPATH/AppForge.git
cd AppForge
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory and add the following keys:
```env
DATABASE_URL="postgresql://<username>:<password>@<neon-host>/neondb?sslmode=require"

# NextAuth configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-development-secret-key"

# OAuth Credentials
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

### 3. Setup Database Schema
Run migrations to set up the database structure on your Neon instance:
```bash
npx prisma db push
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) or connect mobile devices on your Wi-Fi using the network IP shown in the console.

---

## 🚀 Deployment to Vercel

1. Push your code to your GitHub repository.
2. Sign in to [Vercel](https://vercel.com/) and click **Add New** ➡️ **Project**.
3. Select your `AppForge` repository.
4. Configure the environment variables in Vercel to match your production Neon Database credentials.
5. Click **Deploy**. Vercel will build and launch your application automatically.
