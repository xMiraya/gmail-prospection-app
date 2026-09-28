import { describe, it, expect } from "vitest";
import { computeNextSlots } from "@/lib/campaigns/slots";

describe("computeNextSlots", () => {
  it("ne dépasse jamais la limite quotidienne", () => {
    const from = new Date("2025-01-06T08:00:00"); // lundi
    const slots = computeNextSlots({
      count: 10,
      from,
      sendDays: [1, 2, 3, 4, 5],
      sendStartHour: 9,
      sendEndHour: 17,
      dailyLimit: 3,
      minIntervalMinutes: 1,
      alreadyScheduledCounts: {},
    });

    const perDay: Record<string, number> = {};
    for (const s of slots) {
      const key = s.toISOString().slice(0, 10);
      perDay[key] = (perDay[key] ?? 0) + 1;
    }
    for (const count of Object.values(perDay)) {
      expect(count).toBeLessThanOrEqual(3);
    }
    expect(slots).toHaveLength(10);
  });

  it("respecte les jours autorisés (jamais le week-end si exclu)", () => {
    const from = new Date("2025-01-10T16:00:00"); // vendredi après-midi
    const slots = computeNextSlots({
      count: 5,
      from,
      sendDays: [1, 2, 3, 4, 5],
      sendStartHour: 9,
      sendEndHour: 17,
      dailyLimit: 1,
      minIntervalMinutes: 1,
      alreadyScheduledCounts: {},
    });
    for (const s of slots) {
      expect([0, 6]).not.toContain(s.getDay());
    }
  });

  it("respecte la plage horaire", () => {
    const from = new Date("2025-01-06T08:00:00");
    const slots = computeNextSlots({
      count: 3,
      from,
      sendDays: [1, 2, 3, 4, 5],
      sendStartHour: 9,
      sendEndHour: 17,
      dailyLimit: 3,
      minIntervalMinutes: 1,
      alreadyScheduledCounts: {},
    });
    for (const s of slots) {
      expect(s.getHours()).toBeGreaterThanOrEqual(9);
      expect(s.getHours()).toBeLessThan(17);
    }
  });

  it("tient compte des créneaux déjà pris pour ne pas dépasser la limite au total", () => {
    const from = new Date("2025-01-06T09:00:00");
    const key = from.toISOString().slice(0, 10);
    const slots = computeNextSlots({
      count: 2,
      from,
      sendDays: [1, 2, 3, 4, 5],
      sendStartHour: 9,
      sendEndHour: 17,
      dailyLimit: 3,
      minIntervalMinutes: 1,
      alreadyScheduledCounts: { [key]: 2 },
    });
    // Un seul créneau restant aujourd'hui, le second doit basculer au jour suivant.
    expect(slots[0]?.toISOString().slice(0, 10)).toBe(key);
    expect(slots[1]?.toISOString().slice(0, 10)).not.toBe(key);
  });
});
