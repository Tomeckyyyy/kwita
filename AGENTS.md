# Instrukcje dla agenta

**Co budujemy:** Kwita, kredyt kupiecki bez banku na Solanie (HackYeah 2026, Superteam Poland: Finance Without Intermediaries, Team ZMOW). Opis dla ludzi: `README.md`.

Przed pracą przeczytaj spec (`docs/superpowers/specs/2026-10-04-kwita-design.md`), plan (`docs/superpowers/plans/2026-10-04-kwita.md`) i umowę program ↔ front (`docs/INTERFEJS.md`, IDL w `app/src/idl/`).

## Zasady pracy w repo

1. **Buduj i testuj przez `make`**, nie gołym `anchor build` / `anchor test`. Anchor 1.2.0 domyślnie buduje SBPF v3, a z nim testy LiteSVM padają (`InvalidAccountData`). `Makefile` wymusza `--arch v0`.
2. **Nie uruchamiaj `anchor keys sync`** i nie zmieniaj `declare_id!`. Program ID jest wspólny dla zespołu (sekcja „Program ID”).
3. **Nie nadpisuj `~/.config/solana/id.json`**: to może być czyjś portfel. Nie wypisuj go, nie commituj, nie wysyłaj nigdzie.
4. **Pytaj przed każdym `sudo`.** Wszystko poza pakietami systemowymi instaluje się w katalogu domowym.
5. **Po zmianie programu:** `make test` (wszystkie `0 failed`), `make idl` (IDL i typy do `app/src/idl/`, commitować), `npx tsc -b` w `app/`. Nowe kody błędów dopisuj na końcu enuma `KwitaError`, istniejących nie przenumerowuj.
6. **Zmiana układu konta `Circle` albo `Member`** psuje odczyt istniejących kont na devnecie. Po takim upgradzie trzeba zrobić nowy `seed-devnet`.
7. **Nie wdrażaj na devnet** (`make upgrade-devnet`, `make deploy-devnet`) bez wyraźnej zgody użytkownika. Front i program wdrażaj razem, jeśli zmieniła się lista kont instrukcji.
8. **Publiczny RPC devnetu** (`api.devnet.solana.com`) szybko zwraca 429. Do seeda i smoke'a użyj `DEVNET_RPC=<URL>` / `RPC_URL=<URL>` z kluczem (np. Helius). Klucz trafia tylko do `app/.env.local`, które jest w `.gitignore`. Nigdy nie commituj klucza.
9. **`app/public/demo-firms.json` zawiera prywatne klucze firm demo** (devnet). Jest w `.gitignore`: nie commituj go i nie publikuj builda z nim tam, gdzie krąg ma zostać nietknięty.
10. **Długie komendy uruchamiaj w tle albo z dużym timeoutem.** Kompilacja `avm` trwa ok. 10–15 min, pierwsza kompilacja programu na świeżym klonie 15–35 min. Nie rób świeżego klonu ani worktree tylko po to, żeby pracować na gałęzi: `target/` ma cache kompilacji.
11. **Commity** po polsku, krótko, z prefiksem obszaru jak w historii (`Program: …`, `Front: …`, `Skrypty …`, `Dokumentacja: …`, `Devnet: …`).
12. **Dokumenty** po polsku, krótko, bez marketingu. Liczby i fakty o konkurencji tylko ze źródłem.

## Komendy projektu

| Komenda | Co robi |
|---|---|
| `make check` | sprawdza wersje narzędzi, portfel, saldo |
| `make build` | kompiluje program (`anchor build --arch v0`), kopiuje wspólny keypair programu |
| `make test` | build + testy LiteSVM (bez walidatora) |
| `make idl` | kopiuje IDL i typy TS do `app/src/idl/` |
| `make localnet` | lokalny walidator w bieżącym terminalu |
| `make deploy-local` | deploy na lokalny walidator |
| `make deploy-devnet` | pierwszy deploy na devnet (`--max-len` = rozmiar programu) |
| `make upgrade-devnet` | upgrade programu na devnecie (CLI 3.1.10 sam powiększa konto programu) |
| `make seed-local` / `make seed-devnet` | krąg demo, mint tPLN, 3 firmy demo; zapisuje `app/.env.local` i `app/public/demo-firms.json`. `PRESENTER=<adres>` zasila Phantoma (bez zaproszenia), `DEVNET_RPC=<URL>` zmienia RPC |
| `make smoke-local` | cały scenariusz demo przez bibliotekę klienta na localnecie. Na devnecie: `cd app && npm run smoke` (RPC i krąg z `.env.local`) |
| `make app` | front na http://localhost:5173 |

## Program ID

`GB8MgJJggQM7uiHwWy9nuL5AZnGbFraHVharujHKXAgk`, z wspólnego keypaira `keys/kwita-program-keypair.json` (devnet, bez wartości). `make build` kopiuje go do `target/deploy/`. Upgrade authority na devnecie: klucz zespołu z `~/.config/solana/id.json` lidera.

---

## Konfiguracja środowiska u członka zespołu

Instrukcja dla agenta AI (Claude Code, Codex itp.), który stawia środowisko na komputerze kolejnej osoby z zespołu.

**Cel:** po zakończeniu w katalogu repo `make check` kończy się kodem 0, a `make test` pokazuje same `test result: ok. ... 0 failed`.

**Zapisuj, co instalujesz i co zmieniasz w plikach powłoki**, i na końcu przekaż to użytkownikowi razem z sekcją „Odinstalowanie”. Nie usuwaj ani nie podmieniaj istniejącego Rusta (krok 2).

### Przypięte wersje

| Składnik | Wersja | Gdzie przypięte / skąd |
|---|---|---|
| Solana CLI (Agave), w tym `cargo-build-sbf`, `solana-test-validator` | **3.1.10** | `Anchor.toml` → `[toolchain] solana_version` |
| Anchor CLI | **1.2.0** | `Anchor.toml` → `[toolchain] anchor_version`, `anchor-lang = "1.2.0"` w `programs/kwita/Cargo.toml` |
| avm (menedżer wersji Anchora) | z tagu **v1.2.0** repo `otter-sec/anchor` | Stare adresy `coral-xyz/anchor` i `solana-foundation/anchor` przekierowują na `otter-sec/anchor` |
| Rust (host, do testów i IDL) | **1.89.0** | `rust-toolchain.toml`; rustup dociąga go sam przy pierwszym `cargo` w repo |
| Platform-tools (kompilator SBF) | **v1.57** | domyślne w Anchor 1.2.0, pobierane automatycznie przy pierwszym buildzie (~3 GB) |
| Architektura SBPF | **v0** | `Makefile` (`ARCH ?= v0`). Domyślne v3 z Anchora psuje testy |
| LiteSVM (testy) | 0.10.0 | `programs/kwita/Cargo.toml` |
| Node.js | **24.x** | `.nvmrc`; potrzebny dopiero przy frontendzie |

### Krok 0: rozpoznaj system

- **Linux x86_64**: instrukcja poniżej wprost.
- **macOS** (arm64/x86_64): te same kroki; pakiety systemowe przez `xcode-select --install`.
- **Windows**: wszystko robimy **w WSL2 (Ubuntu)**, nie w PowerShellu. Jeśli WSL nie jest zainstalowany, poproś użytkownika o `wsl --install` (wymaga restartu) i kontynuuj w terminalu Ubuntu.

Sprawdź, co już jest: `command -v rustup cargo solana anchor avm node git`.

### Krok 1: pakiety systemowe (pomiń, jeśli są)

| System | Komenda (zapytaj o zgodę na sudo) |
|---|---|
| Debian / Ubuntu / WSL | `sudo apt-get update && sudo apt-get install -y build-essential pkg-config libssl-dev libudev-dev git curl` |
| Arch | `sudo pacman -S --needed base-devel pkgconf openssl git curl` |
| Fedora | `sudo dnf install -y gcc gcc-c++ make pkgconf-pkg-config openssl-devel systemd-devel git curl` |
| macOS | `xcode-select --install` |

### Krok 2: Rust przez rustup

`cargo-build-sbf` **wymaga rustup** (rejestruje przez niego toolchain Solany). Bez niego build kończy się błędem `Failed to execute rustup: No such file or directory`.

- **`rustup` już jest:** nic nie rób.
- **Nie ma żadnego Rusta:**
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  ```
- **Rust z pakietu dystrybucji bez rustup** (np. Arch `rust`, Debian `rustc`): nie usuwaj go. Zainstaluj lokalny rustup z systemowym Rustem jako domyślnym, wtedy `cargo` w terminalu zostaje tą samą wersją:
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path --default-toolchain none
  ~/.cargo/bin/rustup toolchain link system /usr
  ~/.cargo/bin/rustup default system
  ```

### Krok 3: Solana CLI 3.1.10

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/v3.1.10/install)"
```

Instalator dopisuje PATH tylko do `~/.profile` i `~/.bash_profile`. **zsh ich nie czyta**, więc PATH ustaw w kroku 5.

### Krok 4: avm i Anchor 1.2.0

```bash
cargo install --git https://github.com/otter-sec/anchor --tag v1.2.0 avm --locked   # kompilacja ~10–15 min
avm install 1.2.0     # gotowa binarka, kilka sekund
avm use 1.2.0
```

`avm use` sam przełącza Solanę na wersję zgodną z Anchorem i wypisuje `✨ 3.1.10 initialized`. To oczekiwane.

### Krok 5: PATH

Dopisz do pliku startowego powłoki (`~/.zshrc` dla zsh, `~/.bashrc` dla bash) blok ze znacznikami, żeby dało się go potem usunąć jednym `sed`:

```bash
# >>> hackyeah-solana >>> (usun ten blok przy odinstalowaniu)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$HOME/.avm/bin:$PATH"
# <<< hackyeah-solana <<<
```

W bieżącej sesji agenta wykonaj ten sam `export`, bo nowa konfiguracja nie jest jeszcze wczytana.

### Krok 6: portfel devnet

```bash
[ -f ~/.config/solana/id.json ] || solana-keygen new --no-bip39-passphrase   # NIE nadpisuj istniejącego
solana config set --url devnet
solana address
```

Testowy SOL: `solana airdrop 2` prawie zawsze kończy się błędem limitu (`airdrop request failed... rate limit`). Poproś użytkownika, żeby wszedł na **https://faucet.solana.com**, zalogował się przez GitHub (wyższe limity) wybrał Devnet i wkleił adres z `solana address`. Na upgrade programu potrzeba ok. **2,5 SOL** (bufor ~2 SOL wraca po deployu), na seed kilka setnych SOL. Do demo z frontendem użytkownik instaluje też portfel Phantom w przeglądarce i przełącza go na devnet.

### Krok 7: weryfikacja

```bash
git clone git@github.com:Tomeckyyyy/kwita.git && cd kwita
make check     # ma się skończyć kodem 0; WARN o saldzie 0 SOL jest dopuszczalny
make test      # pierwszy raz 15–35 min (pobiera platform-tools ~3 GB i kompiluje), potem ~40 s
```

Oczekiwany wynik `make test`: wszystkie linie `test result: ok. ... 0 failed`.

Opcjonalnie, sprawdzenie deployu bez SOL: `make localnet` w osobnym terminalu, potem `make deploy-local`.

### Krok 8: raport dla użytkownika

Na koniec przekaż: co zostało zainstalowane (wersje), jakie pliki powłoki zmieniłeś, adres portfela, czy jest SOL, oraz odnośnik do sekcji „Odinstalowanie”.

### Znane problemy

| Objaw | Przyczyna i rozwiązanie |
|---|---|
| `Failed to execute rustup: No such file or directory` | Brak rustup. Krok 2 |
| Test pada z `InvalidAccountData` na `svm.add_program(...)` | Program zbudowany jako SBPF v3 (domyślne w Anchor 1.2.0). Buduj przez `make build` / `make test` (`--arch v0`) |
| `airdrop request failed ... rate limit` | Limit faucetu CLI. Użyj https://faucet.solana.com |
| `429 Too Many Requests` przy seed / smoke / froncie | Limit publicznego RPC devnetu. Użyj RPC z kluczem (`DEVNET_RPC=<URL>`, np. Helius) |
| `401 Unauthorized` z RPC z kluczem | Ucięty URL. Sprawdź `VITE_RPC_URL` w `app/.env.local` |
| Po `avm use` zmieniła się wersja `solana` | Oczekiwane: Anchor ustawia zgodną (3.1.10). `make check` to weryfikuje |
| Błąd o niezgodności Program ID (keypair vs `declare_id!`) | Brak wspólnego keypaira w `target/deploy/`. Używaj `make build` (kopiuje go z `keys/`). Nie uruchamiaj `anchor keys sync` |
| Pierwsze `cargo` w repo pobiera Rusta 1.89.0 | Oczekiwane, wynika z `rust-toolchain.toml` |
| Komenda agenta przerwana timeoutem przy kompilacji | Uruchom w tle i poczekaj; `avm` i pierwszy build trwają kilkanaście minut |

### Odinstalowanie (po hackathonie)

Usuń tylko to, czego nie było przed instalacją (agent powinien był to zgłosić w raporcie):

```bash
rm -rf ~/.local/share/solana ~/.cache/solana ~/.avm   # Solana CLI, platform-tools (~3 GB), Anchor
rm -rf ~/.config/solana                               # klucz devnetowy; NIE usuwaj, jeśli to Twój prawdziwy portfel sprzed instalacji
rm -f  ~/.cargo/bin/avm ~/.cargo/bin/anchor
rustup toolchain uninstall 1.89.0                      # jeśli rustup był już wcześniej
# rustup self uninstall                                # jeśli rustup był instalowany tylko na hackathon (usuwa ~/.rustup i ~/.cargo)
sed -i '/# >>> hackyeah-solana >>>/,/# <<< hackyeah-solana <<</d' ~/.zshrc ~/.bashrc 2>/dev/null
sed -i '\#/.local/share/solana/install/active_release/bin#d' ~/.profile ~/.bash_profile 2>/dev/null
```

Rozszerzenie Phantom usuń z przeglądarki ręcznie. Katalog projektu (`target/` ma kilka GB) usuń razem z repo.
