export type Token = {
  name: string;
  symbol: string;
  baseSymbol?: string;
  decimals: number;
  address: string;
  coingeckoUrl?: string;
  imageUrl?: string;

  isUsdg?: boolean;
  isNative?: boolean;
  isWrapped?: boolean;
  isShortable?: boolean;
  isStable?: boolean;
  isTempHidden?: boolean;
};

export type TokenInfo = Token & {
  hasMaxAvailableLong?: boolean;
  hasMaxAvailableShort?: boolean;

  usdgAmount?: bigint;
  maxUsdgAmount?: bigint;

  poolAmount?: bigint;
  bufferAmount?: bigint;
  managedAmount?: bigint;
  managedUsd?: bigint;
  availableAmount?: bigint;
  availableUsd?: bigint;
  guaranteedUsd?: bigint;
  redemptionAmount?: bigint;
  reservedAmount?: bigint;

  balance?: bigint;

  weight?: bigint;

  maxPrice?: bigint;
  maxPrimaryPrice?: bigint;

  minPrice?: bigint;
  minPrimaryPrice?: bigint;

  contractMaxPrice?: bigint;
  contractMinPrice?: bigint;

  spread?: bigint;

  cumulativeFundingRate?: bigint;
  fundingRate?: bigint;

  globalShortSize?: bigint;

  maxAvailableLong?: bigint;
  maxAvailableShort?: bigint;

  maxGlobalLongSize?: bigint;
  maxGlobalShortSize?: bigint;

  maxLongCapacity?: bigint;
};

export type InfoTokens = {
  [key: string]: TokenInfo;
};

export type Position = {
  positionId: string;
  contractKey: string;
  adapter: string;
  key: string;
  adapterKey: string;
  collateralToken: TokenInfo;
  indexToken: TokenInfo;
  isLong: boolean;
  size: bigint;
  collateral: bigint;
  averagePrice: bigint;
  entryFundingRate: bigint;
  hasRealisedProfit: bigint;
  realisedPnl: bigint;
  lastIncreasedTime: bigint;
  hasProfit: boolean;
  delta: bigint;
  fundingFee?: bigint;
  collateralAfterFee: bigint;
  closingFee: bigint;
  positionFee: bigint;
  totalFees: bigint;
  pendingDelta: bigint;
  hasLowCollateral?: Boolean;
  markPrice?: bigint;
  deltaPercentage?: bigint;
  deltaBeforeFeesStr?: String;
  deltaPercentageStr?: String;
  deltaStr?: String;
  hasProfitAfterFees?: Boolean;
  pendingDeltaAfterFees?: bigint;
  deltaPercentageAfterFees?: bigint;
  deltaAfterFeesStr?: String;
  deltaAfterFeesPercentageStr?: String;
  netValue?: bigint;
  leverage?: bigint;
  leverageStr?: String;
  cumulativeFundingRate?: bigint;
};
