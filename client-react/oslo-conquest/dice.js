// Viser kampoppgjøret som en popup med terningøyne og resultat.
// Skjules igjen når spilleren klikker "Fortsett".

const DICE_FACES = ['','⚀','⚁','⚂','⚃','⚄','⚅'];

export function showDiceResult(result) {
  const el = document.getElementById('dice-display');
  el.style.display = 'block';

  document.getElementById('attacker-name').textContent = result.attackerName || 'Angriper';
  document.getElementById('defender-name').textContent = result.defenderName || 'Forsvarer';

  document.getElementById('attacker-dice').innerHTML = (result.attackerDice || [])
    .map(d => `<div class="die attacker">${DICE_FACES[d]}</div>`).join('');
  document.getElementById('defender-dice').innerHTML = (result.defenderDice || [])
    .map(d => `<div class="die defender">${DICE_FACES[d]}</div>`).join('');

  document.getElementById('dice-result').textContent = result.attackerWins
    ? `✅ Angriperen vinner! Forsvarer tapte ${result.defenderLost} bat.`
    : `❌ Angrepet mislyktes. Angriper tapte ${result.attackerLost} bat.`;
}

export function closeDice() {
  document.getElementById('dice-display').style.display = 'none';
}
