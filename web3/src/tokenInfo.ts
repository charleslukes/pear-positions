import {
  DEFAULT_MAX_USDG_AMOUNT,
  TOKENS,
  USDG_ADDRESS,
  USD_DECIMALS,
  address,
  serverUrl,
} from "../utils/constants";
import { abiAndContractMapper } from "../utils/init";
import { InfoTokens, TokenInfo } from "../types";
import { expandDecimals } from "../utils/numbers";
import { getSpread, instantiateContract } from "../utils/helpers";

export const tokenInfo = async (account: string) => {
  const tokenAddresses = Object.values(address.tokens);
  const vaultReaderAddress = address.contracts.VAULT_READER;
  const vaultAddress = address.contracts.GMX_VAULT;
  const positionRouterAddress = address.contracts.GMX_POSITION_ROUTER;
  const nativeTokenAddress = address.tokens.ETH;
  const whitelistedTokensAddresses = TOKENS.arbitrum
    .filter((data) => tokenAddresses.includes(data.address))
    .map((data) => data.address);

  const vaultReaderContract = instantiateContract(
    vaultReaderAddress,
    abiAndContractMapper.vaultReader.abi
  );

  const vaultTokenInfo = await vaultReaderContract.getVaultTokenInfoV4(
    vaultAddress,
    positionRouterAddress,
    nativeTokenAddress,
    expandDecimals(1, 18),
    whitelistedTokensAddresses
  );

  const indexPricesResponse = await fetch(`${serverUrl}/prices`);
  const indexPrices = await indexPricesResponse.json();

  const readerContract = instantiateContract(
    address.contracts.GMX_READER,
    abiAndContractMapper.reader.abi
  );

  const tokenBalances = await readerContract.getTokenBalances(
    account,
    tokenAddresses
  );

  const fundingRateInfo = await readerContract.getFundingRates(
    vaultAddress,
    nativeTokenAddress,
    tokenAddresses
  );

  const tokensInfo = TOKENS.arbitrum.filter((data) =>
    tokenAddresses.includes(data.address)
  );

  return {
    tokensInfo,
    tokenBalances,
    vaultTokenInfo,
    fundingRateInfo,
    indexPrices,
    nativeTokenAddress,
    whitelistedTokensAddresses,
  };
};

export const getDetailedTokenInfos = async (account: string) => {
  const {
    tokensInfo,
    tokenBalances,
    fundingRateInfo,
    vaultTokenInfo,
    whitelistedTokensAddresses,
  } = await tokenInfo(account);

  const vaultLength = 15;
  const fundingRatePropsLength = 2;
  const infoTokens: InfoTokens = {};
  const whitelistedTokens = TOKENS.arbitrum.filter((data) =>
    whitelistedTokensAddresses.includes(data.address)
  );

  for (let i = 0; i < tokensInfo.length; i++) {
    const token: any = JSON.parse(JSON.stringify(tokensInfo[i])) as TokenInfo;

    if (tokenBalances) {
      token.balance = tokenBalances[i];
    }

    if (token.address === USDG_ADDRESS) {
      token.minPrice = expandDecimals(1, USD_DECIMALS);
      token.maxPrice = expandDecimals(1, USD_DECIMALS);
    }

    infoTokens[token.address] = token;
  }

  for (let i = 0; i < whitelistedTokens.length; i++) {
    const token = JSON.parse(JSON.stringify(whitelistedTokens[i])) as TokenInfo;

    if (vaultTokenInfo) {
      token.poolAmount = vaultTokenInfo[i * vaultLength];
      token.reservedAmount = vaultTokenInfo[i * vaultLength + 1];
      token.availableAmount = token.poolAmount! - token.reservedAmount!;
      token.usdgAmount = vaultTokenInfo[i * vaultLength + 2];
      token.redemptionAmount = vaultTokenInfo[i * vaultLength + 3];
      token.weight = vaultTokenInfo[i * vaultLength + 4];
      token.bufferAmount = vaultTokenInfo[i * vaultLength + 5];
      token.maxUsdgAmount = vaultTokenInfo[i * vaultLength + 6];
      token.globalShortSize = vaultTokenInfo[i * vaultLength + 7];
      token.maxGlobalShortSize = vaultTokenInfo[i * vaultLength + 8];
      token.maxGlobalLongSize = vaultTokenInfo[i * vaultLength + 9];
      token.minPrice = vaultTokenInfo[i * vaultLength + 10];
      token.maxPrice = vaultTokenInfo[i * vaultLength + 11];
      token.spread = getSpread({
        minPrice: token.minPrice!,
        maxPrice: token.maxPrice!,
      });
      token.guaranteedUsd = vaultTokenInfo[i * vaultLength + 12];
      token.maxPrimaryPrice = vaultTokenInfo[i * vaultLength + 13];
      token.minPrimaryPrice = vaultTokenInfo[i * vaultLength + 14];

      // save minPrice and maxPrice as setTokenUsingIndexPrices may override it
      token.contractMinPrice = token.minPrice;
      token.contractMaxPrice = token.maxPrice;

      token.maxAvailableShort = BigInt(0);

      token.hasMaxAvailableShort = false;
      if (token.maxGlobalShortSize! > 0) {
        token.hasMaxAvailableShort = true;
        if (token.maxGlobalShortSize! > token.globalShortSize!) {
          token.maxAvailableShort =
            token.maxGlobalShortSize! - token.globalShortSize!;
        }
      }

      if (token.maxUsdgAmount && token.maxUsdgAmount === BigInt(0)) {
        token.maxUsdgAmount = DEFAULT_MAX_USDG_AMOUNT;
      }

      token.availableUsd = token.isStable
        ? BigInt(token.poolAmount! * token.minPrice!) /
          expandDecimals(1, token.decimals)
        : BigInt(token.availableAmount * token.minPrice!) /
          expandDecimals(1, token.decimals);

      token.maxAvailableLong = BigInt(0)!;
      token.hasMaxAvailableLong = false;
      if (token.maxGlobalLongSize! > 0) {
        token.hasMaxAvailableLong = true;

        if (token.maxGlobalLongSize! > token.guaranteedUsd!) {
          const remainingLongSize =
            token.maxGlobalLongSize! - token.guaranteedUsd!;
          token.maxAvailableLong =
            remainingLongSize < token.availableUsd
              ? remainingLongSize
              : token.availableUsd;
        }
      } else {
        token.maxAvailableLong = token.availableUsd;
      }

      token.maxLongCapacity =
        token.maxGlobalLongSize! > 0 &&
        token.maxGlobalLongSize! < token.availableUsd + token.guaranteedUsd!
          ? token.maxGlobalLongSize
          : token.availableUsd + token.guaranteedUsd!;

      token.managedUsd = token.availableUsd + token.guaranteedUsd!;
      token.managedAmount =
        (token.managedUsd * expandDecimals(1, token.decimals)) /
        token.minPrice!;
    }

    if (fundingRateInfo) {
      token.fundingRate = fundingRateInfo[i * fundingRatePropsLength];
      token.cumulativeFundingRate =
        fundingRateInfo[i * fundingRatePropsLength + 1];
    }

    if (infoTokens[token.address]) {
      token.balance = infoTokens[token.address].balance;
    }

    infoTokens[token.address] = token;
  }

  return infoTokens;
};
