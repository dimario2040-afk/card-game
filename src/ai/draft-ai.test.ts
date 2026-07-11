import { describe, it, expect } from "vitest";
import { decideDraftAction } from "./draft-ai";
import type { Card } from "../types/card";

describe("Draft AI", () => {
  it("should select 1 hero and up to 5 units", () => {
    const hand: Card[] = [
      { suit: "hearts", rank: "2" },
      { suit: "diamonds", rank: "3" },
      { suit: "clubs", rank: "4" },
      { suit: "spades", rank: "5" },
      { suit: "hearts", rank: "6" },
      { suit: "diamonds", rank: "7" }
    ];
    const action = decideDraftAction(hand);
    expect(action.units.length).toBe(5);
  });

  it("should pick highest rank as hero", () => {
    const hand: Card[] = [
      { suit: "hearts", rank: "2" },
      { suit: "spades", rank: "A" },
      { suit: "clubs", rank: "10" }
    ];
    const action = decideDraftAction(hand);
    expect(action.hero.rank).toBe("A");
  });
});
