# Interfejs programu `kwita` (umowa program ↔ front)

Program ID: `GB8MgJJggQM7uiHwWy9nuL5AZnGbFraHVharujHKXAgk`. IDL i typy TS: `app/src/idl/kwita.json`, `app/src/idl/kwita.ts` (odświeża `make idl`). Klient TS do użycia we froncie i skryptach: `app/src/lib/kwita.ts`.

Kwoty: jednostki bazowe tokena kaucji (tPLN, 6 miejsc po przecinku; 1 tPLN = 1 000 000). W TS: `toUnits(150)` → `BN(150_000_000)`.

## Konta (PDA)

| Konto | Seedy | Najważniejsze pola |
|---|---|---|
| `Circle` | `"circle"`, creator, `circle_id` (u64 LE) | `collateralMint`, `vault`, `depositAmount`, `salesLimitBps`, `perCounterpartyCap`, `maxSalesCredit`, `defaultAfterSecs`, `reserveBalance` (i64), `reserveUsdc`, `unbackedLoss`, `memberCount` |
| vault (SPL token account) | `"vault"`, circle | authority = `Circle` |
| `Member` | `"member"`, circle, owner | `owner`, `balance` (i64), `deposit`, `countedSales`, `guaranteesGiven`, `guaranteesReceived`, `negativeSince` (0 = nie na minusie), `status` (`{active:{}}` / `{exited:{}}` / `{defaulted:{}}`) |
| `Pair` | `"pair"`, circle, seller (owner), buyer (owner) | `counted` |
| `Guarantee` | `"guarantee"`, circle, guarantor (owner), beneficiary (owner) | `guarantor`, `beneficiary`, `amount` |

Filtry `getProgramAccounts`: `Member.circle` jest na offsecie 8, `Guarantee.beneficiary` na offsecie 40.

Limit: `deposit + min(maxSalesCredit, countedSales * salesLimitBps / 10000) + guaranteesReceived - guaranteesGiven`; firma może zejść do `balance >= -limit`.

## Instrukcje

Konta w kolejności z IDL; „S” = podpisuje, „W” = zapisywalne.

| Instrukcja | Argumenty | Konta |
|---|---|---|
| `createCircle` | `circleId: u64, depositAmount: u64, salesLimitBps: u16, perCounterpartyCap: u64, maxSalesCredit: u64, defaultAfterSecs: i64` | creator (S,W), circle (W), collateralMint, vault (W), tokenProgram, systemProgram |
| `join` | — | owner (S,W), circle (W), member (W), collateralMint, ownerToken (W, ATA ownera), vault (W), tokenProgram, systemProgram |
| `pay` | `amount: u64, invoiceRef: string (≤ 64 B)` | buyer (S,W), circle, buyerMember (W), sellerMember (W), pair (W), systemProgram |
| `giveGuarantee` | `amount: u64` | guarantor (S,W), circle, guarantorMember (W), beneficiaryMember (W), guarantee (W), systemProgram |
| `withdrawGuarantee` | `amount: u64` | guarantor (S), circle, guarantorMember (W), beneficiaryMember (W), guarantee (W) |
| `redeem` | `amount: u64` | owner (S), circle (W), member (W), collateralMint, ownerToken (W), vault (W), tokenProgram |
| `leave` | `forfeitPositive: bool` | jak `redeem` |
| `declareDefault` | — | caller (S), circle (W), member (W, firma na minusie); `remainingAccounts`: pary `[guarantee (W), member poręczyciela (W)]` dla każdego poręczenia za tę firmę |

## Błędy (kod = 6000 + indeks)

| Kod | Nazwa | Kiedy |
|---|---|---|
| 6000 | InvalidParams | `createCircle`: kaucja 0, bps > 10 000, termin ≤ 0 |
| 6001 | ZeroAmount | kwota 0 |
| 6002 | SelfPayment | płatność do siebie |
| 6003 | NotActive | firma wyszła albo jest niewypłacalna |
| 6004 | LimitExceeded | zakup albo poręczenie ponad limit |
| 6005 | InvoiceRefTooLong | numer faktury > 64 B |
| 6006 | SelfGuarantee | poręczenie za siebie |
| 6007 | GuaranteeTooSmall | wycofanie większe niż poręczenie |
| 6008 | GuaranteeInUse | wycofanie zostawiłoby firmę ponad limitem |
| 6009 | InsufficientBalance | `redeem` większy niż saldo |
| 6010 | ReserveEmpty | Rezerwa nie ma tyle tPLN |
| 6011 | HasGivenGuarantees | `leave` z aktywnymi poręczeniami za innych |
| 6012 | DepositTooSmallToLeave | dług większy niż kaucja |
| 6013 | PositiveBalance | `leave` z plusem bez `forfeitPositive` |
| 6014 | NotNegative | `declareDefault` dla firmy nie na minusie |
| 6015 | TooEarly | termin niewypłacalności nie minął |
| 6016 | InvalidGuaranteeAccount | zła para w `remainingAccounts` |
| 6017 | MathOverflow | przepełnienie |
| 6018 | WrongCircle | konto z innego kręgu |

## Zdarzenia

`CircleCreated`, `MemberJoined`, `PaymentMade { buyer, seller, amount, counted, invoiceRef }`, `GuaranteeChanged`, `Redeemed`, `MemberLeft { coveredDebt, forfeited, refunded }`, `MemberDefaulted { debt, fromDeposit, fromGuarantors, unbacked }`.

## Przykład (TS, `@anchor-lang/core`)

```ts
await program.methods
  .pay(new BN(150 * UNIT), "FV/12/2026")
  .accountsPartial({ buyer, circle, buyerMember, sellerMember, pair, systemProgram: SystemProgram.programId })
  .rpc();
```

## Deploy

- `kwita.so`: 319 152 B, rent-exempt ok. 1,62 SOL (`solana rent 319152`). Deploy na devnet chwilowo potrzebuje ~2× tyle (bufor + program), bufor wraca po deployu.
- Upgrade authority: klucz devnetowy zespołu. Po hackathonie można ją wyłączyć: `solana program set-upgrade-authority <PROGRAM_ID> --final`.
