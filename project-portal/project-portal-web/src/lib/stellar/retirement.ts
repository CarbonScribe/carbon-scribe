export const getStellarExpertTxUrl = (transactionHash: string, network: 'testnet' | 'public' = 'public'): string => {
  const networkPath = network === 'testnet' ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${networkPath}/tx/${transactionHash}`;
};

export const getStellarExpertAccountUrl = (accountId: string, network: 'testnet' | 'public' = 'public'): string => {
  const networkPath = network === 'testnet' ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${networkPath}/account/${accountId}`;
};
