function blockContribution(block) {
  return (block.progress * block.weight) / 100;
}

function legScore(blocks, leg) {
  const inLeg = blocks.filter(b => b.legs.includes(leg));
  if (inLeg.length === 0) return 0;
  const sum = inLeg.reduce((s, b) => s + blockContribution(b), 0);
  return sum / inLeg.length;
}

function computeKPI(blocks, legWeights) {
  let weightedSum = 0;
  let weightSum = 0;
  for (const leg in legWeights) {
    const score = legScore(blocks, leg);
    weightedSum += score * legWeights[leg];
    weightSum += legWeights[leg];
  }
  return weightSum > 0 ? weightedSum / weightSum : 0;
}

function statusFor(actual, expected) {
  if (actual >= expected + 10) return 'ahead';
  if (actual <= expected - 10) return 'delayed';
  return 'on_track';
}

function statusLabel(s) {
  return s === 'on_track' ? 'ON TRACK' : s.toUpperCase();
}