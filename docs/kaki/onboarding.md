---
summary: "Prepare and validate Kaki's private household profile."
read_when:

- You are preparing a Kaki onboarding profile
- Onboarding rejects a field or SecretRef
  title: "Onboard a household"

---

Kaki onboarding collects household structure and references to secrets in one validated transaction. It writes only non-secret IDs into plugin configuration and encrypts the private profile with AES-256-GCM.

## Start from the shipped example

```bash
mkdir -p "$HOME/.config/kaki"
cp kaki/examples/onboarding-profile.example.json "$HOME/.config/kaki/profile.json"
chmod 600 "$HOME/.config/kaki/profile.json"
```

The example is deliberately non-secret. Replace every `replace-*` identifier and the sample household data before using it.

## Profile contract

| Field                           | Rule                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `config`                        | Eleven non-empty reference IDs plus one supported locale. IDs are at most 128 characters.                       |
| `householdName`, `operatorName` | Required household and operator display names.                                                                  |
| `members`                       | 1–100 entries. The `operatorPersonId` must match a member `id`.                                                 |
| `addresses`                     | 1–32 entries. Labels are `home`, `office`, or `school`; confirm coordinates and postal data yourself.           |
| `approvalAutoCap`               | Non-negative amount used by the implemented payment policy. Start low.                                          |
| `approvalCurrency`              | Use `SGD` for the currently wired below-cap known-payee policy.                                                 |
| `monthlyModelBudgetUsd`         | Recorded budget value; it is not yet enforced across model execution.                                           |
| `monitorSessionKey`             | Session that receives the scheduled monitor announcement turns.                                                 |
| `secretRefs`                    | Exactly five resolvable references: `householdMemoryKey`, `model`, `ltaDataMall`, `oneMap`, and `phonePairing`. |

Supported locale codes are `sg`, `my`, `id`, `th`, `vn`, `ph`, `mm`, and `kh`. All monitor schedules currently use `Asia/Singapore`; Myanmar and Cambodia packs are conservative stubs.

### Member fields

Each member has:

- `id`, `name`, and `relation`
- `languages`: preferred languages
- `register`: tone or language register
- `dietary`: confirmed dietary notes
- `commute`: confirmed commute notes

Do not infer household facts from private messages without confirmation.

### Address fields

Each address has `id`, `label`, `oneMapSearchValue`, `postalCode`, `latitude`, and `longitude`. Treat a search result as a candidate: the operator must confirm the address and its role.

## SecretRefs

A SecretRef has this exact shape:

```json
{ "source": "env", "provider": "default", "id": "KAKI_MODEL_KEY" }
```

Supported sources are `env`, `file`, `exec`, and `store`. Every reference must resolve during onboarding. The household memory key must resolve to 32 random bytes encoded as unpadded base64url.

<Warning>
A SecretRef points to a secret; it is not the secret. Never place provider keys, pairing secrets, OTPs, bank credentials, or Singpass credentials directly in the profile or plugin config.
</Warning>

For environment-backed references, export values in the shell that launches onboarding:

```bash
export KAKI_MEMORY_KEY="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n')"
export KAKI_MODEL_KEY='<model credential>'
export KAKI_LTA_KEY='<LTA credential or evaluation placeholder>'
export KAKI_ONEMAP_KEY='<OneMap credential or evaluation placeholder>'
export KAKI_PHONE_KEY='<phone pairing secret or evaluation placeholder>'
```

## Run the transaction

```bash
kaki onboard --classic --install-daemon \
  --kaki-profile "$HOME/.config/kaki/profile.json"
```

Kaki temporarily disables the plugin, runs OpenClaw onboarding, adds `SOUL.md` and the maintained skills without overwriting existing destination files, provisions the private profile, and enables the plugin with non-secret references. Restart the Gateway afterward.

If any required field or secret cannot be validated, onboarding must remain incomplete. Correct the named field and rerun the same command; do not use a reset as a general troubleshooting step.

## Channel choices

The default Kaki flow narrows setup to:

- WhatsApp account `assistant`
- Telegram account `control`

Use `--enable-extra-channels` to restore the full OpenClaw picker, or `--skip-channels` to defer channel work. Channel credentials, QR login, allowlists, provider availability, and account terms require operator verification; repository tests cannot prove them.

## Verify the result

```bash
kaki gateway status
kaki status --deep
```

Then open the dashboard:

```bash
kaki dashboard
```

A healthy Gateway plus accessible authenticated Kaki tab proves the local runtime path. It does not prove WhatsApp, a physical Android phone, or external provider readiness. Track those separately as described in [Known limitations](/kaki/limitations).
