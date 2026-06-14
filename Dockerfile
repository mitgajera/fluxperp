# Always-on worker that runs the FluxPerp data services (publisher + market-maker + keeper).
# Deploy to Railway / Render / Fly. Set WALLET_SECRET (deployer keypair JSON array) in the
# host's environment. The Next.js frontend deploys separately on Vercel (root dir = app/).
FROM node:20-slim

WORKDIR /app

# install deps (incl. ts-node/typescript) using the root manifest
COPY package*.json ./
RUN npm install --no-audit --no-fund

# bring in the services + the committed Anchor IDL/types they import
COPY scripts ./scripts
COPY target/idl ./target/idl
COPY target/types ./target/types
COPY tsconfig.json ./tsconfig.json

# WALLET_SECRET (JSON array) is read at runtime; ER_RPC/SOLANA_L1_RPC have devnet defaults
CMD ["npx", "ts-node", "scripts/services.ts"]
