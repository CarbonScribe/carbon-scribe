import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

interface MerkleSibling {
  position: 'left' | 'right';
  hash: string;
}

@Injectable()
export class ProofGeneratorService {
  generateRetirementLeaf(input: {
    txHash: string;
    tokenIds: number[];
    amount: number;
    blockNumber: number;
  }) {
    const payload = JSON.stringify({
      txHash: input.txHash,
      tokenIds: [...input.tokenIds].sort((a, b) => a - b),
      amount: input.amount,
      blockNumber: input.blockNumber,
    });

    return this.sha256(payload);
  }

  generateProof(leaves: string[], targetLeaf: string) {
    if (leaves.length === 0) {
      return {
        root: '',
        proof: [] as MerkleSibling[],
      };
    }

    const normalizedLeaves = leaves.map((leaf) => leaf.toLowerCase());
    const target = targetLeaf.toLowerCase();
    const targetIndex = normalizedLeaves.indexOf(target);

    if (targetIndex === -1) {
      throw new Error('Target leaf is not part of the tree');
    }

    let index = targetIndex;
    let level = [...normalizedLeaves];
    const proof: MerkleSibling[] = [];

    while (level.length > 1) {
      if (level.length % 2 === 1) {
        level.push(level[level.length - 1]);
      }

      const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
      proof.push({
        position: index % 2 === 0 ? 'right' : 'left',
        hash: level[siblingIndex],
      });

      const nextLevel: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        nextLevel.push(this.sha256(`${level[i]}:${level[i + 1]}`));
      }

      index = Math.floor(index / 2);
      level = nextLevel;
    }

    return {
      root: level[0],
      proof,
    };
  }

  verifyProof(targetLeaf: string, root: string, proof: MerkleSibling[]) {
    let computed = targetLeaf.toLowerCase();

    for (const step of proof) {
      if (step.position === 'left') {
        computed = this.sha256(`${step.hash.toLowerCase()}:${computed}`);
      } else {
        computed = this.sha256(`${computed}:${step.hash.toLowerCase()}`);
      }
    }

    return computed === root.toLowerCase();
  }

  private sha256(input: string) {
    return createHash('sha256').update(input).digest('hex');
  }
}
