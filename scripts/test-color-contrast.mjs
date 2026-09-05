import assert from 'node:assert/strict'

function luminance(hex) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrast(foreground, background) {
  const left = luminance(foreground)
  const right = luminance(background)
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05)
}

const bodyPairs = [
  ['#18213d', '#ffffff', 'primary text'],
  ['#66708a', '#ffffff', 'muted body'],
  ['#6d758b', '#ffffff', 'quiet metadata'],
  ['#7357e8', '#ffffff', 'brand on white'],
  ['#5b43c7', '#f0ecff', 'selected navigation'],
  ['#865f1e', '#fff6e8', 'warning copy'],
  ['#16735f', '#e7f8f0', 'success badge'],
  ['#b33b55', '#fff0f2', 'error copy'],
  ['#17231a', '#d5e3cf', 'CW LCD text'],
  ['#f2f3ee', '#494f50', 'CW key face'],
  ['#f0d786', '#292d2e', 'CW SHIFT legends'],
  ['#e1ebdb', '#24372a', 'CW selected menu'],
]

for (const [foreground, background, label] of bodyPairs) {
  assert.ok(contrast(foreground, background) >= 4.5, `${label} must meet 4.5:1; received ${contrast(foreground, background).toFixed(2)}:1`)
}

console.log('Mini-program text color contrast checks passed.')
