import { Injectable } from '@nestjs/common';
import { EmissionsCalculationInput, EmissionsCalculationResult } from '../interfaces/emissions-calculation.interface';
import { GoodsClassificationService } from './goods-classification.service';

@Injectable()
export class EmbeddedEmissionsService {
  constructor(
    private readonly goodsClassificationService: GoodsClassificationService,
  ) {}

  calculateEmbeddedEmissions(input: EmissionsCalculationInput): EmissionsCalculationResult {
    const { actualEmissions, quantity } = input;

    // If actual emissions are provided and valid, use them
    if (actualEmissions !== undefined && actualEmissions !== null && actualEmissions > 0) {
      return {
        actualEmissions,
        defaultEmissions: 0,
        totalEmissions: actualEmissions * quantity,
        calculationMethod: 'ACTUAL',
        unit: 'tCO2e',
        calculationDate: new Date().toISOString(),
      };
    }

    // Otherwise, use default values based on goods type
    return this.calculateWithDefaults(input);
  }

  private calculateWithDefaults(input: EmissionsCalculationInput): EmissionsCalculationResult {
    const { goodsId, quantity, countryOfOrigin } = input;

    // Get the good's default emission factor
    // In a real implementation, this would fetch from database
    const defaultFactor = this.getDefaultEmissionFactor(goodsId, countryOfOrigin);

    const defaultEmissions = defaultFactor * quantity;

    return {
      actualEmissions: null,
      defaultEmissions,
      totalEmissions: defaultEmissions,
      calculationMethod: 'DEFAULT',
      unit: 'tCO2e',
      calculationDate: new Date().toISOString(),
    };
  }

  private getDefaultEmissionFactor(goodsId: string, countryOfOrigin: string): number {
    // Default emission factors based on CBAM methodology
    // These would typically come from the database or configuration
    const baseFactors: Record<string, number> = {
      CEMENT: 0.94,
      IRON_STEEL: 1.85,
      ALUMINIUM: 8.5,
      FERTILIZERS: 2.2,
      ELECTRICITY: 0.4,
      HYDROGEN: 10.5,
    };

    // Country-specific adjustment factors (example values)
    const countryFactors: Record<string, number> = {
      CN: 1.2, // China - higher grid emission factor
      IN: 1.15, // India
      US: 0.9, // United States
      DE: 0.7, // Germany
      FR: 0.5, // France (nuclear-heavy grid)
      DEFAULT: 1.0,
    };

    const baseFactor = baseFactors[goodsId] || 1.0;
    const countryFactor = countryFactors[countryOfOrigin] || countryFactors.DEFAULT;

    return baseFactor * countryFactor;
  }

  calculateCertificateCost(emissions: number, certificatePrice?: number): number {
    // Default CBAM certificate price (would be fetched from EU registry)
    const defaultPrice = certificatePrice || 80; // EUR per tCO2e
    return emissions * defaultPrice;
  }

  validateInstallationId(installationId?: string): boolean {
    if (!installationId) {
      return false;
    }

    // EU installation ID format validation
    // Format: EU-XXX-YYYYYY (where XXX is country code, YYYYYY is numeric)
    const euInstallationPattern = /^EU-[A-Z]{2}-\d{6}$/;
    return euInstallationPattern.test(installationId);
  }
}
