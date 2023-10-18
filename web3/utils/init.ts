import { adapterABI } from "../abis/adapter";
import { readerABI } from "../abis/reader";
import { vaultABI } from "../abis/vault";
import { address, arbitrum_rpc } from "../utils/constants";
import { factoryABI } from "../abis/factory";
import { positionRouterABI } from "../abis/positionRouter";
import { vaultReaderABI } from "../abis/vaultReader";

export const abiAndContractMapper = {
  reader: {
    abi: readerABI,
    contract: address.contracts.GMX_READER,
  },
  vault: {
    abi: vaultABI,
    contract: address.contracts.GMX_VAULT,
  },
  factory: {
    abi: factoryABI,
    contract: address.contracts.GMX_FACTORY_ADDRESS,
  },
  position: {
    abi: positionRouterABI,
    contract: address.contracts.GMX_POSITION_ROUTER,
  },
  vaultReader: {
    abi: vaultReaderABI,
    contract: address.contracts.VAULT_READER,
  },
};

