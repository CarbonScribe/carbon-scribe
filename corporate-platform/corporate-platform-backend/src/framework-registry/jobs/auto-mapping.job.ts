import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/database/prisma.service';
import { MethodologyMappingService } from '../services/methodology-mapping.service';

@Injectable()
export class AutoMappingJob {
  private readonly logger = new Logger(AutoMappingJob.name);

  constructor(
    private prisma: PrismaService,
    private mappingService: MethodologyMappingService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoMapping() {
    this.logger.log('Starting auto-mapping job for new methodologies...');

    try {
      // Find methodologies that have no active mappings
      const unmappedMethodologies =
        await this.prisma.syncedMethodology.findMany({
          where: {
            mappings: {
              none: {
                isActive: true,
              },
            },
          },
        });

      this.logger.log(
        `Found ${unmappedMethodologies.length} unmapped methodologies.`,
      );

      for (const methodology of unmappedMethodologies) {
        try {
          const mappings = await this.mappingService.autoMapMethodology(
            methodology.id,
            'system-job',
          );
          if (mappings.length > 0) {
            this.logger.log(
              `Auto-mapped methodology ${methodology.name} (${methodology.id}) to ${mappings.length} frameworks.`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to auto-map methodology ${methodology.id}: ${error.message}`,
          );
        }
      }

      this.logger.log('Auto-mapping job completed.');
    } catch (error) {
      this.logger.error(`Auto-mapping job failed: ${error.message}`);
    }
  }
}
