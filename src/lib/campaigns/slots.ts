/**
 * Calcule les créneaux d'envoi disponibles en respectant :
 * - les jours autorisés (0=dimanche ... 6=samedi)
 * - la plage horaire autorisée
 * - la limite quotidienne d'emails
 * - un intervalle minimum (avec une part aléatoire) entre deux emails
 *
 * `alreadyScheduledCounts` doit contenir, par jour (clé "YYYY-MM-DD"), le nombre
 * d'emails déjà programmés pour ce jour, afin de ne jamais dépasser la limite
 * quotidienne même en ajoutant des créneaux au fil de plusieurs appels.
 */
export function computeNextSlots(params: {
  count: number;
  from: Date;
  sendDays: number[];
  sendStartHour: number;
  sendEndHour: number;
  dailyLimit: number;
  minIntervalMinutes: number;
  alreadyScheduledCounts: Record<string, number>;
}): Date[] {
  const {
    count,
    from,
    sendDays,
    sendStartHour,
    sendEndHour,
    dailyLimit,
    minIntervalMinutes,
    alreadyScheduledCounts,
  } = params;

  const slots: Date[] = [];
  const counts = { ...alreadyScheduledCounts };

  let cursor = new Date(from);

  const dayKey = (d: Date) => d.toISOString().slice(0, 10);

  const isAllowedDay = (d: Date) => sendDays.includes(d.getDay());

  const clampToWindow = (d: Date) => {
    const day = new Date(d);
    if (day.getHours() < sendStartHour) {
      day.setHours(sendStartHour, 0, 0, 0);
    }
    return day;
  };

  cursor = clampToWindow(cursor);

  while (slots.length < count) {
    if (!isAllowedDay(cursor) || cursor.getHours() >= sendEndHour) {
      // passe au jour suivant, ouverture à l'heure de début
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(sendStartHour, 0, 0, 0);
      continue;
    }

    const key = dayKey(cursor);
    const usedToday = counts[key] ?? 0;

    if (usedToday >= dailyLimit) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(sendStartHour, 0, 0, 0);
      continue;
    }

    slots.push(new Date(cursor));
    counts[key] = usedToday + 1;

    // intervalle minimum + variation aléatoire raisonnable (jusqu'à +50%)
    const jitter = Math.random() * minIntervalMinutes * 0.5;
    cursor = new Date(cursor.getTime() + (minIntervalMinutes + jitter) * 60_000);
  }

  return slots;
}
