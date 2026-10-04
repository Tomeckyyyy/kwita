# Kwita: kredyt kupiecki bez banku

**HackYeah 2026 · wyzwanie Superteam Poland: Finance Without Intermediaries · Team ZMOW**

Krąg małych firm z jednego miasta płaci sobie nawzajem „na kreskę”. Każda firma zaczyna od salda 0, kupując schodzi na minus, a sprzedając wraca na plus. Limit kreski nie zależy od banku ani od operatora sieci: **liczy go program na Solanie** według jawnej reguły, a za ryzyko odpowiadają kaucja i poręczenia innych firm.

- Program na devnecie: [`GB8MgJJggQM7uiHwWy9nuL5AZnGbFraHVharujHKXAgk`](https://explorer.solana.com/address/GB8MgJJggQM7uiHwWy9nuL5AZnGbFraHVharujHKXAgk?cluster=devnet)
- Przebieg demo z linkami do transakcji: sekcja [Na devnecie](#na-devnecie)
- Jak uruchomić: sekcja [Uruchomienie](#uruchomienie)

---

## Problem

Małe firmy finansują się nawzajem odroczonymi płatnościami. Drukarnia oddaje ulotki teraz, kawiarnia płaci za 30 dni. Kto czeka na pieniądze, traci płynność. Kto ich nie ma, bierze kredyt obrotowy w banku: z odsetkami, zabezpieczeniami i papierami.

Sieci kredytu wzajemnego pokazały, że firmy z jednego regionu mogą kupować od siebie bez gotówki. Szwajcarski WIR działa od 1934 roku i obsługuje ponad 45 000 MŚP, a włoski Sardex ponad 10 000 firm (dane sieci). Każda firma ma saldo, które może zejść na minus, a dług spłaca własną sprzedażą.

Takie sieci mają jednak nowego pośrednika: **operatora**, który prowadzi księgę, sam przydziela limity i decyduje, kto wchodzi do sieci. Firmy muszą mu ufać, że nie przyzna komuś limitu po cichu i nie poprawi księgi.

## Dla kogo

Małe firmy w jednym mieście, które już kupują od siebie usługi: kawiarnia, drukarnia, studio graficzne, biuro rachunkowe. Nie budujemy narzędzia dla deweloperów. Interfejs mówi o saldach, limitach i fakturach, a nie o tokenach.

## Jaki pośrednik znika

| Relacja | Pośrednik dziś | Co robi | Kto to robi w Kwicie |
|---|---|---|---|
| Kredyt kupiecki między firmami | Bank | pożycza na procent, ocenia firmę, ustala limit | limit liczy program z danych w sieci |
| Sieć kredytu wzajemnego (WIR, Sardex) | Operator sieci | prowadzi księgę, przydziela limity, wpuszcza firmy | księgę prowadzi program, limit wynika z reguły, firmy zaprasza każda firma z kręgu |
| Egzekucja długu | Sąd, windykacja, operator | ściąga dług od firmy, która zniknęła | po terminie każdy może ogłosić niewypłacalność, program zabiera kaucję i przenosi dług na poręczycieli |

---

## Jak to działa

### Saldo od zera, suma zawsze 0

Płatność w kręgu to przesunięcie salda: kupujący schodzi na minus, sprzedawca idzie na plus o tyle samo. Jednostki powstają przy zakupie i znikają przy spłacie, więc nikt nie musi wykładać pieniędzy na start. 1 jednostka kręgu = 1 tPLN (testowy złoty na devnecie).

Jednostki kręgu to konta programu, a nie token SPL. Nie da się ich przelać poza regułami kręgu.

### Limit liczy program

```
limit = kaucja + min(50% sprzedaży netto, 1 000) + poręczenia otrzymane − poręczenia udzielone
```

| Składnik | Jak działa (parametry kręgu demo) |
|---|---|
| Kaucja | 200 tPLN wpłacone przy dołączeniu. Leży w skarbcu programu i przepada, gdy firma zniknie z długiem |
| Sprzedaż netto | Do limitu liczy się nadwyżka sprzedaży do danej firmy nad zakupami od niej. Wymiana w kółko z jednym partnerem daje 0. Pułap: 300 tPLN od jednego kupującego, 1 000 tPLN łącznie |
| Poręczenia | Inna firma ręczy własnym limitem: jej limit spada o tyle, o ile rośnie limit firmy, za którą poręcza |

Program sprawdza limit przy każdej płatności (`pay.rs`). Płatność ponad limit kończy się odmową z czytelnym komunikatem w logach transakcji, np. `Kwita: saldo po zakupie -250 tPLN przekracza limit 200 tPLN. Odmowa.`

### Kto wchodzi do kręgu

Krąg może założyć każdy. Założyciel ustawia parametry raz i potem nie ma żadnych uprawnień. Do kręgu wchodzi się z zaproszeniem od **dowolnej** aktywnej firmy z kręgu, bez zgody admina. Zaproszenie działa raz: po wyjściu z kręgu nie da się wrócić na to samo.

### Kto płaci, gdy firma zniknie

1. Firma jest na minusie dłużej, niż pozwala krąg (w demo 60 s).
2. **Ktokolwiek** może ogłosić jej niewypłacalność (`declare_default`). Program sprawdza tylko termin.
3. Cała kaucja przepada do Rezerwy kręgu i pokrywa dług.
4. Resztę długu przejmują poręczyciele.
5. Czego nie pokryli, program zapisuje jawnie w liczniku `unbacked_loss`.

**Rezerwa kręgu** to „firma bez właściciela” prowadzona przez program. Przejmuje dług w księdze i trzyma kaucje w tPLN. Firmy z saldem dodatnim wymieniają u niej jednostki na tPLN 1:1 (`redeem`). Nikt nie ma do niej klucza.

Zawsze się zgadza (testy sprawdzają to po każdym scenariuszu):
- suma sald wszystkich firm + saldo Rezerwy = 0,
- tPLN w skarbcu = kaucje firm + tPLN Rezerwy.

---

## Kto może co

| Operacja | Kto może | Gdzie w kodzie |
|---|---|---|
| Założyć krąg | każdy; parametry ustawia raz | [`create_circle.rs`](programs/kwita/src/instructions/create_circle.rs) |
| Wpuścić firmę | każda aktywna firma z kręgu, zaproszeniem | [`invite.rs`](programs/kwita/src/instructions/invite.rs), [`join.rs`](programs/kwita/src/instructions/join.rs) |
| Przyznać limit | nikt; limit wynika z reguły | [`state.rs`](programs/kwita/src/state.rs) (`Member::limit`), [`pay.rs`](programs/kwita/src/instructions/pay.rs) |
| Poręczyć za firmę | każda aktywna firma, w granicach własnego limitu | [`guarantee.rs`](programs/kwita/src/instructions/guarantee.rs) |
| Ogłosić niewypłacalność | każdy, po terminie | [`declare_default.rs`](programs/kwita/src/instructions/declare_default.rs) |
| Wypłacić tPLN ze skarbca | tylko instrukcje programu: wyjście z kręgu i wymiana | [`leave.rs`](programs/kwita/src/instructions/leave.rs), [`redeem.rs`](programs/kwita/src/instructions/redeem.rs) |
| Zmienić parametry kręgu | nikt; nie ma takiej instrukcji | — |
| Zmienić program | klucz zespołu (upgrade authority), tylko na devnecie | przed produkcją: `solana program set-upgrade-authority --final` albo multisig |

## Dlaczego blockchain, a nie baza danych

Księgi kredytu wzajemnego nie może prowadzić ktoś, kto na niej zarabia albo w niej uczestniczy. Z bazą danych zawsze jest ktoś, kto może dopisać sobie jednostki, przyznać limit znajomemu albo poprawić historię.

- **Nikt nie przepisze księgi:** salda zmieniają się tylko przez instrukcje programu.
- **Każdy sprawdzi reguły:** salda, limity i suma równa zero są publiczne, a zasady kręgu nie zmieniają się po założeniu.
- **Kaucje bez depozytariusza:** tPLN leży w skarbcu, którym zarządza tylko program.

## Ograniczenia

- **Wszystko jest jawne:** salda, kwoty i to, kto komu płaci. Numer faktury można zapisać jako hash, ale ukrycie kwot i stron wymaga dowodów ZK albo MPC.
- **Program nie widzi świata:** nie sprawdzi, czy usługę wykonano ani czy faktura istnieje. Do tego potrzebna byłaby wyrocznia, czyli znowu ktoś zaufany.
- **Egzekucja kończy się na łańcuchu:** program zabierze kaucję i przeniesie dług na poręczycieli, ale reszty nie ściągnie. Strata ponad to trafia do `unbacked_loss`, a jej podział między firmy to następny krok.
- **Klucz to konto:** zgubiony klucz to utracony dostęp do salda i kaucji. Firmy potrzebują portfela, który to przed nimi ukryje.
- **Zaproszenie nie wiąże się z odpowiedzialnością:** firma może zaprosić dowolnie wiele adresów. Każde konto musi wpłacić kaucję, więc fałszywe firmy kosztują, ale następnym krokiem jest zaproszenie połączone z poręczeniem.
- **Demo:** tPLN to testowy token wybijany przez zespół, a front podpisuje za 3 firmy demo kluczami z pliku.

## Model

Program jest darmowy i niczyj: bez opłat od płatności i bez tokena. Każdy może napisać własną aplikację do tego samego programu. Zarabianie na dostępie do kręgu zrobiłoby z nas pośrednika, którego usuwamy.

Zarabiać można na aplikacji, która ukrywa kryptowaluty przed firmą: logowanie mailem bez portfela i SOL, faktury z KSeF, eksport dla księgowej. Firma, która przejdzie do innej aplikacji, nie traci sald.

---

## Na devnecie

- Program: [`GB8MgJJggQM7uiHwWy9nuL5AZnGbFraHVharujHKXAgk`](https://explorer.solana.com/address/GB8MgJJggQM7uiHwWy9nuL5AZnGbFraHVharujHKXAgk?cluster=devnet), pierwszy deploy: [`4DJN1x7q…`](https://explorer.solana.com/tx/4DJN1x7qGccqxQN4WAs327YwwWaZUYWfRGLpi3YJ73Mf72MuyVJuZ2CFzGTYLLiCXRpKBWdgttzcrs4mWU2DgJgP?cluster=devnet), upgrade z zaproszeniami: [`YLmMsYmg…`](https://explorer.solana.com/tx/YLmMsYmgo6F1PZAGrno5gJBHeCpnez5Jg9ehNh2JWm3icXL4M45TCrKW325wnagKRTjsp25MyqKbZSnMfNwMmy6?cluster=devnet) (4.10.2026).
- Przebieg scenariusza demo (`npm run smoke` na devnecie, 4.10.2026):

| Krok | Co się dzieje | Transakcja |
|---|---|---|
| 1 | Kawiarnia próbuje dołączyć bez zaproszenia: program odmawia | (odrzucona w symulacji) |
| 2 | Biuro rachunkowe zaprasza Kawiarnię | [zaproszenie](https://explorer.solana.com/tx/51GV7aBBtKahYGa3uWPpDAbDMuxDauYKY8o75oxdcscuQnzNVPR4Bcba3vYLe7q9XeeLajyRDmhiHRAYnJVsMGVH?cluster=devnet) |
| 3 | Kawiarnia dołącza z zaproszeniem, kaucja 200 tPLN | [dołączenie](https://explorer.solana.com/tx/2NjjJPrJy5UWGk5v6A7bKXotRoo8z3ZW6Kd54VGrAmUej5zAhk42WAgrwhJro57H3NZxjftLwofgZhrVR8YAvRMa?cluster=devnet) |
| 4 | Kawiarnia kupuje ulotki za 150 (saldo −150) | [zakup](https://explorer.solana.com/tx/Swub8AJm4nyGUQQzEVtjgNi4o4TFWEVpuLZjRs5P39HCvAFoz85aCF66m4FXcJw9CQjpVLUFVYg9akQoafsKB8Y?cluster=devnet) |
| 5 | Projekt za 100 jest ponad limit 200: program odmawia | (odrzucona w symulacji) |
| 6 | Studio graficzne poręcza 100 | [poręczenie](https://explorer.solana.com/tx/4mfFkotPRj8BMoV4VCfzhrTz41mbt6cJyY6DMVvQizKugMTGZ1XAYwT14c9C5vH7QZyYfudJdewHXwQb1nbW49zv?cluster=devnet) |
| 7 | Ten sam zakup za 100 przechodzi | [zakup](https://explorer.solana.com/tx/21PgCUFuz4URa9uXS9r3SEYtDyZXm8p6wGsboARyg78vQx9BsbVkx4cGw9w28gm9NrDKxfaa3vr23TuV3S21sBTC?cluster=devnet) |
| 8 | Drukarnia kupuje u Biura za 200 | [zakup](https://explorer.solana.com/tx/4te9E46nBEcdCkjapoWZxPXmT9dMZXQDjk73hmhG5LS5RmVvedFv85GjrkHFYhxPaQxdswHTozUi9T4xraxHnZnp?cluster=devnet) |
| 9 | Drukarnia wychodzi z kręgu z saldem −50: dług pokrywa jej kaucja | [wyjście](https://explorer.solana.com/tx/2FPrq8d8viKtZmLdsdrsf1BL5qeQQyYKjx5CFygdyRkbKj8iYJGuRANbGPVs3M28YT7F969xmWgmPBANTaC89NnS?cluster=devnet) |
| 10 | Biuro wymienia 50 jednostek na tPLN z Rezerwy | [wymiana](https://explorer.solana.com/tx/29cyGH227ZQxjxn4ivyqjxk1xcETdNYY9s5XvuaW7ibDaxSrN6aRSVcJVqqRTLMSAJB5oujYfu5swSQZwyZQDjyR?cluster=devnet) |
| 11 | Po terminie inna firma ogłasza niewypłacalność Kawiarni: kaucja do Rezerwy, reszta długu na poręczyciela | [niewypłacalność](https://explorer.solana.com/tx/2yWdasAEXuUetmiBpXBwdRT6ogiNvuquPjm47S3wffQXPxTQ3n9rFcTjkTDVc8qqxpUUsuB9wHZ5G5qs9LPmQxo1?cluster=devnet) |

Odmowy (kroki 1 i 5) w skrypcie kończą się już w symulacji transakcji. Front wysyła transakcje bez symulacji, więc tam odrzucona transakcja trafia do sieci i w Explorerze widać komunikat programu, np. `Kwita: brak zaproszenia do kręgu. Odmowa.`

---

## Architektura

```
Phantom / klucze firm demo
        │  podpis transakcji
        ▼
Front (React, app/)  ──RPC──▶  Program kwita (Anchor, Solana devnet)
  księga kręgu, płatności,        konta: Circle, Member, Pair,
  poręczenia, zaproszenia,        Guarantee, Invite, skarbiec SPL
  linki do Explorera                       │
                                           ▼
                                  Solana Explorer (dowód każdego kroku)
```

Front nie ma backendu ani bazy danych. To statyczna strona, która czyta konta programu przez RPC i wysyła transakcje podpisane portfelem. Każdy może napisać własnego klienta do tego samego programu na podstawie IDL (`app/src/idl/kwita.json`).

### Konta programu

| Konto | Adres (PDA) | Co trzyma |
|---|---|---|
| `Circle` | `["circle", założyciel, circle_id]` | parametry kręgu, skarbiec, Rezerwa (`reserve_balance`, `reserve_usdc`), `unbacked_loss`, liczba firm |
| skarbiec | `["vault", circle]` | konto tokenowe SPL z kaucjami i tPLN Rezerwy; podpisuje tylko program |
| `Member` | `["member", circle, firma]` | saldo, kaucja, sprzedaż liczona do limitu, poręczenia, „na minusie od”, status |
| `Pair` | `["pair", circle, sprzedawca, kupujący]` | sprzedaż w parze firm, z której liczona jest sprzedaż netto |
| `Guarantee` | `["guarantee", circle, poręczyciel, firma]` | kwota poręczenia |
| `Invite` | `["invite", circle, zaproszony]` | oczekujące zaproszenie; `join` je zamyka |

### Instrukcje

| Instrukcja | Kto podpisuje | Co robi |
|---|---|---|
| `create_circle` | założyciel | zakłada krąg z parametrami i skarbiec |
| `invite` / `revoke_invite` | aktywna firma z kręgu | zaprasza adres / wycofuje niewykorzystane zaproszenie |
| `join` | firma z zaproszeniem (albo założyciel) | wpłaca kaucję do skarbca, saldo 0, zużywa zaproszenie |
| `pay` | kupujący | przesuwa saldo, sprawdza limit kupującego i pułap salda sprzedawcy, liczy sprzedaż netto; numer faktury w zdarzeniu |
| `give_guarantee` / `withdraw_guarantee` | poręczyciel | podnosi / obniża limit innej firmy kosztem własnego |
| `redeem` | firma na plusie | wymienia jednostki na tPLN z Rezerwy |
| `leave` | firma | wychodzi z kręgu; dług pokrywa kaucja, reszta kaucji wraca |
| `declare_default` | ktokolwiek | po terminie: kaucja do Rezerwy, dług na poręczycieli, reszta do `unbacked_loss` |

Pełna specyfikacja kont, argumentów, błędów i zdarzeń: [`docs/INTERFEJS.md`](docs/INTERFEJS.md).

## Co gdzie leży

```
programs/kwita/src/
  lib.rs                 wejście programu, lista instrukcji
  state.rs               konta i reguła limitu (Member::limit)
  instructions/          jedna instrukcja = jeden plik (pay.rs, declare_default.rs, invite.rs, …)
  error.rs, events.rs    kody błędów i zdarzenia
programs/kwita/tests/    testy LiteSVM (60 testów: płatności, poręczenia, wyjście, niewypłacalność, zaproszenia)
app/
  src/lib/kwita.ts       biblioteka klienta: PDA, instrukcje, odczyt stanu kręgu
  src/components/        księga kręgu, panel akcji, zdarzenia, przełącznik „działam jako”
  src/idl/               IDL i typy programu (generowane przez make idl)
  scripts/seed.ts        zakłada krąg demo, mint tPLN i firmy demo
  scripts/smoke.ts       cały scenariusz demo przez bibliotekę klienta
docs/
  PITCH.md               scenariusz filmu i prezentacji
  QA.md                  pytania jury z odpowiedziami
  INTERFEJS.md           umowa program ↔ front
  WYZWANIE.md            treść wyzwania
  superpowers/           spec i plan wdrożenia
keys/                    wspólny keypair programu (devnet, stały Program ID)
Makefile                 wszystkie komendy projektu
AGENTS.md                instrukcje dla agentów AI i konfiguracja środowiska
```

---

## Uruchomienie

### Wymagania

| Narzędzie | Wersja |
|---|---|
| Solana CLI (Agave) | 3.1.10 |
| Anchor CLI | 1.2.0 |
| Rust | 1.89.0 (z `rust-toolchain.toml`) |
| Node.js | 24.x |
| Portfel w przeglądarce | Phantom, w trybie Testnet Mode, sieć Solana Devnet |

Instalacja krok po kroku (Linux, macOS, Windows przez WSL2): [`AGENTS.md`](AGENTS.md), sekcja „Konfiguracja środowiska”. Instrukcja jest napisana dla agenta AI, ale da się ją wykonać ręcznie.

### Front z programem na devnecie

```bash
git clone https://github.com/Tomeckyyyy/kwita && cd kwita
(cd app && npm install)
PRESENTER=<adres Phantoma> DEVNET_RPC=<URL RPC devnetu> make seed-devnet
make app                      # http://localhost:5173
```

`seed-devnet` zakłada krąg demo z 3 firmami (Drukarnia zakłada krąg i zaprasza Studio i Biuro) i zasila Phantoma testowym SOL i tPLN, ale go nie zaprasza: w demo zaprasza go na żywo firma z kręgu. Potrzebny jest portfel z devnetowym SOL w `~/.config/solana/id.json` (faucet: https://faucet.solana.com). Publiczny `api.devnet.solana.com` szybko zwraca 429, bo front odpytuje go co 4 s, więc do demo używamy darmowego RPC z kluczem (np. Helius).

### Lokalnie, bez SOL

```bash
make localnet                 # terminal 1: lokalny walidator
solana airdrop -ul 100        # terminal 2
make deploy-local
make seed-local
make app                      # http://localhost:5173
```

Linki we froncie otwierają transakcje z localnetu w Explorerze przez „Custom RPC URL” (`http://127.0.0.1:8899`).

### Testy i scenariusz

```bash
make test          # 60 testów LiteSVM, bez walidatora
make smoke-local   # cały scenariusz demo na localnecie
```

## Komendy

| Komenda | Co robi |
|---|---|
| `make check` | sprawdza wersje narzędzi, portfel, saldo |
| `make build` | kompiluje program |
| `make test` | build + testy |
| `make idl` | kopiuje IDL i typy TS do frontu |
| `make localnet` / `make deploy-local` | lokalny walidator / deploy na niego |
| `make deploy-devnet` / `make upgrade-devnet` | deploy / upgrade na devnecie |
| `make seed-local` / `make seed-devnet` | krąg demo z firmami demo |
| `make smoke-local` | scenariusz demo na localnecie |
| `make app` | front na http://localhost:5173 |

---

## Zespół

**Team ZMOW**, HackYeah 2026. Projekt powstał z pomocą Claude Code (research konkurencji, spec, kod programu, testy, front). Decyzje produktowe podjął zespół.

Dokumenty: [spec](docs/superpowers/specs/2026-10-04-kwita-design.md) · [plan](docs/superpowers/plans/2026-10-04-kwita.md) · [interfejs](docs/INTERFEJS.md) · [pytania i odpowiedzi](docs/QA.md) · [pitch](docs/PITCH.md) · [wyzwanie](docs/WYZWANIE.md)
