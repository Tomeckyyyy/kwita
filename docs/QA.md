# Kwita: pytania i odpowiedzi do prezentacji

Zbiór pytań, które mogą paść od jury, z odpowiedziami. Każde pytanie ma wersję krótką (na scenę, 1–2 zdania) i pełną (gdyby dopytali). Liczby odnoszą się do parametrów kręgu demo: kaucja 200 tPLN, 50% sprzedaży liczone do limitu, pułap 300 tPLN sprzedaży od jednego kupującego, pułap 1 000 tPLN dodatkowego limitu ze sprzedaży.

---

## 1. Czy dwie firmy w zmowie mogą nabijać między sobą transakcje, żeby podnieść sobie limity?

**Na scenę:** Mogą, ale tylko trochę i z góry wiadomo o ile. Od jednego kupującego program liczy do limitu najwyżej 300 tPLN sprzedaży, czyli para w zmowie podnosi sobie limit o maksymalnie 150 tPLN każda. Fałszywe firmy się nie opłacają, bo każda musi zablokować 200 tPLN kaucji, żeby dać komuś 100 tPLN limitu.

**Pełna odpowiedź:**

- **Jak wygląda zmowa:** Drukarnia kupuje u Biura za 300, Biuro kupuje u Drukarni za 300. Salda wracają do zera, a obie firmy mają po 300 „sprzedaży”, więc ich limity rosną o 50% z 300 = 150 tPLN.
- **Co ją ogranicza (w programie, `pay.rs`):**
  - Konto `Pair` (sprzedawca, kupujący) liczy sprzedaż do limitu tylko do 300 tPLN od jednego kupującego. Dalsze „kręcenie” tej samej pary nic nie daje (test `sales_from_one_buyer_capped`).
  - Dodatkowy limit ze sprzedaży ma pułap 1 000 tPLN niezależnie od liczby partnerów.
- **Ile można na tym ukraść:** para w zmowie może zejść na minus o 150 tPLN więcej, niż pozwala kaucja. Jeśli potem zniknie, strata kręgu to najwyżej 150 tPLN na firmę od jednego partnera w zmowie. Do tego Drukarnia musiałaby znaleźć uczciwą firmę, która jej coś sprzeda.
- **Fałszywe firmy (sybil):** każda fałszywa firma musi wpłacić 200 tPLN kaucji. Jej limit to 200, więc może „kupić” najwyżej za 200, co daje sprzedawcy +100 limitu. Za każde 100 tPLN fałszywego limitu trzeba zablokować 200 tPLN, które przepadną przy niewypłacalności. To się nie opłaca.
- **Dlaczego to i tak lepsze niż dziś:** w Sardexie operator ręcznie ocenia firmy i ustala limity według niejawnych zasad. U nas ryzyko zmowy jest jawne i policzalne: każdy widzi parametry kręgu i wie, ile maksymalnie można stracić.
- **Co dalej (za tydzień):**
  - **Sprzedaż netto na parę:** do limitu liczyć tylko nadwyżkę tego, co Drukarnia sprzedała Biuru, nad tym, co od niego kupiła. Wymiana w kółko daje wtedy zero.
  - Liczyć sprzedaż z ostatnich 90 dni zamiast od początku.
  - Krąg może ustawić niższe parametry (np. 30% zamiast 50%).

---

## 2. Jak działa Rezerwa kręgu?

**Na scenę:** Rezerwa to „firma bez właściciela” prowadzona przez program. Gdy ktoś wychodzi z kręgu albo znika z długiem, Rezerwa przejmuje jego miejsce w księdze i dostaje jego kaucję w tPLN. Firmy z saldem dodatnim mogą potem wymienić swoje jednostki na te tPLN. Nikt nie ma do niej klucza: wpływy i wypłaty wynikają wyłącznie z reguł programu.

**Pełna odpowiedź:**

Rezerwa ma trzy liczby (konto `Circle`):

| Pole | Co znaczy |
|---|---|
| `reserve_balance` | saldo Rezerwy w jednostkach kręgu, liczone jak saldo firmy. Ujemne: Rezerwa przejęła czyjś dług. Dodatnie: ktoś oddał jej swoje jednostki |
| `reserve_usdc` | ile tPLN w skarbcu należy do Rezerwy (reszta skarbca to kaucje firm) |
| `unbacked_loss` | dług, którego nie pokryła ani kaucja, ani poręczyciele |

Skąd Rezerwa dostaje środki (`leave.rs`, `declare_default.rs`):

1. **Firma wychodzi z długiem:** Drukarnia ma −50 i wychodzi. Z jej kaucji 50 tPLN trafia do Rezerwy, a Rezerwa przejmuje dług (saldo −50). Reszta kaucji (150) wraca do Drukarni.
2. **Firma wychodzi z nadwyżką i ją oddaje:** saldo +X przechodzi na Rezerwę jako bufor. tPLN się nie przesuwa.
3. **Niewypłacalność:** cała kaucja przepada do Rezerwy, nawet ta część, która przewyższa dług (to kara za zniknięcie). Rezerwa przejmuje dług do wysokości kaucji, resztę biorą poręczyciele, a to, czego nie pokryli, idzie do `unbacked_loss`.

Jedyna wypłata z Rezerwy (`redeem.rs`): firma z saldem dodatnim wymienia jednostki na tPLN 1:1, dopóki Rezerwa ma tPLN. Saldo firmy maleje, saldo Rezerwy rośnie o tyle samo, a tPLN przechodzi ze skarbca do firmy.

**Po co to jest:** gdy Drukarnia wychodzi z długiem 50, ktoś w kręgu ma te 50 „na plusie” (np. Biuro), a dłużnika już nie ma. Rezerwa zajmuje miejsce dłużnika i trzyma za nią prawdziwe tPLN z kaucji, więc Biuro może zamienić swoje jednostki na pieniądze. W ten sposób firma z nadwyżką może wyjść do gotówki bez operatora.

**Co zawsze się zgadza (testy po każdym scenariuszu):**
- suma sald wszystkich firm + saldo Rezerwy = 0;
- tPLN w skarbcu = kaucje firm + tPLN Rezerwy.

**Ograniczenia (MVP):**
- Wymiana działa w kolejności zgłoszeń: kto pierwszy wymieni, ten dostaje tPLN, dopóki są.
- `unbacked_loss` jest tylko zapisywana. Podział tej straty między firmy na plusie to następny krok.

---

## 3. Co zrobić, żeby Kwita była gotowa do prawdziwego użycia? (= „co dalej za tydzień?”)

**Na scenę:** Trzy rzeczy: liczyć do limitu tylko sprzedaż netto między parą firm (koniec z nabijaniem w kółko), dać firmom logowanie mailem bez instalowania portfela i bez SOL, i zrobić pilotaż z 5–10 firmami z jednego coworkingu na stablecoinie złotówkowym albo euro.

**Pełna odpowiedź:**

Program (zasady kręgu):
- **Sprzedaż netto na parę firm:** do limitu liczy się tylko nadwyżka tego, co A sprzedała B, nad tym, co od niej kupiła. Usuwa zmowę z pytania 1.
- **Okno czasowe dla sprzedaży** (np. 90 dni): limit odzwierciedla bieżącą aktywność, a nie historię sprzed roku.
- **Podział niepokrytej straty** proporcjonalnie między firmy z saldem dodatnim, zamiast samego zapisu w `unbacked_loss`.
- **Zamykanie kont przy wyjściu:** zwrot opłaty za miejsce w sieci (ok. 0,001 SOL) i możliwość ponownego dołączenia.
- **Kręgi zamknięte:** wejście tylko z poręczeniem 1–2 firm z kręgu (opcja przy zakładaniu kręgu).
- **Uprawnienia:** po audycie odebranie możliwości aktualizacji programu (`set-upgrade-authority --final`) albo przekazanie jej multisigowi (Squads), żeby nikt sam nie mógł zmienić kodu.
- **Audyt i testy losowe (fuzzing)** przed prawdziwymi pieniędzmi.

Dla firm (użyteczność):
- **Logowanie mailem / Google z portfelem wbudowanym** i opłatami sieciowymi płaconymi przez aplikację: właściciel kawiarni nie instaluje Phantoma i nie kupuje SOL.
- **Kaucja w prawdziwym stablecoinie** (PLN, jeśli będzie dostępny, inaczej EURC) i wpłata przez BLIK lub przelew przez bramkę on-ramp.
- **Płatność kodem QR** (Solana Pay): sprzedawca pokazuje kod, kupujący skanuje telefonem i płaci jednostkami kręgu.
- **Faktury:** numer z KSeF w każdej płatności (pole już jest) i eksport dla księgowej.
- **Katalog ofert kręgu:** co kto sprzedaje, żeby firmy z nadwyżką miały na co ją wydać (Sardex robi to ręcznie przez brokerów).
- **Powiadomienia:** „otrzymałeś płatność”, „zbliża się termin spłaty”.

Prawo i biznes:
- Sprawdzenie z prawnikiem: wyjątek „ograniczonej sieci” w ustawie o usługach płatniczych, zasada 15 000 zł przez rachunek płatniczy, VAT od transakcji w kręgu.
- Weryfikacja firm (NIP / KRS / CEIDG) przy wejściu.
- Regulamin kręgu jako umowa między firmami, która odsyła do zasad zapisanych w programie.
- Pilotaż: 5–10 firm, które już handlują ze sobą (coworking, lokalne zrzeszenie), 3 miesiące, a potem mierzymy obrót w kręgu i liczbę niewypłacalności.
