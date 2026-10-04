# Kwita: kredyt kupiecki bez banku

Projekt na **HackYeah 2026**, wyzwanie **Superteam Poland: Finance Without Intermediaries** (Solana).

Krąg małych firm płaci sobie nawzajem jednostkami kręgu (1 jednostka = 1 tPLN, testowy złoty) zamiast gotówką. Każda firma zaczyna od salda 0 i może zejść na minus do swojego limitu, a dług spłaca sprzedażą do kręgu. Suma sald zawsze wynosi 0, więc nikt nie musi wykładać płynności. To model Sardexu i szwajcarskiego WIR, ale bez operatora: **limit liczy program** (kaucja + 50% sprzedaży do różnych firm + poręczenia), a za ryzyko odpowiadają kaucja w tPLN i poręczyciele.

Do kręgu wchodzi się tylko z zaproszeniem, a zaprosić może każda firma z kręgu: nie ma admina ani bramkarza.

- Zastępowani pośrednicy: bank (kredyt obrotowy z odsetkami) i operator sieci barterowej, który sam ustala limity i wybiera firmy.
- Użytkownik docelowy: małe firmy w jednym mieście, które już kupują od siebie usługi (kawiarnia, drukarnia, studio graficzne, biuro rachunkowe).
- Spec: [`docs/superpowers/specs/2026-10-04-kwita-design.md`](docs/superpowers/specs/2026-10-04-kwita-design.md). Plan: [`docs/superpowers/plans/2026-10-04-kwita.md`](docs/superpowers/plans/2026-10-04-kwita.md). Interfejs program ↔ front: [`docs/INTERFEJS.md`](docs/INTERFEJS.md). Wyzwanie: [`docs/WYZWANIE.md`](docs/WYZWANIE.md).

## Demo lokalnie (bez SOL)

```bash
make localnet                 # terminal 1: lokalny walidator
solana airdrop -ul 100        # terminal 2
make deploy-local
make seed-local               # krąg demo + 3 firmy demo (Drukarnia zakłada i zaprasza resztę); PRESENTER=<adres Phantoma> zasila Phantoma, ale go nie zaprasza
make app                      # http://localhost:5173
```

Explorer pokazuje transakcje z localnetu przez „Custom RPC URL” (`http://127.0.0.1:8899`); linki we froncie robią to same.

## Na devnecie

- Program: [`GB8MgJJggQM7uiHwWy9nuL5AZnGbFraHVharujHKXAgk`](https://explorer.solana.com/address/GB8MgJJggQM7uiHwWy9nuL5AZnGbFraHVharujHKXAgk?cluster=devnet), pierwszy deploy: [`4DJN1x7q…`](https://explorer.solana.com/tx/4DJN1x7qGccqxQN4WAs327YwwWaZUYWfRGLpi3YJ73Mf72MuyVJuZ2CFzGTYLLiCXRpKBWdgttzcrs4mWU2DgJgP?cluster=devnet), upgrade po przeglądzie kodu: 4.10.2026 (`make upgrade-devnet`).
- Przebieg scenariusza demo (`npm run smoke` na devnecie, 4.10.2026):
  - zakup ponad limit przechodzi dopiero po poręczeniu: [zakup](https://explorer.solana.com/tx/xk9YFgogyHdL7RLxa8kBCg1Ki2XYtNPxBkQi5wqeCBm392Qj8EpqCom2PK4gDVoVvGK4RnQJJPNTG6j69ReT8hX?cluster=devnet), [poręczenie](https://explorer.solana.com/tx/5ZdbuKVrAoLdFgV4oWaK7Y74Zwxbra2r6Kpk1KJ78bnSeWHiwb1mDVMwSMfe8VnvoZNJT5cRmn3P1UasCCspUBgU?cluster=devnet);
  - wyjście z kręgu z długiem pokrytym kaucją: [leave](https://explorer.solana.com/tx/3NrbCS14XaCJNnySjZYnTei4pMsGH7NBrcZL9WK9YrYY1DAP5K2E7m2ncBQk9SMGtEBTWDfUfUNtsC3YQCqq9Xru?cluster=devnet);
  - wymiana jednostek na tPLN z Rezerwy: [redeem](https://explorer.solana.com/tx/jFTSGR3Rs8cpU9wNSq61eHogSZWU2PeBrA55m45G89JYyHuvhU7zDaUbNXEFCUtUWfcxVmHPfUdVKjbcaDqpQvw?cluster=devnet);
  - niewypłacalność ogłoszona przez inną firmę, dług przechodzi na poręczyciela: [declare_default](https://explorer.solana.com/tx/hR7d2yht9iL3atUeKx9Xvp3cT3bkV8rJywZmJcuKYYRvibmzT4roTamhDzZjbNu2XnwvFtoPJRX3NmrrpLWeKSe?cluster=devnet).
- Demo z frontu na devnecie: `PRESENTER=<adres Phantoma> make seed-devnet`, potem `make app`. W Phantomie: Ustawienia → Developer Settings → Testnet Mode, sieć Solana Devnet.

---

## Dla agenta: konfiguracja środowiska u członka zespołu

Ta sekcja jest instrukcją dla agenta AI (Claude Code, Codex itp.), który stawia środowisko na komputerze kolejnej osoby z zespołu.

**Cel:** po zakończeniu w katalogu repo `make check` kończy się kodem 0, a `make test` pokazuje same `test result: ok. ... 0 failed`.

### Zasady

1. **Pytaj przed każdym `sudo`.** Wszystko poza pakietami systemowymi instaluje się w katalogu domowym.
2. **Nie usuwaj ani nie podmieniaj istniejącego Rusta** (pakiet z dystrybucji, istniejący rustup). Patrz krok 2.
3. **Nie nadpisuj istniejącego `~/.config/solana/id.json`**: to może być czyjś portfel. Nie wypisuj go, nie commituj, nie wysyłaj nigdzie.
4. **Nie uruchamiaj `anchor keys sync`.** Program ID jest wspólny dla zespołu (patrz „Program ID” niżej). Zmiana `declare_id!` rozjedzie repo.
5. **Długie komendy uruchamiaj w tle albo z dużym timeoutem.** Kompilacja `avm` trwa ok. 10–15 min, pierwsza kompilacja programu na świeżym klonie 15–35 min.
6. **Zapisuj, co instalujesz i co zmieniasz w plikach powłoki**, i na końcu przekaż to użytkownikowi razem z sekcją „Odinstalowanie”.

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

Testowy SOL: `solana airdrop 2` prawie zawsze kończy się błędem limitu (`airdrop request failed... rate limit`). Poproś użytkownika, żeby wszedł na **https://faucet.solana.com**, zalogował się przez GitHub (wyższe limity) i wkleił adres z `solana address`. Potrzeba **2–3 SOL** (deploy programu to ok. 1 SOL rentu). Do demo z frontendem użytkownik instaluje też portfel Phantom w przeglądarce i przełącza go na devnet.

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
| Po `avm use` zmieniła się wersja `solana` | Oczekiwane: Anchor ustawia zgodną (3.1.10). `make check` to weryfikuje |
| Błąd o niezgodności Program ID (keypair vs `declare_id!`) | Brak wspólnego keypaira w `target/deploy/`. Używaj `make build` (kopiuje go z `keys/`). Nie uruchamiaj `anchor keys sync` |
| Pierwsze `cargo` w repo pobiera Rusta 1.89.0 | Oczekiwane, wynika z `rust-toolchain.toml` |
| Komenda agenta przerwana timeoutem przy kompilacji | Uruchom w tle i poczekaj; `avm` i pierwszy build trwają kilkanaście minut |

---

## Komendy projektu

| Komenda | Co robi |
|---|---|
| `make check` | sprawdza wersje narzędzi, portfel, saldo |
| `make build` | kompiluje program (`anchor build --arch v0`) |
| `make test` | build + testy LiteSVM (bez walidatora) |
| `make localnet` | lokalny walidator w bieżącym terminalu |
| `make deploy-local` | deploy na lokalny walidator |
| `make deploy-devnet` | deploy na devnet (`--max-len` = rozmiar programu) |
| `make idl` | kopiuje IDL i typy TS do `app/src/idl/` (commitować) |
| `make seed-local` / `make seed-devnet` | krąg demo, tPLN, 3 firmy demo; zapisuje `app/.env.local` i `app/public/demo-firms.json` |
| `make smoke-local` | cały scenariusz demo przez bibliotekę klienta |
| `make app` | front na http://localhost:5173 |

## Program ID

`GB8MgJJggQM7uiHwWy9nuL5AZnGbFraHVharujHKXAgk`, z wspólnego keypaira `keys/kwita-program-keypair.json` (devnet, bez wartości). `make build` kopiuje go do `target/deploy/`. Nie uruchamiaj `anchor keys sync`.

## Odinstalowanie (po hackathonie)

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
