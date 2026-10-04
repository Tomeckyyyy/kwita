# Kwita: pytania i odpowiedzi do prezentacji

Zbiór pytań, które mogą paść od jury, z odpowiedziami. Każde pytanie ma wersję krótką (na scenę, 1–2 zdania) i pełną (gdyby dopytali). Liczby odnoszą się do parametrów kręgu demo: kaucja 200 tPLN, 50% sprzedaży liczone do limitu, pułap 300 tPLN sprzedaży od jednego kupującego, pułap 1 000 tPLN dodatkowego limitu ze sprzedaży.

---

## 1. Czy dwie firmy w zmowie mogą nabijać między sobą transakcje, żeby podnieść sobie limity?

**Na scenę:** Nie. Do limitu liczy się tylko sprzedaż **netto** między parą firm: to, co sprzedałeś danej firmie, minus to, co od niej kupiłeś. Wymiana w kółko daje zero, a test `wash_trading_between_two_firms_gives_no_limit` to sprawdza. Limit rośnie za to, co wnosisz do kręgu, a nie za kręcenie obrotu z kolegą.

**Pełna odpowiedź:**

- **Jak liczymy (`pay.rs`):** dla każdej pary firm program trzyma obrót w obie strony (konta `Pair` sprzedawca→kupujący i odwrotnie). Kredyt ze sprzedaży od danego kupującego = min(300 tPLN, sprzedaż do niego − zakupy od niego), nie mniej niż 0. Limit kupującego jest sprawdzany już po przeliczeniu, więc odkupienie od tej samej firmy od razu obniża jego limit (test `buyer_limit_uses_credit_after_buying_back`).
- **Zwykły handel nie cierpi:** płatności i salda działają tak samo. Handel w kręgu (A→B→C→A) i sprzedaż do wielu firm budują limit normalnie. Nie buduje go tylko wzajemna wymiana z tym samym partnerem, bo strony rozliczyły się nawzajem.
- **Fałszywe firmy (sybil):** każda fałszywa firma musi wpłacić 200 tPLN kaucji, a jej limit pozwala „kupić” najwyżej za 200, co daje sprzedawcy +100 limitu. Za każde 100 tPLN fałszywego limitu trzeba zablokować 200 tPLN, które przepadają przy niewypłacalności. To się nie opłaca.
- **Co zostaje:** grupa wielu firm w zmowie może podnieść komuś limit sprzedażą „w jedną stronę” z kilku firm, ale każda z nich ryzykuje własną kaucją i limitem. Dodatkowy limit ze sprzedaży ma też pułap 1 000 tPLN.
- **Dlaczego to lepsze niż dziś:** w Sardexie operator ręcznie ocenia firmy i ustala limity według niejawnych zasad. U nas reguła jest jawna i ta sama dla wszystkich.

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
- **Silniejsze zaproszenia:** dziś do wejścia wystarczy zaproszenie jednej firmy z kręgu (pytanie 4). Następny krok: zaproszenie połączone z poręczeniem albo wymagane od 2 firm (opcja przy zakładaniu kręgu).
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

---

## 4. Kto decyduje, kto wchodzi do kręgu?

**Na scenę:** Nikt centralny. Do kręgu wchodzi się tylko z zaproszeniem, a zaprosić może **każda** aktywna firma z kręgu. Bez zaproszenia program odrzuca dołączenie, co pokazujemy na żywo: Phantom próbuje wejść, dostaje odmowę, firma z kręgu go zaprasza i dopiero wtedy wchodzi.

**Pełna odpowiedź:**

- **Jak to działa (`invite.rs`, `join.rs`):** `invite` tworzy konto zaproszenia dla adresu portfela nowej firmy. Podpisuje firma z kręgu i płaci za konto (ok. 0,0012 SOL). `join` sprawdza, czy zaproszenie istnieje, i je zużywa: konto jest zamykane, a opłata wraca do zapraszającego. Po wyjściu z kręgu nie da się wrócić na to samo zaproszenie.
- **Założyciel nie jest adminem:** jedyna różnica jest taka, że dołącza jako pierwszy bez zaproszenia (ktoś musi być pierwszy). Nie może nikogo wyrzucić, zablokować ani cofnąć cudzego zaproszenia. Firma po wyjściu albo niewypłacalna nie może zapraszać.
- **Dlaczego jedna firma wystarczy:** zaproszenie nie daje kredytu. Nowa firma i tak wpłaca kaucję 200 tPLN i zaczyna z limitem równym kaucji, więc zaproszenie „słabej” firmy nie naraża kręgu na więcej niż jej własna kaucja. Kto chce dać jej większy limit, poręcza własnym limitem.
- **Czym to się różni od Sardexu:** tam operator wybiera firmy i ustala im limity. W Kwicie sieć rośnie od firm, które już handlują ze sobą, a reguła jest ta sama dla wszystkich i zapisana w programie.
- **Co dalej:** zaproszenie z poręczeniem albo od 2 firm, weryfikacja NIP/KRS przy wejściu (pytanie 3).
