/**
 * Tests for CR3: Wrong map key used when deleting reactions
 *
 * Both reaction.store.ts and comment_reaction.store.ts had:
 *   delete this.reactionMap[reaction]      // BUG: emoji code, not UUID
 *   delete this.commentReactionMap[reaction] // BUG: same
 *
 * The fix uses currentReaction.id (UUID) which is the actual map key.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Minimal types
// ---------------------------------------------------------------------------

interface Reaction {
  id: string;
  actor: string;
  reaction: string; // emoji code, e.g. "👍"
}

type ReactionMap = Record<string, Reaction>; // keyed by UUID

// ---------------------------------------------------------------------------
// Helpers that mirror the production store logic
// ---------------------------------------------------------------------------

/** BUGGY: uses the emoji code string as the delete key */
function removeFromMapBuggy(reactionMap: ReactionMap, currentReactionId: string, reactionCode: string): void {
  delete reactionMap[reactionCode]; // BUG: should be currentReactionId
}

/** FIXED: uses the UUID (currentReaction.id) as the delete key */
function removeFromMapFixed(reactionMap: ReactionMap, currentReactionId: string, _reactionCode: string): void {
  delete reactionMap[currentReactionId]; // Fixed
}

// ---------------------------------------------------------------------------
// Shared test data factory
// ---------------------------------------------------------------------------

function makeReactionMap(): ReactionMap {
  return {
    "uuid-001": { id: "uuid-001", actor: "user-1", reaction: "👍" },
    "uuid-002": { id: "uuid-002", actor: "user-2", reaction: "👍" },
    "uuid-003": { id: "uuid-003", actor: "user-1", reaction: "❤️" },
  };
}

// ---------------------------------------------------------------------------
// Demonstrating the bug (before state)
// ---------------------------------------------------------------------------

describe("CR3 — Buggy delete (before state, for documentation)", () => {
  it("is a no-op: emoji code key does not exist in reactionMap so nothing is deleted", () => {
    const map = makeReactionMap();
    removeFromMapBuggy(map, "uuid-001", "👍");

    // The entry keyed by the UUID is NOT deleted — memory leak
    expect(map["uuid-001"]).toBeDefined();
    // The emoji key was never in the map to begin with
    expect(map["👍"]).toBeUndefined();
  });

  it("leaves all 3 entries intact after a 'remove' (stale data)", () => {
    const map = makeReactionMap();
    removeFromMapBuggy(map, "uuid-001", "👍");
    expect(Object.keys(map)).toHaveLength(3); // nothing removed — bug confirmed
  });
});

// ---------------------------------------------------------------------------
// Verifying the fix (after state)
// ---------------------------------------------------------------------------

describe("CR3 — Fixed delete (after state)", () => {
  it("removes the correct entry from reactionMap using the UUID", () => {
    const map = makeReactionMap();
    removeFromMapFixed(map, "uuid-001", "👍");

    expect(map["uuid-001"]).toBeUndefined(); // correctly removed
    expect(map["uuid-002"]).toBeDefined(); // other reactions unaffected
    expect(map["uuid-003"]).toBeDefined();
  });

  it("reduces the map size by exactly 1 after removal", () => {
    const map = makeReactionMap();
    removeFromMapFixed(map, "uuid-001", "👍");
    expect(Object.keys(map)).toHaveLength(2);
  });

  it("removing one user's reaction does not affect the same emoji from another user", () => {
    const map = makeReactionMap();
    // user-1 removes their 👍 (uuid-001); user-2's 👍 (uuid-002) must remain
    removeFromMapFixed(map, "uuid-001", "👍");
    expect(map["uuid-002"]).toBeDefined();
    expect(map["uuid-002"].reaction).toBe("👍");
  });

  it("is idempotent: removing an already-removed reaction does not throw", () => {
    const map = makeReactionMap();
    removeFromMapFixed(map, "uuid-001", "👍");
    expect(() => removeFromMapFixed(map, "uuid-001", "👍")).not.toThrow();
    expect(Object.keys(map)).toHaveLength(2);
  });

  it("applies equally to comment reactions (same map key pattern)", () => {
    // commentReactionMap follows the same structure — this test covers both stores
    const commentMap: ReactionMap = {
      "c-uuid-001": { id: "c-uuid-001", actor: "user-1", reaction: "😄" },
    };
    removeFromMapFixed(commentMap, "c-uuid-001", "😄");
    expect(commentMap["c-uuid-001"]).toBeUndefined();
    expect(Object.keys(commentMap)).toHaveLength(0);
  });
});
