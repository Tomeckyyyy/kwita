use anchor_lang::prelude::*;

#[event]
pub struct CircleCreated {
    pub circle: Pubkey,
    pub creator: Pubkey,
    pub circle_id: u64,
}

#[event]
pub struct MemberJoined {
    pub circle: Pubkey,
    pub owner: Pubkey,
    pub deposit: u64,
}

#[event]
pub struct PaymentMade {
    pub circle: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub amount: u64,
    pub counted: u64,
    pub invoice_ref: String,
}

#[event]
pub struct GuaranteeChanged {
    pub circle: Pubkey,
    pub guarantor: Pubkey,
    pub beneficiary: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Redeemed {
    pub circle: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct MemberLeft {
    pub circle: Pubkey,
    pub owner: Pubkey,
    pub covered_debt: u64,
    pub forfeited: u64,
    pub refunded: u64,
}

#[event]
pub struct MemberDefaulted {
    pub circle: Pubkey,
    pub owner: Pubkey,
    pub debt: u64,
    pub from_deposit: u64,
    pub from_guarantors: u64,
    pub unbacked: u64,
}

#[event]
pub struct MemberInvited {
    pub circle: Pubkey,
    pub inviter: Pubkey,
    pub invitee: Pubkey,
}

#[event]
pub struct InviteRevoked {
    pub circle: Pubkey,
    pub inviter: Pubkey,
    pub invitee: Pubkey,
}
