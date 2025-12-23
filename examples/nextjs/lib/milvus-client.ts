import { HttpClient } from '@zilliz/milvus2-sdk-node';
import { randomUUID } from 'crypto';

const clientCache = new Map<string, HttpClient>();

export interface ClientInfo {
  clientId: string;
  client: HttpClient;
  address: string;
  createdAt: Date;
}

export function getClient(clientId: string): HttpClient | null {
  return clientCache.get(clientId) || null;
}

export function createClient(
  address: string,
  token: string
): { clientId: string; client: HttpClient } {
  const clientId = randomUUID();
  const client = new HttpClient({
    endpoint: address,
    token,
  });

  clientCache.set(clientId, client);

  return { clientId, client };
}

export function removeClient(clientId: string): void {
  clientCache.delete(clientId);
}

export function getClientInfo(clientId: string): ClientInfo | null {
  const client = clientCache.get(clientId);
  if (!client) return null;

  return {
    clientId,
    client,
    address: client.config.endpoint || '',
    createdAt: new Date(),
  };
}

export async function getOrRecreateClient(
  clientId: string,
  address?: string,
  token?: string
): Promise<HttpClient | null> {
  let client = getClient(clientId);
  
  if (!client && address && token) {
    // Recreate client and update cache with same clientId
    const newClient = new HttpClient({
      endpoint: address,
      token,
    });
    clientCache.set(clientId, newClient);
    client = newClient;
  }
  
  return client;
}
