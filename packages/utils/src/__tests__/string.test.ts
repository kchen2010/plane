import { describe, expect, it } from "vitest";
import { getFirstCharacters } from "../string";

describe("string utils - getFirstCharacters", () => {
  it("should return the first letter for a single-word name", () => {
    expect(getFirstCharacters("John")).toBe("J");
  });

  it("should return two initials for a two-word name", () => {
    expect(getFirstCharacters("John Doe")).toBe("JD");
  });

  it("should return only two initials even if the name has three words", () => {
    expect(getFirstCharacters("John Jacob Jingleheimer")).toBe("JJ");
  });

  it("should safely handle multiple spaces between words", () => {
    // The old code would fail this and return "J"
    expect(getFirstCharacters("Jane      Smith")).toBe("JS");
  });

  it("should force the initials to be uppercase", () => {
    expect(getFirstCharacters("alice bob")).toBe("AB");
  });

  it("should return a fallback '?' for empty strings or just spaces", () => {
    expect(getFirstCharacters("")).toBe("?");
    expect(getFirstCharacters("     ")).toBe("?");
  });

  it("should return a fallback '?' for null or undefined inputs", () => {
    expect(getFirstCharacters(null)).toBe("?");
    expect(getFirstCharacters(undefined)).toBe("?");
  });
});
