import * as THREE from 'three';

/**
 * Extracts polylines from a BufferGeometry, joins them end-to-end,
 * and groups them based on connectivity.
 * 
 * @param {THREE.BufferGeometry} geometry - The buffer geometry containing polyline segments.
 * @param {number} [tolerance=1e-5] - Tolerance for merging vertices at the same position.
 * @returns {{ paths: THREE.Vector3[][], closed: boolean[] }} Object containing the paths and their closed flags.
 */
export function extractPolylines(geometry, tolerance = 1e-5) {
  const positionAttr = geometry.attributes.position;
  if (!positionAttr) {
    return { paths: [], closed: [] };
  }

  // Helper to round coordinates to avoid float precision issues when hashing
  const precision = Math.round(-Math.log10(tolerance));
  function getVertexKey(x, y, z) {
    return `${x.toFixed(precision)},${y.toFixed(precision)},${z.toFixed(precision)}`;
  }

  // 1. Gather all unique vertices and merge by position
  const vertices = [];
  const keyToNodeId = new Map();

  function getOrCreateNode(x, y, z) {
    const key = getVertexKey(x, y, z);
    if (keyToNodeId.has(key)) {
      return keyToNodeId.get(key);
    }
    const nodeId = vertices.length;
    vertices.push(new THREE.Vector3(x, y, z));
    keyToNodeId.set(key, nodeId);
    return nodeId;
  }

  // 2. Gather edges (pairs of node IDs)
  const edges = [];
  const indexAttr = geometry.index;

  if (indexAttr) {
    const index = indexAttr.array;
    for (let i = 0; i < index.length; i += 2) {
      if (i + 1 >= index.length) break;
      const idxA = index[i];
      const idxB = index[i + 1];

      const xA = positionAttr.getX(idxA);
      const yA = positionAttr.getY(idxA);
      const zA = positionAttr.getZ(idxA);

      const xB = positionAttr.getX(idxB);
      const yB = positionAttr.getY(idxB);
      const zB = positionAttr.getZ(idxB);

      const nodeA = getOrCreateNode(xA, yA, zA);
      const nodeB = getOrCreateNode(xB, yB, zB);

      if (nodeA !== nodeB) {
        edges.push([nodeA, nodeB]);
      }
    }
  } else {
    // Unindexed geometry
    for (let i = 0; i < positionAttr.count; i += 2) {
      if (i + 1 >= positionAttr.count) break;
      const xA = positionAttr.getX(i);
      const yA = positionAttr.getY(i);
      const zA = positionAttr.getZ(i);

      const xB = positionAttr.getX(i + 1);
      const yB = positionAttr.getY(i + 1);
      const zB = positionAttr.getZ(i + 1);

      const nodeA = getOrCreateNode(xA, yA, zA);
      const nodeB = getOrCreateNode(xB, yB, zB);

      if (nodeA !== nodeB) {
        edges.push([nodeA, nodeB]);
      }
    }
  }

  // 3. Build adjacency list representation of the graph
  const adjacency = Array.from({ length: vertices.length }, () => new Set());
  for (const [u, v] of edges) {
    adjacency[u].add(v);
    adjacency[v].add(u);
  }

  const visitedEdges = new Set();
  function getEdgeKey(u, v) {
    return u < v ? `${u}-${v}` : `${v}-${u}`;
  }

  const paths = [];
  const closedFlags = [];

  // Helper to trace from a starting node along available unvisited edges
  function tracePath(startNode) {
    const path = [startNode];
    let currentNode = startNode;
    let done = false;

    while (!done) {
      let nextNode = null;
      for (const neighbor of adjacency[currentNode]) {
        const edgeKey = getEdgeKey(currentNode, neighbor);
        if (!visitedEdges.has(edgeKey)) {
          visitedEdges.add(edgeKey);
          nextNode = neighbor;
          break;
        }
      }

      if (nextNode !== null) {
        path.push(nextNode);
        currentNode = nextNode;
      } else {
        done = true;
      }
    }
    return path;
  }

  // 4. Trace open paths first (starting from nodes of degree 1)
  for (let i = 0; i < vertices.length; i++) {
    // Find unvisited/partially-visited paths starting at a dead end (degree 1)
    let unvisitedEdgeCount = 0;
    let firstUnvisitedNeighbor = null;

    for (const neighbor of adjacency[i]) {
      if (!visitedEdges.has(getEdgeKey(i, neighbor))) {
        unvisitedEdgeCount++;
        if (firstUnvisitedNeighbor === null) {
          firstUnvisitedNeighbor = neighbor;
        }
      }
    }

    // If it's a dead end for remaining edges, start tracing
    if (unvisitedEdgeCount === 1) {
      const nodePath = tracePath(i);
      if (nodePath.length > 1) {
        const points = nodePath.map(id => vertices[id]);
        paths.push(points);
        closedFlags.push(false);
      }
    }
  }

  // 5. Trace remaining closed loops (all remaining active nodes will have degree 2 or more)
  for (let i = 0; i < vertices.length; i++) {
    let hasUnvisited = false;
    for (const neighbor of adjacency[i]) {
      if (!visitedEdges.has(getEdgeKey(i, neighbor))) {
        hasUnvisited = true;
        break;
      }
    }

    if (hasUnvisited) {
      const nodePath = tracePath(i);
      if (nodePath.length > 1) {
        const points = nodePath.map(id => vertices[id]);
        // Check if it forms a closed loop
        const startPt = points[0];
        const endPt = points[points.length - 1];
        const isClosed = startPt.distanceTo(endPt) <= tolerance;
        if (isClosed) points.pop();
        paths.push(points);
        closedFlags.push(isClosed);
      }
    }
  }

  return {
    paths,
    closed: closedFlags
  };
}
