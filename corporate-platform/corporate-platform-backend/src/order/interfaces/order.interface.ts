export interface IOrderItem {
    id: string;
    orderId: string;
    creditId: string;
    creditName: string;
    projectName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    vintage?: number;
    verificationStandard?: string;
}

export interface IOrderStatusEvent {
    id: string;
    orderId: string;
    status: string;
    message?: string;
    createdAt: Date;
}

export interface IOrder {
    id: string;
    orderNumber: string;
    companyId: string;
    userId: string;
    status: string;
    subtotal: number;
    serviceFee: number;
    total: number;
    paymentMethod?: string;
    transactionHash?: string;
    paidAt?: Date;
    createdAt: Date;
    completedAt?: Date;
    items?: IOrderItem[];
    statusEvents?: IOrderStatusEvent[];
}

export interface IPaginatedOrders {
    data: IOrder[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface IOrderStats {
    totalSpent: number;
    orderCount: number;
    avgOrderValue: number;
}

export type OrderStatus =
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'refunded';
