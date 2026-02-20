import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { IOrderStatusEvent } from '../interfaces/order.interface';

export interface IOrderStatusResult {
    status: string;
    updatedAt: Date;
    events: IOrderStatusEvent[];
}

@Injectable()
export class TrackingService {
    constructor(private readonly prisma: PrismaService) { }

    async getOrderStatus(
        orderId: string,
        companyId: string,
    ): Promise<IOrderStatusResult | null> {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, companyId },
            include: {
                statusEvents: { orderBy: { createdAt: 'asc' } },
            },
        });

        if (!order) {
            return null;
        }

        const latestEvent = order.statusEvents[order.statusEvents.length - 1];

        return {
            status: order.status,
            updatedAt: latestEvent?.createdAt ?? order.createdAt,
            events: order.statusEvents as unknown as IOrderStatusEvent[],
        };
    }

    async addStatusEvent(
        orderId: string,
        status: string,
        message?: string,
    ): Promise<IOrderStatusEvent> {
        const event = await this.prisma.orderStatusEvent.create({
            data: {
                orderId,
                status,
                message,
            },
        });

        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status,
                ...(status === 'completed' ? { completedAt: new Date() } : {}),
            },
        });

        return event as unknown as IOrderStatusEvent;
    }

    async getStatusHistory(
        orderId: string,
    ): Promise<IOrderStatusEvent[]> {
        const events = await this.prisma.orderStatusEvent.findMany({
            where: { orderId },
            orderBy: { createdAt: 'asc' },
        });

        return events as unknown as IOrderStatusEvent[];
    }
}
