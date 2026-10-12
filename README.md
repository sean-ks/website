# sean shiroma

My personal site: an Arch Linux terminal in the browser.

## What's in it

- A fastfetch screen with a 3D shape drawn in text characters.
- A small shell: `help`, `ls`, `cd`, `cat`, `tree`, `open`, Tab completion, history.
- `view .` opens a file browser: the tree on the left, the file on the right.
- A bare-bones tmux, because I like tmux. Prefix is Ctrl-A or Ctrl-B; `?` lists the keys.
- `cat novig-stats.txt` shows my Novig market-making stats.

## Editing

All the text lives in `content.js`. Add a file there and it shows up in `ls`.

## Running locally

    python3 -m http.server 8000

Then open http://localhost:8000.

## Novig stats

A GitHub Action runs `scripts/update-novig-stats.mjs` once a day and commits the result.
Pull before pushing, since the Action commits to `main`.
To refresh by hand: `node scripts/update-novig-stats.mjs`.

## Font

Geist Mono, under the SIL Open Font License (`assets/fonts/OFL-GeistMono.txt`).
