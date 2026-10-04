/// Kwota w tPLN do logów programu: -250, 12,5, 0,01.
pub fn tpln(base_units: i128) -> String {
    let sign = if base_units < 0 { "-" } else { "" };
    let abs = base_units.unsigned_abs();
    let whole = abs / 1_000_000;
    let cents = (abs % 1_000_000) / 10_000;
    if cents == 0 {
        format!("{sign}{whole}")
    } else if cents % 10 == 0 {
        format!("{sign}{whole},{}", cents / 10)
    } else {
        format!("{sign}{whole},{cents:02}")
    }
}

#[cfg(test)]
mod tests {
    use super::tpln;

    #[test]
    fn formats_amounts() {
        assert_eq!(tpln(-250_000_000), "-250");
        assert_eq!(tpln(12_500_000), "12,5");
        assert_eq!(tpln(10_000), "0,01");
        assert_eq!(tpln(0), "0");
    }
}
