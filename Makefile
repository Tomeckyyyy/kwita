# Komendy projektu. Używaj ich zamiast gołego `anchor build` / `anchor test`:
# Anchor 1.2.0 domyślnie buduje SBPF v3, a z nim testy LiteSVM padają (InvalidAccountData).
ARCH        ?= v0
PROGRAM     := kwita
KEYPAIR_SRC := keys/$(PROGRAM)-program-keypair.json
KEYPAIR_DST := target/deploy/$(PROGRAM)-keypair.json
SO          := target/deploy/$(PROGRAM).so
DEVNET_RPC  ?= https://api.devnet.solana.com

.PHONY: check keypair build test idl localnet deploy-local deploy-devnet upgrade-devnet seed-local seed-devnet smoke-local app clean

check:            ## sprawdza wersje narzędzi
	./scripts/check-env.sh

keypair:          ## kopiuje wspólny keypair programu (stały Program ID dla całego zespołu)
	@mkdir -p target/deploy
	@cp -n $(KEYPAIR_SRC) $(KEYPAIR_DST) 2>/dev/null || true

build: keypair    ## kompiluje program
	anchor build --arch $(ARCH)

test: build       ## kompiluje i uruchamia testy (LiteSVM, bez walidatora)
	anchor test --skip-build

idl: build        ## kopiuje IDL i typy do frontu (commitować!)
	mkdir -p app/src/idl
	cp target/idl/$(PROGRAM).json app/src/idl/$(PROGRAM).json
	cp target/types/$(PROGRAM).ts app/src/idl/$(PROGRAM).ts

localnet:         ## lokalny walidator (osobny terminal), nie potrzebuje SOL
	solana-test-validator --reset --ledger test-ledger

deploy-local: build ## deploy na lokalny walidator (najpierw: make localnet)
	solana program deploy -ul $(SO) --program-id $(KEYPAIR_DST)

deploy-devnet: build ## deploy na devnet; max-len = rozmiar programu (oszczędza SOL)
	solana program deploy -ud $(SO) --program-id $(KEYPAIR_DST) --max-len $$(stat -c%s $(SO))

upgrade-devnet: build ## upgrade programu na devnecie; gdy program urósł: solana program extend -ud <PROGRAM_ID> 10240 (min. 10 KB)
	solana program deploy -ud $(SO) --program-id $(KEYPAIR_DST)

seed-local:       ## krąg demo na localnecie (PRESENTER=<adres Phantoma> opcjonalnie)
	cd app && RPC_URL=http://127.0.0.1:8899 CLUSTER=localnet npm run seed

seed-devnet:      ## krąg demo na devnecie (DEVNET_RPC=<URL Helius> omija limity publicznego RPC)
	cd app && RPC_URL='$(DEVNET_RPC)' CLUSTER=devnet npm run seed

smoke-local:      ## cały scenariusz demo przez bibliotekę klienta (localnet)
	cd app && RPC_URL=http://127.0.0.1:8899 CLUSTER=localnet npm run smoke

app:              ## front (http://localhost:5173)
	cd app && npm run dev

clean:
	anchor clean
