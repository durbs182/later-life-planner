# Azure Key Vault instructions for Codex auth

Run these steps via Claude-Code using subscription `81c7ddc0-db49-4fb3-809c-776e3756f2ea`. The goal is to create a vault that stores the existing `auth.json` credentials (secret name `codex-auth-json`) and grant the CI/CD principal access so both the auto-fix and refresh workflows can read/write the secret.

1. **Create a resource group**
   - Name suggestion: `codex-auth-rg` (or similar) in your preferred region.
   - Command: `az group create --name codex-auth-rg --location eastus --subscription 81c7ddc0-db49-4fb3-809c-776e3756f2ea`
2. **Create the Key Vault**
   - Name must be globally unique (e.g., `codex-auth-vault-<random>`).
   - Example: `az keyvault create --name codex-auth-vault-123 --resource-group codex-auth-rg --subscription ... --location eastus --sku standard`
3. **Store the current `auth.json`** (obtain the file from the repository or previous run).
   - Upload it as the secret `codex-auth-json`:
     ```
     az keyvault secret set --vault-name <vault-name> --name codex-auth-json --value "$(cat auth.json)"
     ```
4. **Grant the existing CI/CD service principal access** (the `AZURE_CREDENTIALS_CODEX_KV` secret used by the Codex workflows).
   - Use `az keyvault set-policy` with `--spn <AZURE_CLIENT_ID>` (or the principal id) to grant `get`/`list`/`set` on secrets.
   - Example: `az keyvault set-policy --name <vault-name> --spn ${{ secrets.AZURE_CLIENT_ID }} --secret-permissions get list set`
5. **Record the vault name**
   - Return the final vault name back to me so I can set `AZURE_KEYVAULT_NAME` as a GitHub secret.

Once Claude-Code completes these steps, share the vault name so I can reference it in the workflows. No further repository changes are needed for the vault itself.
