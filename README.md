# microgit-cli
`microgit` - **your own git server - clone, push, host**.

A small command line client for the [microgit-server](https://www.npmjs.com/package/microgit-server) server. It keeps the API
session in a local config file, creates and deletes repositories, and wraps the
usual `git` commands: one `login` is enough for `clone`, `commit`, `push` and
`pull`, without any extra password setup.


## Install

```bash
npm install -g microgit-cli
```

## Interactive shell

Run `microgit` with no arguments (or `$ microgit shell`) to open the shell:

```
  μgit ━━━━ ●
       ┣━━━ ●   microgit-cli • MIT v0.1.15
       ┗━━━ ●   manage your own git server — clone, push, host

  # server   http://127.0.0.1:3000
  # account  alice · 7d left

  ✓ ready · type help to list the commands
  ✓ ready · use config to manage settings

  # one-shot microgit --help

  ↑↓ history   tab complete   clear to reset
alice@microgit:~/Repo $
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

# 5. The repository is now live at:
#    http://127.0.0.1:80/abc/app.git
#    (visit it, or clone it from anywhere with `microgit clone` / `git clone`).

# 6. Check the session or list repositories.
microgit whoami
microgit list
```

Signing in again reuses a valid stored session, so the username and password are
only asked for once. Add `--force` to sign in as another account.

## Commands

| Command | What it does |
| --- | --- |
| `microgit login` | Sign in and store the API token (already enough for git) |
| `microgit register` | Create an account (when the server allows registration) and sign in |
| `microgit logout` | Revoke the server session, remove the local token, password and any password typed this run |
| `microgit whoami` | Show the signed-in account, server and expiry |
| `microgit new <name>` | Create a repository; asks public/private, plus `--private`, `--public`, `--clone`, `--init` |
| `microgit list` | List repositories; `--owner`, `--name`, `--public`, `--private` |
| `microgit delete <name\|owner/name>` | Delete a repository; asks before doing it |
| `microgit clone <name\|owner/name> [dir]` | Clone using the clone URL from the server |
| `microgit init [dir]` | Local only: project folder, `git init` and an empty `README.md` |
| `microgit status` | `git status --short --branch` |
| `microgit commit -m "message"` | `git add -A`, commit, then push |
| `microgit push [git args]` | Push with the stored credentials; `--url http://user:pass@host` allowed |
| `microgit pull [git args]` | Pull with the stored credentials; `--url http://user:pass@host` allowed |
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

One `microgit login` is enough: the stored session token is accepted by the
server as the git password, so `clone`, `commit`, `push` and `pull` work right
after signing in.

The CLI passes credentials to git as an `http.extraHeader`, so they are **not**
written into `.git/config` and are not part of the clone URL.

Credentials are looked up in this order:

1. Credentials inside the URL: `--url http://user:pass@host:3000`
2. A password typed at a prompt during this run (memory only)
3. A password stored in the config (`microgit config set password ...`), or `MICROGIT_PASSWORD`
4. The session token stored by `login`

### Credentials inside the URL

Manual (one-shot) runs may carry the credentials in the URL. They are used for
the API as well as for git, and they are never written to the config file:

```bash
microgit login --url http://alice:secret@127.0.0.1:3000
microgit clone secret/app --url http://alice:secret@127.0.0.1:3000
microgit commit -m "Fix login" --url http://alice:secret@127.0.0.1:3000
microgit push --url http://alice:secret@127.0.0.1:3000
```

### When nothing is stored

If no credential is available, or the server rejects the ones that are, the CLI
asks for the password on a terminal. The username comes from the config and the
answer is kept **in memory only** — never written to disk — for as long as the
process runs, so it is asked once per run and dropped by `microgit logout`.
Without a terminal the command fails with a clear message instead of hanging.

The server's message of the day, when it publishes one, is printed after
`login`, `register` and `whoami`.

### Managing the config

All through `microgit config`:

| Command | What it does |
| --- | --- |
| `microgit config` | Interactive menu to view/edit/clear fields |
| `microgit config show` | Print current settings (token masked) |
| `microgit config path` | Print the config file path |
| `microgit config set <key> <value>` | Set `url`, `username`, `token` or `password` |
| `microgit config unset <key>` | Remove `token`, `password`, `username` or `expiresAt` |
| `microgit config clear` | Delete the config file entirely |
| `microgit config edit` | Open the file in `$EDITOR` / `$VISUAL` (or Notepad on Windows) |

## Domains

The server's `domain` / `publicUrl` setting changes the clone URL it returns.
`microgit clone` and `microgit new --init` use that URL, so the name must resolve
from the machine running the CLI. If the public domain is only reachable from
outside, log in with the internal URL instead; the repository still works, but a
`domain` configured on the server wins when it builds the clone URL.
