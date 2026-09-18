#!/usr/bin/env node
'use strict';
const { createPetServer } = require('./service.cjs');
(async () => {
  const port = Number(process.env.PET_SERVICE_PORT || process.env.PORT || 8799);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PET_SERVICE_PORT');
  const service = createPetServer();
  let address;
  try { address = await service.listen(port, process.env.PET_SERVICE_HOST || '127.0.0.1'); }
  catch (error) { await service.close(); throw error; }
  console.log(`Pet service listening on ${address.address}:${address.port}; generation requests are queued.`);
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; await service.close(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
