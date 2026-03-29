import { Injectable, Logger } from '@nestjs/common';
import { TransferService } from '../../stellar/transfer.service';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class PostPurchaseService {
  private readonly logger = new Logger(PostPurchaseService.name);

  constructor(
    private readonly transferService: TransferService,
    private readonly prisma: PrismaService,
  ) {}

  async handleOrderCompleted(orderId: string) {
    try {
      this.logger.log(`Processing post-purchase for order: ${orderId}`);

      const prisma = this.prisma as any;
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: { credit: true },
          },
        },
      });

      if (!order) {
        this.logger.error(`Order ${orderId} not found`);
        return;
      }

      // Group credits by project or iterate through items
      for (const item of order.items) {
        // Trigger transfer for each item
        const dto = {
          purchaseId: `${orderId}-${item.id}`, // specific to item
          companyId: order.companyId,
          projectId: item.credit.projectId || 'unknown_project',
          amount: item.quantity,
          contractId:
            'CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM', // Carbon Asset Contract
          fromAddress: 'GB_PROJECT_PROXY', // In real system, derived from project
          toAddress: 'GB_COMPANY_PROXY', // In real system, derived from company
        };

        await this.transferService.initiateTransfer(dto);
      }

      this.logger.log(`Post-purchase transfer initiated for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `Error in post-purchase processing for order ${orderId}`,
        error,
      );
    }
  }
}
