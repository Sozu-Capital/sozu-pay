#![cfg(test)]
extern crate std;

use super::{DisbursementWallet, DisbursementWalletClient};
use soroban_sdk::testutils::{Address as _, MockAuth, MockAuthInvoke};
use soroban_sdk::{token, vec, Address, Env, IntoVal};

const CAP: i128 = 30_0000000;

struct Setup<'a> {
    env: Env,
    admin: Address,
    signer: Address,
    token: Address,
    client: DisbursementWalletClient<'a>,
}

fn setup() -> Setup<'static> {
    let env = Env::default();
    let admin = Address::generate(&env);
    let signer = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(token_admin).address();
    let contract_id = env.register(DisbursementWallet, (admin.clone(),));
    let client = DisbursementWalletClient::new(&env, &contract_id);
    Setup { env, admin, signer, token, client }
}

fn initialize_as_admin(s: &Setup) {
    s.env.mock_all_auths();
    s.client.initialize(&s.token, &vec![&s.env, s.signer.clone()], &CAP);
}

fn fund(s: &Setup, amount: i128) {
    s.env.mock_all_auths();
    token::StellarAssetClient::new(&s.env, &s.token).mint(&s.client.address, &amount);
}

#[test]
fn constructor_records_the_deployer_as_admin() {
    let s = setup();
    assert_eq!(s.client.admin(), s.admin);
}

#[test]
fn initialize_with_admin_auth_succeeds() {
    let s = setup();
    initialize_as_admin(&s);
    assert_eq!(s.env.auths()[0].0, s.admin);
    assert_eq!(s.client.token(), s.token);
    assert!(s.client.is_signer(&s.signer));
    assert_eq!(s.client.max_per_payout(), CAP);
}

#[test]
#[should_panic(expected = "Already initialized")]
fn second_initialize_panics() {
    let s = setup();
    initialize_as_admin(&s);
    let attacker = Address::generate(&s.env);
    s.client.initialize(&s.token, &vec![&s.env, attacker], &i128::MAX);
}

#[test]
#[should_panic(expected = "No signers")]
fn initialize_with_no_signers_panics() {
    let s = setup();
    s.env.mock_all_auths();
    s.client.initialize(&s.token, &vec![&s.env], &CAP);
}

#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
fn initialize_without_admin_auth_fails() {
    let s = setup();
    s.client.initialize(&s.token, &vec![&s.env, s.signer.clone()], &CAP);
}

#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
fn initialize_authorized_by_someone_else_fails() {
    let s = setup();
    let attacker = Address::generate(&s.env);
    let signers = vec![&s.env, attacker.clone()];
    s.client
        .mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &s.client.address,
                fn_name: "initialize",
                args: (s.token.clone(), signers.clone(), CAP).into_val(&s.env),
                sub_invokes: &[],
            },
        }])
        .initialize(&s.token, &signers, &CAP);
}

#[test]
#[should_panic(expected = "Invalid payout cap")]
fn initialize_rejects_non_positive_cap() {
    let s = setup();
    s.env.mock_all_auths();
    s.client.initialize(&s.token, &vec![&s.env, s.signer.clone()], &0);
}

#[test]
fn payout_at_the_cap_transfers() {
    let s = setup();
    initialize_as_admin(&s);
    fund(&s, 100_0000000);
    let recipient = Address::generate(&s.env);
    s.client.payout(&s.signer, &recipient, &CAP);
    let balance = token::Client::new(&s.env, &s.token);
    assert_eq!(balance.balance(&recipient), CAP);
    assert_eq!(balance.balance(&s.client.address), 100_0000000 - CAP);
}

#[test]
#[should_panic(expected = "Over payout cap")]
fn payout_over_the_cap_panics() {
    let s = setup();
    initialize_as_admin(&s);
    fund(&s, 100_0000000);
    s.client.payout(&s.signer, &Address::generate(&s.env), &(CAP + 1));
}

#[test]
#[should_panic(expected = "Invalid amount")]
fn payout_rejects_non_positive_amount() {
    let s = setup();
    initialize_as_admin(&s);
    s.client.payout(&s.signer, &Address::generate(&s.env), &-5);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn payout_from_non_signer_panics() {
    let s = setup();
    initialize_as_admin(&s);
    fund(&s, 100_0000000);
    let outsider = Address::generate(&s.env);
    s.client.payout(&outsider, &Address::generate(&s.env), &1);
}
