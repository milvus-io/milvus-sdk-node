# Next.js with Milvus Node SDK - Zilliz Cloud Management

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app) and integrated with [Milvus Node SDK](https://github.com/milvus-io/milvus-sdk-node). It provides a web interface for managing Zilliz Cloud databases and collections using the HttpClient API.

## Features

- **Authentication**: Connect to Zilliz Cloud using endpoint address and API token
- **Database Management**: List and browse databases
- **Collection Management**: View collections within each database
- **Collection Details**: 
  - Schema view: Display collection schema with field information
  - Data view: Browse collection data with pagination

## Installation

Install dependencies:

```bash
yarn install
```

## Configuration

The `next.config.js` is configured to handle server-side bundling of `@zilliz/milvus2-sdk-node`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@zilliz/milvus2-sdk-node"],
  outputFileTracingIncludes: {
    "/api/**/*": ["node_modules/@zilliz/milvus2-sdk-node/dist/proto/**/*"],
  },
};

module.exports = nextConfig;
```

## Usage

### Development

Run the development server:

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Application Flow

1. **Login**: Enter your Zilliz Cloud endpoint and API token
2. **Database List**: View all available databases
3. **Collection List**: Select a database to view its collections
4. **Collection Detail**: Click on a collection to view:
   - **Schema Tab**: Collection schema with field details
   - **Data Tab**: Collection data with pagination

### API Endpoints

**Authentication:**
- `POST /api/auth/connect` - Connect to Zilliz Cloud (requires `address` and `token`)

**Databases:**
- `GET /api/databases` - List all databases

**Collections:**
- `GET /api/databases/[dbName]/collections` - List collections in a database
- `GET /api/databases/[dbName]/collections/[collectionName]/schema` - Get collection schema
- `GET /api/databases/[dbName]/collections/[collectionName]/data` - Get collection data (supports `limit` and `offset` query params)

## Architecture

- **Frontend**: Next.js App Router with React Server Components and Client Components
- **UI Components**: shadcn/ui components (Card, Table, Tabs, etc.)
- **Backend**: Next.js API Routes using Milvus Node SDK HttpClient
- **Authentication**: Cookie-based session management
- **Client Management**: Server-side HttpClient cache using Map

## Deployment

### Vercel

1. Push your code to a Git repository
2. Import the project in [Vercel Dashboard](https://vercel.com/dashboard)
3. Deploy

No environment variables are required - users authenticate through the login page.
