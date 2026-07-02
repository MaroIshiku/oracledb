const redactionGlyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&?=+";

function scrambleText(length) {
  let output = "";
  for (let index = 0; index < length; index += 1) {
    output += redactionGlyphs[Math.floor(Math.random() * redactionGlyphs.length)];
  }
  return output;
}

const redactions = [...document.querySelectorAll("[data-redacted]")].map((node) => ({
  node,
  length: Number(node.dataset.length || node.textContent.length || 8),
}));

if (redactions.length) {
  const tick = () => {
    for (const item of redactions) {
      item.node.textContent = scrambleText(item.length);
    }
  };
  tick();
  window.setInterval(tick, 95);
}
