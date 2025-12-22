# Next.js with Milvus Node SDK - Insertion Task Manager

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app) and integrated with [Milvus Node SDK](https://github.com/milvus-io/milvus-sdk-node). It provides a task-based interface for managing Milvus data insertion tasks.

## Installation

Install dependencies:

```bash
npm install
# or
yarn install
```

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Upstash Redis Configuration (Required)
KV_REST_API_URL=https://your-database.upstash.io
KV_REST_API_TOKEN=your_token_here

# Milvus Configuration
MILVUS_ADDRESS=127.0.0.1:19530
MILVUS_TOKEN=

# Cron Secret (optional, for local testing)
CRON_SECRET=your_secret_key
```

### Getting Upstash Redis Credentials

1. Go to [Upstash Console](https://console.upstash.com/)
2. Find your database (e.g., `upstash-kv-teal-umbrella`)
3. Copy the `REST API URL` and `REST API TOKEN`
4. Add them to your `.env.local` file as `KV_REST_API_URL` and `KV_REST_API_TOKEN`

**Important**: For Vercel deployment, add these environment variables in the Vercel Dashboard under Project Settings → Environment Variables.

## Configuration

Update `next.config.js`, Server-side bundling ignores @zilliz/milvus2-sdk-node.

Fixed the issue of "Unable to load service: milvus.proto.milvus.MilvusService"

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@zilliz/milvus2-sdk-node'],
    outputFileTracingIncludes: {
      // When deploying to Vercel, the following configuration is required
      '/api/**/*': ['node_modules/@zilliz/milvus2-sdk-node/dist/proto/**/*'],
    },
  },
};

module.exports = nextConfig;
```

### monorepo

you can try this tip:

```javascript
config.externals.push('@zilliz/milvus2-sdk-node');
```

## Usage

### Development

Run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Features

- **Task Management**: Create, start, stop, and delete insertion tasks
- **Scheduling Options**:
  - One-time insertion
  - Interval-based insertion (with optional end time)
- **Server-side Execution**: Tasks run via Vercel Cron Jobs (every minute)
- **Real-time Updates**: Task status and statistics update automatically

### API Endpoints

**Task Management:**
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create a new task
- `PUT /api/tasks` - Update a task
- `DELETE /api/tasks?id={taskId}` - Delete a task
- `GET /api/cron/tasks` - Cron job endpoint (executes every minute)

**Milvus Collections:**
- `GET /api/milvus/collections` - List Milvus collections

## Deployment

### Vercel

1. Push your code to a Git repository
2. Import the project in [Vercel Dashboard](https://vercel.com/dashboard)
3. Add environment variables in Project Settings
4. Deploy

The Cron Job will automatically run every minute on Vercel deployments.
