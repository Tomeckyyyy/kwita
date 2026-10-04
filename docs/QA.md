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
