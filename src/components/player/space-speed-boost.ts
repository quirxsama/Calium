type SpeedBoostPlayer = {
  playbackRate: number;
  remoteControl: { togglePaused: (event: KeyboardEvent) => void };
};

const INTERACTIVE_TARGETS = 'button, a, input, textarea, select, [contenteditable], [role="button"], [role="slider"], [role^="menuitem"], [role="option"], [role="switch"], [role="textbox"]';

export function bindSpaceSpeedBoost(
  el: HTMLElement,
  player: SpeedBoostPlayer,
  enabled: boolean,
  onBoostChange: (active: boolean) => void,
): () => void {
  let pressed = false;
  let boosted = false;
  let previousRate = 1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const isSpace = (event: KeyboardEvent) => event.code === "Space" || event.key === " ";
  const consume = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    pressed = false;
    if (boosted) {
      player.playbackRate = previousRate;
      boosted = false;
      onBoostChange(false);
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!isSpace(event) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    if (event.target instanceof Element && event.target.closest(INTERACTIVE_TARGETS)) return;
    consume(event);
    if (pressed || event.repeat) return;
    pressed = true;
    if (!enabled) {
      player.remoteControl.togglePaused(event);
      return;
    }
    timer = setTimeout(() => {
      timer = undefined;
      previousRate = Number.isFinite(player.playbackRate) && player.playbackRate > 0 ? player.playbackRate : 1;
      player.playbackRate = 2;
      boosted = true;
      onBoostChange(true);
    }, 500);
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (!isSpace(event) || !pressed) return;
    consume(event);
    const shortPress = !boosted;
    cancel();
    if (enabled && shortPress) player.remoteControl.togglePaused(event);
  };
  const onVisibilityChange = () => { if (document.hidden) cancel(); };
  const onFocusOut = (event: FocusEvent) => {
    if (!event.relatedTarget || !el.contains(event.relatedTarget as Node)) cancel();
  };

  el.addEventListener("keydown", onKeyDown, true);
  el.addEventListener("focusout", onFocusOut);
  document.addEventListener("keyup", onKeyUp, true);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("blur", cancel);
  return () => {
    cancel();
    el.removeEventListener("keydown", onKeyDown, true);
    el.removeEventListener("focusout", onFocusOut);
    document.removeEventListener("keyup", onKeyUp, true);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("blur", cancel);
  };
}
