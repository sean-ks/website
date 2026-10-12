// Session state shared by the shell, tmux and input, changed only through its setters (P is the shell running the current command).
export let P = null, liveFetch = null, server = null, client = null, plain = null, plainWin = null, prefixArmed = 0, repeatUntil = 0, confirmYes = null;
export const setP = v => { P = v; };
export const setLiveFetch = v => { liveFetch = v; };
export const setServer = v => { server = v; };
export const setClient = v => { client = v; };
export const setPlain = (p, w) => { plain = p; plainWin = w; };
export const setPrefixArmed = v => { prefixArmed = v; };
export const setRepeatUntil = v => { repeatUntil = v; };
export const setConfirmYes = v => { confirmYes = v; };
