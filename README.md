# Sean Shiroma: personal site

A static site that looks and behaves like an Arch Linux terminal running tmux. On load it shows a fastfetch-style summary with a live glyph renderer in the logo position: a 3D shape raymarched with WebGL and drawn as terminal characters. Visitors then browse the files with `ls`, `cd`, `cat` and other commands, or with `view .`, a two-column file browser. tmux's keys split the window into panes and open more windows; each pane is its own shell.

It uses plain HTML, CSS and JavaScript. There is no build step, no framework and no third-party request.

## Files

```
index.html                  page shell, no-JS fallback, meta tags
style.css                   colours (light/dark), layout, fonts
content.js                  everything the terminal shows (edit this)
main.js                     the shells, tmux (panes, windows, status line), view, fastfetch screen
renderer.js                 the glyph renderer in the logo box (WebGL)
assets/favicon.svg          browser-tab icon
assets/novig-stats.js       Novig stats snapshot (generated, do not edit)
assets/fonts/               Geist Mono (latin subset + box-drawing subset) and its licence
assets/resume.pdf           your resume (add it, see below)
scripts/update-novig-stats.mjs     refreshes assets/novig-stats.js
.github/workflows/novig-stats.yml  runs that script every day
.nojekyll                   tells GitHub Pages to serve the files as they are
```

`index.html` loads `content.js`, `assets/novig-stats.js`, `renderer.js` and `main.js`, all with `defer`, in that order.

## Editing content

All text lives in `content.js` (`window.SITE`):

- `fetch`: the `Key: value` lines on the opening screen. `main.js` adds `OS` (fixed: `Arch Linux x86_64`) before them, and `Uptime`, `Resolution`, `Terminal`, `GPU`, `Locale` and `Theme` after them, which are live values from the visitor's browser.
- `fs`: the home directory (`/home/guest`, shown as `~`).
  - A string is a text file. Keep the backticks. A line starting with `- `, or a `key   value` line (a word, two or more spaces, then the value), wraps under its text on narrow screens, and URLs and email addresses become links.
  - An object is a folder.
  - `{ link: 'assets/resume.pdf' }` is a binary file that `open` launches in a new tab.
  - `{ generated: 'novig' }` is `novig-stats.txt`, built from `assets/novig-stats.js`.
  - Names starting with `.` are hidden unless `ls -a` is used.

Nothing in `main.js` lists the files: `ls`, `cat`, `tree`, `view` and tab completion show whatever `fs` contains, so a new file or folder only needs an entry there.

The `help` list is the `HELP` array in `main.js`. Two constants at the top of `main.js` set the time zone for `date`, `uptime` and `ls -l` (`TZ = 'America/New_York'`) and the kernel version `uname -r` prints (`KERNEL`).

## Commands

| Command | What it does |
| --- | --- |
| `help` | list the commands |
| `ls [-a] [-l] [-h] [path...]` | list a directory; directories are bold blue |
| `cd [dir]` | change directory; `cd` or `cd ~` goes home, `cd -` goes back |
| `pwd` | print the current directory |
| `cat file...` | print files |
| `view [dir]` | browse a directory: the tree on the left, the selected file on the right (see below) |
| `tree [-a] [dir]` | show the directory tree |
| `open file\|url` | open `resume.pdf` or a link in a new tab |
| `clear` | clear the screen (also Ctrl+L) |
| `fastfetch`, `neofetch` | print the opening summary again |
| `history [n]`, `history -c` | list or clear previous commands |
| `theme [dark\|light\|auto]` | switch colours; the choice is saved in `localStorage` under `theme` |
| `tmux [command]` | the tmux commands listed below |
| `exit`, `logout` | in a tmux pane: close the pane; in the plain shell (after a detach or exit): log out and start a new login |
| `whoami`, `hostname`, `uname [-a]`, `date`, `uptime [-p]`, `echo` | as on Linux |
| `sudo`, `pacman` | print what the real tools print for a user without root |

The shell also handles `'...'` and `"..."` quoting, `$VAR` and `$?`, `~`, and `;`, `&&` and `||`. Pipes and redirection are not supported.

Keys: Tab completes commands, paths and tmux commands (a second Tab lists the candidates), Up and Down recall history, PageUp and PageDown scroll the pane, and Ctrl+C, Ctrl+L, Ctrl+U, Ctrl+E, Ctrl+K and Ctrl+D (delete a character, or end the shell on an empty line) work as in bash. Inside tmux, Ctrl+A and Ctrl+B are the tmux prefix; pressing the prefix twice sends it on, so Ctrl+A Ctrl+A moves to the start of the line. Ctrl+W deletes the previous word where the browser allows it; on Windows and Linux, Chrome and Firefox close the tab instead.

With a mouse or touch screen, clicking a name in `ls` or `tree` output runs `cd` then `ls` for a directory, `cat` for a text file and `open` for `resume.pdf`. The command is shown after the prompt as if typed. On touch screens a row of buttons (`help`, `ls`, `view .`, `cd ..`, `clear`) sits above the status line; they run in the active pane (closing `view` first if it is open).

## tmux

The page fills the browser window like a full-screen terminal. On load, tmux runs with one session (`0`), one window (`0:bash`) and one pane. The status line at the bottom is tmux's default: green, with `[session]` and the window list (`*` marks the current window, `-` the last one, `Z` a zoomed pane) on the left, and the pane title (the host name), time and date on the right, in America/New_York time.

The prefix is **Ctrl+A** (as in screen and many tmux configurations) or **Ctrl+B** (tmux's default). Then:

| Key | Action |
| --- | --- |
| `%` | split left/right (the new pane goes on the right) |
| `"` | split top/bottom (the new pane goes below) |
| `o` | next pane |
| arrow keys | the pane in that direction; for half a second more arrows repeat without the prefix, as in tmux |
| `;` | last pane |
| `z` | zoom the active pane, or unzoom |
| `x` | kill the pane (asks `kill-pane N? (y/n)` in the status line) |
| `c` | new window |
| `n`, `p`, `l`, `0`-`9` | next, previous, last window, window 0-9 |
| `&` | kill the window (asks `kill-window bash? (y/n)`, with the window name, as tmux does) |
| `d` | detach |
| `?` | list the key bindings in the pane (q closes) |
| `q` | show each pane's number for a second; pressing a number then selects that pane |

Neither prefix clashes with a browser shortcut that a page cannot override (Ctrl+W, Ctrl+T, Ctrl+N), so both work in every browser. In the plain shell (outside tmux) Ctrl+A goes to the start of the line, as in bash.

New panes and windows start a prompt in the active pane's directory. Window names follow the program in the active pane (`bash`, or `view` while it runs). A split that would leave a pane narrower than 24 columns or lower than 5 rows prints `no space for new pane` in the status line, so phones get top/bottom splits only.

Commands (also how phone users drive tmux): `tmux` or `tmux new [-d] [-s name]`, `tmux ls`, `tmux attach` or `tmux a [-t name]`, `tmux detach`, `tmux split-window [-h|-v]`, `tmux new-window`, `tmux select-pane -L|-R|-U|-D|-t N`, `tmux select-window -t N`, `tmux next-window`, `tmux previous-window`, `tmux last-pane`, `tmux last-window`, `tmux resize-pane -Z`, `tmux kill-pane`, `tmux kill-window`, `tmux kill-session [-t name]`, `tmux kill-server`, `tmux list-keys [-N]`, `tmux display-panes`, `tmux -V`. Unique prefixes work (`tmux splitw`, `tmux sp`); anything else prints `unknown command: ...`. Inside tmux, `tmux` and `tmux attach` print `sessions should be nested with care, unset $TMUX to force`. `$TMUX` and `$TMUX_PANE` are set in panes.

Leaving tmux works as in a real terminal. Prefix `d` returns to the plain shell with `[detached (from session 0)]`; `tmux ls` lists the session and `tmux attach` brings it back exactly as it was. `exit` (or Ctrl+D on an empty line) closes a pane; closing the last pane of the last window ends the session with `[exited]`. `exit` in the plain shell logs out, and the new login starts tmux with the fastfetch screen, as on first load.

Mouse and touch: clicking a pane selects it (a text selection is kept), and clicking a window in the status line selects it.

## view

`view [dir]` (default `.`) opens a two-column browser on the pane's alternate screen: a tree of the directory on the left (directories in bold blue, collapsed at first, the first file selected) and the selected file on the right, rendered as `cat` renders it, with links. A directory shows its entries; `resume.pdf` shows a link that opens it. The bottom line shows the path and the keys. `view file` opens the file's directory with the file selected.

Keys: Up/Down or `j`/`k` move; Right, `l` or Enter open a directory, or move to the file (then Up/Down scroll it); Left or `h` close a directory, go to the parent, or back from the file to the tree; `g`/`G` go to the top or bottom; PageUp/PageDown scroll the file; `q` or Esc quit. Clicking an entry selects it and clicking a directory opens or closes it. Panes narrower than 60 columns (phones) put the tree above the file, and `q quit` at the bottom can be tapped. On exit the pane shows its transcript as before, with only the `view` command line added.

## Novig stats

`cat novig-stats.txt` shows profit, trades, volume, return, Sharpe ratio and days from https://www.lbtrading.com/stats/novig. That site does not allow cross-origin requests, so the numbers come from a snapshot in `assets/novig-stats.js`:

- `scripts/update-novig-stats.mjs` (Node 18 or newer, no dependencies) downloads `novig_stats.json` and `novig_stats.csv` and computes the values the same way lbtrading.com's own page does. `updated` is the `Last-Modified` time of the JSON file.
- The workflow `.github/workflows/novig-stats.yml` runs it every day at 05:30 UTC and commits `assets/novig-stats.js` as github-actions[bot] when it changed (rebasing onto `main` first, so a push of yours in the meantime does not make it fail).
- Because of that daily commit, run `git pull --rebase` before pushing your own changes, or the push is rejected.
- To refresh by hand, run `node scripts/update-novig-stats.mjs` and commit the file, or open the **Actions** tab, choose **Update Novig stats** and click **Run workflow**.
- Exit code 1 means the download or a check failed; the existing file is left untouched and the site keeps showing the last snapshot with its date.
- If the file is missing or invalid, `cat` prints `cat: novig-stats.txt: snapshot unavailable`.

For the daily run to work, the repository has to be pushed to GitHub with Actions enabled. The workflow asks for `contents: write` itself, so the default token settings are enough, but branch protection on `main` must not block github-actions[bot]. GitHub pauses scheduled workflows in public repositories after 60 days without activity; re-enable it from the Actions tab if that happens.

## Preview locally

Serve the folder over HTTP:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly from disk (`file://`) also works, but Chrome blocks the webfont there, so a local monospace font is used instead.

## Deploy on GitHub Pages

1. Push the repository to GitHub (the files sit at the repository root).
2. Go to **Settings → Pages → Build and deployment**, choose **Source: Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
3. The site appears at `https://<username>.github.io/<repo>/`, or at `https://<username>.github.io/` if the repository is named `<username>.github.io`.

All paths are relative, so the site works under a sub-path. Each push, including the daily stats commit, publishes a new version. If a stats commit does not show up on the site, check the **pages build and deployment** run on the Actions tab.

## Adding the resume

Save the PDF as `assets/resume.pdf`. `open resume.pdf` (or clicking it in `ls`) opens it in a new tab, and `ls -l` shows its real size and date. Until the file exists, those requests return 404. That is expected, and `ls -l` shows the size as 0.

## Behaviour notes

- **Theme:** follows the system light/dark setting until `theme dark` or `theme light` is used. The saved choice is applied before the first paint.
- **Renderer:** drag to turn the shape and click (or tap) for the next one. It changes shape by itself after about 12 seconds without input, pauses when it is off screen, in a hidden pane or window, or the tab is hidden, and caps the pixel ratio at 3. Only the newest logo, in any pane, is live; older ones (after `clear`, `fastfetch` elsewhere, or closing its pane) show a still text version, as does the live one while the browser has lost its WebGL context.
- **Logo size:** in a wide pane the logo grows with the pane, from 42 to 64 columns (about 27 rows at 1440 px, square on screen), leaving room for the welcome line and the prompt; medium panes use 34 x 15. It is resized when the window, a split or a zoom changes the pane.
- **Phones:** the logo sits above the info lines and is 8 to 13 rows tall, as many as leave the welcome line, the prompt and the buttons on the first screen. The page follows the visual viewport, so an on-screen keyboard shrinks the panes instead of covering the prompt.
- **Reduced motion:** with `prefers-reduced-motion: reduce` the renderer draws one still frame (dragging still turns it) and the cursor does not blink.
- **No WebGL:** the logo box shows the same torus as still text, and the `GPU` line is left out.
- **No JavaScript:** the page shows the name, bio and contact links, and a note that the terminal needs JavaScript.

## Fonts and licence

Geist Mono (Copyright 2024 The Geist Project Authors) is self-hosted from `assets/fonts/` under the SIL Open Font License 1.1; see `assets/fonts/OFL-GeistMono.txt`. `geist-mono-box.woff2` is a subset of the same font with the four box-drawing characters `tree` uses. `style.css` also defines size-matched local fallback faces (Menlo / DejaVu Sans Mono, Consolas), so the character grid stays the same while the font loads.
