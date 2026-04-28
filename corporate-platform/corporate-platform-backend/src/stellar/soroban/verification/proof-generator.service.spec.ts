import { ProofGeneratorService } from './proof-generator.service';

describe('ProofGeneratorService', () => {
  let service: ProofGeneratorService;

  beforeEach(() => {
    service = new ProofGeneratorService();
  });

  it('builds a deterministic leaf hash', () => {
    const leafA = service.generateRetirementLeaf({
      txHash: 'abc',
      tokenIds: [3, 1, 2],
      amount: 120,
      blockNumber: 90,
    });

    const leafB = service.generateRetirementLeaf({
      txHash: 'abc',
      tokenIds: [1, 2, 3],
      amount: 120,
      blockNumber: 90,
    });

    expect(leafA).toEqual(leafB);
  });

  it('creates and validates a merkle proof', () => {
    const leaves = ['a', 'b', 'c', 'd'].map((item) =>
      service.generateRetirementLeaf({
        txHash: item,
        tokenIds: [1],
        amount: 1,
        blockNumber: 1,
      }),
    );

    const targetLeaf = leaves[2];
    const { root, proof } = service.generateProof(leaves, targetLeaf);

    expect(root).toBeTruthy();
    expect(proof.length).toBeGreaterThan(0);
    expect(service.verifyProof(targetLeaf, root, proof)).toBe(true);
  });
});
