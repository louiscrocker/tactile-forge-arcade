// =====================================================
// Tactile Forge — AI heading selection
// =====================================================

export function pickAIHeading(engine, player) {
  const idx = player.currentMark % engine.course.marks.length;
  const direct = engine.angleToMark(player, idx);
  const directPOS = engine.getPointOfSail(direct);

  if (directPOS.modifier >= 1) return direct + (Math.random() - 0.5) * 12;

  if (directPOS.modifier <= 0) {
    const wind = engine.getWindAngle();
    const t1 = (wind + 50) % 360;
    const t2 = (wind - 50 + 360) % 360;
    const d1 = Math.abs(engine.angleDifference(t1, direct));
    const d2 = Math.abs(engine.angleDifference(t2, direct));
    let chosen = d1 < d2 ? t1 : t2;
    chosen = avoidCollisions(engine, player, chosen);
    const jitter = engine.difficulty === 'easy' ? 28 : engine.difficulty === 'hard' ? 8 : 16;
    return chosen + (Math.random() - 0.5) * jitter;
  }
  return direct + (Math.random() - 0.5) * 8;
}

function avoidCollisions(engine, player, heading) {
  const r = (heading - 90) * Math.PI / 180;
  const px = player.x + Math.cos(r) * 0.05;
  const py = player.y + Math.sin(r) * 0.05;
  for (const o of engine.players) {
    if (o.id === player.id || o.finished) continue;
    if (Math.hypot(px - o.x, py - o.y) < 0.04) {
      return heading + (Math.random() < 0.5 ? 18 : -18);
    }
  }
  return heading;
}

export function aiShouldRest(engine, player) {
  if (player.crewStamina > 18) return false;
  return engine.distanceToMark(player, player.currentMark) > 0.16;
}
