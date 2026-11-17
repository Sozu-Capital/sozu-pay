//! Disbursement wallet: holds a token (e.g. USDC) and allows authorized signers
//! to call `payout(recipient, amount)`. The transaction signer (invoker) must
//! be in the authorized signers list; the contract then transfers token from
//! its own balance to the recipient.
//!
//! The deployer is fixed as admin by the constructor, atomically with deployment,
//! so nobody can initialize a freshly deployed instance before the deployer does.

#![no_std]

use soroban_sdk::{contract, contractimpl, token, Address, Env, Vec};

#[contract]
pub struct DisbursementWallet;

mod keys {
    use soroban_sdk::{symbol_short, Symbol};
    pub(crate) fn admin_key() -> Symbol {
        symbol_short!("ADMIN")
    }
    pub(crate) fn token_key() -> Symbol {
        symbol_short!("TOKEN")
    }
    pub(crate) fn signers_key() -> Symbol {
        symbol_short!("SIGNERS")
    }
    pub(crate) fn max_payout_key() -> Symbol {
        symbol_short!("MAXPAY")
    }
}

#[contractimpl]
impl DisbursementWallet {
    /// Runs once, inside the deploy transaction. `admin` is the deployer.
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&keys::admin_key(), &admin);
    }

    /// Set the token, the authorized signers and the per-payout cap (in token base units).
    /// Succeeds once and requires the admin's auth.
    pub fn initialize(env: Env, token_addr: Address, signers: Vec<Address>, max_per_payout: i128) {
        let storage = env.storage().instance();
        if storage.has(&keys::token_key()) {
            panic!("Already initialized");
        }
        let admin: Address = storage.get(&keys::admin_key()).unwrap();
        admin.require_auth();
        if max_per_payout <= 0 {
            panic!("Invalid payout cap");
        }
        if signers.is_empty() {
            panic!("No signers");
        }
        storage.set(&keys::token_key(), &token_addr);
        storage.set(&keys::signers_key(), &signers);
        storage.set(&keys::max_payout_key(), &max_per_payout);
    }

    /// Add an authorized signer. Callable only by an existing signer.
    /// `caller` must be in signers and must have signed the tx (require_auth).
    pub fn add_signer(env: Env, caller: Address, new_signer: Address) {
        caller.require_auth();
        let signers: Vec<Address> = env.storage().instance().get(&keys::signers_key()).unwrap();
        if !signers.contains(caller) {
            panic!("Unauthorized");
        }
        if signers.contains(new_signer.clone()) {
            panic!("Already signer");
        }
        let mut updated = signers;
        updated.push_back(new_signer);
        env.storage().instance().set(&keys::signers_key(), &updated);
    }

    /// Transfer `amount` of the wallet's token to `recipient`.
    /// `caller` must be in the authorized signers list and must have signed the tx (require_auth).
    /// `amount` must be positive and at most the per-payout cap.
    pub fn payout(env: Env, caller: Address, recipient: Address, amount: i128) {
        caller.require_auth();
        let signers: Vec<Address> = env.storage().instance().get(&keys::signers_key()).unwrap();
        if !signers.contains(caller) {
            panic!("Unauthorized");
        }
        if amount <= 0 {
            panic!("Invalid amount");
        }
        let max_per_payout: i128 = env.storage().instance().get(&keys::max_payout_key()).unwrap();
        if amount > max_per_payout {
            panic!("Over payout cap");
        }

        let token_addr: Address = env.storage().instance().get(&keys::token_key()).unwrap();
        let contract = env.current_contract_address();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&contract, &recipient, &amount);
    }

    /// Return the token address (for display / verification).
    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&keys::token_key()).unwrap()
    }

    /// Return the per-payout cap in token base units.
    pub fn max_per_payout(env: Env) -> i128 {
        env.storage().instance().get(&keys::max_payout_key()).unwrap()
    }

    /// Return the admin (deployer) address.
    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&keys::admin_key()).unwrap()
    }

    /// Return whether the given address is an authorized signer.
    pub fn is_signer(env: Env, address: Address) -> bool {
        let signers: Vec<Address> = env.storage().instance().get(&keys::signers_key()).unwrap();
        signers.contains(address)
    }
}

#[cfg(test)]
mod test;
