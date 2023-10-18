import { ethers } from "ethers";
import {
  AddressZero,
  BASIS_POINTS_DIVISOR,
  FUNDING_RATE_PRECISION,
  MARGIN_FEE_BASIS_POINTS,
  TOKENS,
  USD_DECIMALS,
  address,
  arbitrum_rpc,
} from "./constants";
import { InfoTokens, Token } from "../types";
import { expandDecimals, formatAmount } from "./numbers";

export const instantiateContract = (
  contractAddress: string,
  contractAbi: any
) => {
  const provider = new ethers.JsonRpcProvider(arbitrum_rpc);
  const contract = new ethers.Contract(contractAddress, contractAbi, provider);

  return contract;
};

export const isAddressValid = (account: string) => {
  return ethers.isAddress(account);
};

export const getTokenAddress = (token: Token) => {
  if (token.address === AddressZero) {
    return address.tokens.ETH;
  }
  return token.address;
};

export function getSpread(p: { minPrice: bigint; maxPrice: bigint }): bigint {
  const diff = p.maxPrice - p.minPrice;
  const divisor: bigint = BigInt(2);
  return (diff * expandDecimals(1, 30)) / ((p.maxPrice + p.minPrice) / divisor);
}

export function getDeltaStr({
  delta,
  deltaPercentage,
  hasProfit,
}: {
  delta: bigint;
  deltaPercentage: bigint;
  hasProfit: boolean;
}) {
  let deltaStr;
  let deltaPercentageStr;

  if (delta > 0) {
    deltaStr = hasProfit ? "+" : "-";
    deltaPercentageStr = hasProfit ? "+" : "-";
  } else {
    deltaStr = "";
    deltaPercentageStr = "";
  }
  deltaStr += `$${formatAmount(delta, USD_DECIMALS, 2, true)}`;
  deltaPercentageStr += `${formatAmount(deltaPercentage, 2, 2)}%`;

  return { deltaStr, deltaPercentageStr };
}

export function getLeverageStr(leverage: bigint | undefined) {
  if (leverage) {
    if (leverage < 0) {
      return "> 100x";
    }
    return `${formatAmount(leverage, 4, 2, true)}x`;
  }
}

export function getFundingFee(data: {
  size: bigint;
  entryFundingRate?: bigint;
  cumulativeFundingRate?: bigint;
}) {
  let { entryFundingRate, cumulativeFundingRate, size } = data;

  if (entryFundingRate && cumulativeFundingRate) {
    return (
      (size * cumulativeFundingRate - entryFundingRate) /
      BigInt(FUNDING_RATE_PRECISION)
    );
  }

  return;
}

export function getPositionKeyWithAdapter(
  account: string,
  collateralTokenAddress: string,
  indexTokenAddress: string,
  adapter: string,
  isLong: boolean,
  nativeTokenAddress?: string
) {
  const tokenAddress0 =
    collateralTokenAddress === AddressZero
      ? nativeTokenAddress
      : collateralTokenAddress;
  const tokenAddress1 =
    indexTokenAddress === AddressZero ? nativeTokenAddress : indexTokenAddress;
  return (
    account +
    ":" +
    adapter +
    ":" +
    tokenAddress0 +
    ":" +
    tokenAddress1 +
    ":" +
    isLong
  );
}

export function getLeverage({
  size,
  sizeDelta,
  increaseSize,
  collateral,
  collateralDelta,
  increaseCollateral,
  entryFundingRate,
  cumulativeFundingRate,
  hasProfit,
  delta,
  includeDelta,
}: {
  size: bigint;
  sizeDelta?: bigint;
  increaseSize?: boolean;
  collateral: bigint;
  collateralDelta?: bigint;
  increaseCollateral?: boolean;
  entryFundingRate: bigint;
  cumulativeFundingRate?: bigint;
  hasProfit: boolean;
  delta: bigint;
  includeDelta: boolean;
}) {
  if (!size && !sizeDelta) {
    return;
  }
  if (!collateral && !collateralDelta) {
    return;
  }

  let nextSize = size ? size : BigInt(0);
  if (sizeDelta) {
    if (increaseSize) {
      nextSize = size + sizeDelta;
    } else {
      if (sizeDelta >= size) {
        return;
      }
      nextSize = size - sizeDelta;
    }
  }

  let remainingCollateral = collateral ? collateral : BigInt(0);
  if (collateralDelta) {
    if (increaseCollateral) {
      remainingCollateral = collateral + collateralDelta;
    } else {
      if (collateralDelta >= collateral) {
        return;
      }
      remainingCollateral = collateral - collateralDelta;
    }
  }

  if (delta && includeDelta) {
    if (hasProfit) {
      remainingCollateral = remainingCollateral + delta;
    } else {
      if (delta > remainingCollateral) {
        return;
      }

      remainingCollateral = remainingCollateral - delta;
    }
  }

  if (remainingCollateral === BigInt(0)) {
    return;
  }

  remainingCollateral = sizeDelta
    ? (remainingCollateral *
        BigInt(BASIS_POINTS_DIVISOR - MARGIN_FEE_BASIS_POINTS)) /
      BigInt(BASIS_POINTS_DIVISOR)
    : remainingCollateral;
  if (entryFundingRate && cumulativeFundingRate) {
    const fundingFee =
      (size * (cumulativeFundingRate - entryFundingRate)) /
      BigInt(FUNDING_RATE_PRECISION);
    remainingCollateral = remainingCollateral - fundingFee;
  }

  return (nextSize * BigInt(BASIS_POINTS_DIVISOR)) / remainingCollateral;
}

export function getTokenInfo(
  infoTokens: InfoTokens,
  tokenAddress: string,
  replaceNative?: boolean,
  nativeTokenAddress?: string
) {
  if (replaceNative && tokenAddress === nativeTokenAddress) {
    return infoTokens[AddressZero];
  }

  return infoTokens[tokenAddress];
}

export function getPositionContractKey(
  account: string,
  collateralToken: string,
  indexToken: string,
  isLong: boolean
) {
  return ethers.solidityPackedKeccak256(
    ["address", "address", "address", "bool"],
    [account, collateralToken, indexToken, isLong]
  );
}

export function getPositionQuery(tokens: Token[]) {
  const collateralTokens = [];
  const indexTokens = [];
  const isLong = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.isStable) {
      continue;
    }
    if (token.isWrapped) {
      continue;
    }
    collateralTokens.push(getTokenAddress(token));
    indexTokens.push(getTokenAddress(token));
    isLong.push(true);
  }

  for (let i = 0; i < tokens.length; i++) {
    const stableToken = tokens[i];
    if (!stableToken.isStable) {
      continue;
    }

    for (let j = 0; j < tokens.length; j++) {
      const token = tokens[j];
      if (token.isStable) {
        continue;
      }
      if (token.isWrapped) {
        continue;
      }
      collateralTokens.push(stableToken.address);
      indexTokens.push(getTokenAddress(token));
      isLong.push(false);
    }
  }

  return { collateralTokens, indexTokens, isLong };
}

export function getPositionKey(
  account: string,
  collateralTokenAddress: string,
  indexTokenAddress: string,
  isLong: boolean,
  nativeTokenAddress?: string
) {
  const tokenAddress0 =
    collateralTokenAddress === AddressZero
      ? nativeTokenAddress
      : collateralTokenAddress;
  const tokenAddress1 =
    indexTokenAddress === AddressZero ? nativeTokenAddress : indexTokenAddress;
  return account + ":" + tokenAddress0 + ":" + tokenAddress1 + ":" + isLong;
}

export function getValidWhitelistedTokensAndAddress() {
  const tokenAddresses = Object.values(address.tokens);
  const whitelistedTokensAddresses = TOKENS.arbitrum
    .filter((data) => tokenAddresses.includes(data.address))
    .map((data) => data.address);

  const whitelistedTokens = TOKENS.arbitrum.filter((data) =>
    whitelistedTokensAddresses.includes(data.address)
  );

  return {
    tokenAddresses,
    whitelistedTokensAddresses,
    whitelistedTokens,
  };
}
