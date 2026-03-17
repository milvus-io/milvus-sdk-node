/**
 * Bitset flags for cluster capabilities.
 */
export const ClusterCapability = {
  READABLE: 0b01, // bit 0
  WRITABLE: 0b10, // bit 1
  PRIMARY: 0b11, // read + write
} as const;

/**
 * Information about a cluster in the global topology.
 */
export interface ClusterInfo {
  clusterId: string;
  endpoint: string;
  capability: number;
}

/**
 * Global cluster topology containing all clusters.
 */
export interface GlobalTopology {
  version: number;
  clusters: ClusterInfo[];
}
