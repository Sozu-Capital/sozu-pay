// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Stellar Soroban Contracts ^0.7.2
#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env, MuxedAddress, String};
use stellar_access::ownable::{self as ownable, Ownable};
use stellar_macros::only_owner;
use stellar_tokens::fungible::{Base, FungibleToken};

#[contract]
pub struct Pizza;

#[contractimpl]
impl Pizza {
    pub fn __constructor(e: &Env, recipient: Address, owner: Address) {
        Base::set_metadata(
            e,
            0,
            String::from_str(e, "Pizza"),
            String::from_str(e, "PIZZA"),
        );
        Base::mint(e, &recipient, 20);
        ownable::set_owner(e, &owner);
    }

    #[only_owner]
    pub fn mint(e: &Env, account: Address, amount: i128) {
        Base::mint(e, &account, amount);
    }
}

#[contractimpl(contracttrait)]
impl FungibleToken for Pizza {
    type ContractType = Base;
}

#[contractimpl(contracttrait)]
impl Ownable for Pizza {}
