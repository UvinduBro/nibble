// "How to play" + tips for every game. Shown before a game starts (first time), from the ? button,
// and one tip rotates on the result screen.
export const GUIDES = {
  blast: {
    goal: 'Fill whole rows or columns to clear them. The game ends when none of your 3 shapes fit.',
    steps: ['Drag a shape from the side onto the board.', 'Complete a full row or column to clear it and score.', 'Clear several lines at once, or in a row, for combo points.'],
    tips: ['Keep the middle open: big shapes need room.', 'Place the awkward 3×3 and long bars first, while there’s space.', 'Don’t fill corners one cell at a time; leave space for L-shapes.'],
  },
  merge: {
    goal: 'Drop fruit into the jar. Two of the same fruit merge into a bigger one. Don’t let the pile cross the line.',
    steps: ['Move left and right to aim.', 'Click, tap or press Space to drop.', 'Match the same fruit to merge them and score.'],
    tips: ['Keep big fruit in one corner and build towards it.', 'Small fruit can roll into gaps, so aim for the sides.', 'Look at the next fruit before you drop the current one.'],
  },
  p2048: {
    goal: 'Slide all the pets together. Two of the same merge into the next pet. Reach the dragon!',
    steps: ['Use the arrow keys, or swipe.', 'Every move slides every pet as far as it can go.', 'A new small pet appears after each move.'],
    tips: ['Pick a corner and keep your biggest pet there.', 'Mostly use only 2 or 3 directions.', 'Don’t chase merges that pull your big pet out of its corner.'],
  },
  flappy: {
    goal: 'Fly through the gaps between the windows. Each gap is a point.',
    steps: ['Tap, click or press Space to flap.', 'Let go to fall a little.', 'Hitting a window or the floor ends the game.'],
    tips: ['Tap in a steady rhythm, not in panic bursts.', 'Aim for the middle of each gap.', 'Watch the next gap, not your pet.'],
  },
  wordle: {
    goal: 'Guess today’s 5-letter word in 6 tries. Points once a day; a new word every day.',
    steps: ['Type a 5-letter word and press Enter.', 'Green: right letter, right spot. Yellow: in the word, wrong spot. Grey: not in the word.', 'Use the colours to narrow it down.'],
    tips: ['Start with a word full of common letters, like STARE or CRANE.', 'Don’t reuse grey letters.', 'Fewer guesses means more points.'],
  },
  snake: {
    goal: 'Eat snacks to grow longer. Don’t run into the walls or your own tail.',
    steps: ['Steer with the arrow keys or by swiping.', 'Each snack is points and makes you longer.', 'The game speeds up as you grow.'],
    tips: ['Move along the edges when you’re long.', 'Leave yourself an escape route before grabbing a snack.', 'Don’t turn back on yourself.'],
  },
  snack: {
    goal: 'Catch falling snacks with your pet. Avoid the bugs.',
    steps: ['Move with the mouse, your finger, or ← →.', 'Each snack is a point; ⭐ stars are worth more.', 'Catching a bug costs a heart. Lose all 3 hearts and it’s over.'],
    tips: ['Stay near the middle so you can reach both sides.', 'Ignore a far-away snack if a bug is in the way.', 'It speeds up over time: keep calm.'],
  },
  hop: {
    goal: 'Run along the taskbar and jump over the clutter for as long as you can.',
    steps: ['Space, ↑ or tap to jump.', 'Tap again in the air for a double jump.', 'Hitting anything ends the run.'],
    tips: ['Jump a little early for tall things.', 'Save the double jump for when you need it.', 'It speeds up, so get your timing right early.'],
  },
  stack: {
    goal: 'Stack ice cream scoops as high as you can. Overhanging parts fall off.',
    steps: ['A scoop slides from side to side.', 'Tap, click or press Space to drop it.', 'Miss the stack completely and it’s over.'],
    tips: ['Drop when the scoop lines up exactly for a Perfect (+1 bonus, no shrinking).', 'Watch the edge of the scoop, not the middle.', 'It gets faster as you go: breathe.'],
  },
  bugs: {
    goal: 'Squash as many bugs as you can in 30 seconds. Don’t tap the pets!',
    steps: ['Click or tap a bug when it pops out of a window.', 'Ladybugs 🐞 are worth 3. Tapping a pet costs 3 points.', 'Score as many as you can before time runs out.'],
    tips: ['Keep your eyes moving across all the windows.', 'Look before you tap: pets pop out too.', 'Fast bugs disappear sooner; get them first.'],
  },
  memory: {
    goal: 'Find every matching pair of animals with as few flips as possible.',
    steps: ['Flip two cards at a time.', 'A match stays face up.', 'No match? They flip back over.'],
    tips: ['Flip cards in order so you remember where things are.', 'Say the animals in your head as you flip.', 'Fewer moves means more points.'],
  },
  dance: {
    goal: 'Watch the dance moves, then copy them in the same order. Each round adds one move.',
    steps: ['Watch your pet’s moves.', 'Repeat them with ← → ↑ ↓ or the buttons.', 'One wrong move ends the game.'],
    tips: ['Say the moves out loud: left, up, up, right…', 'Group them in threes to remember longer dances.', 'Take your time: there’s no rush when copying.'],
  },
  pool: {
    goal: 'Pot all 10 balls in 12 shots. Each ball is 10 points; potting 2+ in one shot is a combo bonus. Clearing the table gives +5 per shot left.',
    steps: ['Press anywhere and drag backwards, like pulling a slingshot: the direction sets your aim, the length sets the power.', 'Let go to shoot. A quick tap just aims at that spot.', 'The dotted line shows where the cue ball goes; the yellow line shows where the ball you hit will go.', 'Keys: ← → to aim, ↑ ↓ for power, Space to shoot.'],
    tips: ['Use soft shots for balls near a pocket.', 'Potting the white ball (a scratch) costs you a shot.', 'Line up the yellow guide with a pocket before you shoot.', 'Break the pack with a strong first shot.'],
  },
  ludo: {
    goal: 'Get all 4 of your tokens (blue) around the board and into the middle before the computer does.',
    steps: ['Click the dice or press Space to roll.', 'You need a 6 to move a token out of your base.', 'Click a glowing token (or press 1–4) to move it.', 'Land exactly in the middle to get a token home.'],
    tips: ['Rolling a 6, capturing, or getting a token home gives you another roll.', 'Land on an opponent to send them back to their base!', 'Squares with a ★ and coloured start squares are safe: nobody can capture you there.', 'Three 6s in a row loses your turn.'],
  },
  // friend games
  ttt: {
    goal: 'Get 3 of your marks in a row (across, down or diagonal) before your friend does.',
    steps: ['The challenger goes first with ❌.', 'Take turns tapping an empty square.', 'A full board with no line is a draw.'],
    tips: ['Take the middle if you can.', 'Corners are stronger than edges.', 'Always block when your friend has two in a row.'],
  },
  c4: {
    goal: 'Get 4 of your discs in a row (across, down or diagonal) before your friend does.',
    steps: ['Tap a column to drop your disc to the lowest free spot.', 'Take turns with your friend.', 'A full board with no line is a draw.'],
    tips: ['Play the middle columns: they’re part of the most lines.', 'Watch for your friend’s diagonals.', 'Set up two threats at once so they can only block one.'],
  },
};

export const tipFor = (key, n = Date.now()) => {
  const g = GUIDES[key];
  if (!g || !g.tips.length) return '';
  return g.tips[Math.floor(n / 1000) % g.tips.length];
};
