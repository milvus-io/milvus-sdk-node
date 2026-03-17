import { logger } from './logger';
import {
  ClusterCapability,
  ClusterInfo,
  GlobalTopology,
} from '../types/GlobalCluster';

// Re-export types for convenience
export { ClusterCapability, ClusterInfo, GlobalTopology };

// Identifier used in URIs to detect global cluster endpoints
export const GLOBAL_CLUSTER_IDENTIFIER = 'global-cluster';

// Retry constants for topology fetch
const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // ms
const MAX_DELAY = 10000; // ms
const REQUEST_TIMEOUT = 10000; // ms

// Default refresh interval for topology refresher
export const DEFAULT_REFRESH_INTERVAL = 300000; // 5 minutes in ms

/**
 * Check if a ClusterInfo is the primary (writable) cluster.
 */
export function isPrimaryCluster(cluster: ClusterInfo): boolean {
  return (cluster.capability & ClusterCapability.WRITABLE) !== 0;
}

/**
 * Get the primary cluster from a topology.
 * @throws Error if no primary cluster is found.
 */
export function getPrimaryCluster(topology: GlobalTopology): ClusterInfo {
  const primary = topology.clusters.find(isPrimaryCluster);
  if (!primary) {
    throw new Error('No primary cluster found in topology');
  }
  return primary;
}

/**
 * Check if the URI points to a global cluster endpoint.
 */
export function isGlobalEndpoint(uri: string): boolean {
  if (!uri) return false;
  return uri.toLowerCase().includes(GLOBAL_CLUSTER_IDENTIFIER);
}

/**
 * Parse the topology response from the REST API.
 */
function parseTopologyResponse(data: {
  version: string;
  clusters: Array<{
    clusterId: string;
    endpoint: string;
    capability: number;
  }>;
}): GlobalTopology {
  return {
    version: parseInt(data.version, 10),
    clusters: data.clusters.map(c => ({
      clusterId: c.clusterId,
      endpoint: c.endpoint,
      capability: c.capability,
    })),
  };
}

/**
 * Fetch the global cluster topology from the REST API.
 *
 * @param globalEndpoint - The global cluster endpoint URL
 * @param token - Authentication token
 * @returns GlobalTopology object containing cluster information
 * @throws Error if topology cannot be fetched after retries
 */
export async function fetchTopology(
  globalEndpoint: string,
  token: string
): Promise<GlobalTopology> {
  // Build the topology URL
  let endpoint = globalEndpoint.replace(/\/+$/, '');
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    endpoint = `https://${endpoint}`;
  }
  const url = `${endpoint}/${GLOBAL_CLUSTER_IDENTIFIER}/topology`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT
      );

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        const err = new Error(
          `Topology request failed with status ${response.status}: ${text}`
        );
        // Only retry on 5xx server errors; 4xx are permanent (auth, bad request, etc.)
        if (response.status >= 400 && response.status < 500) {
          throw err;
        }
        throw Object.assign(err, { retryable: true });
      }

      const result = await response.json();

      if (result.code !== undefined && result.code !== 0) {
        // API-level error, don't retry
        throw new Error(result.message || 'Unknown API error');
      }

      return parseTopologyResponse(result.data);
    } catch (e: any) {
      // Only retry network errors, timeouts, and 5xx errors
      if (!e.retryable && e.name !== 'AbortError' && !e.message?.includes('fetch failed')) {
        throw e;
      }

      lastError = e;
      if (attempt < MAX_RETRIES - 1) {
        const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
        const jitter = delay * 0.1 * Math.random();
        logger.warn(
          `Topology fetch attempt ${attempt + 1} failed: ${e.message}. Retrying in ${(delay + jitter).toFixed(0)}ms`
        );
        await new Promise(resolve =>
          setTimeout(resolve, delay + jitter)
        );
      }
    }
  }

  throw new Error(
    `Failed to fetch global topology after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
}

/**
 * Background refresher that periodically fetches the global cluster topology.
 */
export class TopologyRefresher {
  private globalEndpoint: string;
  private token: string;
  private topology: GlobalTopology;
  private refreshInterval: number;
  private onTopologyChange?: (topology: GlobalTopology) => void;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;

  constructor(options: {
    globalEndpoint: string;
    token: string;
    topology: GlobalTopology;
    refreshInterval?: number;
    onTopologyChange?: (topology: GlobalTopology) => void;
  }) {
    this.globalEndpoint = options.globalEndpoint;
    this.token = options.token;
    this.topology = options.topology;
    this.refreshInterval =
      options.refreshInterval ?? DEFAULT_REFRESH_INTERVAL;
    this.onTopologyChange = options.onTopologyChange;
  }

  /** Start the background refresh interval. */
  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(
      () => this.tryRefresh(),
      this.refreshInterval
    );
    // Allow the Node.js process to exit even if the interval is still running
    if (this.intervalId && typeof this.intervalId === 'object' && 'unref' in this.intervalId) {
      this.intervalId.unref();
    }
  }

  /** Stop the background refresh interval. */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Check if the refresher is running. */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /** Get the current topology. */
  getTopology(): GlobalTopology {
    return this.topology;
  }

  /** Trigger an immediate topology refresh (debounced). */
  triggerRefresh(): void {
    if (this.refreshing) return;
    this.refreshing = true;
    this.tryRefresh().finally(() => {
      this.refreshing = false;
    });
  }

  private async tryRefresh(): Promise<void> {
    try {
      const newTopology = await fetchTopology(
        this.globalEndpoint,
        this.token
      );

      if (newTopology.version > this.topology.version) {
        const oldVersion = this.topology.version;
        this.topology = newTopology;
        logger.info(
          `Topology updated: version ${oldVersion} -> ${newTopology.version}`
        );

        if (this.onTopologyChange) {
          try {
            this.onTopologyChange(newTopology);
          } catch {
            logger.warn('Topology change callback failed');
          }
        }
      }
    } catch {
      logger.warn('Topology refresh failed');
      // Keep using cached topology, will retry next interval
    }
  }
}
