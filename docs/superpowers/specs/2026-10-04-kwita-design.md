# Kwita: kredyt kupiecki bez banku (spec)

Data: 2026-10-04. HackYeah 2026, wyzwanie Superteam Poland „Finance Without Intermediaries”. Oddanie: 4.10, 23:00.

## Cel

Krąg firm płaci sobie nawzajem jednostkami kręgu (1 jednostka = 1 tPLN, testowy złoty) zamiast gotówką. Każda firma zaczyna od salda 0 i może zejść na minus do swojego limitu. Dług spłaca sprzedażą do kręgu. Suma sald zawsze wynosi 0, więc nikt nie wykłada płynności.

Zastępowani pośrednicy:
- bank, który daje kredyt obrotowy z odsetkami;
- operator sieci barterowej (Sardex, WIR), który prowadzi księgę i sam ustala limity (w Sardexie zasady to „trade secrets”).

W Kwicie limit liczy reguła w programie, za ryzyko odpowiadają kaucja i poręczyciele, a zasad po założeniu kręgu nikt nie zmienia (brak admina, brak tokena, brak opłat).

Użytkownik docelowy: małe firmy w jednym mieście, które już kupują od siebie usługi (kawiarnia, drukarnia, studio graficzne, biuro rachunkowe).

Kryterium sukcesu: demo na żywo przed 4.10, 23:00. Połączenie portfela → dołączenie bez zaproszenia odrzucone → firma z kręgu zaprasza → dołączenie → zakup na minus → zakup ponad limit odrzucony → poręczenie podnosi limit → wymiana na tPLN z Rezerwy → wyjście z kręgu → ogłoszenie niewypłacalności. Każdy krok to transakcja widoczna w Solana Explorerze.

## Poza zakresem (MVP)

- Podział niepokrytej straty między firmy na plusie. Strata ponad kaucję i poręczenia trafia do licznika `unbacked_loss` kręgu (pitch: następny krok).
- VAT płatny w tPLN, blokowanie firm oszukujących poza łańcuchem, głosowania, wiele kręgów w UI, dopłata do kaucji.

## Program `kwita` (Anchor 1.2.0)

Kwoty to `u64`/`i64` w jednostkach bazowych tokena kaucji (6 miejsc po przecinku). Jednostki kręgu są kontami programu, nie tokenami SPL, więc nie da się ich przelać poza regułami.

### Konta (PDA)

| Konto | Seedy | Pola |
|---|---|---|
| `Circle` | `["circle", creator, circle_id.to_le_bytes()]` | `creator`, `circle_id: u64`, `collateral_mint`, `vault`, `deposit_amount: u64`, `sales_limit_bps: u16`, `per_counterparty_cap: u64`, `max_sales_credit: u64`, `default_after_secs: i64`, `reserve_balance: i64`, `reserve_usdc: u64`, `unbacked_loss: u64`, `member_count: u32`, `bump` |
| vault (konto tokenowe SPL) | `["vault", circle]`, authority = `Circle` | wszystkie kaucje i tPLN Rezerwy |
| `Member` | `["member", circle, owner]` | `circle`, `owner`, `balance: i64`, `deposit: u64`, `counted_sales: u64`, `guarantees_given: u64`, `guarantees_received: u64`, `negative_since: i64` (0 = nie na minusie), `status: Active / Exited / Defaulted`, `bump` |
| `Pair` | `["pair", circle, seller, buyer]` (seller/buyer = adresy właścicieli) | `counted: u64`, `bump` |
| `Guarantee` | `["guarantee", circle, guarantor, beneficiary]` (adresy właścicieli) | `guarantor`, `beneficiary`, `amount: u64`, `bump` |
| `Invite` | `["invite", circle, invitee]` (adres zaproszonej firmy) | `circle`, `inviter`, `invitee`, `bump`. Jedno oczekujące zaproszenie na firmę; `join` je zamyka |

Parametry `Circle` są ustawiane tylko w `create_circle`. Żadna instrukcja ich nie zmienia.

Wejście do kręgu tylko z zaproszeniem. Zaprasza każda aktywna firma z kręgu; nie ma admina ani bramkarza. Założyciel (`Circle.creator`) dołącza bez zaproszenia, bo ktoś musi być pierwszy, i poza tym nie ma żadnych uprawnień. Układ `Circle` się nie zmienił, więc wszystkie kręgi (także założone wcześniej) są „tylko z zaproszeniem”.

### Limit

```
limit(m) = m.deposit
         + min(max_sales_credit, m.counted_sales * sales_limit_bps / 10_000)
         + m.guarantees_received
         - m.guarantees_given
```

Firma może zejść do `balance >= -limit(m)`. Nowa firma ma limit równy kaucji, więc jest w pełni pokryta. Sprzedaż liczy się do limitu tylko do `per_counterparty_cap` od jednego kupującego (`Pair.counted`), więc dwie firmy sprzedające sobie w kółko nie pompują limitów.

### Niezmienniki

1. Suma `balance` wszystkich firm + `reserve_balance` = 0.
2. Stan vault = suma `deposit` wszystkich firm + `reserve_usdc`.

Testy sprawdzają oba po każdym scenariuszu.

### Instrukcje

| Instrukcja | Podpisuje | Działanie | Błędy |
|---|---|---|---|
| `create_circle(circle_id, deposit_amount, sales_limit_bps, per_counterparty_cap, max_sales_credit, default_after_secs)` | twórca (płaci rent) | tworzy `Circle` i vault | `InvalidParams` (bps > 10 000, deposit = 0, default_after_secs <= 0) |
| `invite(invitee)` | zapraszający (płaci rent) | zapraszający ma `Member` w tym kręgu ze statusem `Active`, `invitee ≠ zapraszający`. Tworzy `Invite`. Zdarzenie `MemberInvited` | `InviterNotActive`, `CannotInviteSelf`, konto już istnieje (oczekujące zaproszenie) |
| `revoke_invite(invitee)` | zapraszający | zamyka niewykorzystane `Invite`, rent wraca do zapraszającego. Zdarzenie `InviteRevoked` | `WrongInviter` |
| `join()` | firma | wymaga `Invite` dla (krąg, firma), chyba że firma to `creator`. Konta opcjonalne `invite`, `inviter`: zaproszenie jest zużywane (zamknięte, rent wraca do zapraszającego), więc po `leave` nie da się wrócić na to samo zaproszenie. Tworzy `Member`, przelewa `deposit_amount` z konta tokenowego firmy do vault, `deposit = deposit_amount`, `balance = 0` | `NotInvited`, `WrongInviter`, standardowe błędy tokena |
| `pay(amount, invoice_ref: String ≤ 64)` | kupujący | sprawdza `amount > 0`, kupujący ≠ sprzedawca, oba `Active`, `buyer.balance - amount >= -limit(buyer)`. `buyer.balance -= amount`, `seller.balance += amount`. `Pair` (init-if-needed): `counted_now = min(cap - pair.counted, amount)`, `pair.counted += counted_now`, `seller.counted_sales += counted_now`. `negative_since`: ustaw na teraz, gdy kupujący schodzi poniżej 0 z ≥ 0; zeruj, gdy sprzedawca wraca do ≥ 0. Zdarzenie `PaymentMade` z `invoice_ref` (numer faktury, np. KSeF) | `ZeroAmount`, `SelfPayment`, `NotActive`, `LimitExceeded`, `InvoiceRefTooLong` |
| `give_guarantee(amount)` | poręczyciel | oba `Active`, różne firmy. `guarantor.guarantees_given += amount`, `beneficiary.guarantees_received += amount`, `Guarantee.amount += amount` (init-if-needed). Po zmianie poręczyciel musi mieścić się w swoim limicie | `ZeroAmount`, `SelfGuarantee`, `NotActive`, `LimitExceeded` |
| `withdraw_guarantee(amount)` | poręczyciel | `amount <= Guarantee.amount`. Jeśli firma z poręczenia jest `Active`, po zmniejszeniu musi mieścić się w swoim limicie. Jeśli wyszła albo jest niewypłacalna, wycofanie jest zawsze możliwe | `ZeroAmount`, `GuaranteeTooSmall`, `GuaranteeInUse` |
| `redeem(amount)` | firma na plusie | firma `Active`, `balance >= amount`, `reserve_usdc >= amount`. `balance -= amount`, `reserve_balance += amount`, `reserve_usdc -= amount`, przelew tPLN z vault do firmy | `ZeroAmount`, `InsufficientBalance`, `ReserveEmpty` |
| `leave(forfeit_positive: bool)` | firma | firma `Active`, `guarantees_given == 0`. Saldo ujemne: `need = -balance`, wymaga `deposit >= need`; `deposit -= need`, `reserve_usdc += need`, `reserve_balance -= need`, `balance = 0`. Saldo dodatnie: wymaga `forfeit_positive`; `reserve_balance += balance`, `balance = 0`. Reszta kaucji wraca na konto tokenowe firmy, `status = Exited` | `NotActive`, `HasGivenGuarantees`, `DepositTooSmallToLeave`, `PositiveBalance` |
| `declare_default()` | **ktokolwiek** | firma `Active`, `balance < 0`, `now >= negative_since + default_after_secs`. Kaucja przepada w całości do Rezerwy: `reserve_usdc += deposit`, część pokrywa dług (`take = min(deposit, loss)`, `reserve_balance -= take`). Potem `remaining_accounts` = pary (`Guarantee`, `Member` poręczyciela) dla tej firmy: dług `min(g.amount, loss)` przechodzi na saldo poręczyciela (może wyjść poza jego limit, ustawia mu `negative_since`), poręczenie zeruje się po obu stronach. Reszta straty: `reserve_balance -= loss`, `unbacked_loss += loss`. `balance = 0`, `deposit = 0`, `status = Defaulted` | `NotActive`, `NotNegative`, `TooEarly`, `InvalidGuaranteeAccount` |

Zdarzenia: `CircleCreated`, `MemberInvited`, `InviteRevoked`, `MemberJoined`, `PaymentMade`, `GuaranteeChanged`, `Redeemed`, `MemberLeft`, `MemberDefaulted`.

Uprawnienia po deployu: brak admina kręgu. Upgrade authority programu = klucz devnetowy zespołu (uczciwie mówimy o tym jury; po hackathonie można ją wyłączyć: `solana program set-upgrade-authority --final`).

## Front (`app/`, Vite + React + TypeScript)

- Wallet Adapter (Phantom). Portfel z Phantoma to firma prezentera (Kawiarnia).
- Trzy pozostałe firmy demo (Drukarnia, Studio graficzne, Biuro rachunkowe) podpisują kluczami z pliku `app/public/demo-firms.json`, generowanego przez `seed` i wpisanego do `.gitignore`. Przełącznik „działam jako: …”.
- Ekrany (jedna strona, surowy UI wystarczy):
  - **Krąg:** tabela firm (saldo, limit, kaucja, status, „na minusie od”), Rezerwa (saldo, tPLN, niepokryta strata).
  - **Zapłać:** firma sprzedająca, kwota, numer faktury.
  - **Poręcz / Wycofaj poręczenie.**
  - **Zaproś:** adres portfela firmy, lista oczekujących zaproszeń, wycofanie własnego.
  - **Wymień na tPLN, Wyjdź z kręgu** (z zaznaczeniem „oddaj saldo dodatnie Rezerwie”).
  - **Niewypłacalność:** licznik do terminu i przycisk `declare_default`.
- Po każdej transakcji link do Explorera (devnet albo Custom RPC dla localnetu).
- Sieć i adres kręgu z `app/.env` (`VITE_RPC_URL`, `VITE_CLUSTER`, `VITE_CIRCLE`), zapisywane przez `seed`.

## Skrypt `seed` (TypeScript)

Tworzy mint tPLN (6 miejsc), cztery firmy demo (zasila je małą ilością SOL z portfela zespołu), mintuje każdej 1 000 tPLN, zakłada krąg i zapisuje pliki dla frontu. Parametry kręgu demo:

| Parametr | Wartość demo |
|---|---|
| `deposit_amount` | 200 tPLN |
| `sales_limit_bps` | 5 000 (50%) |
| `per_counterparty_cap` | 300 tPLN |
| `max_sales_credit` | 1 000 tPLN |
| `default_after_secs` | 60 s (w produkcji 12 miesięcy) |

Krąg zakłada pierwsza firma demo (Drukarnia): dołącza bez zaproszenia i zaprasza Studio i Biuro, które potem dołączają. Kawiarni (Phantom) seed nie zaprasza: w demo zaprasza ją na żywo firma z kręgu.

## Praca równoległa

- `docs/INTERFEJS.md`: konta, seedy, instrukcje z kontami i argumentami, błędy, zdarzenia, przykłady wywołań w TS. Umowa między programem a frontem.
- IDL kopiowany przez `make idl` do `app/src/idl/kwita.json` (commitowany), żeby front dało się robić bez budowania programu.
- Wspólny keypair programu w `keys/` daje stały Program ID dla całego zespołu (jak w `bezposrednik`).

## Środowisko

Te same przypięte wersje co w `bezposrednik`: Anchor 1.2.0, Solana 3.1.10, Rust 1.89.0, SBPF v0 (`make build`), LiteSVM do testów, Node 24. `Makefile`: `check`, `build`, `test`, `idl`, `localnet`, `deploy-local`, `deploy-devnet`, `seed`, `app`. README z sekcją dla agenta.

Devnet: 5 SOL na portfelu zespołu. Deploy z `--max-len` równym rozmiarowi programu. Plan awaryjny: lokalny walidator + Explorer z Custom RPC.

## Testy (Rust + LiteSVM, test-first)

Po kilka przypadków na instrukcję:
- `create_circle`: poprawne parametry, odrzucenie złych.
- `join`: kaucja w vault, saldo 0, limit = kaucja.
- zaproszenia: zaproszona firma dołącza, bez zaproszenia odmowa, założyciel bez zaproszenia, nie-członek i firma po wyjściu nie zapraszają, zaproszenie działa raz, zaproszenie siebie odrzucone, wycofanie.
- `pay`: przelew salda, odrzucenie ponad limit, płatność do siebie, `negative_since` ustawiany i zerowany, pułap sprzedaży od jednego kupującego.
- `give_guarantee` / `withdraw_guarantee`: podniesienie limitu, odrzucenie wycofania w użyciu, wycofanie po wyjściu firmy.
- `redeem`: wymiana przy pełnej Rezerwie, odrzucenie przy pustej.
- `leave`: z minusem (kaucja pokrywa), z plusem (wymaga `forfeit_positive`), z danym poręczeniem (odrzucone).
- `declare_default`: za wcześnie (odrzucone), po terminie bez poręczyciela, z poręczycielem, strata ponad kaucję + poręczenie trafia do `unbacked_loss`.
- Po każdym scenariuszu oba niezmienniki.

## Demo (≤ 3 min)

1. Kawiarnia łączy Phantoma i próbuje dołączyć: program odrzuca (brak zaproszenia). Biuro rachunkowe zaprasza adres Phantoma, Kawiarnia dołącza (kaucja 200 tPLN, limit 200).
2. Kawiarnia kupuje ulotki w Drukarni za 150 (saldo −150).
3. Kawiarnia próbuje kupić projekt w Studiu za 100: program odrzuca (−250 < −200).
4. Studio poręcza za Kawiarnię 100: limit 300, zakup przechodzi.
5. Drukarnia (+150) kupuje u Biura rachunkowego za 200 (saldo −50) i wychodzi z kręgu: kaucja pokrywa dług, 50 tPLN trafia do Rezerwy, reszta kaucji wraca.
6. Biuro rachunkowe (na plusie) wymienia 50 jednostek na tPLN z Rezerwy.
7. Firma, która „zniknęła” na minusie: po 60 s ktokolwiek ogłasza niewypłacalność, kaucja przepada, dług przechodzi na poręczyciela.

Każdy krok z linkiem do Explorera. Odpowiedzi dla jury: gdzie znika pośrednik (`pay` liczy limit, `declare_default` egzekwuje), co jeśli ktoś zniknie (kaucja → poręczyciel → `unbacked_loss`), kto ma uprawnienia (nikt w kręgu; zaprasza każda firma z kręgu; upgrade authority programu do wyłączenia), dlaczego nie baza danych (operator nie przepisze księgi ani nie przyzna limitu po cichu).
