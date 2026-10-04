use anchor_lang::prelude::*;

#[error_code]
pub enum KwitaError {
    #[msg("Nieprawidłowe parametry kręgu")]
    InvalidParams, // 6000
    #[msg("Kwota musi być większa od zera")]
    ZeroAmount, // 6001
    #[msg("Nie można płacić samemu sobie")]
    SelfPayment, // 6002
    #[msg("Firma nie jest aktywna w kręgu")]
    NotActive, // 6003
    #[msg("Przekroczony limit kredytu")]
    LimitExceeded, // 6004
    #[msg("Numer faktury jest za długi (max 64 bajty)")]
    InvoiceRefTooLong, // 6005
    #[msg("Nie można poręczyć za siebie")]
    SelfGuarantee, // 6006
    #[msg("Poręczenie jest mniejsze niż kwota wycofania")]
    GuaranteeTooSmall, // 6007
    #[msg("Poręczenie jest w użyciu: firma przekroczyłaby limit")]
    GuaranteeInUse, // 6008
    #[msg("Za małe saldo")]
    InsufficientBalance, // 6009
    #[msg("Rezerwa nie ma tyle tPLN")]
    ReserveEmpty, // 6010
    #[msg("Firma ma aktywne poręczenia za inne firmy")]
    HasGivenGuarantees, // 6011
    #[msg("Kaucja nie pokrywa salda ujemnego")]
    DepositTooSmallToLeave, // 6012
    #[msg("Saldo dodatnie: wydaj je, wymień albo oddaj Rezerwie")]
    PositiveBalance, // 6013
    #[msg("Saldo nie jest ujemne")]
    NotNegative, // 6014
    #[msg("Termin niewypłacalności jeszcze nie minął")]
    TooEarly, // 6015
    #[msg("Nieprawidłowe konto poręczenia")]
    InvalidGuaranteeAccount, // 6016
    #[msg("Przepełnienie arytmetyczne")]
    MathOverflow, // 6017
    #[msg("Konto należy do innego kręgu")]
    WrongCircle, // 6018
    #[msg("Saldo sprzedawcy przekroczyłoby pułap salda dodatniego")]
    PositiveBalanceCap, // 6019
    #[msg("Firma ma poręczenia od innych firm: poproś poręczycieli o ich wycofanie")]
    HasReceivedGuarantees, // 6020
    #[msg("Nie masz zaproszenia do tego kręgu")]
    NotInvited, // 6021
    #[msg("Nie można zaprosić samego siebie")]
    CannotInviteSelf, // 6022
    #[msg("Zapraszać może tylko aktywna firma z kręgu")]
    InviterNotActive, // 6023
    #[msg("Konto zapraszającego nie zgadza się z zaproszeniem")]
    WrongInviter, // 6024
}
