# Kwita: materiały do oddania

Szkic do przerobienia własnymi słowami. Jury pyta o każdą decyzję, więc mów tylko to, co umiesz obronić.

## Wideo (≤ 3 min)

| Czas | Co na ekranie | Co mówisz |
|---|---|---|
| 0:00–0:20 | Slajd: kawiarnia, drukarnia, biuro rachunkowe | Małe firmy w jednym mieście kupują od siebie usługi, ale każda transakcja wymaga gotówki albo kredytu obrotowego w banku. Sieci barterowe (Sardex, WIR) rozwiązują to kredytem wzajemnym, ale operator sam ustala limity i prowadzi księgę. |
| 0:20–0:50 | Slajd z mechanizmem | Kwita: każda firma zaczyna od zera i płaci jednostkami kręgu, schodząc na minus do limitu. Suma sald zawsze wynosi zero, więc nikt nie wykłada płynności. Limit liczy program: kaucja + połowa sprzedaży do różnych firm + poręczenia. |
| 0:50–2:40 | Front, Phantom, Explorer | 1) Kawiarnia łączy Phantoma i próbuje dołączyć: program odrzuca, bo nie ma zaproszenia. Przełączamy się na Biuro rachunkowe, zakładka „Zaproś”, adres Phantoma: zaproszenie. Kawiarnia dołącza (kaucja 200 tPLN). Nikt centralny nie decyduje, kto wchodzi. 2) Kupuje ulotki za 150 (saldo −150). 3) Projekt za 100: program odrzuca, limit przekroczony. 4) Studio poręcza 100, zakup przechodzi. 5) Drukarnia wychodzi z kręgu z minusem: kaucja pokrywa dług. 6) Biuro wymienia jednostki na tPLN z Rezerwy. 7) Po terminie ktokolwiek ogłasza niewypłacalność: kaucja przepada, reszta długu przechodzi na poręczyciela. Każdy krok: link do Explorera. |
| 2:40–3:00 | Slajd „dlaczego blockchain” | Operator nie może przepisać księgi, dopisać sobie jednostek ani po cichu przyznać limitu znajomemu. Zasady kręgu są niezmienne od założenia i nie ma admina. |

## Slajdy (≤ 10)

1. **Problem:** płynność małych firm; kredyt obrotowy kosztuje; zatory płatnicze.
2. **Pośrednicy dziś:** bank (odsetki, zabezpieczenia) i operator sieci barterowej (Sardex: limity ok. 1% obrotu, zasady „trade secrets”).
3. **Mechanizm Kwity:** saldo od zera, płatność = przesunięcie salda, suma = 0. Wejście z zaproszeniem od dowolnej firmy z kręgu, bez admina.
4. **Limit z reguły:** kaucja + min(pułap, 50% sprzedaży) + poręczenia; pułap sprzedaży od jednego kupującego blokuje pompowanie limitów w kółko.
5. **Kaucja, poręczenia, Rezerwa:** kto płaci, gdy ktoś zniknie (kaucja → poręczyciel → `unbacked_loss`).
6. **Demo:** zrzut frontu + linki do Explorera.
7. **Gdzie w kodzie znika pośrednik:** `pay.rs` (sprawdzenie limitu), `declare_default.rs` (egzekucja bez sądu i bez operatora).
8. **Konkurencja:** Sardex/WIR (operator), ReSource (Celo, underwriterzy z tokenem SOURCE), Trustlines (linie kredytowe między znajomymi, przy niespłacie „nothing happens”). Na Solanie nie ma kredytu wzajemnego (Colosseum Copilot).
9. **Co dalej za tydzień:** podział niepokrytej straty między firmy na plusie, pilotaż z 5–10 firmami z jednego coworkingu, stablecoin PLN zamiast tPLN, numer KSeF w każdej płatności.
10. **Zespół + użycie AI.**

## Pytania jury

- **Gdzie dokładnie znika pośrednik?** `programs/kwita/src/instructions/pay.rs`: limit liczony z danych on-chain, nikt go nie przyznaje. `declare_default.rs`: egzekucja długu bez sądu i operatora, wywołać może każdy.
- **Co jeśli jedna strona zniknie w połowie i gdzie są wtedy środki?** Nie ma środków w drodze, są tylko salda. Dług znikającej firmy pokrywa jej kaucja (leży w vault programu), potem poręczyciel; reszta trafia do licznika `unbacked_loss` kręgu.
- **Kto ma jakie uprawnienia, czy autor może coś zmienić po deployu?** W kręgu nikt: parametry ustawia tylko `create_circle`, nie ma instrukcji zmiany ani admina. Nowe firmy zaprasza każda firma z kręgu; założyciel tylko dołącza pierwszy bez zaproszenia. Program ma upgrade authority (klucz zespołu); przed produkcją: `solana program set-upgrade-authority --final`.
- **Dlaczego blockchain, a nie baza danych?** Księgi kredytu wzajemnego nie może prowadzić strona, która na niej zarabia albo w niej uczestniczy. Tu reguła limitu i egzekucji jest publiczna i niezmienna, a każdy może sprawdzić, że suma sald wynosi zero.
- **Co dalej za tydzień?** Patrz slajd 9.

## Ryzyka, o których mówimy wprost

- VAT: każda płatność w kręgu to zwykła sprzedaż z fakturą (jak w Sardexie); VAT płaci się w złotówkach.
- Zasada 15 000 zł przez rachunek płatniczy i regulacje usług płatniczych: do sprawdzenia z doradcą przed wdrożeniem.
- Front podpisuje za 3 firmy demo kluczami z pliku: tylko na potrzeby demo.

## Użycie AI

Projekt powstał z pomocą Claude Code (research konkurencji w Colosseum Copilot, spec, plan, kod programu, testy i frontu). Decyzje produktowe (kaucja zamiast DAO, poręczenia, brak tokena) podjął zespół.
