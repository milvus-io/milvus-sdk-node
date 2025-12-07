# Retry Mechanism

The Milvus Node.js SDK implements an automatic retry mechanism for gRPC requests using a custom interceptor. This document explains how the retry logic works.

## Overview

The retry mechanism is implemented as a gRPC interceptor (`getRetryInterceptor`) that automatically retries failed requests based on specific conditions. It uses exponential backoff to space out retry attempts.

## Configuration

You can configure the retry behavior when creating a MilvusClient instance:

```typescript
const client = new MilvusClient({
  address: 'localhost:19530',
  maxRetries: 3,      // Maximum number of retry attempts (default: 3)
  retryDelay: 10,     // Base delay in milliseconds (default: 10ms)
});
```

| Parameter   | Type   | Default | Description                                    |
|-------------|--------|---------|------------------------------------------------|
| maxRetries  | number | 3       | Maximum number of retry attempts               |
| retryDelay  | number | 10      | Base delay in milliseconds between retries     |

## Retry Conditions

A request will be retried when either of the following conditions is met:

- **Invalid Message Response**: The response message is considered invalid (checked by `isInvalidMessage`)
- **Retryable gRPC Status Code**: The gRPC status code is NOT in the ignore list

### Non-Retryable gRPC Status Codes

The following gRPC status codes will NOT trigger a retry (they are in the ignore list):

| Status Code         | Reason                                          |
|---------------------|-------------------------------------------------|
| OK                  | Request succeeded                               |
| DEADLINE_EXCEEDED   | Request timed out                               |
| PERMISSION_DENIED   | Deterministic error, retry won't help           |
| UNAUTHENTICATED     | Authentication failed, retry won't help        |
| INVALID_ARGUMENT    | Bad request parameters, retry won't help        |
| ALREADY_EXISTS      | Resource already exists, retry won't help       |
| RESOURCE_EXHAUSTED  | Quota exceeded, retry may worsen the issue      |
| UNIMPLEMENTED       | Feature not supported, retry won't help         |

### Retryable gRPC Status Codes

All other gRPC status codes will trigger a retry, including:

| Status Code | Description                        |
|-------------|------------------------------------|
| UNAVAILABLE | Service temporarily unavailable    |
| INTERNAL    | Internal server error              |
| UNKNOWN     | Unknown error                      |
| ABORTED     | Operation was aborted              |
| DATA_LOSS   | Unrecoverable data loss            |

## Exponential Backoff

The retry delay increases exponentially with each attempt using the formula:

```
delay = 2^retryCount × retryDelay
```

Example (with default `retryDelay = 10ms`):

| Attempt | Delay Calculation | Actual Delay |
|---------|-------------------|--------------|
| 1       | 2¹ × 10ms         | 20ms         |
| 2       | 2² × 10ms         | 40ms         |
| 3       | 2³ × 10ms         | 80ms         |

## Deadline Handling

Each retry attempt resets the deadline to ensure consistent timeout behavior:

```typescript
options.deadline = new Date(Date.now() + timeout);
```

The original timeout duration is preserved across all retry attempts.

## Error Information

When all retry attempts are exhausted and the request still fails, the error message is enriched with retry information:

```
Original error message (retried 3 times, 250ms)
```

This helps with debugging and understanding the total time spent on the request.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        gRPC Request                                 │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Retry Interceptor                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  1. Save metadata and message                               │   │
│  │  2. Execute gRPC call                                       │   │
│  │  3. Receive response                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────┐
                    │  Check Response   │
                    └───────────────────┘
                                │
            ┌───────────────────┴───────────────────┐
            │                                       │
            ▼                                       ▼
   ┌─────────────────┐                    ┌─────────────────┐
   │  Invalid Msg OR │                    │   Valid Msg AND │
   │  Retryable Code │                    │  Non-Retryable  │
   └─────────────────┘                    └─────────────────┘
            │                                       │
            ▼                                       ▼
   ┌─────────────────┐                    ┌─────────────────┐
   │ retryCount <    │                    │ Return Response │
   │ maxRetries?     │                    │                 │
   └─────────────────┘                    └─────────────────┘
            │
      ┌─────┴─────┐
      │           │
     YES          NO
      │           │
      ▼           ▼
┌───────────┐ ┌─────────────────┐
│  Wait     │ │ Return Error    │
│  (exp     │ │ with retry info │
│  backoff) │ └─────────────────┘
└───────────┘
      │
      ▼
┌───────────────────┐
│  Retry Request    │
│  (reset deadline) │
└───────────────────┘
```

## Logging

The retry mechanism logs detailed information at the debug level:

- `[Request]` - Initial request with method name and timeout
- `[Response]` - Response received (red for errors, green for success)
- `[Retry Delay]` - Delay before retry attempt
- `[Retry Attempt]` - Retry attempt number
- `[Retry Executing]` - Retry request being sent
- `[Failed after retries]` - Final failure after all retries exhausted
