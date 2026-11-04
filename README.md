# microgit-cli

`microgit` - **your own git server - clone, push, host**.

A small command line client for the [microgit-server](https://www.npmjs.com/package/microgit-server) server. It keeps the API
session in a local config file, creates and deletes repositories, and wraps the
usual `git` commands so push/pull work with the account credentials.


## Install

```bash
npm install -g microgit-cli
```


## Interactive shell

Run `microgit` with no arguments (or `microgit shell`) to open the shell:

```
  ● ━━━ ●
    ┣━━━ ●   microgit-cli • gitserver  v0.1.0
    ┗━━━ ●   your own git server — clone, push, host

  # server   http://{HOST_NAME}:{PORT}
  # account  alice · 7d left

  ✓ ready · type help to list the commands
  # one-shot microgit --help

alice@microgit:~/repos$ new app
```

Starting the shell clears the screen and the scrollback first, so the banner is
the only thing on the page. The prompt shows the signed-in account and the
current folder. Commands are the same words as the one-shot CLI, and the shell
adds:

| Keys / command | What it does |
| --- | --- |
| `↑` / `↓` | History, kept in `~/.microgit/history` |
| `Tab` | Complete command names, `config` actions and `--options` |
| `Ctrl+C` | Clear the line; on an empty line it leaves the shell |
| `Ctrl+D` | Leave the shell |
| `help` | The command list |
| `clear` | Clear the screen and redraw the banner |
| `exit` / `quit` | Leave the shell |

Errors never close the shell. A command that asks something (`login`,
`commit`, `delete`, `new`) asks inside the same prompt.

## Quick start

```bash
# 1. Register an account (non-interactive example).
microgit register --url http://127.0.0.1:80 --user abc --password 1234

# 2. Sign in (non-interactive example).
microgit login --url http://127.0.0.1:80 --user abc --password 1234

# 3. Create a repository and a local checkout with a first commit,
#    then push it.
microgit new app --init

# 4. Work as usual; commit also pushes.
cd app
echo "hello" > hello.txt
microgit commit -m "Add hello.txt"

# 5. Check the session or list repositories.
microgit whoami
microgit list
```

Signing in again reuses a valid stored session, so the username and password are
only asked for once. Add `--force` to sign in as another account.

## Commands

| Command | What it does |
| --- | --- |
| `microgit login` | Sign in, store the API token and optionally the git password |
| `microgit register` | Create an account (when the server allows registration) and sign in |
| `microgit logout` | Revoke the server session, remove the local token and password |
| `microgit whoami` | Show the signed-in account, server and expiry |
| `microgit new <name>` | Create a repository; asks public/private, plus `--private`, `--public`, `--clone`, `--init` |
| `microgit list` | List repositories; `--owner`, `--name`, `--public`, `--private` |
| `microgit delete <name\|owner/name>` | Delete a repository; asks before doing it |
| `microgit clone <name\|owner/name> [dir]` | Clone using the clone URL from the server |
| `microgit init [dir]` | Local only: project folder, `git init` and an empty `README.md` |
| `microgit status` | `git status --short --branch` |
| `microgit commit -m "message"` | `git add -A`, commit, then push |
| `microgit push [git args]` | Push with stored credentials |
| `microgit pull [git args]` | Pull with stored credentials |
| `microgit config` | Show or edit the config file and session |

Every command accepts `-h` / `--help`. Commands that print API data also accept
`--json` where it makes sense (`whoami`, `list`, `new`, `delete`, `clone`,
`login`, `register`, `logout`, `config`).

### Creating repositories

Without `--private` or `--public` the CLI asks for the visibility, and Enter
creates a public repository:

```bash
microgit new app                  # asks: public or private
microgit new secret --private
microgit new app --public
microgit new app --clone          # create it and clone the empty repository
microgit new app --init           # create it, README, first commit and push
microgit new app --init --dir ./projects/app
```

The request sent to the server is `{"name":"app","private":false}` (or `true`).

`new` prints the server's clone URL. Existing repositories are not an error:
the API returns `created: false` and the CLI says it already exists.

### Starting a local repository

`microgit init` is local only — it does not talk to the server:

```bash
microgit init app        # creates ./app, .git on main, empty README.md
microgit init            # initialise the current folder
microgit init --dir ./projects/app
```

It refuses to run inside an existing repository, and reuses the saved account
name for `user.name` / `user.email` when git has none configured.

### Deleting repositories

```bash
microgit delete app                 # asks for confirmation
microgit delete app --yes           # non-interactive
microgit delete bob/app --yes       # administrators can delete for another owner
```

### Listing repositories

```bash
microgit list
microgit list --owner alice
microgit list --private --limit 20
microgit list --public --page 2 --json
```

## Authentication and git credentials

The JSON API uses the session token returned by `login`. The CLI sends it as
`Authorization: Bearer <token>` and stores it in the config file. Git uses HTTP
Basic with the **account username and password**, not the API token.

For that reason `login` only stores the token by default. Add
`--save-password` to also store the password, which makes `push`, `pull`,
`clone` of a private repository and `new --init` work without another prompt:

```bash
microgit login --save-password
```

The password is stored in plain text in the config file. The file is created
with mode `600` on Unix; on Windows the user profile permissions apply. If you
do not want to store it, leave `--save-password` off and let `git` ask when it
needs credentials, or set `MICROGIT_PASSWORD` for one command:

```bash
MICROGIT_PASSWORD='alicepass1' microgit push
```

Logging in again keeps a saved password when the username is unchanged; pass
`--forget-password` to remove it.

The CLI passes credentials to git as an `http.extraHeader`, so they are **not**
written into `.git/config` and are not part of the clone URL.

The server's message of the day, when it publishes one, is printed after
`login`, `register` and `whoami`.

## Config file

Default location: `~/.microgit/config.json`. Use `MICROGIT_CONFIG` to point at a
different file, for example one per server:

```bash
MICROGIT_CONFIG=~/.microgit/work.json microgit login --url https://git.example.com
```

The shell keeps its history next to it, in `~/.microgit/history`.

Show it with:

```bash
microgit config
microgit config set url https://git.example.com
microgit config set username alice
microgit config unset password
microgit config clear
microgit config edit              # open config.json in $EDITOR / notepad
```

Environment variables override the file for one command:

| Variable | Meaning |
| --- | --- |
| `MICROGIT_URL` | Server URL |
| `MICROGIT_TOKEN` | API token, instead of the stored one |
| `MICROGIT_USERNAME` | Account name, also used for git |
| `MICROGIT_PASSWORD` | Git password, also used for git |
| `MICROGIT_CONFIG` | Config file path |
| `NO_COLOR` | Disable colours |

## Renaming the CLI

Package name, command name, banner, tagline, label, version, environment prefix
and config folder all live in [`src/settings.ts`](src/settings.ts). Change them
there and update `name` / `bin` in `package.json` to match.

## Domains

The server's `domain` / `publicUrl` setting changes the clone URL it returns.
`microgit clone` and `microgit new --init` use that URL, so the name must resolve
from the machine running the CLI. If the public domain is only reachable from
outside, log in with the internal URL instead; the repository still works, but a
`domain` configured on the server wins when it builds the clone URL.

## Exit codes

- `0` success
- `1` expected failure (bad input, server error, git failure)

Errors are printed once without a stack trace. `--json` output is still the
server's JSON (or, for `whoami`/`config`, a small object with the same fields).

## Troubleshooting

- **`You are not signed in`** — run `microgit login`; the token expires after the
  server's `sessionDays`.
- **`login` keeps signing in as the old account** — the stored session is still
  valid; pass `--force` or run `microgit logout` first.
- **`Authentication failed` on push** — `login --save-password`, or set
  `MICROGIT_PASSWORD`; the username/password is your account, not the API token.
- **`No 'origin' remote`** — use `microgit clone <owner/name>` or add a remote
  with git.
- **`Directory is not empty`** — `--clone`/`--init` refuse to overwrite files;
  choose another `--dir`.
- **`Already a git repository`** — `microgit init` skips folders that already
  have `.git`.
- **Server unreachable** — pass `--url` or set `MICROGIT_URL`; check the server's
  `host`, `port` and reverse proxy.