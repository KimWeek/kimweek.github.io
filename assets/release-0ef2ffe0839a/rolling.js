const reels = new WeakMap();

export function rollingText(element, text, immediate = false) {
  text = String(text);
  if (element.dataset.value === text) return;
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = typeof matchMedia !== "undefined" && matchMedia("(hover: none), (pointer: coarse)").matches;
  let state = reels.get(element);
  if (touch) {
    state?.slots.forEach(slot => clearTimeout(slot?.timer));
    reels.delete(element); element.textContent = text;
    element.dataset.value = text; element.setAttribute("aria-label", text);
    return;
  }
  if (!state || state.text.length !== text.length || element.children.length !== text.length) {
    state?.slots.forEach(slot => clearTimeout(slot?.timer));
    element.replaceChildren();
    const slots = [...text].map(character => {
      const wrapper = document.createElement("span");
      wrapper.setAttribute("aria-hidden", "true");
      if (!/\d/.test(character)) {
        wrapper.className = "reel-separator";
        wrapper.textContent = character;
        element.append(wrapper);
        return null;
      }
      wrapper.className = "digit-slot";
      const strip = document.createElement("span");
      strip.className = "digit-strip";
      for (const digit of "01234567890") {
        const item = document.createElement("span");
        item.textContent = digit;
        strip.append(item);
      }
      wrapper.append(strip);
      element.append(wrapper);
      return { strip, digit: -1, timer: 0 };
    });
    state = { slots, text };
    reels.set(element, state);
    immediate = true;
  }
  state.slots.forEach((slot, index) => {
    if (!slot) return;
    const digit = Number(text[index]);
    if (slot.digit === digit) return;
    clearTimeout(slot.timer);
    const wrap = slot.digit === 9 && digit === 0 && !immediate && !reduce;
    slot.strip.style.transition = immediate || reduce ? "none" : "";
    slot.strip.style.transform = `translate3d(0, -${wrap ? 10 : digit}em, 0)`;
    if (wrap) slot.timer = setTimeout(() => {
      slot.strip.style.transition = "none";
      slot.strip.style.transform = "translate3d(0, 0, 0)";
    }, 720);
    slot.digit = digit;
  });
  state.text = text;
  element.dataset.value = text;
  element.setAttribute("aria-label", text);
}
